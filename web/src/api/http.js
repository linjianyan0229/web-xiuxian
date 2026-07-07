import axios from 'axios'
import router from '../router/index.js'
// 循环引用无碍：stores/auth → api/auth → 本文件，useAuthStore 只在拦截器回调（运行时）调用
import { useAuthStore } from '../stores/auth.js'

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截：自动附带令牌
http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token')
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`
  }
  return cfg
})

// 响应拦截：抽取 data；令牌失效(401)时清理并回登录页。
// 清理统一走 auth store 的 logout()（同步 Pinia 与 localStorage，心跳等基于 store 的 watcher 随之停止），
// 只清 localStorage 会留下空跑的心跳定时器与陈旧的 store 状态
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      try {
        useAuthStore().logout()
      } catch {
        // pinia 尚未激活的极端场景兜底
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
      if (router.currentRoute.value.name !== 'login') {
        router.push({ name: 'login' })
      }
    }
    const msg = err.response?.data?.error || err.message || '网络异常'
    return Promise.reject(new Error(msg))
  }
)

export default http
