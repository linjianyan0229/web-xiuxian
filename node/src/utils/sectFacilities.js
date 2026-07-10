// 宗门设施开启条件与仓库数值（设计文档：docs/设计文档/宗门设施与仓库机制.md）
// minMembers 为开启所需宗门人数（实时聚合判定）；数值为初稿标定，后续可挪 system_configs。
// 前端展示镜像在 web/src/utils/sectFacilities.js，勿单方增删。
export const SECT_FACILITIES = {
  warehouse: { name: '宗门仓库', minMembers: 0 }, // 建宗直接拥有
  task: { name: '宗门任务', minMembers: 5 },
  scripture: { name: '藏经阁', minMembers: 10 },
  shop: { name: '宗门商店', minMembers: 15 },
  retreat: { name: '闭关室', minMembers: 20 },
  enforce: { name: '执法堂', minMembers: 30 },
  prison: { name: '宗门大牢', minMembers: 30 },
  peak: { name: '山峰', minMembers: 50 },
}

// 仓库：容量按「格」计（一格=一种物品×品质条目，可叠加物品合并一格）
export const WAREHOUSE_MAX_LEVEL = 10

export function warehouseCapacity(level) {
  const lv = Math.max(1, Math.min(WAREHOUSE_MAX_LEVEL, Number(level) || 1))
  return 100 + (lv - 1) * 50
}

// 升级费用（level → level+1），灵石；满级返回 null
export function warehouseUpgradeCost(level) {
  const lv = Number(level) || 1
  if (lv >= WAREHOUSE_MAX_LEVEL) return null
  return lv * 5000
}

// 仓库管理权（取出/升级）：太上长老/宗主/神子（rank≤3）或仓库管理长老
export function canManageWarehouse(position, rank) {
  return rank <= 3 || position === 'warehouse_elder'
}
