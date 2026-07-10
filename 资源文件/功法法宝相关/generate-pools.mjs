// 功法/心法/法宝 种子数据生成器
// 依据设计文档：docs/设计文档/功法机制.md、docs/设计文档/法宝机制.md
//   - 功法+心法共用 techniques.json（type: main/heart），黄/玄/地/天/仙 五阶 × 下/中/上品 = 15 档
//   - 法宝 artifacts.json，按初稿倾向只用五阶（法器<灵器<宝器<道器<仙器，不分品）
//   - 效果模型复用丹药 {target,targetName,type,value,polarity}，永久生效不设 hours
//   - base_effects 为「基础加成」，实际加成 = base × 层数/炼化倍率（数据只填一套 base + 一条倍率曲线）
// 运行：node generate-pools.mjs（在本目录），产物写入 node/src/data/techniques.json、artifacts.json
// 生成为确定性（固定随机种子），改配置重跑即可全量重建。

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', '..', 'node', 'src', 'data')
const realms = JSON.parse(readFileSync(join(dataDir, 'realms.json'), 'utf8'))
const realmNameOf = (id) => realms.find((r) => r.id === id)?.name || String(id)

// ---------- 确定性随机（mulberry32） ----------
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
const rng = mulberry32(20260710)
const rand = () => rng()
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const jitter = (v, lo = 0.88, hi = 1.12) => v * (lo + rand() * (hi - lo))

// ---------- 五维属性（对齐 pills.json statNames 命名） ----------
const STAT_NAMES = {
  hp: '气血',
  attack: '攻击力',
  defense: '防御力',
  spirit: '精神力',
  lingQi: '灵气',
}
const FIVE = Object.keys(STAT_NAMES)

function effect(target, value, polarity = 'positive') {
  return {
    target,
    targetName: STAT_NAMES[target],
    type: 'percent',
    value,
    polarity,
  }
}
function summarize(effects) {
  return effects
    .map((e) => `${e.targetName}${e.polarity === 'negative' ? '−' : '+'}${e.value}%`)
    .join('、')
}

/* ================================================================
 * 一、功法 + 心法（techniques.json）
 * ================================================================ */

// 五阶：境界范围按设计文档建议段位映射 realms.id
// （黄=凡人~筑基、玄=筑基~元婴、地=元婴~大乘、天=大乘~天仙、仙=地仙~仙王）
const T_TIERS = [
  { tier: 'huang', name: '黄阶', P: { low: 2, mid: 3, high: 4 }, realmMin: 1, realmMax: 13, maxLevel: 4, thresholdBase: 100, baseProgress: 10 },
  { tier: 'xuan', name: '玄阶', P: { low: 5, mid: 7, high: 9 }, realmMin: 10, realmMax: 33, maxLevel: 4, thresholdBase: 200, baseProgress: 14 },
  { tier: 'di', name: '地阶', P: { low: 11, mid: 14, high: 17 }, realmMin: 30, realmMax: 53, maxLevel: 5, thresholdBase: 400, baseProgress: 20 },
  { tier: 'tian', name: '天阶', P: { low: 20, mid: 25, high: 30 }, realmMin: 50, realmMax: 65, maxLevel: 5, thresholdBase: 800, baseProgress: 28 },
  { tier: 'xian', name: '仙阶', P: { low: 36, mid: 44, high: 52 }, realmMin: 58, realmMax: 80, maxLevel: 5, thresholdBase: 1600, baseProgress: 40 },
]
const GRADES = [
  { key: 'low', name: '下品', thresholdMul: 1 },
  { key: 'mid', name: '中品', thresholdMul: 1.25 },
  { key: 'high', name: '上品', thresholdMul: 1.5 },
]
// 层数倍率曲线（设计初稿）：入门/小成/大成/圆满/(登峰造极)
const LEVEL_MULTIPLIERS = [1, 1.6, 2.4, 3.4, 4.6]
const LEVEL_NAMES = ['入门', '小成', '大成', '圆满', '登峰造极']

