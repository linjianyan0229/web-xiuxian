<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../../stores/admin.js'

const router = useRouter()
const admin = useAdminStore()

const form = reactive({ username: '', password: '' })
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  if (!form.username || !form.password) {
    error.value = '请填写账号与密码'
    return
  }
  loading.value = true
  try {
    await admin.login({ username: form.username, password: form.password })
    router.push({ name: 'admin-dashboard' })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="seal">仙</div>
        <h1>文字修仙 · 后台</h1>
        <p class="tagline">管理控制台</p>
      </div>

      <form class="auth-form" @submit.prevent="onSubmit">
        <div class="field">
          <label>管理员账号</label>
          <input v-model.trim="form.username" type="text" placeholder="输入管理员账号" autocomplete="username" />
        </div>
        <div class="field">
          <label>密码</label>
          <input v-model="form.password" type="password" placeholder="输入密码" autocomplete="current-password" />
        </div>

        <p class="form-error">{{ error }}</p>

        <button class="btn" type="submit" :disabled="loading">
          {{ loading ? '登入中…' : '登 录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 360px;
  padding: 36px 32px 32px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
}
.brand {
  text-align: center;
  margin-bottom: 26px;
}
.seal {
  width: 48px;
  height: 48px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  font-family: var(--serif);
  font-size: 24px;
  color: #fff;
  background: var(--accent);
  border-radius: 12px;
}
.brand h1 {
  margin: 0;
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--text-h);
}
.tagline {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--muted);
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
