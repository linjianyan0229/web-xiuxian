import { query } from '../config/db.js'

// 玩家每日修炼统计（前台首页「今日修炼」面板）。
// 归日一律用数据库 CURDATE()，与签到/今日新增等现有按日逻辑同一时钟。

// 收敛为非负整数
function uint(v) {
  return Math.max(0, Math.floor(Number(v) || 0))
}

// 累计当日统计（UPSERT）。旁路功能：失败只告警不抛错，勿影响主流程（同 playerLogModel.addLog）
export async function bumpDailyStat(
  userId,
  { cultivateCount = 0, meditationSeconds = 0, cultivationGained = 0 } = {}
) {
  const c = uint(cultivateCount)
  const s = uint(meditationSeconds)
  const g = uint(cultivationGained)
  if (c === 0 && s === 0 && g === 0) return
  try {
    await query(
      `INSERT INTO user_daily_stats
         (user_id, stat_date, cultivate_count, meditation_seconds, cultivation_gained)
       VALUES (?, CURDATE(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cultivate_count = cultivate_count + ?,
         meditation_seconds = meditation_seconds + ?,
         cultivation_gained = cultivation_gained + ?`,
      [userId, c, s, g, c, s, g]
    )
  } catch (err) {
    console.warn(`写每日修炼统计失败(user=${userId}):`, err.message)
  }
}

// 今日统计（无记录返回全 0 行）
export async function findTodayStat(userId) {
  const rows = await query(
    `SELECT cultivate_count, meditation_seconds, cultivation_gained
     FROM user_daily_stats
     WHERE user_id = ? AND stat_date = CURDATE() LIMIT 1`,
    [userId]
  )
  return rows[0] || { cultivate_count: 0, meditation_seconds: 0, cultivation_gained: 0 }
}