// 流派：五维权重（主功法均衡带偏向；权重合计≈5，均值≈P）
const CATEGORIES = [
  { key: 'sword', name: '剑修', w: { attack: 1.5, spirit: 1.1, lingQi: 0.9, hp: 0.8, defense: 0.7 }, focus: ['attack', 'spirit'] },
  { key: 'body', name: '体修', w: { hp: 1.5, defense: 1.3, attack: 0.9, lingQi: 0.7, spirit: 0.6 }, focus: ['hp', 'defense'] },
  { key: 'guard', name: '护道', w: { defense: 1.5, hp: 1.2, lingQi: 0.9, attack: 0.7, spirit: 0.7 }, focus: ['defense', 'hp'] },
  { key: 'soul', name: '神魂', w: { spirit: 1.5, lingQi: 1.2, attack: 0.9, hp: 0.7, defense: 0.7 }, focus: ['spirit', 'lingQi'] },
  { key: 'qi', name: '灵息', w: { lingQi: 1.5, spirit: 1.1, hp: 0.9, defense: 0.8, attack: 0.7 }, focus: ['lingQi', 'spirit'] },
  { key: 'balanced', name: '圆融', w: { hp: 1, attack: 1, defense: 1, spirit: 1, lingQi: 1 }, focus: ['attack', 'defense'] },
]

// 命名词库：按阶取气象，前缀×流派主题×后缀 组合保证量大且贴味
const T_PREFIX = {
  huang: ['青岩', '赤枫', '黄芦', '铁衣', '苍狼', '石泉', '山南', '溪云', '枯藤', '野狐', '土行', '荒火', '白杨', '黑水', '孤峰', '寒鸦', '断崖', '古井'],
  xuan: ['玄冰', '紫电', '碧落', '流火', '惊涛', '裂空', '幽泉', '霜月', '雷鸣', '赤霄', '青冥', '玉虚', '沧浪', '斩风', '夜枭', '丹霞', '皓月', '疾影'],
  di: ['地煞', '山河', '九幽', '焚天', '镇狱', '沧海', '奔雷', '蚀日', '千机', '血河', '昆吾', '岱舆', '阴阳', '星陨', '龙渊', '孽海', '塌岳', '冥河'],
  tian: ['天罡', '紫微', '周天', '焚寰', '霜天', '斗转', '星河', '御雷', '凌霄', '贯日', '擎天', '神霄', '太玄', '斩尘', '万象', '昊阳', '摘星', '天衍'],
  xian: ['太初', '鸿蒙', '混沌', '无量', '大衍', '太上', '紫霄', '不朽', '造化', '永恒', '寂灭', '开天', '道一', '真如', '无极', '弥罗', '亘古', '归墟'],
}
const T_THEME = {
  sword: ['剑气', '御剑', '剑心', '飞虹', '断岳', '诛邪', '青锋', '剑罡', '万剑', '剑意'],
  body: ['炼体', '金身', '磐岩', '龙象', '霸体', '淬骨', '玄武', '不坏', '熔金', '撼山'],
  guard: ['护体', '玄盾', '镇岳', '庇霄', '城垣', '龟甲', '守一', '磐守', '固元', '罩身'],
  soul: ['凝神', '摄魂', '观心', '明识', '神游', '照虚', '洞冥', '御神', '通幽', '铸魂'],
  qi: ['聚灵', '纳气', '引灵', '周天', '灵潮', '吐纳', '汇脉', '蕴灵', '化炁', '灵漩'],
  balanced: ['混元', '太和', '归一', '圆融', '两仪', '中枢', '抱朴', '通玄', '衡天', '五行'],
}
const MAIN_SUFFIX = ['诀', '功', '经', '真经', '宝典', '秘录', '真解', '神功', '玄章', '天书']
const HEART_SUFFIX = ['心法', '心经', '内篇', '吐纳法', '凝神篇', '养气诀', '定心咒', '观想法', '温养篇', '守一诀']

const usedTechNames = new Set()
function techName(tierKey, catKey, suffixPool) {
  for (let i = 0; i < 60; i++) {
    const n = pick(T_PREFIX[tierKey]) + pick(T_THEME[catKey]) + pick(suffixPool)
    if (!usedTechNames.has(n)) {
      usedTechNames.add(n)
      return n
    }
  }
  // 兜底：追加序号（正常词库容量下几乎不会走到）
  const n = pick(T_PREFIX[tierKey]) + pick(T_THEME[catKey]) + pick(suffixPool) + usedTechNames.size
  usedTechNames.add(n)
  return n
}

