import { query, getPool } from '../config/db.js'
import { POSITION_ORDER } from '../utils/sectPositions.js'

// 成员列表按职位职级排序用（key 来自内部常量，直接内联安全）
const POSITION_FIELD = POSITION_ORDER.map((k) => `'${k}'`).join(', ')

// 宗门视图：带宗主道号/境界与实时人数（成员关系在 users.sect_id 上聚合）
const SECT_SELECT = `
  SELECT s.id, s.name, s.avatar, s.background, s.intro,
         s.realm_req, s.realm_req_rank, s.leader_id, s.activity, s.created_time,
         lu.dao_name AS leader_name, lr.name AS leader_realm_name,
         (SELECT COUNT(*) FROM users m WHERE m.sect_id = s.id) AS member_count
  FROM sects s
  LEFT JOIN users lu ON lu.id = s.leader_id
  LEFT JOIN realms lr ON lr.id = lu.realm_id
`

// 宗门列表：分页 + 名称关键字 + 境界要求筛选（realmReq 传大境界名精确匹配，'none' 表示只看无要求）
export async function listSects({ page = 1, pageSize = 10, keyword = '', realmReq = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size

  let where = 'WHERE 1=1'
  const params = []
  if (keyword) {
    where += ' AND s.name LIKE ?'
    params.push(`%${keyword}%`)
  }
  if (realmReq === 'none') {
    where += " AND s.realm_req = ''"
  } else if (realmReq) {
    where += ' AND s.realm_req = ?'
    params.push(realmReq)
  }

  // size/offset 已收敛为安全整数，直接内联（同 listUsers，规避 mysql2 的 LIMIT 占位符限制）
  const list = await query(
    `${SECT_SELECT} ${where}
     ORDER BY s.activity DESC, s.id ASC
     LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total FROM sects s ${where}`, params)
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

export async function findSectById(id) {
  const rows = await query(`${SECT_SELECT} WHERE s.id = ? LIMIT 1`, [id])
  return rows[0] || null
}

// 境界要求可选项：全部大境界（名称 + 该档最小境界序号，序号用于日后入门校验/排序）。
// 注意 rank 是 MySQL 8 保留字，别名用 realm_rank
export async function sectRealmOptions() {
  return query('SELECT realm, MIN(id) AS realm_rank FROM realms GROUP BY realm ORDER BY realm_rank')
}

// 校验境界要求是否为合法大境界，返回 { realm, realm_rank } 或 null
export async function findRealmOption(realm) {
  const rows = await query(
    'SELECT realm, MIN(id) AS realm_rank FROM realms WHERE realm = ? GROUP BY realm LIMIT 1',
    [realm]
  )
  return rows[0] || null
}

// 创建宗门（事务）：原子扣灵石（余额与"无宗门"守卫）→ 建宗门 → 创建者入驻并任宗主。
// 返回 { id } 成功；{ error: 'no_funds_or_in_sect' } 扣款守卫未过；宗门名重复抛 ER_DUP_ENTRY 由调用方翻译。
export async function createSect({ leaderId, name, intro, avatar, background, realmReq, realmReqRank, cost }) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const [pay] = await conn.execute(
      `UPDATE users SET ling_shi = ling_shi - ?
       WHERE id = ? AND role = 0 AND status = 1 AND ling_shi >= ? AND sect_id IS NULL`,
      [cost, leaderId, cost]
    )
    if (pay.affectedRows === 0) {
      await conn.rollback()
      return { error: 'no_funds_or_in_sect' }
    }
    const [ins] = await conn.execute(
      `INSERT INTO sects (name, avatar, background, intro, realm_req, realm_req_rank, leader_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, avatar, background, intro, realmReq, realmReqRank, leaderId]
    )
    await conn.execute('UPDATE users SET sect_id = ? WHERE id = ?', [ins.insertId, leaderId])
    await conn.execute(
      "INSERT INTO sect_members (sect_id, user_id, position) VALUES (?, ?, 'sect_master')",
      [ins.insertId, leaderId]
    )
    await conn.commit()
    return { id: ins.insertId }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// 后台可编辑字段白名单
const SECT_UPDATABLE = ['name', 'intro', 'avatar', 'background', 'realm_req', 'realm_req_rank', 'activity']

export async function updateSect(id, fields) {
  const keys = Object.keys(fields).filter((k) => SECT_UPDATABLE.includes(k))
  if (keys.length === 0) return 0
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => fields[k])
  params.push(id)
  const result = await query(`UPDATE sects SET ${setSql} WHERE id = ?`, params)
  return result.affectedRows
}

// 解散宗门（事务）：先带守卫删宗门行（守卫未过即整体放弃），再清全体成员归属与成员表。
// 传 leaderId 时要求删除时刻仍由其执掌——宗主身份在事务内校验，防「传位提交后旧宗主仍解散」的并发窗口
// （与 transferLeader 的 UPDATE sects 互斥于同一行锁，谁后到谁失败）。返回受影响宗门行数（0=不存在/已易主）
export async function disbandSect(id, { leaderId = null } = {}) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const [del] = leaderId
      ? await conn.execute('DELETE FROM sects WHERE id = ? AND leader_id = ?', [id, leaderId])
      : await conn.execute('DELETE FROM sects WHERE id = ?', [id])
    if (del.affectedRows === 0) {
      await conn.rollback()
      return 0
    }
    await conn.execute('UPDATE users SET sect_id = NULL WHERE sect_id = ?', [id])
    await conn.execute('DELETE FROM sect_members WHERE sect_id = ?', [id])
    await conn.commit()
    return del.affectedRows
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// 删除玩家的手动级联用：其执掌的宗门一并解散（无宗主则宗门无法运转，先从简处理）
export async function disbandSectsLedBy(userId) {
  const rows = await query('SELECT id FROM sects WHERE leader_id = ?', [userId])
  for (const r of rows) {
    await disbandSect(r.id)
  }
  return rows.length
}

/* ---------- 成员与职位（sect_members；归属仍以 users.sect_id 为准，两处同事务写） ---------- */

// 查某用户的成员行（职位判定入口）；无则 null
export async function findMemberByUserId(userId) {
  const rows = await query(
    'SELECT id, sect_id, user_id, position, peak_id, joined_time FROM sect_members WHERE user_id = ? LIMIT 1',
    [userId]
  )
  return rows[0] || null
}

// 宗门成员列表：按职位职级排序（同职级按入宗先后），带道号/头像/性别/在线/境界
export async function listSectMembers(sectId, { page = 1, pageSize = 50 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50))
  const offset = (p - 1) * size
  const list = await query(
    `SELECT m.user_id, m.position, m.joined_time,
            u.dao_name, u.avatar, u.gender, u.is_online, u.realm_id, r.name AS realm_name
     FROM sect_members m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN realms r ON r.id = u.realm_id
     WHERE m.sect_id = ?
     ORDER BY FIELD(m.position, ${POSITION_FIELD}), m.joined_time ASC, m.id ASC
     LIMIT ${size} OFFSET ${offset}`,
    [sectId]
  )
  const totalRows = await query('SELECT COUNT(*) AS total FROM sect_members WHERE sect_id = ?', [sectId])
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

// 加入宗门（事务）：锁宗门行防解散竞态 → 原子入宗（无宗门+境界门槛守卫）→ 记外门弟子。
// 返回 {} 成功；{ error: 'sect_gone' | 'cannot_join' }
export async function joinSect({ userId, sectId }) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const [sects] = await conn.execute(
      'SELECT id, realm_req_rank FROM sects WHERE id = ? FOR UPDATE',
      [sectId]
    )
    if (sects.length === 0) {
      await conn.rollback()
      return { error: 'sect_gone' }
    }
    const [upd] = await conn.execute(
      `UPDATE users SET sect_id = ?
       WHERE id = ? AND role = 0 AND status = 1 AND sect_id IS NULL AND realm_id >= ?`,
      [sectId, userId, sects[0].realm_req_rank]
    )
    if (upd.affectedRows === 0) {
      await conn.rollback()
      return { error: 'cannot_join' }
    }
    await conn.execute(
      "INSERT INTO sect_members (sect_id, user_id, position) VALUES (?, ?, 'outer_disciple')",
      [sectId, userId]
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

// 离开宗门（事务）：删成员行（SQL 层拦宗主）+ 清归属。retire=退出/被逐共用。
// 返回受影响成员行数（0=非本宗成员或身为宗主）
export async function removeMember({ sectId, userId }) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const [del] = await conn.execute(
      "DELETE FROM sect_members WHERE sect_id = ? AND user_id = ? AND position != 'sect_master'",
      [sectId, userId]
    )
    if (del.affectedRows > 0) {
      await conn.execute('UPDATE users SET sect_id = NULL WHERE id = ? AND sect_id = ?', [userId, sectId])
    }
    await conn.commit()
    return del.affectedRows
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// 任免职位（事务）：定额职位先锁定在编行校验编制，再改任。
// 返回 {} 成功；{ error: 'quota_full' | 'not_member' }
export async function appointMember({ sectId, targetId, position, quota }) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    if (quota !== null && quota !== undefined) {
      const [cnt] = await conn.execute(
        'SELECT COUNT(*) AS c FROM sect_members WHERE sect_id = ? AND position = ? AND user_id != ? FOR UPDATE',
        [sectId, position, targetId]
      )
      if (cnt[0].c >= quota) {
        await conn.rollback()
        return { error: 'quota_full' }
      }
    }
    const [upd] = await conn.execute(
      "UPDATE sect_members SET position = ? WHERE sect_id = ? AND user_id = ? AND position != 'sect_master'",
      [position, sectId, targetId]
    )
    if (upd.affectedRows === 0) {
      await conn.rollback()
      return { error: 'not_member' }
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

// 转让宗主之位（事务）：新宗主须为本宗成员；原宗主卸任改任太上长老（编制校验）。
// 加锁顺序统一为「先 sects 行、后 sect_members」——与 disbandSect/joinSect 同序，
// 反序（先锁成员再锁宗门）会与并发解散互等死锁（全局错误处理无重试，死锁直接 500）。
// 返回 {} 成功；{ error: 'not_leader' | 'not_member' | 'taishang_full' }
export async function transferLeader({ sectId, fromId, toId, taishangQuota }) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    // 先锁宗门行并校验仍由 fromId 执掌（宗主身份进事务内判定）
    const [sects] = await conn.execute(
      'SELECT id FROM sects WHERE id = ? AND leader_id = ? FOR UPDATE',
      [sectId, fromId]
    )
    if (sects.length === 0) {
      await conn.rollback()
      return { error: 'not_leader' }
    }
    // 原宗主卸任后任太上长老：锁定在编太上校验编制
    const [cnt] = await conn.execute(
      "SELECT COUNT(*) AS c FROM sect_members WHERE sect_id = ? AND position = 'taishang_elder' FOR UPDATE",
      [sectId]
    )
    if (cnt[0].c >= taishangQuota) {
      await conn.rollback()
      return { error: 'taishang_full' }
    }
    const [toUpd] = await conn.execute(
      "UPDATE sect_members SET position = 'sect_master' WHERE sect_id = ? AND user_id = ?",
      [sectId, toId]
    )
    if (toUpd.affectedRows === 0) {
      await conn.rollback()
      return { error: 'not_member' }
    }
    await conn.execute(
      "UPDATE sect_members SET position = 'taishang_elder' WHERE sect_id = ? AND user_id = ?",
      [sectId, fromId]
    )
    await conn.execute('UPDATE sects SET leader_id = ? WHERE id = ?', [toId, sectId])
    await conn.commit()
    return {}
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
