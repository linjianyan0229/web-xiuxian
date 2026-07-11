// 成丹材料 + 丹方 种子数据生成器
// 依据设计文档：docs/设计文档/丹药材料与丹方机制.md
//   - 材料按 22 个大境界档分层（凡人~大罗金仙）；仙王/仙帝/道祖/圣人（圣王以上）丹药不生成丹方
//   - 材料五类：herb 灵植 / mineral 矿石 / beast 兽材 / essence 精魄 / misc 丹引
//   - 稀有度五档：common 凡品 / uncommon 良品 / rare 上品 / epic 珍品 / legendary 绝品
//   - 价格 = 境界基准(5×1.55^档位) × 稀有度乘数 × 抖动；产出地按 凡俗/尘世/仙家 三界域分池
//   - 丹方：每丹 5~20 味（随境界档递增），1 味主药(上品+，类型呼应丹药类别) + 若干辅药 + 1 味丹引
// 运行：node generate-materials.mjs（在本目录），产物写入 node/src/data/pill-materials.json
// 生成为确定性（固定随机种子），改配置重跑即可全量重建。

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', '..', 'node', 'src', 'data')
const pillsData = JSON.parse(readFileSync(join(dataDir, 'pills.json'), 'utf8'))

// ---------- 确定性随机（mulberry32，同 generate-pools.mjs） ----------
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260711)
const rand = () => rng()
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

// ---------- 境界档（凡人~大罗金仙 22 档；仙王及以上不产材料） ----------
// realmRank = 大境界序号（与 pills.json 的 realmRank / pills.realm_rank 同语义）
// minRealmId = 该大境界最小 realms.id（与 users.realm_id 比较的境界门槛用）
const REALM_TIERS = [
  { realm: '凡人', key: 'fanren', realmRank: 1, minRealmId: 1 },
  { realm: '炼体', key: 'lianti', realmRank: 2, minRealmId: 2 },
  { realm: '练气', key: 'lianqi', realmRank: 3, minRealmId: 6 },
  { realm: '筑基', key: 'zhuji', realmRank: 4, minRealmId: 10 },
  { realm: '开光', key: 'kaiguang', realmRank: 5, minRealmId: 14 },
  { realm: '融合', key: 'ronghe', realmRank: 6, minRealmId: 18 },
  { realm: '心动', key: 'xindong', realmRank: 7, minRealmId: 22 },
  { realm: '金丹', key: 'jindan', realmRank: 8, minRealmId: 26 },
  { realm: '元婴', key: 'yuanying', realmRank: 9, minRealmId: 30 },
  { realm: '出窍', key: 'chuqiao', realmRank: 10, minRealmId: 34 },
  { realm: '分神', key: 'fenshen', realmRank: 11, minRealmId: 38 },
  { realm: '合体', key: 'heti', realmRank: 12, minRealmId: 42 },
  { realm: '洞虚', key: 'dongxu', realmRank: 13, minRealmId: 46 },
  { realm: '大乘', key: 'dacheng', realmRank: 14, minRealmId: 50 },
  { realm: '渡劫', key: 'dujie', realmRank: 15, minRealmId: 54 },
  { realm: '地仙', key: 'dixian', realmRank: 16, minRealmId: 58 },
  { realm: '天仙', key: 'tianxian', realmRank: 17, minRealmId: 62 },
  { realm: '真仙', key: 'zhenxian', realmRank: 18, minRealmId: 66 },
  { realm: '玄仙', key: 'xuanxian', realmRank: 19, minRealmId: 70 },
  { realm: '金仙', key: 'jinxian', realmRank: 20, minRealmId: 74 },
  { realm: '太乙金仙', key: 'taiyijinxian', realmRank: 21, minRealmId: 78 },
  { realm: '大罗金仙', key: 'daluojinxian', realmRank: 22, minRealmId: 79 },
]
const tierIndexOf = new Map(REALM_TIERS.map((t, i) => [t.realm, i]))
// 校验：材料档 realmRank 必须与 pills.json 同名境界的序号一致（防两侧语义再度漂移）
{
  const pillRankByRealm = new Map()
  for (const p of pillsData.pills) if (!pillRankByRealm.has(p.realm)) pillRankByRealm.set(p.realm, p.realmRank)
  for (const t of REALM_TIERS) {
    if (pillRankByRealm.get(t.realm) !== t.realmRank)
      throw new Error(`realmRank 不一致：${t.realm} 材料=${t.realmRank} 丹药=${pillRankByRealm.get(t.realm)}`)
  }
}
// 圣王以上（数据文件 immortalKingAndAbove）：不生成丹方
const NO_RECIPE_REALMS = new Set(['仙王', '仙帝', '道祖', '圣人'])

