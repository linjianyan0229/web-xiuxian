import { readFile, writeFile } from 'node:fs/promises'

const realmPath = new URL('../境界相关/cultivation_realm_table.json', import.meta.url)
const pillsPath = new URL('./pills.json', import.meta.url)
const pillsMdPath = new URL('./pills.md', import.meta.url)
const summaryPath = new URL('./pills.summary.md', import.meta.url)

const realmRows = JSON.parse(await readFile(realmPath, 'utf8'))
const allRealmOrder = [...new Map(realmRows.map((row) => [row.realm, row])).values()]
  .map((row) => row.realm)
const realmOrder = allRealmOrder.filter((realm) => realm !== '凡人')
const cultivationPillRealms = allRealmOrder.slice(0, allRealmOrder.indexOf('渡劫') + 1)

const immortalKingAndAbove = new Set(['仙王', '仙帝', '道祖', '圣人'])

const qualityDefs = [
  { key: 'fan', name: '凡', effectMultiplier: 1, negativeMultiplier: 1 },
  { key: 'ling', name: '灵', effectMultiplier: 1.6, negativeMultiplier: 1.45 },
  { key: 'dao', name: '道', effectMultiplier: 2.4, negativeMultiplier: 2.1 },
]

const deathSaveBaseChance = {
  fan: 20,
  ling: 35,
  dao: 50,
}

const cultivationPillRules = {
  fan: { basePercent: 10, realmStepPercent: 3, durationHours: 6 },
  ling: { basePercent: 30, realmStepPercent: 5, durationHours: 12 },
  dao: { basePercent: 60, realmStepPercent: 8, durationHours: 24 },
}

const statNames = {
  hp: '气血',
  maxHp: '气血上限',
  comprehension: '悟性',
  attack: '攻击力',
  defense: '防御力',
  spirit: '精神力',
  lingQi: '灵气',
  cultivationGain: '修为获取',
  breakthroughChance: '突破概率',
  daoYun: '道韵',
  daoLaw: '道法领悟',
  deathSave: '免死',
}

const commonTemplates = [
  ['healing', '疗伤类', '回春丹', 'temporary_positive', 'self', [{ target: 'hp', type: 'flat', base: 90, duration: 'instant', polarity: 'positive' }]],
  ['healing', '疗伤类', '固元丹', 'permanent_positive', 'self', [{ target: 'maxHp', type: 'flat', base: 12, duration: 'permanent', polarity: 'positive' }]],
  ['comprehension_up', '提高悟性类', '悟道丹', 'temporary_positive', 'self', [{ target: 'comprehension', type: 'percent', base: 4, duration: 'temporary', hours: 12, polarity: 'positive' }]],
  ['comprehension_up', '提高悟性类', '明心丹', 'permanent_positive', 'self', [{ target: 'comprehension', type: 'percent', base: 1, duration: 'permanent', polarity: 'positive' }]],
  ['attack_up', '增加攻击力类', '破军丹', 'temporary_positive', 'self', [{ target: 'attack', type: 'percent', base: 5, duration: 'temporary', hours: 8, polarity: 'positive' }]],
  ['attack_up', '增加攻击力类', '淬锋丹', 'permanent_positive', 'self', [{ target: 'attack', type: 'flat', base: 8, duration: 'permanent', polarity: 'positive' }]],
  ['defense_up', '增加防御力类', '玄甲丹', 'temporary_positive', 'self', [{ target: 'defense', type: 'percent', base: 5, duration: 'temporary', hours: 8, polarity: 'positive' }]],
  ['defense_up', '增加防御力类', '金身丹', 'permanent_positive', 'self', [{ target: 'defense', type: 'flat', base: 7, duration: 'permanent', polarity: 'positive' }]],
  ['spirit_up', '增加精神力类', '凝神丹', 'temporary_positive', 'self', [{ target: 'spirit', type: 'percent', base: 5, duration: 'temporary', hours: 10, polarity: 'positive' }]],
  ['spirit_up', '增加精神力类', '养魂丹', 'permanent_positive', 'self', [{ target: 'spirit', type: 'flat', base: 7, duration: 'permanent', polarity: 'positive' }]],
  ['ling_qi_up', '增加灵气类', '聚灵丹', 'temporary_positive', 'self', [{ target: 'lingQi', type: 'flat', base: 120, duration: 'instant', polarity: 'positive' }]],
  ['ling_qi_up', '增加灵气类', '纳元丹', 'permanent_positive', 'self', [{ target: 'lingQi', type: 'flat', base: 10, duration: 'permanent', polarity: 'positive' }]],
  ['healing_down', '减少疗伤类', '蚀血丹', 'temporary_negative', 'enemy', [{ target: 'hp', type: 'flat', base: 70, duration: 'instant', polarity: 'negative' }]],
  ['comprehension_down', '降低悟性类', '迷心丹', 'permanent_negative', 'enemy', [{ target: 'comprehension', type: 'percent', base: 1, duration: 'permanent', polarity: 'negative' }]],
  ['attack_down', '降低攻击力类', '折锋丹', 'temporary_negative', 'enemy', [{ target: 'attack', type: 'percent', base: 6, duration: 'temporary', hours: 8, polarity: 'negative' }]],
  ['defense_down', '降低防御力类', '破甲丹', 'permanent_negative', 'enemy', [{ target: 'defense', type: 'flat', base: 5, duration: 'permanent', polarity: 'negative' }]],
  ['spirit_down', '降低精神力类', '乱魂丹', 'temporary_negative', 'enemy', [{ target: 'spirit', type: 'percent', base: 6, duration: 'temporary', hours: 8, polarity: 'negative' }]],
  ['ling_qi_down', '降低灵气类', '散灵丹', 'permanent_negative', 'enemy', [{ target: 'lingQi', type: 'flat', base: 12, duration: 'permanent', polarity: 'negative' }]],
  ['death_save', '免死药', '续命丹', 'positive_and_negative', 'self', [
    { target: 'deathSave', type: 'percent', base: 45, duration: 'until_triggered', polarity: 'positive' },
    { target: 'spirit', type: 'percent', base: 8, duration: 'temporary', hours: 12, polarity: 'negative' },
  ]],
  ['breakthrough', '突破丹', '破境丹', 'temporary_negative_and_positive', 'self', [
    { target: 'breakthroughChance', type: 'percent', base: 6, duration: 'next_breakthrough', polarity: 'positive' },
    { target: 'maxHp', type: 'percent', base: 4, duration: 'temporary', hours: 12, polarity: 'negative' },
  ]],
  ['dao_yun', '道韵丹', '道韵丹', 'positive_and_negative', 'self', [
    { target: 'daoYun', type: 'flat', base: 4, duration: 'instant', polarity: 'positive' },
    { target: 'comprehension', type: 'percent', base: 3, duration: 'temporary', hours: 8, polarity: 'negative' },
  ]],
  ['dao_law', '道法丹', '道法丹', 'positive_and_negative', 'self', [
    { target: 'daoLaw', type: 'flat', base: 1, duration: 'instant', polarity: 'positive' },
    { target: 'lingQi', type: 'percent', base: 5, duration: 'temporary', hours: 8, polarity: 'negative' },
  ]],
]

