import {
  pillMeta,
  listPills,
  findPillById,
  updatePill,
  updatePillGrade,
} from '../models/pillModel.js'

// 效果字段合法取值（与 pills.json 数据口径一致）
const EFFECT_TARGETS = new Set([
  'hp', 'maxHp', 'comprehension', 'attack', 'defense', 'spirit', 'lingQi',
  'cultivationGain', 'breakthroughChance', 'daoYun', 'daoLaw', 'deathSave',
])
const EFFECT_TYPES = new Set(['percent', 'flat'])
const EFFECT_DURATIONS = new Set(['temporary', 'instant', 'permanent', 'until_triggered', 'next_breakthrough'])
const EFFECT_POLARITIES = new Set(['positive', 'negative'])
const GRADES = new Set(['fan', 'ling', 'dao'])

// 校验并规范化效果数组；非法时返回 { error }，合法返回 { effects }
function sanitizeEffects(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 4) {
    return { error: 'effects 必须为 1~4 个效果的数组' }
  }
  const effects = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') return { error: '效果必须为对象' }
    if (!EFFECT_TARGETS.has(e.target)) return { error: `未知的效果属性: ${e.target}` }
    if (!EFFECT_TYPES.has(e.type)) return { error: `效果类型只能为 percent/flat: ${e.type}` }
    if (!EFFECT_DURATIONS.has(e.duration)) return { error: `未知的效果时效: ${e.duration}` }
    if (!EFFECT_POLARITIES.has(e.polarity)) return { error: `效果极性只能为 positive/negative: ${e.polarity}` }
    const value = Number(e.value)
    if (!Number.isFinite(value) || value < 0 || value > 1e9) {
      return { error: '效果数值必须为 0~10亿 的数字' }
    }
    const item = {
      target: e.target,
      targetName: String(e.targetName || '').slice(0, 32),
      type: e.type,
      value: Math.round(value * 100) / 100,
      duration: e.duration,
      polarity: e.polarity,
    }
    if (e.duration === 'temporary') {
      const hours = Number(e.hours)
      if (!Number.isFinite(hours) || hours <= 0 || hours > 720) {
        return { error: '临时效果需要 0~720 小时的持续时长' }
      }
      item.hours = Math.round(hours * 10) / 10
    }
    effects.push(item)
  }
  return { effects }
}

// 丹药列表（分页 + 境界/类型/关键字筛选，每项附带凡/灵/道三档）
export async function getPills(req, res, next) {
  try {
    const { page = 1, pageSize = 10, keyword = '', category = '', realm = '' } = req.query
    const result = await listPills({
      page,
      pageSize,
      keyword: String(keyword).trim(),
      category: String(category).trim(),
      realm: String(realm).trim(),
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// 筛选元数据：全部丹药类型与境界
export async function getPillMeta(req, res, next) {
  try {
    res.json(await pillMeta())
  } catch (err) {
    next(err)
  }
}

// 编辑丹药基础信息（名称/备注）
export async function editPill(req, res, next) {
  try {
    const id = String(req.params.id || '')
    const pill = await findPillById(id)
    if (!pill) return res.status(404).json({ error: '丹药不存在' })

    const body = req.body || {}
    const fields = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 64)
      if (!name) return res.status(400).json({ error: '丹药名不能为空' })
      fields.name = name
    }
    if (body.note !== undefined) {
      fields.note = String(body.note).trim().slice(0, 255)
    }

    await updatePill(id, fields)
    res.json({ pill: await findPillById(id) })
  } catch (err) {
    next(err)
  }
}

// 编辑某丹药某品质档：成品名 / 效果列表 / 摘要
export async function editPillGrade(req, res, next) {
  try {
    const id = String(req.params.id || '')
    const grade = String(req.params.grade || '')
    if (!GRADES.has(grade)) {
      return res.status(400).json({ error: '品质只能为 fan/ling/dao' })
    }
    const pill = await findPillById(id)
    if (!pill) return res.status(404).json({ error: '丹药不存在' })

    const body = req.body || {}
    const fields = {}
    if (body.itemName !== undefined) {
      const itemName = String(body.itemName).trim().slice(0, 64)
      if (!itemName) return res.status(400).json({ error: '成品名不能为空' })
      fields.item_name = itemName
    }
    if (body.summary !== undefined) {
      fields.summary = String(body.summary).trim().slice(0, 255)
    }
    if (body.effects !== undefined) {
      const r = sanitizeEffects(body.effects)
      if (r.error) return res.status(400).json({ error: r.error })
      fields.effects = JSON.stringify(r.effects)
    }

    const affected = await updatePillGrade(id, grade, fields)
    if (!affected && Object.keys(fields).length > 0) {
      // 品质档缺失（理论上种子数据齐全，不应发生）
      const exists = pill.grades.some((g) => g.grade === grade)
      if (!exists) return res.status(404).json({ error: '该品质档不存在' })
    }
    res.json({ pill: await findPillById(id) })
  } catch (err) {
    next(err)
  }
}
