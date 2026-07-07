import { query } from '../config/db.js'

// 对外暴露的用户视图（不含 password / email_code），关联出当前境界名
const USER_SELECT = `
  SELECT u.id, u.dao_name, u.email, u.role, u.status, u.avatar, u.gender,
         u.realm_id, r.name AS realm_name, r.advance_exp,
         u.ling_shi, u.cultivation, u.dao_yun, u.dao_law, u.comprehension, u.death_count,
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

export async function createUser({ daoName, email, password, emailCode = null, comprehension = 1, gender = 1 }) {
  const result = await query(
    `INSERT INTO users (dao_name, email, password, email_code, role, status, comprehension, gender)
     VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
    [daoName, email, password, emailCode, comprehension, gender]
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

// 中间件用：取当前库中存储的登录令牌（用于校验请求携带的 token 是否为最新签发的一枚，
// 实现「后登录挤掉先登录」与「登出即吊销旧 token」）。
export async function findAccessTokenById(id) {
  const rows = await query('SELECT access_token FROM users WHERE id = ? LIMIT 1', [id])
  return rows[0]?.access_token ?? null
}

// 登出：清空令牌并置离线；清空后旧 token 立即失效（中间件比对不通过）
export async function clearLoginState(id) {
  await query('UPDATE users SET access_token = NULL, is_online = 0 WHERE id = ?', [id])
}

// 更新头像（存 /api/uploads/avatars/ 下的访问路径）
export async function updateAvatar(id, avatar) {
  await query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, id])
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

/* ---------- 修炼 ---------- */

// 修炼相关信息：当前境界圆满修为(advance_exp)、上次修炼时间及是否已过冷却（冷却秒数来自系统配置）
export async function findCultivateInfo(id, cooldownSeconds) {
  const cd = Math.max(0, Math.floor(Number(cooldownSeconds) || 0))
  const rows = await query(
    `SELECT u.id, u.cultivation, u.last_cultivate_time, u.realm_id,
            r.name AS realm_name, r.advance_exp,
            (u.last_cultivate_time IS NULL OR u.last_cultivate_time <= NOW() - INTERVAL ? SECOND) AS can_cultivate,
            (u.meditation_end_time IS NOT NULL AND u.meditation_end_time > NOW()) AS is_meditating
     FROM users u LEFT JOIN realms r ON r.id = u.realm_id
     WHERE u.id = ? LIMIT 1`,
    [cd, id]
  )
  return rows[0] || null
}

// 原子修炼：仅当冷却已过且不在打坐中时加修为并记录修炼时间；
// 打坐守卫（meditation_end_time IS NULL OR <= NOW()）防并发下入定与修炼同时成功。
// 返回受影响行数（0=冷却未到 / 正在打坐，可防并发连点）
export async function applyCultivate(id, gain, cooldownSeconds) {
  const cd = Math.max(0, Math.floor(Number(cooldownSeconds) || 0))
  const result = await query(
    `UPDATE users
        SET cultivation = cultivation + ?, last_cultivate_time = NOW()
      WHERE id = ?
        AND (last_cultivate_time IS NULL OR last_cultivate_time <= NOW() - INTERVAL ? SECOND)
        AND (meditation_end_time IS NULL OR meditation_end_time <= NOW())`,
    [gain, id, cd]
  )
  return result.affectedRows
}

/* ---------- 打坐（定时挂机修炼） ---------- */

