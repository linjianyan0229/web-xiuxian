import { query } from '../config/db.js'

// 好友关系数据访问。一行代表一对用户的关系（requester 发起、addressee 接收），
// status: 0=待通过, 1=已结交。是否好友需查两个方向；uk_pair 约束「同向」不重复，
// 无向唯一键 uk_pair_nodir(LEAST, GREATEST) 保证一对用户至多一行——双方并发互发时
// 后到的 INSERT 抛 ER_DUP_ENTRY，由控制器捕获后按实际关系回执。

// 二人之间的关系行（任一方向），无则 null
export async function findBetween(aId, bId) {
  const rows = await query(
    `SELECT * FROM friendships
     WHERE (requester_id = ? AND addressee_id = ?)
        OR (requester_id = ? AND addressee_id = ?)
     LIMIT 1`,
    [aId, bId, bId, aId]
  )
  return rows[0] || null
}

export async function findById(id) {
  const rows = await query('SELECT * FROM friendships WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
}

// 发起结交请求（status=0）；并发下唯一键冲突（ER_DUP_ENTRY）由控制器捕获处理
export async function createRequest(requesterId, addresseeId) {
  const result = await query(
    'INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 0)',
    [requesterId, addresseeId]
  )
  return result.insertId
}

// 接受请求：仅接收方可将待通过置为已结交，返回受影响行数（0=非本人/非待通过）
export async function acceptRequest(id, addresseeId) {
  const result = await query(
    `UPDATE friendships SET status = 1
      WHERE id = ? AND addressee_id = ? AND status = 0`,
    [id, addresseeId]
  )
  return result.affectedRows
}

// 拒绝/取消请求：删除待通过行（接收方拒绝或发起方撤回均可）
export async function deleteRequest(id) {
  const result = await query('DELETE FROM friendships WHERE id = ?', [id])
  return result.affectedRows
}

// 解除二人一切关系（好友或待通过），拉黑与删好友共用
export async function deleteBetween(aId, bId) {
  const result = await query(
    `DELETE FROM friendships
      WHERE (requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?)`,
    [aId, bId, bId, aId]
  )
  return result.affectedRows
}

// 我的好友（已结交），带对方公开信息与在线态，在线者靠前
export async function listFriends(userId) {
  return query(
    `SELECT f.id AS friendship_id,
            u.id, u.dao_name, u.avatar, u.gender, u.is_online,
            u.realm_id, r.name AS realm_name, s.name AS sect_name
       FROM friendships f
       JOIN users u ON u.id = IF(f.requester_id = ?, f.addressee_id, f.requester_id)
       LEFT JOIN realms r ON r.id = u.realm_id
       LEFT JOIN sects s ON s.id = u.sect_id
      WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 1
      ORDER BY u.is_online DESC, u.realm_id DESC, f.id DESC`,
    [userId, userId, userId]
  )
}

// 我收到的待通过请求（别人向我发起），带发起方公开信息
export async function listIncomingRequests(userId) {
  return query(
    `SELECT f.id AS friendship_id, f.created_time,
            u.id, u.dao_name, u.avatar, u.gender, u.realm_id, r.name AS realm_name
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       LEFT JOIN realms r ON r.id = u.realm_id
      WHERE f.addressee_id = ? AND f.status = 0
      ORDER BY f.id DESC`,
    [userId]
  )
}

// 待处理请求数（红点/角标用）
export async function countIncomingRequests(userId) {
  const rows = await query(
    'SELECT COUNT(*) AS c FROM friendships WHERE addressee_id = ? AND status = 0',
    [userId]
  )
  return rows[0].c
}
