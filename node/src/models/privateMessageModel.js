import { query } from '../config/db.js'

// 私信数据访问。点对点，一行一条消息；会话由收发双方 id 聚合，无独立会话表。

export async function addMessage(senderId, receiverId, content) {
  const result = await query(
    'INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
    [senderId, receiverId, content]
  )
  return result.insertId
}

// 与某道友的往来消息（时间正序，最近 N 条）
export async function listConversation(userId, otherId, limit = 50) {
  const n = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
  // 取最近 N 条（倒序限量）后翻正序返回
  const rows = await query(
    `SELECT id, sender_id, receiver_id, content, receiver_read, created_time
       FROM private_messages
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY id DESC LIMIT ${n}`,
    [userId, otherId, otherId, userId]
  )
  return rows.reverse()
}

// 会话列表：每位往来对象一行，取其最新一条消息 + 我方未读数，最近活跃靠前
export async function listConversations(userId) {
  return query(
    `SELECT t.other_id AS id, t.unread,
            pm.content AS last_content, pm.created_time AS last_time, pm.sender_id AS last_sender,
            u.dao_name, u.avatar, u.gender, u.is_online,
            u.realm_id, r.name AS realm_name
       FROM (
         SELECT IF(sender_id = ?, receiver_id, sender_id) AS other_id,
                MAX(id) AS last_id,
                SUM(receiver_id = ? AND receiver_read = 0) AS unread
           FROM private_messages
          WHERE sender_id = ? OR receiver_id = ?
          GROUP BY other_id
       ) t
       JOIN private_messages pm ON pm.id = t.last_id
       JOIN users u ON u.id = t.other_id
       LEFT JOIN realms r ON r.id = u.realm_id
      ORDER BY t.last_id DESC`,
    [userId, userId, userId, userId]
  )
}

// 将某道友发给我的消息标记为已读
export async function markConversationRead(userId, otherId) {
  const result = await query(
    `UPDATE private_messages SET receiver_read = 1
      WHERE receiver_id = ? AND sender_id = ? AND receiver_read = 0`,
    [userId, otherId]
  )
  return result.affectedRows
}

// 我的未读私信总数
export async function countUnread(userId) {
  const rows = await query(
    'SELECT COUNT(*) AS c FROM private_messages WHERE receiver_id = ? AND receiver_read = 0',
    [userId]
  )
  return rows[0].c
}
