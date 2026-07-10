import { query } from '../config/db.js'

// 品阶固定排序：法器 < 灵器 < 宝器 < 道器 < 仙器
export const ARTIFACT_TIERS = ['faqi', 'lingqi', 'baoqi', 'daoqi', 'xianqi']
const TIER_ORDER = `FIELD(tier, ${ARTIFACT_TIERS.map((k) => `'${k}'`).join(',')})`
// 类型固定排序：本命/攻击/防御/辅助
export const ARTIFACT_TYPES = ['natal', 'offense', 'defense', 'support']
const TYPE_ORDER = `FIELD(type, ${ARTIFACT_TYPES.map((k) => `'${k}'`).join(',')})`

// 筛选元数据：品阶/类型（供后台下拉）
export async function artifactMeta() {
  const tiers = await query(
    `SELECT DISTINCT tier, tier_name FROM artifacts ORDER BY ${TIER_ORDER}`
  )
  const types = await query(
    `SELECT DISTINCT type, type_name FROM artifacts ORDER BY ${TYPE_ORDER}`
  )
  return { tiers, types }
}

// 分页 + 筛选（类型/品阶精确，关键字模糊匹配法宝名）
export async function listArtifacts({ page = 1, pageSize = 10, keyword = '', type = '', tier = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size

  let where = 'WHERE 1=1'
  const params = []
  if (keyword) {
    where += ' AND name LIKE ?'
    params.push(`%${keyword}%`)
  }
  if (type) {
    where += ' AND type = ?'
    params.push(type)
  }
  if (tier) {
    where += ' AND tier = ?'
    params.push(tier)
  }

  // size/offset 已收敛为安全整数，直接内联（同 listPills，规避 mysql2 的 LIMIT 占位符限制）
  const list = await query(
    `SELECT * FROM artifacts ${where} ORDER BY ${TIER_ORDER}, ${TYPE_ORDER}, id ASC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total FROM artifacts ${where}`, params)
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

export async function findArtifactById(id) {
  const rows = await query('SELECT * FROM artifacts WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
}

// 新增（字段已在控制器校验并规范化；JSON 列传入前已 stringify）
export async function createArtifact(row) {
  await query(
    `INSERT INTO artifacts
      (id, name, type, type_name, tier, tier_name, category, realm_req, realm_req_rank,
       refine_max, refine_multipliers, refine_base, threshold_base, threshold_ratio,
       base_effects, summary, intro)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.name, row.type, row.type_name, row.tier, row.tier_name, row.category,
      row.realm_req, row.realm_req_rank, row.refine_max, row.refine_multipliers,
      row.refine_base, row.threshold_base, row.threshold_ratio,
      row.base_effects, row.summary, row.intro,
    ]
  )
  return row.id
}

// 可编辑字段白名单（id 不可改；JSON 列传入前已 stringify）
const ARTIFACT_UPDATABLE = [
  'name', 'type', 'type_name', 'tier', 'tier_name', 'category', 'realm_req', 'realm_req_rank',
  'refine_max', 'refine_multipliers', 'refine_base', 'threshold_base', 'threshold_ratio',
  'base_effects', 'summary', 'intro',
]

export async function updateArtifact(id, fields) {
  const keys = Object.keys(fields).filter((k) => ARTIFACT_UPDATABLE.includes(k))
  if (keys.length === 0) return 0
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => fields[k])
  params.push(id)
  const result = await query(`UPDATE artifacts SET ${setSql} WHERE id = ?`, params)
  return result.affectedRows
}

export async function deleteArtifact(id) {
  const result = await query('DELETE FROM artifacts WHERE id = ?', [id])
  return result.affectedRows
}
