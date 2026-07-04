import http from './http.js'

// 后台接口复用同一个 http 实例（同一令牌，令牌里带 role=admin）
export const apiAdminProfile = () => http.get('/admin/profile')
export const apiDashboard = () => http.get('/admin/dashboard')
export const apiAdminUsers = (params) => http.get('/admin/users', { params })
export const apiSetUserStatus = (id, status) =>
  http.patch(`/admin/users/${id}/status`, { status })
export const apiCreateUser = (payload) => http.post('/admin/users', payload)
export const apiUpdateUser = (id, payload) => http.put(`/admin/users/${id}`, payload)
export const apiDeleteUser = (id) => http.delete(`/admin/users/${id}`)
export const apiRealms = () => http.get('/admin/realms')
export const apiUpdateRealm = (id, payload) => http.put(`/admin/realms/${id}`, payload)
export const apiRankings = () => http.get('/admin/rankings')

// 系统配置列表
export const apiConfigs = () => http.get('/admin/configs')
export const apiUpdateConfig = (key, value) => http.patch(`/admin/configs/${key}`, { value })
// 更新某境界的每日签到奖励百分比区间
export const apiUpdateRealmSignIn = (id, minPercent, maxPercent) =>
  http.patch(`/admin/realms/${id}/sign-in`, { minPercent, maxPercent })
