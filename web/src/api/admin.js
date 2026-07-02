import adminHttp from './adminHttp.js'

export const apiAdminLogin = (payload) => adminHttp.post('/login', payload)
export const apiAdminProfile = () => adminHttp.get('/profile')
export const apiDashboard = () => adminHttp.get('/dashboard')
export const apiAdminUsers = (params) => adminHttp.get('/users', { params })
export const apiSetUserStatus = (id, status) =>
  adminHttp.patch(`/users/${id}/status`, { status })
