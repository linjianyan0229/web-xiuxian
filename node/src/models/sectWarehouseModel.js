import { query, getPool } from '../config/db.js'
import { positionInfo } from '../utils/sectPositions.js'
import { canManageWarehouse } from '../utils/sectFacilities.js'

// 宗门仓库数据访问（设计文档：docs/设计文档/宗门设施与仓库机制.md）
// 容量按「格」计：sect_warehouse_items 一行=一格，可叠加物品（丹药同种同品质）合并一行。
// 仓库行由建宗事务创建 + 启动回填（db.js），不再惰性 INSERT——防并发解散后经无外键的
// INSERT IGNORE 重建孤儿仓库。所有写操作在事务内按「sects → sect_members → sect_warehouses」
// 顺序加锁并复核宗门存在性与操作者权限（控制器的事务外校验只为友好报错，不作准）。

// 事务内加锁复核：宗门仍在 → 操作者仍为本宗成员 →（可选）仍有仓库管理权。
// 返回 null 通过；'sect_gone' | 'not_member' | 'no_permission' 未过（调用方回滚）。
async function lockAndVerify(conn, { sectId, userId, manage = false }) {
  const [sects] = await conn.execute('SELECT id FROM sects WHERE id = ? FOR UPDATE', [sectId])
  if (sects.length === 0) return 'sect_gone'
  const [members] = await conn.execute(
    'SELECT position FROM sect_members WHERE sect_id = ? AND user_id = ? FOR UPDATE',
    [sectId, userId]
  )
  if (members.length === 0) return 'not_member'
  if (manage) {
    const position = members[0].position
    const rank = positionInfo(position)?.rank ?? 9
    if (!canManageWarehouse(position, rank)) return 'no_permission'
  }
  return null
}

// 仓库等级行（只读；行由建宗事务/启动回填保证存在，异常缺行按 1 级展示不再补建）
export async function getWarehouseLevel(sectId) {
  const rows = await query('SELECT level FROM sect_warehouses WHERE sect_id = ? LIMIT 1', [sectId])
  return Number(rows[0]?.level) || 1
}

// 已用格数（物品行数）
export async function countWarehouseSlots(sectId) {
  const rows = await query(
    'SELECT COUNT(*) AS c FROM sect_warehouse_items WHERE sect_id = ?',
    [sectId]
  )
  return Number(rows[0].c) || 0
}

