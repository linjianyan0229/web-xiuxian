import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiAdminLogin } from '../api/admin.js'

export const useAdminStore = defineStore('admin', () => {
  const token = ref(localStorage.getItem('adminToken') || '')
  const info = ref(JSON.parse(localStorage.getItem('adminInfo') || 'null'))

  function persist() {
    if (token.value) {
      localStorage.setItem('adminToken', token.value)
      localStorage.setItem('adminInfo', JSON.stringify(info.value))
    } else {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminInfo')
    }
  }

  async function login(payload) {
    const { token: t, admin } = await apiAdminLogin(payload)
    token.value = t
    info.value = admin
    persist()
  }

  function logout() {
    token.value = ''
    info.value = null
    persist()
  }

  return { token, info, login, logout }
})
