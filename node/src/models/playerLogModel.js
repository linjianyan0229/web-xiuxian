import { query } from '../config/db.js'

// 写一条修行日志。日志属旁路功能，失败只告警不打断主流程（勿 await 抛错影响业务）
export async function addLog(userId, type, content) {
  try {
    await query(
      'INSERT INTO player_logs (user_id, type, content) VALUES (?, ?, ?)',
      [userId, type, String(content).slice(0, 255)]
    )
  } catch (err) {
    console.warn(`写修行日志失败(user=${userId}, type=${type}):`, err.message)
  }
}

// 最近日志（倒序，前台首页「修行日志」用）
export async function listLogs(userId, limit = 20) {
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 20))
  return query(
    `SELECT id, type, content, created_time
     FROM player_logs WHERE user_id = ?
     ORDER BY id DESC LIMIT ${n}`,
    [userId]
  )
}

// 按类型筛选的最近日志（倒序）——前台「通知」弹窗「通知请求」页用，只取系统通知类日志（如收到丹药赠礼）
export async function listLogsByTypes(userId, types, limit = 30) {
  const list = Array.isArray(types) ? types.filter(Boolean) : []
  if (list.length === 0) return []
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 30))
  const placeholders = list.map(() => '?').join(', ')
  return query(
    `SELECT id, type, content, created_time
     FROM player_logs WHERE user_id = ? AND type IN (${placeholders})
     ORDER BY id DESC LIMIT ${n}`,
    [userId, ...list]
  )
}