// 境界范围：在阶窗口内做小幅抖动，让同档功法范围略有差异
function techRealmRange(t) {
  let min = t.realmMin + randInt(0, 2)
  let max = t.realmMax - randInt(0, 2)
  if (max - min < 4) max = Math.min(83, min + 4)
  return [min, max]
}

const MAIN_INTROS = [
  '{tier}{cat}正法，讲求{theme}，运转日久，五脏生辉。',
  '上古残篇整理而成的{tier}功法，{cat}一脉奉为圭臬。',
  '此功走{cat}一路，入门艰涩，成则{theme}，威能自显。',
  '{tier}法门，脉络堂皇，最重根基，层层递进如登天梯。',
  '相传出自某位无名大能之手，{cat}真意尽在其中。',
]
const HEART_INTROS = [
  '{tier}心法，静中求进，温养经络，为主功法之佐。',
  '打坐吐纳间默运此篇，{theme}之效日积月累。',
  '此心法不求猛进，惟求绵长，辅修者众。',
  '{cat}一脉的辅修法门，与主功法相辅相成。',
  '心随意动，意随气行——此篇所授，尽是水磨工夫。',
]
function fillIntro(tpl, t, cat) {
  return tpl.replaceAll('{tier}', t.name).replaceAll('{cat}', cat.name).replaceAll('{theme}', '气机圆融')
}

// 主功法：每档 每流派 4 部 → 15 档 × 24 = 360
// 心法：  每档 每流派轮转共 16 部 → 15 档 × 16 = 240
const techniques = []
let seq = 0
for (const t of T_TIERS) {
  for (const g of GRADES) {
    const tierKey = `${t.tier}_${g.key}`
    const tierName = `${t.name}${g.name}`
    const P = t.P[g.key]
    const thresholdBase = Math.round(t.thresholdBase * g.thresholdMul)
    const multipliers = LEVEL_MULTIPLIERS.slice(0, t.maxLevel)

    // ---- 主功法 ----
    for (const cat of CATEGORIES) {
      for (let i = 0; i < 4; i++) {
        seq += 1
        const [rMin, rMax] = techRealmRange(t)
        const effects = FIVE.map((k) => effect(k, Math.max(1, Math.round(jitter(P * cat.w[k]))))).filter(
          (e) => e.value > 0
        )
        techniques.push({
          id: `tech_main_${tierKey}_${String(seq).padStart(4, '0')}`,
          name: techName(t.tier, cat.key, MAIN_SUFFIX),
          type: 'main',
          typeName: '主功法',
          tier: tierKey,
          tierName,
          category: cat.key,
          categoryName: cat.name,
          realmMin: rMin,
          realmMax: rMax,
          realmMinName: realmNameOf(rMin),
          realmMaxName: realmNameOf(rMax),
          maxLevel: t.maxLevel,
          levelMultipliers: multipliers,
          baseProgress: t.baseProgress,
          thresholdBase,
          thresholdRatio: 2,
          baseEffects: effects,
          summary: summarize(effects) + '（基础值，随层数倍率放大）',
          intro: fillIntro(pick(MAIN_INTROS), t, cat),
        })
      }
    }

    // ---- 心法（辅功法）：偏科 1~2 项，值更凶但覆盖窄 ----
    for (let i = 0; i < 16; i++) {
      seq += 1
      const cat = CATEGORIES[i % CATEGORIES.length]
      const [rMin, rMax] = techRealmRange(t)
      const single = rand() < 0.4
      const effects = single
        ? [effect(cat.focus[0], Math.max(1, Math.round(jitter(P * 2.2))))]
        : [
            effect(cat.focus[0], Math.max(1, Math.round(jitter(P * 1.8)))),
            effect(cat.focus[1], Math.max(1, Math.round(jitter(P * 1.0)))),
          ]
      techniques.push({
        id: `tech_heart_${tierKey}_${String(seq).padStart(4, '0')}`,
        name: techName(t.tier, cat.key, HEART_SUFFIX),
        type: 'heart',
        typeName: '辅功法（心法）',
        tier: tierKey,
        tierName,
        category: cat.key,
        categoryName: cat.name,
        realmMin: rMin,
        realmMax: rMax,
        realmMinName: realmNameOf(rMin),
        realmMaxName: realmNameOf(rMax),
        maxLevel: t.maxLevel,
        levelMultipliers: multipliers,
        baseProgress: t.baseProgress,
        thresholdBase,
        thresholdRatio: 2,
        baseEffects: effects,
        summary: summarize(effects) + '（基础值，随层数倍率放大）',
        intro: fillIntro(pick(HEART_INTROS), t, cat),
      })
    }
  }
}

