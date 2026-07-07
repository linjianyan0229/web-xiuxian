// 服务端与 MySQL 时钟为 UTC，接口返回的时间是带 Z 的 ISO 串（时刻本身正确）。
// 展示统一固定按东八区（Asia/Shanghai），与游戏受众一致，不随访问端系统时区漂移；
// 切勿再对 ISO 串直接 replace('T')/slice 截取——那会把 UTC 钟面原样显示（慢 8 小时）。
const FULL = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

// ISO/时间串/Date → 'YYYY-MM-DD HH:MM:SS'；空值或无效时间返回 '—'
export function fmtDateTime(t) {
  if (!t) return '—'
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return FULL.format(d).replace(',', '')
}
