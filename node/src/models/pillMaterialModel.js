import { query } from '../config/db.js'

// 稀有度固定顺序：凡品 → 良品 → 上品 → 珍品 → 绝品
const RARITY_ORDER = "FIELD(rarity, 'common', 'uncommon', 'rare', 'epic', 'legendary')"
// 丹方内材料固定顺序：主药 → 辅药 → 丹引（同 sort_order，冗余一道保险）
const ROLE_ORDER = "FIELD(i.role, 'main', 'aux', 'catalyst')"

// 筛选元数据：全部类型/稀有度/境界（供下拉框）
export async function materialMeta() {
  const types = await query(
    `SELECT DISTINCT type, type_name FROM pill_materials ORDER BY FIELD(type, 'herb', 'mineral', 'beast', 'essence', 'misc')`
  )
  const rarities = await query(
    `SELECT DISTINCT rarity, rarity_name FROM pill_materials ORDER BY ${RARITY_ORDER}`
  )
  const realms = await query(
    'SELECT DISTINCT realm, realm_rank FROM pill_materials ORDER BY realm_rank'
  )
  return { types, rarities, realms }
}

// 分页 + 筛选（类型/稀有度/境界精确匹配，关键字模糊匹配材料名）
export async function listMaterials({ page = 1, pageSize = 10, keyword = '', type = '', rarity = '', realm = '' } = {}) {
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
  if (rarity) {
    where += ' AND rarity = ?'
    params.push(rarity)
  }
  if (realm) {
    where += ' AND realm = ?'
    params.push(realm)
  }

  // size/offset 已收敛为安全整数，直接内联（同 listPills，规避 mysql2 的 LIMIT 占位符限制）
  const list = await query(
    `SELECT * FROM pill_materials ${where} ORDER BY realm_rank ASC, ${RARITY_ORDER} ASC, id ASC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(`SELECT COUNT(*) AS total FROM pill_materials ${where}`, params)
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}

export async function findMaterialById(id) {
  const rows = await query('SELECT * FROM pill_materials WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
}

// 单张丹方（含材料明细连表：材料名/类型/稀有度/价格/产出地）；无丹方（圣王以上）返回 null
export async function findRecipeByPillId(pillId) {
  const rows = await query(
    `SELECT r.pill_id, r.material_count, p.name AS pill_name, p.realm, p.realm_rank, p.category, p.category_name
     FROM pill_recipes r
     JOIN pills p ON p.id = r.pill_id
     WHERE r.pill_id = ? LIMIT 1`,
    [pillId]
  )
  const recipe = rows[0]
  if (!recipe) return null
  recipe.items = await query(
    `SELECT i.material_id, i.quantity, i.role, i.sort_order,
            m.name, m.type, m.type_name, m.rarity, m.rarity_name,
            m.realm, m.realm_rank, m.price, m.origins, m.description
     FROM pill_recipe_items i
     JOIN pill_materials m ON m.id = i.material_id
     WHERE i.pill_id = ?
     ORDER BY ${ROLE_ORDER}, i.sort_order`,
    [pillId]
  )
  return recipe
}

// 丹方分页列表（供后台总览；keyword 模糊匹配丹药名）
export async function listRecipes({ page = 1, pageSize = 10, keyword = '', realm = '', category = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size

  let where = 'WHERE 1=1'
  const params = []
  if (keyword) {
    where += ' AND p.name LIKE ?'
    params.push(`%${keyword}%`)
  }
  if (realm) {
    where += ' AND p.realm = ?'
    params.push(realm)
  }
  if (category) {
    where += ' AND p.category = ?'
    params.push(category)
  }

  const list = await query(
    `SELECT r.pill_id, r.material_count, p.name AS pill_name, p.realm, p.realm_rank, p.category, p.category_name
     FROM pill_recipes r
     JOIN pills p ON p.id = r.pill_id
     ${where}
     ORDER BY p.realm_rank ASC, p.category ASC, r.pill_id ASC
     LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const totalRows = await query(
    `SELECT COUNT(*) AS total FROM pill_recipes r JOIN pills p ON p.id = r.pill_id ${where}`,
    params
  )
  return { list, total: totalRows[0].total, page: p, pageSize: size }
}