/* ================================================================
 * 二、法宝（artifacts.json）
 * ================================================================ */

// 五阶（初稿倾向：不再分下/中/上品）；装备境界要求按设计建议段位（realm_req 大境界门槛）
const A_TIERS = [
  { tier: 'faqi', name: '法器', P: 3, refineMax: 3, thresholdBase: 100, refineBase: 10, realmReq: '', realmReqRank: 1 },
  { tier: 'lingqi', name: '灵器', P: 7, refineMax: 3, thresholdBase: 200, refineBase: 12, realmReq: '筑基', realmReqRank: 10 },
  { tier: 'baoqi', name: '宝器', P: 14, refineMax: 4, thresholdBase: 400, refineBase: 16, realmReq: '元婴', realmReqRank: 30 },
  { tier: 'daoqi', name: '道器', P: 24, refineMax: 4, thresholdBase: 800, refineBase: 20, realmReq: '合体', realmReqRank: 42, backlashChance: 0.4 },
  { tier: 'xianqi', name: '仙器', P: 40, refineMax: 5, thresholdBase: 1600, refineBase: 26, realmReq: '地仙', realmReqRank: 58, backlashChance: 0.6 },
]
// 炼化倍率曲线（设计初稿）：初通/相契/交融/人宝合一/圆满
const REFINE_MULTIPLIERS = [1, 1.5, 2.2, 3, 4]
const REFINE_LEVEL_NAMES = ['初通', '相契', '交融', '人宝合一', '圆满']