// 打坐相关信息：打坐起止时间 + 当前境界圆满修为；
// 打坐中/已到期均以 DB 时钟判定，剩余秒数供前端倒计时初始化
export async function findMeditationInfo(id) {
  const rows = await query(
    `SELECT u.id, u.cultivation, u.realm_id,
            u.meditation_start_time, u.meditation_end_time,
            r.name AS realm_name, r.advance_exp,
            (u.meditation_end_time IS NOT NULL AND u.meditation_end_time > NOW()) AS is_meditating,
            (u.meditation_end_time IS NOT NULL AND u.meditation_end_time <= NOW()) AS is_due,
            TIMESTAMPDIFF(SECOND, NOW(), u.meditation_end_time) AS remain_seconds
     FROM users u LEFT JOIN realms r ON r.id = u.realm_id
     WHERE u.id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

// 原子开始打坐：仅当没有进行中/待结算的场次时写入起止时间；返回受影响行数（0=已在打坐，防并发重复开场）
export async function applyMeditationStart(id, minutes) {
  const mins = Math.max(1, Math.floor(Number(minutes) || 0))
  const result = await query(
    `UPDATE users
        SET meditation_start_time = NOW(),
            meditation_end_time = NOW() + INTERVAL ? MINUTE
      WHERE id = ? AND meditation_end_time IS NULL`,
    [mins, id]
  )
  return result.affectedRows
}

// 原子结算到期打坐：加修为并清空打坐时间；WHERE 以 DB 时钟守卫「存在且已到期」，防并发重复结算
export async function applyMeditationSettle(id, gain) {
  const g = Math.max(0, Math.floor(Number(gain) || 0))
  const result = await query(
    `UPDATE users
        SET cultivation = cultivation + ?,
            meditation_start_time = NULL, meditation_end_time = NULL
      WHERE id = ? AND meditation_end_time IS NOT NULL AND meditation_end_time <= NOW()`,
    [g, id]
  )
  return result.affectedRows
}

/* ---------- 境界突破 ---------- */

// 突破相关信息：玩家资源 + 当前境界行（该行即描述晋级到 next_realm 的要求）；带打坐中标记（入定时禁突破）
export async function findBreakthroughInfo(id) {
  const rows = await query(
    `SELECT u.id, u.realm_id, u.cultivation, u.dao_yun, u.dao_law, u.death_count,
            r.name AS realm_name, r.requirement_type, r.advance_exp,
            r.dao_yun_required, r.dao_law_required,
            r.tribulation_type, r.tribulation_death_rate, r.next_realm,
            (u.meditation_end_time IS NOT NULL AND u.meditation_end_time > NOW()) AS is_meditating
     FROM users u LEFT JOIN realms r ON r.id = u.realm_id
     WHERE u.id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

// 突破资源列白名单（防注入）
const BREAKTHROUGH_COST_FIELDS = { cultivation: 'cultivation', dao_yun: 'dao_yun' }

// 突破成功：境界+1 并扣除晋级资源；WHERE 带境界、资源与打坐守卫，防并发重复突破/入定期冲关。
// costField 为 null 时（道法型）不扣资源。返回受影响行数（0=状态已变化 / 正在打坐）
export async function applyBreakthroughSuccess(id, fromRealmId, costField, costAmount) {
  if (costField) {
    const col = BREAKTHROUGH_COST_FIELDS[costField]
    if (!col) throw new Error(`非法的突破消耗字段: ${costField}`)
    const result = await query(
      `UPDATE users SET realm_id = realm_id + 1, ${col} = ${col} - ?
       WHERE id = ? AND realm_id = ? AND ${col} >= ?
         AND (meditation_end_time IS NULL OR meditation_end_time <= NOW())`,
      [costAmount, id, fromRealmId, costAmount]
    )
    return result.affectedRows
  }
  const result = await query(
    `UPDATE users SET realm_id = realm_id + 1
       WHERE id = ? AND realm_id = ?
         AND (meditation_end_time IS NULL OR meditation_end_time <= NOW())`,
    [id, fromRealmId]
  )
  return result.affectedRows
}

// 突破身陨：死亡次数+1，对应晋级资源折损一半（境界不变）。带打坐守卫防入定期冲关。返回受影响行数
export async function applyBreakthroughDeath(id, fromRealmId, lossField) {
  const col = BREAKTHROUGH_COST_FIELDS[lossField]
  if (!col) throw new Error(`非法的陨落损失字段: ${lossField}`)
  const result = await query(
    `UPDATE users SET death_count = death_count + 1, ${col} = FLOOR(${col} / 2)
     WHERE id = ? AND realm_id = ?
       AND (meditation_end_time IS NULL OR meditation_end_time <= NOW())`,
    [id, fromRealmId]
  )
  return result.affectedRows
}

/* ---------- 排行榜（均只统计玩家 role=0）---------- */

// 境界排行：境界越高越靠前，同境界先到者靠前
export async function rankByRealm(limit = 10) {
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
  return query(
    `SELECT u.id, u.dao_name, u.avatar, u.realm_id, r.name AS realm_name
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
    `SELECT u.id, u.dao_name, u.avatar, u.realm_id, r.name AS realm_name
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
    `SELECT u.id, u.dao_name, u.avatar, u.death_count, u.realm_id, r.name AS realm_name
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
export async function adminCreateUser({ daoName, email, password, status = 1, realmId = 1, comprehension = 1, gender = 1 }) {
  const result = await query(
    `INSERT INTO users (dao_name, email, password, role, status, realm_id, comprehension, gender)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
    [daoName, email, password, status, realmId, comprehension, gender]
  )
  return result.insertId
}

// 后台可更新的玩家字段白名单（password 为已哈希值）
const USER_UPDATABLE = [
  'dao_name', 'email', 'password', 'status', 'realm_id', 'gender',
  'ling_shi', 'cultivation', 'dao_yun', 'dao_law', 'comprehension', 'death_count',
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

// 删除玩家（仅 role=0，避免误删管理员）；连带清理其修行日志与丹药背包（无外键，手动级联）
export async function deleteUser(id) {
  const result = await query('DELETE FROM users WHERE id = ? AND role = 0', [id])
  if (result.affectedRows > 0) {
    await query('DELETE FROM player_logs WHERE user_id = ?', [id])
    await query('DELETE FROM user_pills WHERE user_id = ?', [id])
    await query('DELETE FROM user_daily_stats WHERE user_id = ?', [id])
  }
  return result.affectedRows
}