const normalRealmTemplateIndexes = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
]

const highRealmTemplateIndexes = [
  0, 2, 4, 6, 8, 10, 11, 18, 19, 21,
]

const normalRealmTemplates = normalRealmTemplateIndexes.map((index) => commonTemplates[index])
const highRealmTemplates = highRealmTemplateIndexes.map((index) => commonTemplates[index])

const slugMap = {
  凡人: 'fanren',
  炼体: 'lianti',
  练气: 'lianqi',
  筑基: 'zhuji',
  开光: 'kaiguang',
  融合: 'ronghe',
  心动: 'xindong',
  金丹: 'jindan',
  元婴: 'yuanying',
  出窍: 'chuqiao',
  分神: 'fenshen',
  合体: 'heti',
  洞虚: 'dongxu',
  大乘: 'dacheng',
  渡劫: 'dujie',
  地仙: 'dixian',
  天仙: 'tianxian',
  真仙: 'zhenxian',
  玄仙: 'xuanxian',
  金仙: 'jinxian',
  太乙金仙: 'taiyi_jinxian',
  大罗金仙: 'daluo_jinxian',
  仙王: 'xianwang',
  仙帝: 'xiandi',
  道祖: 'daozu',
  圣人: 'shengren',
}

function scaleEffect(effect, realmRank, quality) {
  if (effect.target === 'deathSave') {
    return {
      target: effect.target,
      targetName: statNames[effect.target],
      type: effect.type,
      value: Math.min(90, Number((deathSaveBaseChance[quality.key] + realmRank * 1.2).toFixed(1))),
      duration: effect.duration,
      hours: effect.hours ?? null,
      polarity: effect.polarity,
    }
  }

  const isNegative = effect.polarity === 'negative'
  const multiplier = isNegative ? quality.negativeMultiplier : quality.effectMultiplier
  const realmScale = effect.type === 'percent' ? 1 + realmRank * 0.035 : realmRank
  const rawValue = effect.base * realmScale * multiplier
  let value = effect.type === 'percent'
    ? Number(rawValue.toFixed(1))
    : Math.max(1, Math.round(rawValue))

  if (effect.target === 'comprehension') {
    value = Math.min(30, Math.max(0.1, value))
  }

  return {
    target: effect.target,
    targetName: statNames[effect.target],
    type: effect.type,
    value,
    duration: effect.duration,
    hours: effect.hours ?? null,
    polarity: effect.polarity,
  }
}