// ---------- 材料类型 ----------
const MATERIAL_TYPES = {
  herb: '灵植',
  mineral: '矿石',
  beast: '兽材',
  essence: '精魄',
  misc: '丹引',
}
// 每档各类型生成数量（合计 34/档 × 22 档 = 748 种）
const TYPE_COUNT_PER_TIER = { herb: 12, mineral: 7, beast: 7, essence: 5, misc: 3 }

// ---------- 稀有度 ----------
const RARITIES = [
  { key: 'common', name: '凡品', mult: 1, weightTo: 0.4 },
  { key: 'uncommon', name: '良品', mult: 2.5, weightTo: 0.7 },
  { key: 'rare', name: '上品', mult: 6, weightTo: 0.88 },
  { key: 'epic', name: '珍品', mult: 15, weightTo: 0.97 },
  { key: 'legendary', name: '绝品', mult: 40, weightTo: 1 },
]
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const rarityRank = (k) => RARITY_ORDER.indexOf(k)
function rollRarity() {
  const r = rand()
  return RARITIES.find((x) => r < x.weightTo)
}

// ---------- 产出地（三界域分池，各 10 处） ----------
const ORIGIN_ZONES = [
  {
    zone: 'mortal', // 档位 0~6（凡人~心动）
    maxTier: 6,
    places: ['青云山麓', '落霞谷', '乱石坡', '黑风林', '寒潭幽窟', '百草坡', '赤岩矿脉', '雾隐泽', '野狐岭', '断水崖'],
  },
  {
    zone: 'earth', // 档位 7~14（金丹~渡劫）
    maxTier: 14,
    places: ['昆吾秘境', '万兽山脉', '幽冥血海', '紫霄绝峰', '剑冢遗迹', '星陨荒漠', '沧澜海眼', '太虚幻境', '九幽裂谷', '荒古战场'],
  },
  {
    zone: 'immortal', // 档位 15~21（地仙~大罗金仙）
    maxTier: 21,
    places: ['九天罡风层', '瑶池仙泽', '混沌虚境', '周天星海', '不周残山', '弱水之渊', '扶桑神木林', '鸿蒙紫气带', '天河源头', '轮回道场'],
  },
]
function originPoolOf(tierIdx) {
  return ORIGIN_ZONES.find((z) => tierIdx <= z.maxTier).places
}

// ---------- 名称素材（前缀按界域分段，主体按类型） ----------
const PREFIXES = {
  mortal: ['青纹', '赤叶', '灰羽', '土灵', '溪畔', '石心', '野火', '寒露', '铁背', '黄芽', '白霜', '斑纹', '苦心', '甘泉', '晨曦', '暮岚', '荆棘', '沙砾', '碧痕', '朱果', '墨羽', '涧底', '崖顶', '雾生'],
  earth: ['紫霄', '幽冥', '碧灵', '玄冥', '金曜', '雪魄', '雷纹', '星辉', '月华', '血晶', '龙纹', '凤羽', '玄龟', '灵蛇', '冰髓', '炎心', '翠微', '丹霞', '暗影', '光曜', '风灵', '云隐', '狱火', '沧溟'],
  immortal: ['鸿蒙', '混沌', '太虚', '周天', '洞玄', '通冥', '瑶光', '璇玑', '天枢', '紫气', '道纹', '劫灰', '不朽', '造化', '归墟', '太初', '罡风', '仙韵', '虚空', '轮回', '万象', '玄黄', '大衍', '无量'],
}
const BODIES = {
  herb: ['草', '花', '芝', '果', '藤', '叶', '根', '莲', '菇'],
  mineral: ['铁', '晶', '玉', '砂', '髓', '石', '金', '铜'],
  beast: ['妖丹', '兽骨', '精血', '鳞甲', '兽筋', '羽翎', '獠牙', '兽魂'],
  essence: ['灵液', '真火', '寒泉', '精魄', '灵露', '气旋'],
  misc: ['丹引粉', '药泥', '辅浆', '引晶'],
}
function prefixPoolOf(tierIdx) {
  if (tierIdx <= 6) return PREFIXES.mortal
  if (tierIdx <= 14) return PREFIXES.earth
  return PREFIXES.immortal
}

