import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import mysql from 'mysql2/promise'
import { config, allowSeedDefaultAdmin } from './env.js'
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
  comprehension TINYINT UNSIGNED NOT NULL DEFAULT 1      COMMENT '悟性(%), 上限100, 注册时随机生成',
  register_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  login_time    DATETIME        DEFAULT NULL             COMMENT '最近登录时间',
  last_sign_time DATETIME       DEFAULT NULL             COMMENT '上次每日签到时间',
  last_cultivate_time DATETIME  DEFAULT NULL             COMMENT '上次修炼时间(冷却用)',
  meditation_start_time DATETIME DEFAULT NULL            COMMENT '打坐开始时间(NULL=未打坐)',
  meditation_end_time DATETIME  DEFAULT NULL             COMMENT '打坐结束时间(到期后惰性结算并清空)',
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
  advance_exp            BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '晋级所需经验(即该境界圆满修为)',
  sign_in_min_percent    DECIMAL(4,2)    NOT NULL DEFAULT 1.00 COMMENT '每日签到奖励百分比区间下限(占圆满修为/道韵, 0.1~3)',
  sign_in_max_percent    DECIMAL(4,2)    NOT NULL DEFAULT 2.00 COMMENT '每日签到奖励百分比区间上限(占圆满修为/道韵, 0.1~3)',
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

// 建表语句：丹药表（一行一种丹药，id 来自数据文件 pills.json，如 pill_fanren_cultivation）
const CREATE_PILLS_TABLE = `
CREATE TABLE IF NOT EXISTS pills (
  id             VARCHAR(64)  NOT NULL              COMMENT '丹药ID(数据文件)',
  name           VARCHAR(64)  NOT NULL              COMMENT '丹药名',
  realm          VARCHAR(32)  NOT NULL DEFAULT ''   COMMENT '所属大境界',
  realm_rank     INT UNSIGNED NOT NULL DEFAULT 0    COMMENT '大境界序号',
  category       VARCHAR(32)  NOT NULL DEFAULT ''   COMMENT '类型标识(如 cultivation_gain)',
  category_name  VARCHAR(32)  NOT NULL DEFAULT ''   COMMENT '类型名称(如 修为丹)',
  effect_mode    VARCHAR(64)  NOT NULL DEFAULT ''   COMMENT '效果组合类型',
  default_target VARCHAR(16)  NOT NULL DEFAULT 'self' COMMENT '默认作用目标: self/enemy',
  note           VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '备注',
  PRIMARY KEY (id),
  KEY idx_realm_rank (realm_rank),
  KEY idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='丹药表';
`

// 建表语句：丹药品质表（每种丹药 凡/灵/道 三档，效果列表存 JSON）
const CREATE_PILL_GRADES_TABLE = `
CREATE TABLE IF NOT EXISTS pill_grades (
  pill_id    VARCHAR(64)  NOT NULL              COMMENT '丹药ID(pills.id)',
  grade      VARCHAR(8)   NOT NULL              COMMENT '品质: fan/ling/dao',
  grade_name VARCHAR(8)   NOT NULL DEFAULT ''   COMMENT '品质名: 凡/灵/道',
  item_name  VARCHAR(64)  NOT NULL DEFAULT ''   COMMENT '成品名(如 凡品凡人修为丹)',
  effects    JSON         NOT NULL              COMMENT '效果列表(target/type/value/duration/hours/polarity)',
  summary    VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '效果摘要',
  PRIMARY KEY (pill_id, grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='丹药品质表';
`

// 建表语句：修行日志表（记录玩家每次操作：注册/登录/签到/修炼等，前台首页「修行日志」展示）
const CREATE_PLAYER_LOGS_TABLE = `
CREATE TABLE IF NOT EXISTS player_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  user_id      BIGINT UNSIGNED NOT NULL              COMMENT '玩家ID(users.id)',
  type         VARCHAR(24)     NOT NULL DEFAULT ''   COMMENT '操作类型: register/login/logout/sign_in/cultivate...',
  content      VARCHAR(255)    NOT NULL              COMMENT '日志内容(叙事文本)',
  created_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
  PRIMARY KEY (id),
  KEY idx_user_time (user_id, created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='修行日志表';
`

// 建表语句：系统配置表（键值对，后台「系统配置列表」用；如签到功能开关等）
const CREATE_SYSTEM_CONFIGS_TABLE = `
CREATE TABLE IF NOT EXISTS system_configs (
  config_key   VARCHAR(64)  NOT NULL              COMMENT '配置键',
  config_value VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '配置值',
  label        VARCHAR(64)  NOT NULL DEFAULT ''   COMMENT '中文名称',
  description  VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '说明',
  value_type   VARCHAR(16)  NOT NULL DEFAULT 'text' COMMENT '值类型: bool/text/number',
  updated_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';
`

// 内置系统配置项（幂等：仅在键不存在时插入，不覆盖管理员已改的值）
const DEFAULT_SYSTEM_CONFIGS = [
  {
    key: 'sign_in_enabled',
    value: '1',
    label: '每日签到',
    description: '开启后玩家进入首页满24小时可签到领取修为；关闭则不再弹出签到。',
    valueType: 'bool',
  },
  {
    key: 'cultivate_cooldown_seconds',
    value: '60',
    label: '修炼间隔(秒)',
    description: '每次修炼后的调息冷却时长，单位秒。单次修炼收益为当前境界圆满修为(advance_exp)的5%。',
    valueType: 'number',
  },
  {
    key: 'meditation_gain_percent_per_hour',
    value: '30',
    label: '打坐每小时收益(%)',
    description: '打坐每小时获得的修为占当前境界圆满修为(advance_exp)的百分比；期满一次性结算并封顶到圆满。',
    valueType: 'number',
  },
]

