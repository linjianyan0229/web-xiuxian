import axios from 'axios'
import router from '../router/index.js'

const adminHttp = axios.create({
  baseURL: '/api/admin',
  timeout: 10000,
})

// 请求拦截：附带管理员令牌
adminHttp.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('adminToken')
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`
  }
  return cfg
})

// 响应拦截：抽 data；令牌失效则清理并回到后台登录
adminHttp.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status
    if (status === 401 || status === 403) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminInfo')
      if (router.currentRoute.value.name !== 'admin-login') {
        router.push({ name: 'admin-login' })
      }
    }
    const msg = err.response?.data?.error || err.message || '网络异常'
    return Promise.reject(new Error(msg))
  }
)

export default adminHttp
