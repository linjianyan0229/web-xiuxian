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

  function logout() {
    token.value = ''
    user.value = null
    persist()
  }

  return { token, user, login, register, fetchProfile, logout }
})