// 类型：偏科加成模板（value = P × 系数）+ 反噬承受属性
const A_TYPES = [
  {
    type: 'natal',
    name: '本命法宝',
    slots: '本命槽',
    make: (P) => FIVE.map((k) => effect(k, Math.max(1, Math.round(jitter(P * 0.9))))),
    backlashTarget: null, // 本命法宝与主人性命相连，不设反噬（五维全沾，负面词条会与正面撞属性）
    nouns: ['本命飞剑', '命魂珠', '本命金灯', '元神幡', '命轮', '本命葫芦', '魂灯', '命符', '元胎镜', '本命钟', '识海塔', '命星盘'],
  },
  {
    type: 'offense',
    name: '攻击法宝',
    slots: '攻击槽',
    make: (P) => [
      effect('attack', Math.max(1, Math.round(jitter(P * 1.6)))),
      effect('spirit', Math.max(1, Math.round(jitter(P * 0.8)))),
    ],
    backlashTarget: 'defense',
    nouns: ['飞剑', '法印', '飞刀', '杀阵旗', '雷梭', '火轮', '断魂枪', '诛神戈', '裂空斧', '穿云箭', '幽冥钩', '惊雷锤'],
  },
  {
    type: 'defense',
    name: '防御法宝',
    slots: '防御槽',
    make: (P) => [
      effect('defense', Math.max(1, Math.round(jitter(P * 1.6)))),
      effect('hp', Math.max(1, Math.round(jitter(P * 0.8)))),
    ],
    backlashTarget: 'attack',
    nouns: ['宝甲', '灵盾', '玄武幡', '镇魂钟', '琉璃璧', '护心镜', '浮屠塔', '罡气罩', '龟甲盾', '石鳞铠', '锁灵环', '避劫珠'],
  },
  {
    type: 'support',
    name: '辅助法宝',
    slots: '辅助槽',
    make: (P) => [
      effect('lingQi', Math.max(1, Math.round(jitter(P * 1.4)))),
      effect('spirit', Math.max(1, Math.round(jitter(P * 1.0)))),
    ],
    backlashTarget: 'hp',
    nouns: ['聚灵珠', '引灵幡', '醒神铃', '聚气盘', '灵犀笛', '望气镜', '缚灵索', '乾坤葫', '清心木鱼', '引雷针', '遁光梭', '藏风袋'],
  },
]
const A_PREFIX = {
  faqi: ['青铜', '寒铁', '桃木', '黑石', '粗玉', '百炼', '铜纹', '素绢', '轻岚', '山纹', '鱼鳞', '柳叶', '斑竹', '磨盘', '沙金', '乌木'],
  lingqi: ['寒光', '碧玉', '紫纹', '流云', '聚灵', '霜华', '青蛟', '赤炎', '游雷', '月魄', '玄铁', '灵犀', '风隼', '秋水', '螭吻', '白泽'],
  baoqi: ['九转', '玄阳', '沧溟', '斗宿', '离火', '坎水', '锁岳', '吞霄', '御虚', '斩龙', '星纹', '雷泽', '幽都', '烛照', '苍梧', '重明'],
  daoqi: ['大衍', '周天', '化道', '灭谛', '天枢', '紫府', '洞真', '斩因', '万化', '道纹', '玄黄', '太阴', '太阳', '归藏', '连山', '演法'],
  xianqi: ['开天', '鸿蒙', '混沌', '不朽', '太初', '无量', '弥天', '造化', '永寂', '真一', '亘古', '道极', '无相', '湮灭', '瀚宇', '御世'],
}
const usedArtifactNames = new Set()
function artifactName(tierKey, typeDef) {
  for (let i = 0; i < 60; i++) {
    const n = pick(A_PREFIX[tierKey]) + pick(typeDef.nouns)
    if (!usedArtifactNames.has(n)) {
      usedArtifactNames.add(n)
      return n
    }
  }
  const n = pick(A_PREFIX[tierKey]) + pick(typeDef.nouns) + usedArtifactNames.size
  usedArtifactNames.add(n)
  return n
}
const A_INTROS = [
  '{tier}之属，{type}一格。祭起时{flavor}，颇有威仪。',
  '古修遗蜕中所出的{tier}，温养日久方显真容。',
  '不知何人炼制的{tier}，器胚厚重，灵性内蕴。',
  '坊市偶有流通的{tier}，{type}中的上选之物。',
  '器如其名——此宝以{flavor}见长，{type}中口碑颇佳。',
]
const FLAVORS = ['灵光湛然', '罡风自随', '宝气冲霄', '声如龙吟', '寒芒摄人', '厚重如山']

const artifacts = []
let aseq = 0
for (const t of A_TIERS) {
  for (const typeDef of A_TYPES) {
    for (let i = 0; i < 15; i++) {
      aseq += 1
      const effects = typeDef.make(t.P)
      // 反噬（道器/仙器概率带负面词条；负面固定不随倍率放大——规则记在 meta.rules；本命件不设反噬）
      if (t.backlashChance && typeDef.backlashTarget && rand() < t.backlashChance) {
        effects.push(effect(typeDef.backlashTarget, Math.max(1, Math.round(t.P * 0.3)), 'negative'))
      }
      artifacts.push({
        id: `artifact_${t.tier}_${typeDef.type}_${String(aseq).padStart(4, '0')}`,
        name: artifactName(t.tier, typeDef),
        type: typeDef.type,
        typeName: typeDef.name,
        tier: t.tier,
        tierName: t.name,
        category: typeDef.slots,
        realmReq: t.realmReq,
        realmReqRank: t.realmReqRank,
        refineMax: t.refineMax,
        refineMultipliers: REFINE_MULTIPLIERS.slice(0, t.refineMax),
        refineBase: t.refineBase,
        thresholdBase: t.thresholdBase,
        thresholdRatio: 2,
        baseEffects: effects,
        summary: summarize(effects) + '（基础值，正面随炼化倍率放大、负面恒定）',
        intro: pick(A_INTROS)
          .replaceAll('{tier}', t.name)
          .replaceAll('{type}', typeDef.name)
          .replaceAll('{flavor}', pick(FLAVORS)),
      })
    }
  }
}

