import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import mysql from 'mysql2/promise'
import { config } from './env.js'
import { hashPassword } from '../utils/password.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool

// 建表语句：用户表（role 区分身份：0=玩家, 1=管理员）
const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  dao_name      VARCHAR(32)     NOT NULL                 COMMENT '道号',
  email         VARCHAR(128)    NOT NULL                 COMMENT '邮箱',
  password      VARCHAR(255)    NOT NULL                 COMMENT '密码(bcrypt哈希)',
  email_code    VARCHAR(16)     DEFAULT NULL             COMMENT '邮箱验证码',
  role          TINYINT         NOT NULL DEFAULT 0       COMMENT '角色: 0=玩家, 1=管理员',
  status        TINYINT         NOT NULL DEFAULT 1       COMMENT '状态: 0=禁用, 1=正常',
  realm_id      INT UNSIGNED    NOT NULL DEFAULT 1       COMMENT '当前境界(realms.id), 1=凡人',
  is_online     TINYINT         NOT NULL DEFAULT 0       COMMENT '是否在线: 0=离线, 1=在线',
  death_count   INT UNSIGNED    NOT NULL DEFAULT 0       COMMENT '死亡次数(突破失败等)',
  ling_shi      BIGINT UNSIGNED NOT NULL DEFAULT 0       COMMENT '灵石',
  cultivation   BIGINT UNSIGNED NOT NULL DEFAULT 0       COMMENT '修为',
  dao_yun       BIGINT UNSIGNED NOT NULL DEFAULT 0       COMMENT '道韵',
  dao_law       BIGINT UNSIGNED NOT NULL DEFAULT 0       COMMENT '道法领悟',
  register_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  login_time    DATETIME        DEFAULT NULL             COMMENT '最近登录时间',
  access_token  VARCHAR(512)    DEFAULT NULL             COMMENT '登录令牌',
  PRIMARY KEY (id),
  UNIQUE KEY uk_dao_name (dao_name),
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
`

// 建表语句：境界表（id 即境界序号, 1=凡人 ... 83=圣人, 数值来自数据文件, 非自增）
const CREATE_REALMS_TABLE = `
CREATE TABLE IF NOT EXISTS realms (
  id                     INT UNSIGNED    NOT NULL              COMMENT '境界ID(序号, 越大越高)',
  realm                  VARCHAR(32)     NOT NULL              COMMENT '大境界',
  stage                  VARCHAR(16)     NOT NULL DEFAULT ''   COMMENT '阶段(初期/中期/后期/圆满)',
  name                   VARCHAR(48)     NOT NULL              COMMENT '完整境界名',
  next_realm             VARCHAR(48)     NOT NULL DEFAULT ''   COMMENT '下一境界名',
  requirement_type       VARCHAR(32)     NOT NULL DEFAULT ''   COMMENT '晋级要求类型',
  advance_exp            BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '晋级所需经验',
  dao_yun_required       INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '晋级所需道韵',
  dao_law_required       INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '晋级所需道法领悟',
  tribulation_type       VARCHAR(32)     NOT NULL DEFAULT ''   COMMENT '雷劫类型',
  tribulation_death_rate DECIMAL(5,1)    NOT NULL DEFAULT 0.0  COMMENT '突破失败死亡率(%)',
  hp                     BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '气血',
  ling_qi                BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '灵气',
  attack                 BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '攻击',
  defense                BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '防御',
  spirit                 BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '神识',
  note                   VARCHAR(255)    NOT NULL DEFAULT ''   COMMENT '备注',
  PRIMARY KEY (id),
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='境界表';
`

// 首次启动从数据文件导入境界（幂等：表非空则跳过）
async function seedRealms() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM realms')
  if (rows[0].c > 0) return

  const raw = await readFile(join(__dirname, '../data/realms.json'), 'utf8')
  const data = JSON.parse(raw)
  const values = data.map((r) => [
    r.id,
    r.realm,
    r.stage || '',
    r.name,
    r.next_realm || '',
    r.requirement_type || '',
    r.advance_exp || 0,
    r.dao_yun_required || 0,
    r.dao_law_required || 0,
    r.tribulation_type || '',
    r.tribulation_death_rate_percent || 0,
    r.hp || 0,
    r.ling_qi || 0,
    r.attack || 0,
    r.defense || 0,
    r.spirit || 0,
    r.note || '',
  ])
  // 批量插入需用 query（execute 不支持嵌套数组批量插入）
  await pool.query(
    `INSERT INTO realms
      (id, realm, stage, name, next_realm, requirement_type, advance_exp,
       dao_yun_required, dao_law_required, tribulation_type, tribulation_death_rate,
       hp, ling_qi, attack, defense, spirit, note)
     VALUES ?`,
    [values]
  )
  console.log(`已导入境界数据 ${data.length} 条`)
}

// 幂等补列：老库已有 users 表但缺某列时补上（MySQL 不支持 ADD COLUMN IF NOT EXISTS）
async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.name, table, column]
  )
  if (rows[0].c === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
  }
}

// 首次启动生成默认管理员（作为 users 表中 role=1 的一行，幂等：已存在则跳过）
async function seedDefaultAdmin() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE role = 1')
  if (rows[0].c > 0) return

  const { defaultUsername, defaultPassword, defaultEmail } = config.admin
  const hashed = await hashPassword(defaultPassword)
  await pool.query(
    'INSERT INTO users (dao_name, email, password, role, status) VALUES (?, ?, ?, 1, 1)',
    [defaultUsername, defaultEmail, hashed]
  )
  console.log(
    `已生成默认管理员账号 -> 账号(道号): ${defaultUsername}  密码: ${defaultPassword}（请尽快修改）`
  )
}

// 启动时：连接 MySQL -> 创建数据库(库不存在则建) -> 创建连接池 -> 建表/迁移 -> 播种管理员
export async function initDatabase() {
  const { host, port, user, password, name } = config.db

  // 先用不带库名的连接创建数据库
  const bootstrap = await mysql.createConnection({ host, port, user, password })
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await bootstrap.end()

  // 创建指向该库的连接池
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: name,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  })

  // 建表
  await pool.query(CREATE_USERS_TABLE)
  await pool.query(CREATE_REALMS_TABLE)

  // 迁移（老库补列）
  await ensureColumn(
    'users',
    'role',
    "role TINYINT NOT NULL DEFAULT 0 COMMENT '角色: 0=玩家, 1=管理员' AFTER email_code"
  )
  await ensureColumn(
    'users',
    'realm_id',
    "realm_id INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '当前境界(realms.id), 1=凡人' AFTER status"
  )
  await ensureColumn(
    'users',
    'is_online',
    "is_online TINYINT NOT NULL DEFAULT 0 COMMENT '是否在线: 0=离线, 1=在线' AFTER realm_id"
  )
  await ensureColumn(
    'users',
    'death_count',
    "death_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '死亡次数(突破失败等)' AFTER is_online"
  )
  await ensureColumn(
    'users',
    'ling_shi',
    "ling_shi BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '灵石' AFTER death_count"
  )
  await ensureColumn(
    'users',
    'cultivation',
    "cultivation BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '修为' AFTER ling_shi"
  )
  await ensureColumn(
    'users',
    'dao_yun',
    "dao_yun BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '道韵' AFTER cultivation"
  )
  await ensureColumn(
    'users',
    'dao_law',
    "dao_law BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '道法领悟' AFTER dao_yun"
  )
  // 清理旧设计：管理员已并入 users 表
  await pool.query('DROP TABLE IF EXISTS admins')
  // 重启后在线态清零，避免残留（真实在线由登录/登出维护）
  await pool.query('UPDATE users SET is_online = 0')

  // 播种境界数据 + 默认管理员
  await seedRealms()
  await seedDefaultAdmin()

  console.log(`数据库已就绪: ${name} (${host}:${port})`)
  return pool
}

// 获取连接池（initDatabase 之后可用）
export function getPool() {
  if (!pool) throw new Error('数据库尚未初始化，请先调用 initDatabase()')
  return pool
}

// 便捷查询封装
export async function query(sql, params) {
  const [rows] = await getPool().execute(sql, params)
  return rows
}
