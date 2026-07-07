import { query } from '../config/db.js'

// 消息视图：带发送者道号/头像/性别/境界名（LEFT JOIN 容错；删号会级联清理消息，正常不会出现空用户）
const MESSAGE_SELECT = `
  SELECT m.id, m.user_id, m.content, m.created_time,
         u.dao_name, u.avatar, u.gender, r.name AS realm_name
  FROM world_messages m
  LEFT JOIN users u ON u.id = m.user_id
  LEFT JOIN realms r ON r.id = u.realm_id
`

export async function addMessage(userId, content) {
  const result = await query(
    'INSERT INTO world_messages (user_id, content) VALUES (?, ?)',
    [userId, content]
  )
  return result.insertId
}

export async function findMessageById(id) {
  const rows = await query(`${MESSAGE_SELECT} WHERE m.id = ? LIMIT 1`, [id])
  return rows[0] || null
}

// 最新 N 条（倒序取出，调用方按需 reverse 成时间正序）
export async function listRecentMessages(limit = 30) {
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 30))
  return query(`${MESSAGE_SELECT} ORDER BY m.id DESC LIMIT ${n}`)
}

// 增量拉取：id 大于游标的消息（时间正序），轮询用
export async function listMessagesAfter(afterId, limit = 50) {
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 50))
  return query(`${MESSAGE_SELECT} WHERE m.id > ? ORDER BY m.id ASC LIMIT ${n}`, [afterId])
}

// 距该玩家上次发言的秒数（从未发言返回 null）；以 DB 时钟计，发言冷却用
export async function secondsSinceLastMessage(userId) {
  const rows = await query(
    `SELECT TIMESTAMPDIFF(SECOND, MAX(created_time), NOW()) AS s
     FROM world_messages WHERE user_id = ?`,
    [userId]
  )
  const s = rows[0]?.s
  return s === null || s === undefined ? null : Number(s)
}
