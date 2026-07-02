import http from './http.js'

// 后台接口复用同一个 http 实例（同一令牌，令牌里带 role=admin）
export const apiAdminProfile = () => http.get('/admin/profile')
export const apiDashboard = () => http.get('/admin/dashboard')
export const apiAdminUsers = (params) => http.get('/admin/users', { params })
export const apiSetUserStatus = (id, status) =>
  http.patch(`/admin/users/${id}/status`, { status })
export const apiRealms = () => http.get('/admin/realms')
export const apiRankings = () => http.get('/admin/rankings')