// 仓库物品列表：分页 + 关键字（丹药成品名/丹药名）；连 pills/pill_grades 带出展示信息
export async function listWarehouseItems(sectId, { page = 1, pageSize = 10, keyword = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size

  let where = 'WHERE w.sect_id = ? AND w.quantity > 0'
  const params = [sectId]
  if (keyword) {
    where += ' AND (g.item_name LIKE ? OR pl.name LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const from = `
    FROM sect_warehouse_items w
    JOIN pills pl ON pl.id = w.item_id
    JOIN pill_grades g ON g.pill_id = w.item_id AND g.grade = w.grade`

  const list = await query(
    `SELECT w.item_type, w.item_id AS pill_id, w.grade, w.quantity, w.updated_time,
            pl.name, pl.realm, pl.realm_rank, pl.category_name,
            g.grade_name, g.item_name, g.summary
     ${from} ${where}
     ORDER BY pl.realm_rank ASC, w.item_id ASC, FIELD(w.grade, 'fan', 'ling', 'dao')
     LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total ${from} ${where}`, params)
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

// 单条仓库物品（带成品名，供取出校验与叙事文案）；不存在返回 null
export async function findWarehouseItem(sectId, pillId, grade) {
  const rows = await query(
    `SELECT w.item_id AS pill_id, w.grade, w.quantity, g.item_name, g.grade_name, pl.name
     FROM sect_warehouse_items w
     JOIN pills pl ON pl.id = w.item_id
     JOIN pill_grades g ON g.pill_id = w.item_id AND g.grade = w.grade
     WHERE w.sect_id = ? AND w.item_type = 'pill' AND w.item_id = ? AND w.grade = ? LIMIT 1`,
    [sectId, pillId, grade]
  )
  return rows[0] || null
}

// 存入（事务）：复核宗门/成员 → 锁仓库行 → 扣个人背包（数量守卫）→ 入库合并；新条目占格前校验容量。
// 返回 {} 成功；{ error: 'sect_gone' | 'not_member' | 'no_items' | 'warehouse_full' }
export async function depositPill({ sectId, userId, pillId, grade, quantity, capacityOf }) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const denied = await lockAndVerify(conn, { sectId, userId })
    if (denied) {
      await conn.rollback()
      return { error: denied }
    }
    // 锁仓库等级行：容量校验与并发存入互斥（行由建宗/回填保证存在）
    const [wh] = await conn.execute(
      'SELECT level FROM sect_warehouses WHERE sect_id = ? FOR UPDATE',
      [sectId]
    )
    const capacity = capacityOf(Number(wh[0]?.level) || 1)

    // 新条目才占格：不存在该「物品×品质」行且已用格数达上限 → 满仓
    const [exist] = await conn.execute(
      `SELECT id FROM sect_warehouse_items
       WHERE sect_id = ? AND item_type = 'pill' AND item_id = ? AND grade = ? LIMIT 1`,
      [sectId, pillId, grade]
    )
    if (exist.length === 0) {
      const [cnt] = await conn.execute(
        'SELECT COUNT(*) AS c FROM sect_warehouse_items WHERE sect_id = ?',
        [sectId]
      )
      if (Number(cnt[0].c) >= capacity) {
        await conn.rollback()
        return { error: 'warehouse_full' }
      }
    }

    const [dec] = await conn.execute(
      `UPDATE user_pills SET quantity = quantity - ?
       WHERE user_id = ? AND pill_id = ? AND grade = ? AND quantity >= ?`,
      [quantity, userId, pillId, grade, quantity]
    )
    if (dec.affectedRows === 0) {
      await conn.rollback()
      return { error: 'no_items' }
    }
    await conn.execute(
      'DELETE FROM user_pills WHERE user_id = ? AND pill_id = ? AND grade = ? AND quantity = 0',
      [userId, pillId, grade]
    )
    await conn.execute(
      `INSERT INTO sect_warehouse_items (sect_id, item_type, item_id, grade, quantity)
       VALUES (?, 'pill', ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [sectId, pillId, grade, quantity]
    )
    await conn.commit()
    return {}
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// 取出（事务）：复核宗门/成员/管理权 → 扣仓库（数量守卫，扣到 0 删行腾格）→ 入操作者背包。
// 返回 {} 成功；{ error: 'sect_gone' | 'not_member' | 'no_permission' | 'no_items' }
export async function withdrawPill({ sectId, userId, pillId, grade, quantity }) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const denied = await lockAndVerify(conn, { sectId, userId, manage: true })
    if (denied) {
      await conn.rollback()
      return { error: denied }
    }
    const [dec] = await conn.execute(
      `UPDATE sect_warehouse_items SET quantity = quantity - ?
       WHERE sect_id = ? AND item_type = 'pill' AND item_id = ? AND grade = ? AND quantity >= ?`,
      [quantity, sectId, pillId, grade, quantity]
    )
    if (dec.affectedRows === 0) {
      await conn.rollback()
      return { error: 'no_items' }
    }
    await conn.execute(
      `DELETE FROM sect_warehouse_items
       WHERE sect_id = ? AND item_type = 'pill' AND item_id = ? AND grade = ? AND quantity = 0`,
      [sectId, pillId, grade]
    )
    await conn.execute(
      `INSERT INTO user_pills (user_id, pill_id, grade, quantity) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [userId, pillId, grade, quantity]
    )
    await conn.commit()
    return {}
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// 升级（事务）：复核宗门/成员/管理权 → 原子扣操作者灵石（余额守卫）→ 等级 +1（等级守卫防并发双升）。
// 返回 {} 成功；{ error: 'sect_gone' | 'not_member' | 'no_permission' | 'no_funds' | 'level_changed' }
export async function upgradeWarehouse({ sectId, userId, fromLevel, cost }) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const denied = await lockAndVerify(conn, { sectId, userId, manage: true })
    if (denied) {
      await conn.rollback()
      return { error: denied }
    }
    const [pay] = await conn.execute(
      `UPDATE users SET ling_shi = ling_shi - ?
       WHERE id = ? AND role = 0 AND status = 1 AND ling_shi >= ?`,
      [cost, userId, cost]
    )
    if (pay.affectedRows === 0) {
      await conn.rollback()
      return { error: 'no_funds' }
    }
    const [upd] = await conn.execute(
      'UPDATE sect_warehouses SET level = level + 1 WHERE sect_id = ? AND level = ?',
      [sectId, fromLevel]
    )
    if (upd.affectedRows === 0) {
      await conn.rollback()
      return { error: 'level_changed' }
    }
    await conn.commit()
    return {}
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
