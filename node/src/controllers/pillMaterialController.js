import {
  materialMeta,
  listMaterials,
  findMaterialById,
  findRecipeByPillId,
  listRecipes,
} from '../models/pillMaterialModel.js'
import { findPillById } from '../models/pillModel.js'

// ============ 后台：成丹材料 ============

// 材料列表（分页 + 类型/稀有度/境界/关键字筛选）
export async function adminGetMaterials(req, res, next) {
  try {
    const { page = 1, pageSize = 10, keyword = '', type = '', rarity = '', realm = '' } = req.query
    const result = await listMaterials({
      page,
      pageSize,
      keyword: String(keyword).trim(),
      type: String(type).trim(),
      rarity: String(rarity).trim(),
      realm: String(realm).trim(),
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// 筛选元数据：全部材料类型/稀有度/境界
export async function adminGetMaterialMeta(req, res, next) {
  try {
    res.json(await materialMeta())
  } catch (err) {
    next(err)
  }
}

// 单个材料详情
export async function adminGetMaterialDetail(req, res, next) {
  try {
    const material = await findMaterialById(String(req.params.id || ''))
    if (!material) return res.status(404).json({ error: '材料不存在' })
    res.json({ material })
  } catch (err) {
    next(err)
  }
}

// ============ 后台：丹方 ============

// 丹方列表（分页 + 境界/类型/关键字筛选，连丹药名）
export async function adminGetRecipes(req, res, next) {
  try {
    const { page = 1, pageSize = 10, keyword = '', realm = '', category = '' } = req.query
    const result = await listRecipes({
      page,
      pageSize,
      keyword: String(keyword).trim(),
      realm: String(realm).trim(),
      category: String(category).trim(),
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// 某丹药的丹方详情（含材料明细）
export async function adminGetPillRecipe(req, res, next) {
  try {
    const recipe = await findRecipeByPillId(String(req.params.id || ''))
    if (!recipe) return res.status(404).json({ error: '此丹无方（圣王以上丹药无法炼制）' })
    res.json({ recipe })
  } catch (err) {
    next(err)
  }
}

// ============ 玩家侧：丹方查阅（图鉴/炼丹预览用） ============

// 某丹药的丹方（玩家可查任意丹药的方子；圣王以上无方 404）
export async function getPillRecipe(req, res, next) {
  try {
    const pillId = String(req.params.pillId || '')
    const pill = await findPillById(pillId)
    if (!pill) return res.status(404).json({ error: '丹药不存在' })
    const recipe = await findRecipeByPillId(pillId)
    if (!recipe) return res.status(404).json({ error: '此丹无方，非人力可炼' })
    res.json({ recipe })
  } catch (err) {
    next(err)
  }
}
