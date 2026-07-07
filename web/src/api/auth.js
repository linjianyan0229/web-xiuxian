import http from './http.js'

export function apiRegister(payload) {
  // payload: { daoName, email, password }
  return http.post('/auth/register', payload)
}

export function apiLogin(payload) {
  // payload: { account, password }
  return http.post('/auth/login', payload)
}

export function apiGetProfile() {
  return http.get('/user/profile')
}

export function apiLogout() {
  return http.post('/auth/logout')
}

// 发送邮箱验证码：purpose 取 'register'(注册) | 'reset'(重置密码)，同邮箱同用途 60 秒限频
export function apiSendEmailCode(email, purpose) {
  return http.post('/auth/email-code', { email, purpose })
}

// 重置密码：邮箱 + 验证码 + 新密码（成功后旧登录全部失效）
export function apiResetPassword(payload) {
  // payload: { email, emailCode, newPassword }
  return http.post('/auth/reset-password', payload)
}
