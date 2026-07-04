import { reactive } from 'vue'

// 全局通知队列（右上角 toast）：模块级单例，任何组件调用 useToast() 均操作同一队列
let seq = 0
const toasts = reactive([])

// 各类型默认停留时长（毫秒）；错误多留一会儿
const DEFAULT_DURATION = { info: 3500, success: 3500, error: 5000 }

function push(type, message, duration) {
  const id = ++seq
  toasts.push({ id, type, message: String(message ?? '') })
  const ms = duration ?? DEFAULT_DURATION[type] ?? 3500
  if (ms > 0) setTimeout(() => dismiss(id), ms)
  return id
}

function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i !== -1) toasts.splice(i, 1)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    info: (message, duration) => push('info', message, duration),
    success: (message, duration) => push('success', message, duration),
    error: (message, duration) => push('error', message, duration),
  }
}
