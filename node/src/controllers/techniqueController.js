import {
  TECH_TIERS,
  techniqueMeta,
  listTechniques,
  findTechniqueById,
  createTechnique,
  updateTechnique,
  deleteTechnique,
} from '../models/techniqueModel.js'

// 品阶名映射（阶_品 → 中文档名）
const TIER_NAMES = {
  huang_low: '黄阶下品', huang_mid: '黄阶中品', huang_high: '黄阶上品',
  xuan_low: '玄阶下品', xuan_mid: '玄阶中品', xuan_high: '玄阶上品',
  di_low: '地阶下品', di_mid: '地阶中品', di_high: '地阶上品',
  tian_low: '天阶下品', tian_mid: '天阶中品', tian_high: '天阶上品',
  xian_low: '仙阶下品', xian_mid: '仙阶中品', xian_high: '仙阶上品',
}
const TYPE_NAMES = { main: '主功法', heart: '辅功法（心法）' }

// 功法效果只加五维（与设计文档一致：不碰资源/修为线），永久生效不设 duration/hours
const EFFECT_TARGETS = { hp: '气血', attack: '攻击力', defense: '防御力', spirit: '精神力', lingQi: '灵气' }
const EFFECT_TYPES = new Set(['percent', 'flat'])
const EFFECT_POLARITIES = new Set(['positive', 'negative'])

// 校验并规范化效果数组（五维/percent|flat/正负极性）；非法返回 { error }
export function sanitizeFiveStatEffects(raw, maxCount = 6) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > maxCount) {
    return { error: `效果必须为 1~${maxCount} 条的数组` }
  }
  const effects = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') return { error: '效果必须为对象' }
    if (!EFFECT_TARGETS[e.target]) return { error: `效果属性只能为五维(hp/attack/defense/spirit/lingQi): ${e.target}` }
    if (!EFFECT_TYPES.has(e.type)) return { error: `效果类型只能为 percent/flat: ${e.type}` }
    if (!EFFECT_POLARITIES.has(e.polarity)) return { error: `效果极性只能为 positive/negative: ${e.polarity}` }
    const value = Number(e.value)
    if (!Number.isFinite(value) || value <= 0 || value > 1e6) {
      return { error: '效果数值必须为 0~100万 的正数' }
    }
    effects.push({
      target: e.target,
      targetName: EFFECT_TARGETS[e.target],
      type: e.type,
      value: Math.round(value * 100) / 100,
      polarity: e.polarity,
    })
  }
  return { effects }
}

// 校验倍率曲线：正数数组、长度须等于满层数、逐层不降
export function sanitizeMultipliers(raw, maxLevel, label = '层数倍率') {
  if (!Array.isArray(raw) || raw.length !== maxLevel) {
    return { error: `${label}必须为长度等于满层数(${maxLevel})的数组` }
  }
  const arr = []
  let prev = 0
  for (const v of raw) {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0 || n > 100) return { error: `${label}必须为 0~100 的正数` }
    if (n < prev) return { error: `${label}须逐层不降` }
    prev = n
    arr.push(Math.round(n * 100) / 100)
  }
  return { multipliers: arr }
}

