// 打坐（定时挂机修炼）机制：选定时长后入定，期间不可中断（无法修炼/突破/再次打坐），
// 期满后按时长一次性结算修为：每小时获得当前境界圆满修为(advance_exp)的 30%
// （百分比可由系统配置 meditation_gain_percent_per_hour 调整），结算时封顶到圆满。
// 设计文档：资源文件/机制相关/打坐机制.md
export const MEDITATION_GAIN_PERCENT_PER_HOUR = 30

// 可选打坐时长白名单（分钟 → 雅称），后端校验与前端展示共用此表
export const MEDITATION_DURATIONS = [
  { minutes: 30, label: '一炷香' },
  { minutes: 60, label: '半个时辰' },
  { minutes: 120, label: '一个时辰' },
  { minutes: 240, label: '两个时辰' },
]

export function isValidMeditationMinutes(minutes) {
  return MEDITATION_DURATIONS.some((d) => d.minutes === Number(minutes))
}

export function meditationDurationLabel(minutes) {
  const d = MEDITATION_DURATIONS.find((x) => x.minutes === Number(minutes))
  return d ? d.label : `${minutes}分钟`
}

// 一场打坐的原始修为收益（未封顶）：advance_exp × 每小时百分比 × 小时数；
// 最后一步才四舍五入，advance_exp>0 且时长>0 时保底 1 点（与修炼机制的取整规则一致）
export function meditationGainForDuration(
  advanceExp,
  minutes,
  perHourPercent = MEDITATION_GAIN_PERCENT_PER_HOUR
) {
  const exp = Number(advanceExp)
  const mins = Number(minutes)
  if (!Number.isFinite(exp) || exp <= 0) return 0
  if (!Number.isFinite(mins) || mins <= 0) return 0
  const percent = Math.max(0, Number(perHourPercent) || 0)
  const gain = Math.round(exp * (percent / 100) * (mins / 60))
  return Math.max(1, gain)
}