async function seedSystemConfigs() {
  for (const c of DEFAULT_SYSTEM_CONFIGS) {
    await pool.query(
      `INSERT IGNORE INTO system_configs (config_key, config_value, label, description, value_type)
       VALUES (?, ?, ?, ?, ?)`,
      [c.key, c.value, c.label, c.description, c.valueType]
    )
  }
}

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

// 首次启动从数据文件导入丹药（幂等：表非空则跳过；数据文件顶层含 version/rules 等元信息，取 .pills）
async function seedPills() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM pills')
  if (rows[0].c > 0) return

  const raw = await readFile(join(__dirname, '../data/pills.json'), 'utf8')
  const pills = JSON.parse(raw).pills
  const pillValues = pills.map((p) => [
    p.id,
    p.name,
    p.realm || '',
    p.realmRank || 0,
    p.category || '',
    p.categoryName || '',
    p.effectMode || '',
    p.defaultTarget || 'self',
    p.notes || '',
  ])
  const gradeValues = pills.flatMap((p) =>
    (p.grades || []).map((g) => [
      p.id,
      g.grade,
      g.gradeName || '',
      g.itemName || '',
      JSON.stringify(g.effects || []),
      g.summary || '',
    ])
  )
  await pool.query(
    `INSERT INTO pills
      (id, name, realm, realm_rank, category, category_name, effect_mode, default_target, note)
     VALUES ?`,
    [pillValues]
  )
  await pool.query(
    `INSERT INTO pill_grades (pill_id, grade, grade_name, item_name, effects, summary) VALUES ?`,
    [gradeValues]
  )
  console.log(`已导入丹药数据 ${pills.length} 种（品质物品 ${gradeValues.length} 件）`)
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

// 幂等删列：列存在时删除（用于淘汰旧字段）
async function dropColumn(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.name, table, column]
  )
  if (rows[0].c > 0) {
    await pool.query(`ALTER TABLE ${table} DROP COLUMN ${column}`)
  }
}

// 首次启动生成默认管理员（作为 users 表中 role=1 的一行，幂等：已存在则跳过）
async function seedDefaultAdmin() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE role = 1')
  if (rows[0].c > 0) return

  // 生产环境未显式配置管理员口令时，不自动播种默认弱口令管理员
  if (!allowSeedDefaultAdmin) {
    console.warn(
      '⚠ 生产环境未配置 ADMIN_PASSWORD，已跳过默认管理员播种；请手动创建管理员账号。'
    )
    return
  }

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
  await pool.query(CREATE_PILLS_TABLE)
  await pool.query(CREATE_PILL_GRADES_TABLE)
  await pool.query(CREATE_PLAYER_LOGS_TABLE)
  await pool.query(CREATE_SYSTEM_CONFIGS_TABLE)

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
  await ensureColumn(
    'users',
    'comprehension',
    "comprehension TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '悟性(%), 上限100, 注册时随机生成' AFTER dao_law"
  )
  await ensureColumn(
    'users',
    'last_sign_time',
    "last_sign_time DATETIME DEFAULT NULL COMMENT '上次每日签到时间' AFTER login_time"
  )
  await ensureColumn(
    'users',
    'last_cultivate_time',
    "last_cultivate_time DATETIME DEFAULT NULL COMMENT '上次修炼时间(冷却用)' AFTER last_sign_time"
  )
  await ensureColumn(
    'users',
    'meditation_start_time',
    "meditation_start_time DATETIME DEFAULT NULL COMMENT '打坐开始时间(NULL=未打坐)' AFTER last_cultivate_time"
  )
  await ensureColumn(
    'users',
    'meditation_end_time',
    "meditation_end_time DATETIME DEFAULT NULL COMMENT '打坐结束时间(到期后惰性结算并清空)' AFTER meditation_start_time"
  )
  await ensureColumn(
    'realms',
    'sign_in_min_percent',
    "sign_in_min_percent DECIMAL(4,2) NOT NULL DEFAULT 1.00 COMMENT '每日签到奖励百分比区间下限(占圆满修为/道韵, 0.1~3)' AFTER advance_exp"
  )
  await ensureColumn(
    'realms',
    'sign_in_max_percent',
    "sign_in_max_percent DECIMAL(4,2) NOT NULL DEFAULT 2.00 COMMENT '每日签到奖励百分比区间上限(占圆满修为/道韵, 0.1~3)' AFTER sign_in_min_percent"
  )
  // 淘汰旧的单一百分比字段（早期版本）
  await dropColumn('realms', 'sign_in_percent')
  // 清理旧设计：管理员已并入 users 表
  await pool.query('DROP TABLE IF EXISTS admins')
  // 重启后在线态清零，避免残留（真实在线由登录/登出维护）
  await pool.query('UPDATE users SET is_online = 0')

  // 播种境界数据 + 丹药数据 + 默认管理员 + 系统配置
  await seedRealms()
  await seedPills()
  await seedDefaultAdmin()
  await seedSystemConfigs()

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