// 从请求体提取并校验功法字段；partial=true 时允许缺省（编辑），否则必填（新增）。
// 返回 { fields }（snake_case，JSON 列已 stringify）或 { error }；跨字段约束由调用方合并现值后再校验。
function extractFields(body, { partial = false } = {}) {
  const fields = {}

  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? '').trim().slice(0, 64)
    if (!name) return { error: '功法名不能为空' }
    fields.name = name
  }
  if (body.type !== undefined || !partial) {
    if (!TYPE_NAMES[body.type]) return { error: '类型只能为 main(主功法)/heart(心法)' }
    fields.type = body.type
    fields.type_name = TYPE_NAMES[body.type]
  }
  if (body.tier !== undefined || !partial) {
    if (!TECH_TIERS.includes(body.tier)) return { error: '品阶不合法（阶_品，如 huang_low）' }
    fields.tier = body.tier
    fields.tier_name = TIER_NAMES[body.tier]
  }
  if (body.category !== undefined) {
    fields.category = String(body.category).trim().slice(0, 16)
    fields.category_name = String(body.categoryName ?? body.category).trim().slice(0, 16)
  }
  if (body.realmMin !== undefined || !partial) {
    const v = parseInt(body.realmMin, 10)
    if (!Number.isInteger(v) || v < 1 || v > 83) return { error: '适用境界下限须为 1~83' }
    fields.realm_min = v
  }
  if (body.realmMax !== undefined || !partial) {
    const v = parseInt(body.realmMax, 10)
    if (!Number.isInteger(v) || v < 1 || v > 83) return { error: '适用境界上限须为 1~83' }
    fields.realm_max = v
  }
  if (body.maxLevel !== undefined || !partial) {
    const v = parseInt(body.maxLevel, 10)
    if (!Number.isInteger(v) || v < 1 || v > 6) return { error: '满层数须为 1~6' }
    fields.max_level = v
  }
  if (body.levelMultipliers !== undefined || !partial) {
    // 长度校验在调用方合并 max_level 后进行，此处先暂存原始数组
    fields.__multipliers = body.levelMultipliers
  }
  if (body.baseProgress !== undefined || !partial) {
    const v = parseInt(body.baseProgress, 10)
    if (!Number.isInteger(v) || v < 1 || v > 1e6) return { error: '熟练度基数须为 1~100万' }
    fields.base_progress = v
  }
  if (body.thresholdBase !== undefined || !partial) {
    const v = parseInt(body.thresholdBase, 10)
    if (!Number.isInteger(v) || v < 1 || v > 1e9) return { error: '层阈值基数须为 1~10亿' }
    fields.threshold_base = v
  }
  if (body.thresholdRatio !== undefined) {
    const v = Number(body.thresholdRatio)
    if (!Number.isFinite(v) || v < 1 || v > 10) return { error: '层阈值公比须为 1~10' }
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

// 跨字段约束：境界范围 min<max、倍率长度=满层数（编辑时用库中现值补缺）
function crossValidate(fields, current) {
  const realmMin = fields.realm_min ?? current?.realm_min
  const realmMax = fields.realm_max ?? current?.realm_max
  if (!(realmMin < realmMax)) return { error: '适用境界下限须小于上限' }

  const maxLevel = fields.max_level ?? current?.max_level
  if (fields.__multipliers !== undefined) {
    const r = sanitizeMultipliers(fields.__multipliers, maxLevel)
    if (r.error) return { error: r.error }
    fields.level_multipliers = JSON.stringify(r.multipliers)
    delete fields.__multipliers
  } else if (fields.max_level !== undefined && current) {
    // 只改满层数不改倍率：校验现有倍率长度是否匹配
    const cur = typeof current.level_multipliers === 'string'
      ? JSON.parse(current.level_multipliers)
      : current.level_multipliers
    if (!Array.isArray(cur) || cur.length !== maxLevel) {
      return { error: '满层数与现有倍率数组长度不符，请同时提交新的层数倍率' }
    }
  }
  return {}
}

// 列表（分页 + 类型/品阶/流派/关键字筛选）
export async function getTechniques(req, res, next) {
  try {
    const { page = 1, pageSize = 10, keyword = '', type = '', tier = '', category = '' } = req.query
    const result = await listTechniques({
      page,
      pageSize,
      keyword: String(keyword).trim(),
      type: String(type).trim(),
      tier: String(tier).trim(),
      category: String(category).trim(),
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// 筛选元数据
export async function getTechniqueMeta(req, res, next) {
  try {
    res.json(await techniqueMeta())
  } catch (err) {
    next(err)
  }
}

// 新增功法（id 服务端生成）
export async function addTechnique(req, res, next) {
  try {
    const { fields, error } = extractFields(req.body || {}, { partial: false })
    if (error) return res.status(400).json({ error })
    const cross = crossValidate(fields, null)
    if (cross.error) return res.status(400).json({ error: cross.error })

    fields.id = `tech_${fields.type}_${fields.tier}_a${Date.now()}`
    fields.category = fields.category ?? ''
    fields.category_name = fields.category_name ?? ''
    fields.threshold_ratio = fields.threshold_ratio ?? 2
    fields.summary = fields.summary ?? ''
    fields.intro = fields.intro ?? ''
    await createTechnique(fields)
    res.status(201).json({ technique: await findTechniqueById(fields.id) })
  } catch (err) {
    next(err)
  }
}

// 编辑功法（部分字段）
export async function editTechnique(req, res, next) {
  try {
    const id = String(req.params.id || '')
    const current = await findTechniqueById(id)
    if (!current) return res.status(404).json({ error: '功法不存在' })

    const { fields, error } = extractFields(req.body || {}, { partial: true })
    if (error) return res.status(400).json({ error })
    const cross = crossValidate(fields, current)
    if (cross.error) return res.status(400).json({ error: cross.error })

    await updateTechnique(id, fields)
    res.json({ technique: await findTechniqueById(id) })
  } catch (err) {
    next(err)
  }
}

// 删除功法（user_techniques 尚未实装，无需级联）
export async function removeTechnique(req, res, next) {
  try {
    const id = String(req.params.id || '')
    const affected = await deleteTechnique(id)
    if (!affected) return res.status(404).json({ error: '功法不存在' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