// ---------- 描述模板 ----------
const DESC_BY_TYPE = {
  herb: (m) => `产于${m.origins[0]}的${m.rarityName}灵植，药性温养，多入${m.realm}级丹方。`,
  mineral: (m) => `采自${m.origins[0]}的${m.rarityName}矿材，质地坚凝，可固丹淬体。`,
  beast: (m) => `取自${m.origins[0]}妖兽的${m.rarityName}兽材，血气充盈，药力峻烈。`,
  essence: (m) => `凝于${m.origins[0]}的${m.rarityName}天地精魄，灵韵充沛，最难求得。`,
  misc: (m) => `${m.origins[0]}特产的${m.rarityName}丹引，调和诸药，炼丹不可或缺。`,
}

/* ================================================================
 * 一、材料库
 * ================================================================ */
const usedNames = new Set()
function uniqueName(tierIdx, type) {
  const prefixes = prefixPoolOf(tierIdx)
  const bodies = BODIES[type]
  for (let i = 0; i < 200; i++) {
    const name = pick(prefixes) + pick(bodies)
    if (!usedNames.has(name)) {
      usedNames.add(name)
      return name
    }
  }
  throw new Error(`名称池耗尽：tier=${tierIdx} type=${type}`)
}

const materials = []
const materialsByTier = REALM_TIERS.map(() => [])

for (let tierIdx = 0; tierIdx < REALM_TIERS.length; tierIdx++) {
  const tier = REALM_TIERS[tierIdx]
  const priceBase = 5 * Math.pow(1.55, tierIdx)
  const originPool = originPoolOf(tierIdx)
  let seq = 0
  for (const [type, count] of Object.entries(TYPE_COUNT_PER_TIER)) {
    for (let i = 0; i < count; i++) {
      // 兜底：每档每类型首个材料强制「上品」（保证主药可选）；丹引首个强制「凡品」（保证廉价引子）
      let rarity
      if (i === 0) rarity = RARITIES.find((r) => r.key === (type === 'misc' ? 'common' : 'rare'))
      else rarity = rollRarity()
      const originCount = randInt(1, 3)
      const origins = []
      const pool = [...originPool]
      for (let k = 0; k < originCount; k++) origins.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
      seq += 1
      const m = {
        id: `mat_${tier.key}_${String(seq).padStart(2, '0')}`,
        name: uniqueName(tierIdx, type),
        type,
        typeName: MATERIAL_TYPES[type],
        rarity: rarity.key,
        rarityName: rarity.name,
        realm: tier.realm,
        realmRank: tier.realmRank,
        minRealmId: tier.minRealmId,
        price: Math.max(1, Math.round(priceBase * rarity.mult * (0.85 + rand() * 0.35))),
        origins,
      }
      m.description = DESC_BY_TYPE[type](m)
      materials.push(m)
      materialsByTier[tierIdx].push(m)
    }
  }
}

/* ================================================================
 * 二、丹方（每丹一方；仙王及以上无）
 * ================================================================ */

// 丹药类别 → 主药类型倾向
const MAIN_TYPE_BY_CATEGORY = {
  cultivation_gain: ['herb'],
  healing: ['herb'],
  comprehension_up: ['herb', 'essence'],
  attack_up: ['beast'],
  defense_up: ['mineral'],
  spirit_up: ['essence', 'herb'],
  ling_qi_up: ['essence', 'herb'],
  healing_down: ['beast', 'herb'],
  comprehension_down: ['beast', 'herb'],
  attack_down: ['beast', 'mineral'],
  defense_down: ['beast', 'mineral'],
  spirit_down: ['beast', 'essence'],
  ling_qi_down: ['beast', 'essence'],
  death_save: ['essence'],
  breakthrough: ['essence'],
  dao_yun: ['essence'],
  dao_law: ['essence'],
}

const recipes = []
let skipped = 0

