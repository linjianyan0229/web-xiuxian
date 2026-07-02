import { query } from '../config/db.js'

// 对外暴露的用户视图（不含 password / email_code），关联出当前境界名
const USER_SELECT = `
  SELECT u.id, u.dao_name, u.email, u.role, u.status,
         u.realm_id, r.name AS realm_name,
         u.ling_shi, u.cultivation, u.dao_yun, u.dao_law,
         r.hp, r.attack, r.defense, r.spirit,
         u.register_time, u.login_time
  FROM users u
  LEFT JOIN realms r ON r.id = u.realm_id
`

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
  const rows = await query(`${USER_SELECT} WHERE u.id = ? LIMIT 1`, [id])
  return rows[0] || null
}

export async function createUser({ daoName, email, password, emailCode = null }) {
  const result = await query(
    `INSERT INTO users (dao_name, email, password, email_code, role, status)
     VALUES (?, ?, ?, ?, 0, 1)`,
    [daoName, email, password, emailCode]
  )
  return result.insertId
}

// 记录本次登录：更新 token、登录时间，并置为在线
export async function updateLoginState(id, accessToken) {
  await query(
    'UPDATE users SET access_token = ?, login_time = NOW(), is_online = 1 WHERE id = ?',
    [accessToken, id]
  )
}

// 设置在线状态（登出置 0）
export async function setOnline(id, online) {
  await query('UPDATE users SET is_online = ? WHERE id = ?', [online ? 1 : 0, id])
}

/* ---------- 排行榜（均只统计玩家 role=0）---------- */

// 境界排行：境界越高越靠前，同境界先到者靠前
export async function rankByRealm(limit = 10) {
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
  return query(
    `SELECT u.id, u.dao_name, u.realm_id, r.name AS realm_name
     FROM users u LEFT JOIN realms r ON r.id = u.realm_id
     WHERE u.role = 0
     ORDER BY u.realm_id DESC, u.register_time ASC
     LIMIT ${n}`
  )
}

// 在线排行：仅在线玩家，按境界排序
export async function rankOnlineByRealm(limit = 10) {
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
  return query(
    `SELECT u.id, u.dao_name, u.realm_id, r.name AS realm_name
     FROM users u LEFT JOIN realms r ON r.id = u.realm_id
     WHERE u.role = 0 AND u.is_online = 1
     ORDER BY u.realm_id DESC, u.login_time DESC
     LIMIT ${n}`
  )
}

// 死亡排行：按死亡次数降序，仅列有死亡记录者
export async function rankByDeath(limit = 10) {
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
  return query(
    `SELECT u.id, u.dao_name, u.death_count, u.realm_id, r.name AS realm_name
     FROM users u LEFT JOIN realms r ON r.id = u.realm_id
     WHERE u.role = 0 AND u.death_count > 0
     ORDER BY u.death_count DESC, u.realm_id DESC
     LIMIT ${n}`
  )
}

/* ---------- 后台管理用查询（玩家 role=0，管理员 role=1）---------- */

export async function countUsers() {
  const rows = await query('SELECT COUNT(*) AS c FROM users WHERE role = 0')
  return rows[0].c
}

export async function countUsersByStatus(status) {
  const rows = await query(
    'SELECT COUNT(*) AS c FROM users WHERE role = 0 AND status = ?',
    [status]
  )
  return rows[0].c
}

// 今日新增玩家（按注册时间 >= 今日零点）
export async function countUsersRegisteredToday() {
  const rows = await query(
    'SELECT COUNT(*) AS c FROM users WHERE role = 0 AND register_time >= CURDATE()'
  )
  return rows[0].c
}

export async function countAdmins() {
  const rows = await query('SELECT COUNT(*) AS c FROM users WHERE role = 1')
  return rows[0].c
}

// 分页 + 关键字（道号/邮箱模糊）查询玩家列表；管理员(role=1)不纳入
export async function listUsers({ page = 1, pageSize = 10, keyword = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size

  let where = 'WHERE u.role = 0'
  const params = []
  if (keyword) {
    where += ' AND (u.dao_name LIKE ? OR u.email LIKE ?)'
    const like = `%${keyword}%`
    params.push(like, like)
  }

  // size/offset 已收敛为安全整数，直接内联以规避 mysql2 对 LIMIT 占位符的限制
  const list = await query(
    `${USER_SELECT} ${where} ORDER BY u.id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total FROM users u ${where}`, params)
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

// 仅对玩家(role=0)启用/禁用，避免误改管理员
export async function updateUserStatus(id, status) {
  const result = await query(
    'UPDATE users SET status = ? WHERE id = ? AND role = 0',
    [status, id]
  )
  return result.affectedRows
}