function scaleCultivationEffect(realmRank, quality) {
  const rule = cultivationPillRules[quality.key]
  return {
    target: 'cultivationGain',
    targetName: statNames.cultivationGain,
    type: 'percent',
    value: Math.min(200, Math.max(10, rule.basePercent + realmRank * rule.realmStepPercent)),
    duration: 'temporary',
    hours: rule.durationHours,
    polarity: 'positive',
  }
}

function describeEffects(effects) {
  return effects.map((effect) => {
    const sign = effect.polarity === 'negative' ? '-' : '+'
    const unit = effect.type === 'percent' ? '%' : ''
    const duration = {
      instant: '立即',
      permanent: '永久',
      temporary: `临时${effect.hours}小时`,
      until_triggered: '触发前',
      next_breakthrough: '下次突破',
    }[effect.duration]

    return `${duration}${effect.targetName}${sign}${effect.value}${unit}`
  }).join('；')
}

const pills = []

cultivationPillRealms.forEach((realm, realmIndex) => {
  const realmRank = realmIndex + 1
  const id = `pill_${slugMap[realm]}_cultivation`
  const qualities = qualityDefs.map((quality) => {
    const effects = [scaleCultivationEffect(realmRank, quality)]

    return {
      grade: quality.key,
      gradeName: quality.name,
      itemName: `${quality.name}品${realm}修为丹`,
      effects,
      summary: describeEffects(effects),
    }
  })

  pills.push({
    id,
    name: `${realm}修为丹`,
    realm,
    realmRank,
    category: 'cultivation_gain',
    categoryName: '修为丹',
    effectMode: 'temporary_positive',
    defaultTarget: 'self',
    grades: qualities,
    notes: '仅凡人至渡劫境界生成；只提供临时修为获取百分比加成，品质越高持续时间越久。',
  })
})

realmOrder.forEach((realm, realmIndex) => {
  const realmRank = allRealmOrder.indexOf(realm) + 1
  const templates = immortalKingAndAbove.has(realm)
    ? highRealmTemplates
    : normalRealmTemplates

  templates.forEach((template, index) => {
    const [category, categoryName, baseName, effectMode, defaultTarget, effects] = template
    const id = `pill_${slugMap[realm]}_${String(index + 1).padStart(2, '0')}`

    const qualities = qualityDefs.map((quality) => {
      const scaledEffects = effects.map((effect) => scaleEffect(effect, realmRank, quality))
      return {
        grade: quality.key,
        gradeName: quality.name,
        itemName: `${quality.name}品${realm}${baseName}`,
        effects: scaledEffects,
        summary: describeEffects(scaledEffects),
      }
    })

    pills.push({
      id,
      name: `${realm}${baseName}`,
      realm,
      realmRank,
      category,
      categoryName,
      effectMode,
      defaultTarget,
      grades: qualities,
      notes: '凡、灵、道三档品质共用同一效果结构；道品效果最高，负面效果也最烈。',
    })
  })
})

const realmSummary = allRealmOrder.map((realm) => ({
  realm,
  count: pills.filter((pill) => pill.realm === realm).length,
}))

const output = {
  version: 1,
  title: '丹药数据',
  rules: {
    excludeRealms: [],
    normalRealmPillCount: 20,
    immortalKingAndAbovePillCount: 10,
    immortalKingAndAbove: [...immortalKingAndAbove],
    immortalKingAndAboveRules: ['不生成道韵丹，不包含道韵属性；只保留道法丹和道法领悟属性。'],
    cultivationPillRule: {
      realms: '凡人至渡劫',
      effect: '只提供临时修为获取百分比加成',
      rangePercent: [10, 200],
      durationHoursByGrade: Object.fromEntries(
        Object.entries(cultivationPillRules).map(([grade, rule]) => [grade, rule.durationHours]),
      ),
      formula: 'min(200, max(10, basePercentByGrade + realmRank * realmStepPercentByGrade))',
    },
    deathSaveRule: {
      formula: 'min(90, baseChanceByGrade + realmRank * 1.2)',
      baseChanceByGrade: deathSaveBaseChance,
    },
    grades: qualityDefs,
    effectModes: [
      'permanent_positive',
      'temporary_positive',
      'permanent_negative',
      'temporary_negative',
      'positive_and_negative',
      'temporary_negative_and_positive',
    ],
  },
  statNames,
  realmSummary,
  totalPillTypes: pills.length,
  totalGradeItems: pills.length * qualityDefs.length,
  pills,
}

