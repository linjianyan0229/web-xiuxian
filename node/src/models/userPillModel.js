import { query, getPool } from '../config/db.js'

// 品质白名单与固定顺序：凡 → 灵 → 道
const GRADES = ['fan', 'ling', 'dao']
const GRADE_ORDER = "FIELD(up.grade, 'fan', 'ling', 'dao')"

export function isValidGrade(grade) {
  return GRADES.includes(grade)
}

// 背包条目通用连表：user_pills 带出丹药基础信息与对应品质档
const ITEM_FROM = `
  FROM user_pills up
  JOIN pills pl ON pl.id = up.pill_id
  JOIN pill_grades g ON g.pill_id = up.pill_id AND g.grade = up.grade`

// 背包列表：分页 + 品质/境界/类型精确筛选 + 关键字模糊匹配（成品名或丹药名）；只列数量>0 的条目
export async function listUserPills(
  userId,
  { page = 1, pageSize = 8, keyword = '', category = '', realm = '', grade = '' } = {}
) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 8))
  const offset = (p - 1) * size

  let where = 'WHERE up.user_id = ? AND up.quantity > 0'
  const params = [userId]
  if (keyword) {
    where += ' AND (g.item_name LIKE ? OR pl.name LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  if (category) {
    where += ' AND pl.category = ?'
    params.push(category)
  }
  if (realm) {
    where += ' AND pl.realm = ?'
    params.push(realm)
  }
  if (grade) {
    where += ' AND up.grade = ?'
    params.push(grade)
  }

  // size/offset 已收敛为安全整数，直接内联（同 listPills，规避 mysql2 的 LIMIT 占位符限制）
  const list = await query(
    `SELECT up.pill_id, up.grade, up.quantity, up.obtained_time,
            pl.name, pl.realm, pl.realm_rank, pl.category, pl.category_name,
            pl.effect_mode, pl.default_target, pl.note,
            g.grade_name, g.item_name, g.effects, g.summary
     ${ITEM_FROM} ${where}
     ORDER BY pl.realm_rank ASC, pl.category ASC, up.pill_id ASC, ${GRADE_ORDER}
     LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total ${ITEM_FROM} ${where}`, params)
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

// 筛选元数据：仅含玩家实际持有丹药的境界/类型（比全量下拉更贴合背包）
export async function userPillMeta(userId) {
  const categories = await query(
    `SELECT DISTINCT pl.category, pl.category_name
     FROM user_pills up JOIN pills pl ON pl.id = up.pill_id
     WHERE up.user_id = ? AND up.quantity > 0
     ORDER BY pl.category_name`,
    [userId]
  )
  const realms = await query(
    `SELECT DISTINCT pl.realm, pl.realm_rank
     FROM user_pills up JOIN pills pl ON pl.id = up.pill_id
     WHERE up.user_id = ? AND up.quantity > 0
     ORDER BY pl.realm_rank`,
    [userId]
  )
  return { categories, realms }
}

// 单条背包条目（含成品名等，供赠送/丢弃校验与叙事文案）；不存在返回 null
export async function findUserPillItem(userId, pillId, grade) {
  const rows = await query(
    `SELECT up.pill_id, up.grade, up.quantity, g.item_name, g.grade_name, pl.name
     ${ITEM_FROM}
     WHERE up.user_id = ? AND up.pill_id = ? AND up.grade = ? LIMIT 1`,
    [userId, pillId, grade]
  )
  return rows[0] || null
}

export async function getUserPillQuantity(userId, pillId, grade) {
  const rows = await query(
    'SELECT quantity FROM user_pills WHERE user_id = ? AND pill_id = ? AND grade = ? LIMIT 1',
    [userId, pillId, grade]
  )
  return Number(rows[0]?.quantity) || 0
}

// 入包（获得丹药）：同种同品质合并计数
export async function addUserPills(userId, pillId, grade, qty) {
  await query(
    `INSERT INTO user_pills (user_id, pill_id, grade, quantity) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [userId, pillId, grade, qty]
  )
}

// 出包（丢弃/消耗）：quantity >= qty 守卫防超扣，扣到 0 的行顺手清掉；返回受影响行数（0=数量不足）
export async function removeUserPills(userId, pillId, grade, qty) {
  const result = await query(
    `UPDATE user_pills SET quantity = quantity - ?
     WHERE user_id = ? AND pill_id = ? AND grade = ? AND quantity >= ?`,
    [qty, userId, pillId, grade, qty]
  )
  if (result.affectedRows > 0) {
    await query(
      'DELETE FROM user_pills WHERE user_id = ? AND pill_id = ? AND grade = ? AND quantity = 0',
      [userId, pillId, grade]
    )
  }
  return result.affectedRows
}

// 转赠：同一事务内扣减赠方（守卫防超扣）并累加受赠方，任一步失败整体回滚；返回 1 成功 / 0 数量不足
export async function transferUserPills(fromUserId, toUserId, pillId, grade, qty) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const [dec] = await conn.execute(
      `UPDATE user_pills SET quantity = quantity - ?
       WHERE user_id = ? AND pill_id = ? AND grade = ? AND quantity >= ?`,
      [qty, fromUserId, pillId, grade, qty]
    )
    if (dec.affectedRows === 0) {
      await conn.rollback()
      return 0
    }
    await conn.execute(
      `INSERT INTO user_pills (user_id, pill_id, grade, quantity) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [toUserId, pillId, grade, qty]
    )
    await conn.execute(
      'DELETE FROM user_pills WHERE user_id = ? AND pill_id = ? AND grade = ? AND quantity = 0',
      [fromUserId, pillId, grade]
    )
    await conn.commit()
    return 1
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
