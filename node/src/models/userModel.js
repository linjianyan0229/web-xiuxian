import { query } from '../config/db.js'

// 对外暴露的安全字段（不含 password / email_code）
const PUBLIC_FIELDS =
  'id, dao_name, email, status, register_time, login_time'

export async function findByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
  return rows[0] || null
}

export async function findByDaoName(daoName) {
  const rows = await query('SELECT * FROM users WHERE dao_name = ? LIMIT 1', [daoName])
  return rows[0] || null
}

// 登录支持道号或邮箱
export async function findByAccount(account) {
  const rows = await query(
    'SELECT * FROM users WHERE email = ? OR dao_name = ? LIMIT 1',
    [account, account]
  )
  return rows[0] || null
}

export async function findPublicById(id) {
  const rows = await query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

export async function createUser({ daoName, email, password, emailCode = null }) {
  const result = await query(
    `INSERT INTO users (dao_name, email, password, email_code, status)
     VALUES (?, ?, ?, ?, 1)`,
    [daoName, email, password, emailCode]
  )
  return result.insertId
}

// 记录本次登录：更新 token 与登录时间
export async function updateLoginState(id, accessToken) {
  await query(
    'UPDATE users SET access_token = ?, login_time = NOW() WHERE id = ?',
    [accessToken, id]
  )
}

/* ---------- 后台管理用查询 ---------- */

export async function countUsers() {
  const rows = await query('SELECT COUNT(*) AS c FROM users')
  return rows[0].c
}

export async function countUsersByStatus(status) {
  const rows = await query('SELECT COUNT(*) AS c FROM users WHERE status = ?', [status])
  return rows[0].c
}

// 今日新增（按注册时间 >= 今日零点）
export async function countUsersRegisteredToday() {
  const rows = await query('SELECT COUNT(*) AS c FROM users WHERE register_time >= CURDATE()')
  return rows[0].c
}

// 分页 + 关键字（道号/邮箱模糊）查询用户列表
export async function listUsers({ page = 1, pageSize = 10, keyword = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size

  let where = ''
  const params = []
  if (keyword) {
    where = 'WHERE dao_name LIKE ? OR email LIKE ?'
    const like = `%${keyword}%`
    params.push(like, like)
  }

  // size/offset 已收敛为安全整数，直接内联以规避 mysql2 对 LIMIT 占位符的限制
  const list = await query(
    `SELECT ${PUBLIC_FIELDS} FROM users ${where} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total FROM users ${where}`, params)
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

export async function updateUserStatus(id, status) {
  const result = await query('UPDATE users SET status = ? WHERE id = ?', [status, id])
  return result.affectedRows
}
