import axios from 'axios'
import router from '../router/index.js'

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

// 响应拦截：抽取 data；令牌失效(401)时清理并回登录页
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (router.currentRoute.value.name !== 'login') {
        router.push({ name: 'login' })
      }
    }
    const msg = err.response?.data?.error || err.message || '网络异常'
    return Promise.reject(new Error(msg))
  }
)

export default http
