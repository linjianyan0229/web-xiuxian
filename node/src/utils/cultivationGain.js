// 修为修炼机制（暂定）：每次修炼获得当前境界总经验(realms.advance_exp)的 5%；
// 修为丹生效时间段内再乘 (1 + 加成%/100)。与悟性无关（悟性只管功法/心法速度）。
// 设计文档：资源文件/机制相关/修为修炼机制.md
export const CULTIVATION_GAIN_PERCENT = 5

// 单次修炼最终修为：最后一步才四舍五入，advance_exp>0 时保底 1 点
export function cultivationGainPerSession(advanceExp, pillBonusPercent = 0) {
  const exp = Number(advanceExp)
  if (!Number.isFinite(exp) || exp <= 0) return 0
  const bonus = Math.max(0, Number(pillBonusPercent) || 0)
  const gain = Math.round((exp * CULTIVATION_GAIN_PERCENT / 100) * (1 + bonus / 100))
  return Math.max(1, gain)
}
