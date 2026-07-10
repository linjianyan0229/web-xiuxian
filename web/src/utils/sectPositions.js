// 宗门职位展示映射（与后端 node/src/utils/sectPositions.js 对应，勿单方增删）
// rank 数字越小职级越高；长老级以上 = rank <= 5
export const SECT_POSITIONS = {
  taishang_elder: { name: '太上长老', rank: 1 },
  sect_master: { name: '宗主', rank: 2 },
  divine_child: { name: '宗门神子', nameFemale: '宗门神女', rank: 3 },
  peak_master: { name: '峰主', rank: 4 },
  scripture_master: { name: '藏经阁阁主', rank: 5 },
  warehouse_elder: { name: '仓库管理长老', rank: 5 },
  task_elder: { name: '任务长老', rank: 5 },
  inner_elder: { name: '内门长老', rank: 5 },
  outer_elder: { name: '外门长老', rank: 5 },
  enforcer: { name: '执法堂执事', rank: 5 },
  core_disciple: { name: '真传弟子', rank: 6 },
  inner_disciple: { name: '内门弟子', rank: 7 },
  outer_disciple: { name: '外门弟子', rank: 8 },
  menial_disciple: { name: '杂役弟子', rank: 9 },
}

// 职位展示名（神子/神女按性别）
export function positionLabel(key, gender) {
  const p = SECT_POSITIONS[key]
  if (!p) return key || '—'
  if (gender === 2 && p.nameFemale) return p.nameFemale
  return p.name
}

export function positionRank(key) {
  return SECT_POSITIONS[key]?.rank ?? 9
}
