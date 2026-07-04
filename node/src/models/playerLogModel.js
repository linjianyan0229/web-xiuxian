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
