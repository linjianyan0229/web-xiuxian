import { query } from '../config/db.js'

// 品阶固定排序：黄/玄/地/天/仙 × 下/中/上品（15 档）
export const TECH_TIERS = [
  'huang_low', 'huang_mid', 'huang_high',
  'xuan_low', 'xuan_mid', 'xuan_high',
  'di_low', 'di_mid', 'di_high',
  'tian_low', 'tian_mid', 'tian_high',
  'xian_low', 'xian_mid', 'xian_high',
]
const TIER_ORDER = `FIELD(t.tier, ${TECH_TIERS.map((k) => `'${k}'`).join(',')})`

// 列表视图：连境界表带出适用范围名称
const TECH_SELECT = `
  SELECT t.*, r1.name AS realm_min_name, r2.name AS realm_max_name
  FROM techniques t
  LEFT JOIN realms r1 ON r1.id = t.realm_min
  LEFT JOIN realms r2 ON r2.id = t.realm_max
`

// 筛选元数据：品阶/类型/流派（供后台下拉）
export async function techniqueMeta() {
  const tiers = await query(
    `SELECT DISTINCT t.tier, t.tier_name FROM techniques t ORDER BY ${TIER_ORDER}`
  )
  const categories = await query(
    'SELECT DISTINCT category, category_name FROM techniques ORDER BY category'
  )
  return { tiers, categories }
}

// 分页 + 筛选（类型/品阶/流派精确，关键字模糊匹配功法名）
export async function listTechniques({ page = 1, pageSize = 10, keyword = '', type = '', tier = '', category = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size

  let where = 'WHERE 1=1'
  const params = []
  if (keyword) {
    where += ' AND t.name LIKE ?'
    params.push(`%${keyword}%`)
  }
  if (type) {
    where += ' AND t.type = ?'
    params.push(type)
  }
  if (tier) {
    where += ' AND t.tier = ?'
    params.push(tier)
  }
  if (category) {
    where += ' AND t.category = ?'
    params.push(category)
  }

  // size/offset 已收敛为安全整数，直接内联（同 listPills，规避 mysql2 的 LIMIT 占位符限制）
  const list = await query(
    `${TECH_SELECT} ${where} ORDER BY ${TIER_ORDER}, t.type ASC, t.id ASC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total FROM techniques t ${where}`, params)
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

export async function findTechniqueById(id) {
  const rows = await query(`${TECH_SELECT} WHERE t.id = ? LIMIT 1`, [id])
  return rows[0] || null
}

// 新增（字段已在控制器校验并规范化；JSON 列传入前已 stringify）
export async function createTechnique(row) {
  await query(
    `INSERT INTO techniques
      (id, name, type, type_name, tier, tier_name, category, category_name,
       realm_min, realm_max, max_level, level_multipliers, base_progress,
       threshold_base, threshold_ratio, base_effects, summary, intro)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.name, row.type, row.type_name, row.tier, row.tier_name,
      row.category, row.category_name, row.realm_min, row.realm_max, row.max_level,
      row.level_multipliers, row.base_progress, row.threshold_base, row.threshold_ratio,
      row.base_effects, row.summary, row.intro,
    ]
  )
  return row.id
}

// 可编辑字段白名单（id 不可改；JSON 列传入前已 stringify）
const TECH_UPDATABLE = [
  'name', 'type', 'type_name', 'tier', 'tier_name', 'category', 'category_name',
  'realm_min', 'realm_max', 'max_level', 'level_multipliers', 'base_progress',
  'threshold_base', 'threshold_ratio', 'base_effects', 'summary', 'intro',
]

export async function updateTechnique(id, fields) {
  const keys = Object.keys(fields).filter((k) => TECH_UPDATABLE.includes(k))
  if (keys.length === 0) return 0
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => fields[k])
  params.push(id)
  const result = await query(`UPDATE techniques SET ${setSql} WHERE id = ?`, params)
  return result.affectedRows
}

export async function deleteTechnique(id) {
  const result = await query('DELETE FROM techniques WHERE id = ?', [id])
  return result.affectedRows
}