for (const pill of pillsData.pills) {
  if (NO_RECIPE_REALMS.has(pill.realm)) {
    skipped += 1
    continue
  }
  const tierIdx = tierIndexOf.get(pill.realm)
  if (tierIdx === undefined) throw new Error(`未知境界：${pill.realm}（${pill.id}）`)

  // 材料池：本档 + 低一档（凡人档只用本档）
  const poolTiers = tierIdx > 0 ? [...materialsByTier[tierIdx], ...materialsByTier[tierIdx - 1]] : [...materialsByTier[tierIdx]]

  // 味数：随境界档 5→20 递增，±2 抖动
  const n = Math.min(20, Math.max(5, 5 + Math.round((tierIdx * 13) / 21) + randInt(0, 2)))

  const chosen = new Set()
  const items = []

  // 1) 主药：本档、上品及以上、类型呼应类别（无匹配则逐步放宽）
  const mainTypes = MAIN_TYPE_BY_CATEGORY[pill.category] || ['herb']
  let mainPool = materialsByTier[tierIdx].filter((m) => mainTypes.includes(m.type) && rarityRank(m.rarity) >= rarityRank('rare'))
  if (!mainPool.length) mainPool = materialsByTier[tierIdx].filter((m) => rarityRank(m.rarity) >= rarityRank('rare'))
  const main = pick(mainPool)
  chosen.add(main.id)
  items.push({ materialId: main.id, name: main.name, quantity: randInt(1, 3), role: 'main' })

  // 2) 丹引：本档 misc 一味
  const miscPool = materialsByTier[tierIdx].filter((m) => m.type === 'misc')
  const catalyst = pick(miscPool)
  chosen.add(catalyst.id)

  // 3) 辅药：n-2 味，从本档+低一档的非丹引材料中抽取（不重复）
  const auxPool = poolTiers.filter((m) => m.type !== 'misc' && !chosen.has(m.id))
  for (let i = 0; i < n - 2 && auxPool.length; i++) {
    const idx = Math.floor(rand() * auxPool.length)
    const m = auxPool.splice(idx, 1)[0]
    chosen.add(m.id)
    items.push({ materialId: m.id, name: m.name, quantity: randInt(2, 9), role: 'aux' })
  }

  items.push({ materialId: catalyst.id, name: catalyst.name, quantity: randInt(1, 2), role: 'catalyst' })

  recipes.push({
    pillId: pill.id,
    pillName: pill.name,
    realm: pill.realm,
    realmRank: pill.realmRank,
    category: pill.category,
    materialCount: items.length,
    materials: items,
  })
}

/* ================================================================
 * 三、校验 + 输出
 * ================================================================ */
const matIndex = new Map(materials.map((m) => [m.id, m]))
for (const r of recipes) {
  if (r.materials.length < 5 || r.materials.length > 20) throw new Error(`味数越界：${r.pillId} = ${r.materials.length}`)
  for (const it of r.materials) {
    if (!matIndex.has(it.materialId)) throw new Error(`材料引用缺失：${r.pillId} → ${it.materialId}`)
  }
  const ids = r.materials.map((it) => it.materialId)
  if (new Set(ids).size !== ids.length) throw new Error(`材料重复：${r.pillId}`)
}
if (new Set(materials.map((m) => m.name)).size !== materials.length) throw new Error('材料名称重复')

const out = {
  version: 1,
  title: '成丹材料与丹方数据',
  rules: {
    noRecipeRealms: [...NO_RECIPE_REALMS],
    noRecipeNote: '仙王及以上（圣王以上）丹药不设丹方，无法炼制，只能由机缘获得。',
    materialTiers: '材料按 22 个大境界档分层（凡人~大罗金仙），丹方取本档为主、可掺低一档材料。',
    recipeSizeRule: '每丹 5~20 味：5 + round(档位×13/21) + 0~2 抖动；主药 1 味（上品+，类型呼应丹药类别）+ 辅药若干 + 丹引 1 味。',
    priceRule: 'price = round(5 × 1.55^档位 × 稀有度乘数 × 0.85~1.20 抖动)，单位灵石。',
    gradeNote: '同一丹方可炼凡/灵/道三品，成丹品质由炼丹系统结算（灵/道品可要求材料份数倍率，实装时定）。',
  },
  materialTypes: MATERIAL_TYPES,
  rarities: RARITIES.map(({ key, name, mult }) => ({ key, name, mult })),
  originZones: ORIGIN_ZONES.map(({ zone, places }) => ({ zone, places })),
  stats: {
    materialCount: materials.length,
    recipeCount: recipes.length,
    pillsWithoutRecipe: skipped,
  },
  materials,
  recipes,
}

const outPath = join(dataDir, 'pill-materials.json')
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')

// ---------- 统计报告 ----------
const rarityCount = {}
for (const m of materials) rarityCount[m.rarityName] = (rarityCount[m.rarityName] || 0) + 1
const sizes = recipes.map((r) => r.materials.length)
console.log(`材料 ${materials.length} 种（${Object.entries(rarityCount).map(([k, v]) => `${k}${v}`).join(' / ')}）`)
console.log(`丹方 ${recipes.length} 张（跳过圣王以上 ${skipped} 种）`)
console.log(`每方味数 ${Math.min(...sizes)} ~ ${Math.max(...sizes)}，均值 ${(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)}`)
console.log(`价格区间 ${Math.min(...materials.map((m) => m.price))} ~ ${Math.max(...materials.map((m) => m.price))} 灵石`)
console.log(`已写入 ${outPath}`)
