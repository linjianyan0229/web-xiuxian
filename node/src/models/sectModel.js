import { query, getPool } from '../config/db.js'

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

// 解散宗门（事务）：清空全体成员的 sect_id 并删除宗门行；返回受影响宗门行数（0=不存在）
export async function disbandSect(id) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute('UPDATE users SET sect_id = NULL WHERE sect_id = ?', [id])
    const [del] = await conn.execute('DELETE FROM sects WHERE id = ?', [id])
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
