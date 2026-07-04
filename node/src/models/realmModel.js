import { query } from '../config/db.js'

// 全部境界，按 id(境界序号) 升序
export async function listRealms() {
  return query('SELECT * FROM realms ORDER BY id ASC')
}

export async function countRealms() {
  const rows = await query('SELECT COUNT(*) AS c FROM realms')
  return rows[0].c
}

export async function findRealmById(id) {
  const rows = await query('SELECT * FROM realms WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
}

// 更新某境界的每日签到奖励百分比区间（min/max 已由调用方收敛到 0.1~3 且 min<=max）；返回受影响行数
export async function updateSignInRange(id, minPercent, maxPercent) {
  const result = await query(
    'UPDATE realms SET sign_in_min_percent = ?, sign_in_max_percent = ? WHERE id = ?',
    [minPercent, maxPercent, id]
  )
  return result.affectedRows
}

// 后台可编辑的境界字段白名单（id 为主键/序号，不可改）
const REALM_UPDATABLE = [
  'realm', 'stage', 'name', 'next_realm', 'requirement_type',
  'advance_exp', 'dao_yun_required', 'dao_law_required',
  'tribulation_type', 'tribulation_death_rate',
  'hp', 'ling_qi', 'attack', 'defense', 'spirit', 'note',
]

// 更新境界名称与属性：按白名单动态拼 SET；返回受影响行数
export async function updateRealm(id, fields) {
  const keys = Object.keys(fields).filter((k) => REALM_UPDATABLE.includes(k))
  if (keys.length === 0) return 0
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => fields[k])
  params.push(id)
  const result = await query(`UPDATE realms SET ${setSql} WHERE id = ?`, params)
  return result.affectedRows
}
