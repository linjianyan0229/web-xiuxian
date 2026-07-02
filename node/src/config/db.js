import mysql from 'mysql2/promise'
import { config } from './env.js'
import { hashPassword } from '../utils/password.js'

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
  register_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  login_time    DATETIME        DEFAULT NULL             COMMENT '最近登录时间',
  access_token  VARCHAR(512)    DEFAULT NULL             COMMENT '登录令牌',
  PRIMARY KEY (id),
  UNIQUE KEY uk_dao_name (dao_name),
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
`

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

  // 建表 + 迁移（老库补 role 列）
  await pool.query(CREATE_USERS_TABLE)
  await ensureColumn(
    'users',
    'role',
    "role TINYINT NOT NULL DEFAULT 0 COMMENT '角色: 0=玩家, 1=管理员' AFTER email_code"
  )
  // 清理旧设计：管理员已并入 users 表
  await pool.query('DROP TABLE IF EXISTS admins')

  // 播种默认管理员
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
