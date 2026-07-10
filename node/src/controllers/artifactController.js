import {
  ARTIFACT_TIERS,
  ARTIFACT_TYPES,
  artifactMeta,
  listArtifacts,
  findArtifactById,
  createArtifact,
  updateArtifact,
  deleteArtifact,
} from '../models/artifactModel.js'
import { sanitizeFiveStatEffects, sanitizeMultipliers } from './techniqueController.js'
import { query } from '../config/db.js'

const TIER_NAMES = { faqi: '法器', lingqi: '灵器', baoqi: '宝器', daoqi: '道器', xianqi: '仙器' }
const TYPE_NAMES = { natal: '本命法宝', offense: '攻击法宝', defense: '防御法宝', support: '辅助法宝' }

// 装备境界要求：空=无要求(rank=1)；否则须为存在的大境界名，rank 取该大境界最小 realms.id
async function resolveRealmReq(realmReq) {
  const name = String(realmReq ?? '').trim().slice(0, 32)
  if (!name) return { realm_req: '', realm_req_rank: 1 }
  const rows = await query('SELECT MIN(id) AS min_id FROM realms WHERE realm = ?', [name])
  if (!rows[0]?.min_id) return { error: `未知的大境界: ${name}` }
  return { realm_req: name, realm_req_rank: rows[0].min_id }
}

// 从请求体提取并校验法宝字段；partial=true 允许缺省（编辑），否则必填（新增）
async function extractFields(body, { partial = false } = {}) {
  const fields = {}

  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? '').trim().slice(0, 64)
    if (!name) return { error: '法宝名不能为空' }
    fields.name = name
  }
  if (body.type !== undefined || !partial) {
    if (!TYPE_NAMES[body.type]) return { error: '类型只能为 natal/offense/defense/support' }
    fields.type = body.type
    fields.type_name = TYPE_NAMES[body.type]
  }
  if (body.tier !== undefined || !partial) {
    if (!ARTIFACT_TIERS.includes(body.tier)) return { error: '品阶只能为 faqi/lingqi/baoqi/daoqi/xianqi' }
    fields.tier = body.tier
    fields.tier_name = TIER_NAMES[body.tier]
  }
  if (body.category !== undefined) {
    fields.category = String(body.category).trim().slice(0, 16)
  }
  if (body.realmReq !== undefined || !partial) {
    const r = await resolveRealmReq(body.realmReq)
    if (r.error) return { error: r.error }
    fields.realm_req = r.realm_req
    fields.realm_req_rank = r.realm_req_rank
  }
  if (body.refineMax !== undefined || !partial) {
    const v = parseInt(body.refineMax, 10)
    if (!Number.isInteger(v) || v < 1 || v > 6) return { error: '满炼化层数须为 1~6' }
    fields.refine_max = v
  }
  if (body.refineMultipliers !== undefined || !partial) {
    fields.__multipliers = body.refineMultipliers // 长度校验在跨字段阶段（合并 refine_max）
  }
  if (body.refineBase !== undefined || !partial) {
    const v = parseInt(body.refineBase, 10)
    if (!Number.isInteger(v) || v < 1 || v > 1e6) return { error: '温养炼化基数须为 1~100万' }
    fields.refine_base = v
  }
  if (body.thresholdBase !== undefined || !partial) {
    const v = parseInt(body.thresholdBase, 10)
    if (!Number.isInteger(v) || v < 1 || v > 1e9) return { error: '炼化阈值基数须为 1~10亿' }
    fields.threshold_base = v
  }
  if (body.thresholdRatio !== undefined) {
    const v = Number(body.thresholdRatio)
    if (!Number.isFinite(v) || v < 1 || v > 10) return { error: '炼化阈值公比须为 1~10' }
    fields.threshold_ratio = Math.round(v * 100) / 100
  }
  if (body.baseEffects !== undefined || !partial) {
    const r = sanitizeFiveStatEffects(body.baseEffects)
    if (r.error) return { error: r.error }
    fields.base_effects = JSON.stringify(r.effects)
  }
  if (body.summary !== undefined) fields.summary = String(body.summary).trim().slice(0, 255)
  if (body.intro !== undefined) fields.intro = String(body.intro).trim().slice(0, 255)

  return { fields }
}

// 跨字段约束：炼化倍率长度=满层数（编辑时用库中现值补缺）
function crossValidate(fields, current) {
  const refineMax = fields.refine_max ?? current?.refine_max
  if (fields.__multipliers !== undefined) {
    const r = sanitizeMultipliers(fields.__multipliers, refineMax, '炼化倍率')
    if (r.error) return { error: r.error }
    fields.refine_multipliers = JSON.stringify(r.multipliers)
    delete fields.__multipliers
  } else if (fields.refine_max !== undefined && current) {
    const cur = typeof current.refine_multipliers === 'string'
      ? JSON.parse(current.refine_multipliers)
      : current.refine_multipliers
    if (!Array.isArray(cur) || cur.length !== refineMax) {
      return { error: '满炼化层数与现有倍率数组长度不符，请同时提交新的炼化倍率' }
    }
  }
  return {}
}

// 列表（分页 + 类型/品阶/关键字筛选）
export async function getArtifacts(req, res, next) {
  try {
    const { page = 1, pageSize = 10, keyword = '', type = '', tier = '' } = req.query
    const result = await listArtifacts({
      page,
      pageSize,
      keyword: String(keyword).trim(),
      type: String(type).trim(),
      tier: String(tier).trim(),
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// 筛选元数据
export async function getArtifactMeta(req, res, next) {
  try {
    res.json(await artifactMeta())
  } catch (err) {
    next(err)
  }
}

// 新增法宝（id 服务端生成）
export async function addArtifact(req, res, next) {
  try {
    const { fields, error } = await extractFields(req.body || {}, { partial: false })
    if (error) return res.status(400).json({ error })
    const cross = crossValidate(fields, null)
    if (cross.error) return res.status(400).json({ error: cross.error })

    fields.id = `artifact_${fields.tier}_${fields.type}_a${Date.now()}`
    fields.category = fields.category ?? ''
    fields.threshold_ratio = fields.threshold_ratio ?? 2
    fields.summary = fields.summary ?? ''
    fields.intro = fields.intro ?? ''
    await createArtifact(fields)
    res.status(201).json({ artifact: await findArtifactById(fields.id) })
  } catch (err) {
    next(err)
  }
}

// 编辑法宝（部分字段）
export async function editArtifact(req, res, next) {
  try {
    const id = String(req.params.id || '')
    const current = await findArtifactById(id)
    if (!current) return res.status(404).json({ error: '法宝不存在' })

    const { fields, error } = await extractFields(req.body || {}, { partial: true })
    if (error) return res.status(400).json({ error })
    const cross = crossValidate(fields, current)
    if (cross.error) return res.status(400).json({ error: cross.error })

    await updateArtifact(id, fields)
    res.json({ artifact: await findArtifactById(id) })
  } catch (err) {
    next(err)
  }
}

// 删除法宝（user_artifacts 尚未实装，无需级联）
export async function removeArtifact(req, res, next) {
  try {
    const id = String(req.params.id || '')
    const affected = await deleteArtifact(id)
    if (!affected) return res.status(404).json({ error: '法宝不存在' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
