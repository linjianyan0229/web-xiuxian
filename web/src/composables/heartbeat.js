import { watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { apiHeartbeat } from '../api/game.js'

// 心跳周期：15 秒一跳；服务端在线榜按「两跳多没心跳（>45s）」判掉线
const INTERVAL_MS = 15000

let timer = null
let lastPing = null // 上一跳实测往返延迟(ms)，随下一跳上报

async function beat() {
  // 兜底：401 时拦截器会经 auth store logout() 触发 watch 停表，此处再挡一手竞态中的空跳
  if (!localStorage.getItem('token')) return
  const t0 = Date.now()
  try {
    await apiHeartbeat(lastPing)
    lastPing = Date.now() - t0
  } catch {
    /* 心跳失败不打扰，下一轮再试 */
  }
}

// App.vue 挂载一次：玩家（role=0）登录期间持续心跳，登出/管理员不上报
export function useHeartbeat() {
  const auth = useAuthStore()
  const sync = () => {
    const active = !!auth.token && auth.user?.role === 0
    if (active && !timer) {
      beat()
      timer = setInterval(beat, INTERVAL_MS)
    } else if (!active && timer) {
      clearInterval(timer)
      timer = null
      lastPing = null
    }
  }
  watch(() => [auth.token, auth.user?.role], sync, { immediate: true })
}
