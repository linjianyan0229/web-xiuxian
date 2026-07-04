import { query } from '../config/db.js'

// 对外暴露的用户视图（不含 password / email_code），关联出当前境界名
const USER_SELECT = `
  SELECT u.id, u.dao_name, u.email, u.role, u.status,
         u.realm_id, r.name AS realm_name,
         u.ling_shi, u.cultivation, u.dao_yun, u.dao_law, u.death_count,
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

// 原始整行（含 role/status/password），后台编辑前用于存在性与角色校验
export async function findRawById(id) {
  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id])
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

/* ---------- 每日签到 ---------- */

// 签到相关信息：当前境界的晋级方式与基准值(圆满修为/圆满道韵)、签到百分比区间、
// 上次签到时间，及是否已满24小时。奖励类型由前端/控制器按 requirement_type 判定。
export async function findSignInInfo(id) {
  const rows = await query(
    `SELECT u.id, u.cultivation, u.dao_yun, u.dao_law, u.last_sign_time, u.realm_id,
            r.name AS realm_name, r.requirement_type,
            r.advance_exp, r.dao_yun_required,
            r.sign_in_min_percent, r.sign_in_max_percent,
            (u.last_sign_time IS NULL OR u.last_sign_time <= NOW() - INTERVAL 24 HOUR) AS can_sign
     FROM users u LEFT JOIN realms r ON r.id = u.realm_id
     WHERE u.id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

// 原子签到：仅当从未签到或距上次签到已满 24 小时时，给对应资源加奖励并记录签到时间；
// field 限定为 cultivation/dao_yun/dao_law（白名单）。返回受影响行数（0=尚未到时间，可防并发重复）
const SIGN_IN_FIELDS = { cultivation: 'cultivation', dao_yun: 'dao_yun', dao_law: 'dao_law' }
export async function applySignIn(id, field, reward) {
  const col = SIGN_IN_FIELDS[field]
  if (!col) throw new Error(`非法的签到奖励字段: ${field}`)
  const result = await query(
    `UPDATE users
        SET ${col} = ${col} + ?, last_sign_time = NOW()
      WHERE id = ?
        AND (last_sign_time IS NULL OR last_sign_time <= NOW() - INTERVAL 24 HOUR)`,
    [reward, id]
  )
  return result.affectedRows
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

// 管理员新建玩家（恒为 role=0；password 需已哈希）
export async function adminCreateUser({ daoName, email, password, status = 1, realmId = 1 }) {
  const result = await query(
    `INSERT INTO users (dao_name, email, password, role, status, realm_id)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [daoName, email, password, status, realmId]
  )
  return result.insertId
}

// 后台可更新的玩家字段白名单（password 为已哈希值）
const USER_UPDATABLE = [
  'dao_name', 'email', 'password', 'status', 'realm_id',
  'ling_shi', 'cultivation', 'dao_yun', 'dao_law', 'death_count',
]

// 管理员更新玩家：按白名单动态拼 SET；仅作用于 role=0。
// 返回受影响行数（值未变时可能为 0，存在性/角色由调用方先行校验）
export async function updateUser(id, fields) {
  const keys = Object.keys(fields).filter((k) => USER_UPDATABLE.includes(k))
  if (keys.length === 0) return 0
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => fields[k])
  params.push(id)
  const result = await query(
    `UPDATE users SET ${setSql} WHERE id = ? AND role = 0`,
    params
  )
  return result.affectedRows
}

// 删除玩家（仅 role=0，避免误删管理员）
export async function deleteUser(id) {
  const result = await query('DELETE FROM users WHERE id = ? AND role = 0', [id])
  return result.affectedRows
}
