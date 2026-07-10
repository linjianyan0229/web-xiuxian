// 宗门职位体系（设计文档：docs/设计文档/宗门职位与权限机制.md）
// rank 数字越小职级越高；「长老级以上」= rank <= 5；人事权（任免/逐出）= rank <= 3。
// quota 为编制上限：null=不限额；文稿要求"建宗时定死编制"，建宗自定编制未实装前
// 先用此处默认编制（不提供修改接口），待 sect_quota 表实装后挪库。
// facilityLevel 为设施使用权限级（藏经阁/商店/闭关室，设施系统未实装，预留）。
export const SECT_POSITIONS = {
  taishang_elder: { name: '太上长老', rank: 1, facilityLevel: 3, quota: 2 },
  sect_master: { name: '宗主', rank: 2, facilityLevel: 3, quota: 1 },
  divine_child: { name: '宗门神子', nameFemale: '宗门神女', rank: 3, facilityLevel: 3, quota: 1 },
  peak_master: { name: '峰主', rank: 4, facilityLevel: 2, quota: 0 }, // 山峰系统未实装，暂不可任命
  scripture_master: { name: '藏经阁阁主', rank: 5, facilityLevel: 3, quota: 1 },
  warehouse_elder: { name: '仓库管理长老', rank: 5, facilityLevel: 3, quota: 1 },
  task_elder: { name: '任务长老', rank: 5, facilityLevel: 3, quota: 1 },
  inner_elder: { name: '内门长老', rank: 5, facilityLevel: 2, quota: 1 },
  outer_elder: { name: '外门长老', rank: 5, facilityLevel: 2, quota: 1 },
  enforcer: { name: '执法堂执事', rank: 5, facilityLevel: 2, quota: 3 },
  core_disciple: { name: '真传弟子', rank: 6, facilityLevel: 3, quota: null }, // 真传按峰归属，山峰未实装暂不可任命
  inner_disciple: { name: '内门弟子', rank: 7, facilityLevel: 2, quota: null },
  outer_disciple: { name: '外门弟子', rank: 8, facilityLevel: 1, quota: null },
  menial_disciple: { name: '杂役弟子', rank: 9, facilityLevel: 0, quota: null },
}

// 按 rank 升序的职位 key 列表（成员列表排序用：FIELD(position, ...)）
export const POSITION_ORDER = Object.keys(SECT_POSITIONS).sort(
  (a, b) => SECT_POSITIONS[a].rank - SECT_POSITIONS[b].rank
)

// 一期可任命/改任的职位白名单：宗主只能经转让变更；峰主/真传弟子依赖山峰系统（未实装）
export const APPOINTABLE_POSITIONS = Object.keys(SECT_POSITIONS).filter(
  (k) => !['sect_master', 'peak_master', 'core_disciple'].includes(k)
)

export function positionInfo(key) {
  return SECT_POSITIONS[key] || null
}

// 职位展示名（神子/神女按性别区分）
export function positionName(key, gender) {
  const p = SECT_POSITIONS[key]
  if (!p) return key
  if (gender === 2 && p.nameFemale) return p.nameFemale
  return p.name
}

// 人事权（任免职位/逐出成员）：太上长老/宗主/神子（rank <= 3）
export function hasPersonnelPower(position) {
  const p = SECT_POSITIONS[position]
  return !!p && p.rank <= 3
}

// 宗门信息管理权（改名称/简介/头像/背景/入门要求）：rank <= 3
export function hasInfoPower(position) {
  return hasPersonnelPower(position)
}

// 长老级以上（rank <= 5）：神子对其任免受限（须呈罢免信，文书系统未实装一期直接 403）
export function isEldersOrAbove(position) {
  const p = SECT_POSITIONS[position]
  return !!p && p.rank <= 5
}
