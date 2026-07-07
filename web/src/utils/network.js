// 在线榜网络状态判定：由服务端返回的 idle_seconds（距最近心跳秒数）与 ping_ms（上报延迟）折算。
// 心跳周期 15s：两跳多（>45s）没有心跳视为掉线；延迟阈值 <100 流畅 / <300 一般 / 其余迟缓。
// 前台修仙榜与后台仪表盘共用，保证口径一致。
export function netStatus(row) {
  const idle = row?.idle_seconds
  const ping = row?.ping_ms

  // 从未上报过心跳（老会话/刚上线未及首跳）：状态未知
  if (idle == null && ping == null) return { key: 'unknown', label: '—' }
  if (idle == null || Number(idle) > 45) return { key: 'lost', label: '掉线' }

  const p = Number(ping)
  if (!Number.isFinite(p)) return { key: 'good', label: '在线' }
  const text = p >= 1000 ? `${(p / 1000).toFixed(1)}s` : `${p}ms`
  if (p < 100) return { key: 'good', label: text }
  if (p < 300) return { key: 'fair', label: text }
  return { key: 'poor', label: text }
}
