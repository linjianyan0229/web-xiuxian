// 宗门设施开启门槛展示映射（与后端 node/src/utils/sectFacilities.js 对应，勿单方增删）
// minMembers 为开启所需宗门人数；0 = 建宗直接拥有。最终判定在后端（各设施接口复核）。
export const SECT_FACILITIES = {
  warehouse: { name: '宗门仓库', minMembers: 0 },
  task: { name: '宗门任务', minMembers: 5 },
  scripture: { name: '藏经阁', minMembers: 10 },
  shop: { name: '宗门商店', minMembers: 15 },
  retreat: { name: '闭关室', minMembers: 20 },
  enforce: { name: '执法堂', minMembers: 30 },
  prison: { name: '宗门大牢', minMembers: 30 },
  peak: { name: '山峰', minMembers: 50 },
}