/* ================================================================
 * 输出
 * ================================================================ */

const techOut = {
  version: 1,
  title: '功法数据（主功法+辅功法/心法）',
  rules: {
    tiers: '黄/玄/地/天/仙 五阶 × 下/中/上品 = 15 档',
    types: { main: '主功法（装备1本，均衡五维带流派偏向）', heart: '辅功法/心法（装备2本，偏科1~2项，熟练度增长×0.6折扣）' },
    effectModel: '实际加成 = baseEffects × levelMultipliers[层-1]；三本之间同属性 percent 相加；永久生效不设 hours',
    levelNames: LEVEL_NAMES,
    threshold: '层阈值 = thresholdBase × thresholdRatio^(层-1)；品阶越高基数越大（下/中/上品 ×1/×1.25/×1.5）',
    realmRange: 'realmMin~realmMax 为适用境界（realms.id）：低于修不动、超出即修尽淘汰',
    growth: '熟练度随修炼/打坐结算顺带涨：base_progress × 修炼速度%(悟性)，心法再乘0.6',
  },
  statNames: STAT_NAMES,
  tierSummary: T_TIERS.map((t) => ({
    tier: t.tier,
    tierName: t.name,
    realmRange: `${realmNameOf(t.realmMin)}~${realmNameOf(t.realmMax)}`,
    maxLevel: t.maxLevel,
    basePowerPercent: t.P,
  })),
  totalMain: techniques.filter((x) => x.type === 'main').length,
  totalHeart: techniques.filter((x) => x.type === 'heart').length,
  total: techniques.length,
  techniques,
}

const artOut = {
  version: 1,
  title: '法宝数据（装备池）',
  rules: {
    tiers: '法器<灵器<宝器<道器<仙器 五阶（初稿：不分下/中/上品）',
    types: { natal: '本命（全能五维）', offense: '攻击（偏攻击/神识）', defense: '防御（偏防御/气血）', support: '辅助（偏灵气/神识）' },
    slots: '本命×1 + 攻击×1 + 防御×1 + 辅助×1 = 4 槽（初稿）',
    effectModel: '实际加成 = baseEffects(正面) × refineMultipliers[层-1]；负面词条恒定不随倍率放大；与功法加成同栈相加',
    refineLevelNames: REFINE_LEVEL_NAMES,
    threshold: '炼化层阈值 = thresholdBase × thresholdRatio^(层-1)',
    realmReq: '装备大境界门槛（realmReq 空=无要求）；满炼化层数由品阶固定（方案A）',
    growth: '炼化度靠温养（挂机时长+可选灵石投入）：refine_base × 小时数 ×（灵石系数）；不吃悟性',
    backlash: '道器约40%、仙器约60% 带一条负面词条（威力越猛副作用越烈）；本命法宝不设反噬',
  },
  statNames: STAT_NAMES,
  tierSummary: A_TIERS.map((t) => ({
    tier: t.tier,
    tierName: t.name,
    realmReq: t.realmReq || '无要求',
    refineMax: t.refineMax,
    basePowerPercent: t.P,
  })),
  total: artifacts.length,
  artifacts,
}

writeFileSync(join(dataDir, 'techniques.json'), JSON.stringify(techOut, null, 2), 'utf8')
writeFileSync(join(dataDir, 'artifacts.json'), JSON.stringify(artOut, null, 2), 'utf8')

console.log(`techniques.json: 主功法 ${techOut.totalMain} + 心法 ${techOut.totalHeart} = ${techOut.total} 部`)
console.log(`artifacts.json: 法宝 ${artOut.total} 件（含反噬件 ${artifacts.filter((a) => a.baseEffects.some((e) => e.polarity === 'negative')).length}）`)
console.log(`名称去重: 功法 ${usedTechNames.size}、法宝 ${usedArtifactNames.size}（均应等于条目数）`)
