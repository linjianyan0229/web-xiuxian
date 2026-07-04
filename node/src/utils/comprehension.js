// 悟性（%）游戏规则：上限 100；初始化时 0.5% 概率天纵奇才直接 15，其余均匀落在 1~10
export const COMPREHENSION_MAX = 100
export const COMPREHENSION_GIFTED = 15
export const COMPREHENSION_GIFTED_RATE = 0.005

// 玩家初始悟性投掷
export function rollComprehension() {
  if (Math.random() < COMPREHENSION_GIFTED_RATE) return COMPREHENSION_GIFTED
  return 1 + Math.floor(Math.random() * 10)
}

// 收敛到合法区间 [0, 100] 的整数（后台改值、未来丹药加成等入口统一走这里）
export function clampComprehension(value) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return null
  return Math.min(COMPREHENSION_MAX, Math.max(0, n))
}

// 修炼速度（仅功法/心法用，修为获取不走此机制，见 资源文件/机制相关/悟性与修炼速度机制.md）：
// 最终修炼速度% = 基础10% + 基础10% × 悟性%，悟性满值100时封顶 20%
export const BASE_CULTIVATION_SPEED_PERCENT = 10

export function cultivationSpeedPercent(comprehension) {
  const c = clampComprehension(comprehension) ?? 0
  const speed = BASE_CULTIVATION_SPEED_PERCENT * (1 + c / 100)
  return Math.round(speed * 100) / 100
}
