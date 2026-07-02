import mysql from 'mysql2/promise'
import { config } from './env.js'
import { hashPassword } from '../utils/password.js'

let pool

// 建表语句：用户表
const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  dao_name      VARCHAR(32)     NOT NULL                 COMMENT '道号',
  email         VARCHAR(128)    NOT NULL                 COMMENT '邮箱',
  password      VARCHAR(255)    NOT NULL                 COMMENT '密码(bcrypt哈希)',
  email_code    VARCHAR(16)     DEFAULT NULL             COMMENT '邮箱验证码',
  status        TINYINT         NOT NULL DEFAULT 1       COMMENT '状态: 0=禁用, 1=正常',
  register_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  login_time    DATETIME        DEFAULT NULL             COMMENT '最近登录时间',
  access_token  VARCHAR(512)    DEFAULT NULL             COMMENT '登录令牌',
  PRIMARY KEY (id),
  UNIQUE KEY uk_dao_name (dao_name),
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
`

// 建表语句：管理员表（后台管理，与游戏用户隔离）
const CREATE_ADMINS_TABLE = `
CREATE TABLE IF NOT EXISTS admins (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '管理员ID',
  username      VARCHAR(32)     NOT NULL                 COMMENT '登录账号',
  password      VARCHAR(255)    NOT NULL                 COMMENT '密码(bcrypt哈希)',
  nickname      VARCHAR(32)     DEFAULT NULL             COMMENT '昵称',
  status        TINYINT         NOT NULL DEFAULT 1       COMMENT '状态: 0=禁用, 1=正常',
  register_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  login_time    DATETIME        DEFAULT NULL             COMMENT '最近登录时间',
  access_token  VARCHAR(512)    DEFAULT NULL             COMMENT '登录令牌',
  PRIMARY KEY (id),
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';
`

// 首次启动时生成默认管理员账号（幂等：已存在则跳过）
async function seedDefaultAdmin() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM admins')
  if (rows[0].c > 0) return

  const { defaultUsername, defaultPassword } = config.admin
  const hashed = await hashPassword(defaultPassword)
  await pool.query(
    'INSERT INTO admins (username, password, nickname, status) VALUES (?, ?, ?, 1)',
    [defaultUsername, hashed, '超级管理员']
  )
  console.log(`已生成默认管理员账号 -> 账号: ${defaultUsername}  密码: ${defaultPassword}（请尽快修改）`)
}

// 启动时：连接 MySQL -> 创建数据库(库不存在则建) -> 创建连接池 -> 建表
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
  await pool.query(CREATE_ADMINS_TABLE)

  // 生成默认管理员
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
