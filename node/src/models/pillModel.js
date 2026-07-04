import { query } from '../config/db.js'

// 品质固定顺序：凡 → 灵 → 道
const GRADE_ORDER = "FIELD(grade, 'fan', 'ling', 'dao')"

// 筛选元数据：全部类型与境界（供后台下拉框）
export async function pillMeta() {
  const categories = await query(
    'SELECT DISTINCT category, category_name FROM pills ORDER BY category_name'
  )
  const realms = await query(
    'SELECT DISTINCT realm, realm_rank FROM pills ORDER BY realm_rank'
  )
  return { categories, realms }
}

// 分页 + 筛选（境界/类型精确匹配，关键字模糊匹配丹药名）；每个丹药附带三档品质
export async function listPills({ page = 1, pageSize = 10, keyword = '', category = '', realm = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size

  let where = 'WHERE 1=1'
  const params = []
  if (keyword) {
    where += ' AND name LIKE ?'
    params.push(`%${keyword}%`)
  }
  if (category) {
    where += ' AND category = ?'
    params.push(category)
  }
  if (realm) {
    where += ' AND realm = ?'
    params.push(realm)
  }

  // size/offset 已收敛为安全整数，直接内联（同 listUsers，规避 mysql2 的 LIMIT 占位符限制）
  const list = await query(
    `SELECT * FROM pills ${where} ORDER BY realm_rank ASC, category ASC, id ASC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total FROM pills ${where}`, params)

  // 批量取出本页丹药的品质档
  if (list.length > 0) {
    const ids = list.map((x) => x.id)
    const holders = ids.map(() => '?').join(',')
    const grades = await query(
      `SELECT * FROM pill_grades WHERE pill_id IN (${holders}) ORDER BY pill_id, ${GRADE_ORDER}`,
      ids
    )
    const byPill = new Map(list.map((x) => [x.id, []]))
    for (const g of grades) byPill.get(g.pill_id)?.push(g)
    for (const x of list) x.grades = byPill.get(x.id) || []
  }

  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

export async function findPillById(id) {
  const rows = await query('SELECT * FROM pills WHERE id = ? LIMIT 1', [id])
  const pill = rows[0]
  if (!pill) return null
  pill.grades = await query(
    `SELECT * FROM pill_grades WHERE pill_id = ? ORDER BY ${GRADE_ORDER}`,
    [id]
  )
  return pill
}

// 丹药级可编辑字段白名单
const PILL_UPDATABLE = ['name', 'note']

export async function updatePill(id, fields) {
  const keys = Object.keys(fields).filter((k) => PILL_UPDATABLE.includes(k))
  if (keys.length === 0) return 0
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => fields[k])
  params.push(id)
  const result = await query(`UPDATE pills SET ${setSql} WHERE id = ?`, params)
  return result.affectedRows
}

// 品质档可编辑字段白名单（effects 传入前需已校验并 JSON.stringify）
const GRADE_UPDATABLE = ['item_name', 'summary', 'effects']

export async function updatePillGrade(pillId, grade, fields) {
  const keys = Object.keys(fields).filter((k) => GRADE_UPDATABLE.includes(k))
  if (keys.length === 0) return 0
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => fields[k])
  params.push(pillId, grade)
  const result = await query(
    `UPDATE pill_grades SET ${setSql} WHERE pill_id = ? AND grade = ?`,
    params
  )
  return result.affectedRows
}
