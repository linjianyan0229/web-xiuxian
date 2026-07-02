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
