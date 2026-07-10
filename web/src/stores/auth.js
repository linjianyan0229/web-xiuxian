import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiLogin, apiRegister, apiGetProfile } from '../api/auth.js'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  function persist() {
    if (token.value) {
      localStorage.setItem('token', token.value)
      localStorage.setItem('user', JSON.stringify(user.value))
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }

  async function login(payload) {
    const { token: t, user: u } = await apiLogin(payload)
    token.value = t
    user.value = u
    persist()
  }

  async function register(payload) {
    const { token: t, user: u } = await apiRegister(payload)
    token.value = t
    user.value = u
    persist()
  }

  async function fetchProfile() {
    const { user: u } = await apiGetProfile()
    user.value = u
    persist()
  }

  // 接口回抛最新用户视图时统一走此处落状态——直接对 auth.user 赋值不会写 localStorage，
  // 刷新页面会读到旧快照（如立派后 sect_id 仍为空导致 /my-sect 误判回列表）
  function setUser(u) {
    user.value = u
    persist()
  }

  function logout() {
    token.value = ''
    user.value = null
    persist()
  }

  return { token, user, login, register, fetchProfile, setUser, logout }
})