await writeFile(pillsPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

function escapeTableCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

const mdLines = [
  '# 丹药数据表',
  '',
  `- 丹药品种数：${pills.length}`,
  `- 品质物品数：${pills.length * qualityDefs.length}`,
  '- 规则：凡人仅生成修为丹；炼体至渡劫在常规丹药外新增修为丹；炼体至大罗金仙每个大境界保留 20 种常规丹药；仙王、仙帝、道祖、圣人每个境界 10 种。',
  '- 品质：凡、灵、道。道品效果最高，负面效果也最烈。',
  '- 悟性：统一使用百分比机制，最低 0.1%，最高 30%；永久和临时效果同样适用。',
  '- 修为丹：仅凡人至渡劫境界生成，只提供临时修为获取百分比加成，范围 10% 至 200%。',
  '- 临时效果：统一使用 24 小时制度，字段为 `hours`。',
  '- 免死药：概率使用 `min(90, 品质基础概率 + 境界序号 * 1.2)`，凡品 20%，灵品 35%，道品 50%。',
  '- 仙王以上：不再生成道韵丹，不包含道韵属性，只保留道法丹和道法属性。',
  '',
  '## 字段说明',
  '',
  '- 类型：丹药分类。',
  '- 效果模式：永久正面、临时正面、永久负面、临时负面、正负混合、临时负面与正面混合。',
  '- 作用目标：`self` 为自身，`enemy` 为敌方或目标对象。',
  '- 凡品效果 / 灵品效果 / 道品效果：同一丹药三档品质的效果摘要。',
  '',
]

for (const realm of allRealmOrder) {
  const realmPills = pills.filter((pill) => pill.realm === realm)

  if (realmPills.length === 0) {
    continue
  }

  mdLines.push(`## ${realm}`)
  mdLines.push('')
  mdLines.push('| 编号 | 丹药 | 类型 | 效果模式 | 作用目标 | 凡品效果 | 灵品效果 | 道品效果 |')
  mdLines.push('|---:|---|---|---|---|---|---|---|')

  realmPills.forEach((pill, index) => {
    const [fan, ling, dao] = pill.grades
    mdLines.push([
      index + 1,
      pill.name,
      pill.categoryName,
      pill.effectMode,
      pill.defaultTarget,
      fan.summary,
      ling.summary,
      dao.summary,
    ].map(escapeTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  })

  mdLines.push('')
}

await writeFile(pillsMdPath, `${mdLines.join('\n')}\n`, 'utf8')

const categoryCounts = pills.reduce((acc, pill) => {
  acc[pill.categoryName] = (acc[pill.categoryName] ?? 0) + 1
  return acc
}, {})

const summary = `# 丹药数据说明

- 数据文件：\`pills.json\`
- Markdown 表格：\`pills.md\`
- 丹药品种数：${pills.length}
- 品质物品数：${pills.length * qualityDefs.length}
- 规则：凡人仅生成修为丹；炼体至渡劫在常规丹药外新增修为丹；炼体至大罗金仙每个大境界保留 20 种常规丹药；仙王、仙帝、道祖、圣人每个境界 10 种。
- 品质：凡、灵、道。道品效果最高，负面效果也最烈。
- 悟性：统一使用百分比机制，最低 0.1%，最高 30%；永久和临时效果同样适用。
- 修为丹：仅凡人至渡劫境界生成，只提供临时修为获取百分比加成，范围 10% 至 200%。
- 临时效果：统一使用 24 小时制度，字段为 \`hours\`。
- 免死药：概率使用 \`min(90, 品质基础概率 + 境界序号 * 1.2)\`，凡品 20%，灵品 35%，道品 50%。
- 仙王以上：不再生成道韵丹，不包含道韵属性，只保留道法丹和道法属性。

## 字段说明

- \`category/categoryName\`：丹药类型，如疗伤、提高悟性、增加攻击力、突破丹、道韵丹、道法丹等。
- \`effectMode\`：效果组合类型，包括永久正面、临时正面、永久负面、临时负面、正负混合、临时负面与正面混合。
- \`defaultTarget\`：默认作用目标，\`self\` 为自身，\`enemy\` 为敌方或目标对象。
- \`grades\`：凡、灵、道三档品质，每档都有独立数值与摘要。

## 类型统计

${Object.entries(categoryCounts).map(([name, count]) => `- ${name}：${count}`).join('\n')}
`

await writeFile(summaryPath, summary, 'utf8')

console.log(`generated ${pills.length} pill types and ${pills.length * qualityDefs.length} grade items`)
