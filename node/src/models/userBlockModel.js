import { query } from '../config/db.js'

// 拉黑数据访问。单向：user_id 拉黑了 blocked_id。
// 结交/私信前需双向校验（任一方拉黑对方即拦截）。

// userId 是否已拉黑 blockedId
export async function isBlocked(userId, blockedId) {
  const rows = await query(
    'SELECT 1 FROM user_blocks WHERE user_id = ? AND blocked_id = ? LIMIT 1',
    [userId, blockedId]
  )
  return rows.length > 0
}

// 二人间是否存在任一方向的拉黑
export async function eitherBlocked(aId, bId) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM user_blocks
      WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)`,
    [aId, bId, bId, aId]
  )
  return rows[0].c > 0
}

// 拉黑（幂等：已拉黑则不重复插入），返回受影响行数
export async function addBlock(userId, blockedId) {
  const result = await query(
    'INSERT IGNORE INTO user_blocks (user_id, blocked_id) VALUES (?, ?)',
    [userId, blockedId]
  )
  return result.affectedRows
}

// 解除拉黑
export async function removeBlock(userId, blockedId) {
  const result = await query(
    'DELETE FROM user_blocks WHERE user_id = ? AND blocked_id = ?',
    [userId, blockedId]
  )
  return result.affectedRows
}

// 我拉黑的名单，带对方公开信息
export async function listBlocks(userId) {
  return query(
    `SELECT b.id AS block_id, b.created_time,
            u.id, u.dao_name, u.avatar, u.gender, u.realm_id, r.name AS realm_name
       FROM user_blocks b
       JOIN users u ON u.id = b.blocked_id
       LEFT JOIN realms r ON r.id = u.realm_id
      WHERE b.user_id = ?
      ORDER BY b.id DESC`,
    [userId]
  )
}
