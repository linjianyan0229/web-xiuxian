<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import AuthShell from '../components/AuthShell.vue'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ daoName: '', email: '', password: '', confirm: '' })
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  if (!form.daoName || !form.email || !form.password) {
    error.value = '道号、邮箱、密码均为必填'
    return
  }
  if (form.password.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (form.password !== form.confirm) {
    error.value = '两次输入的密码不一致'
    return
  }
  loading.value = true
  try {
    await auth.register({
      daoName: form.daoName,
      email: form.email,
      password: form.password,
    })
    router.push({ name: 'home' })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="开宗立派" subtitle="取一道号，自此踏上仙途">
    <form class="auth-form" @submit.prevent="onSubmit">
      <div class="field">
        <label>道号</label>
        <input v-model.trim="form.daoName" type="text" placeholder="2-16位中英文/数字" autocomplete="nickname" />
      </div>
      <div class="field">
        <label>邮箱</label>
        <input v-model.trim="form.email" type="email" placeholder="用于找回与验证" autocomplete="email" />
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="form.password" type="password" placeholder="至少 6 位" autocomplete="new-password" />
      </div>
      <div class="field">
        <label>确认密码</label>
        <input v-model="form.confirm" type="password" placeholder="再次输入密码" autocomplete="new-password" />
      </div>

      <p class="form-error">{{ error }}</p>

      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? '结缘中…' : '立 派' }}
      </button>
    </form>

    <p class="switch">
      已入仙门？<RouterLink to="/login">返回登入</RouterLink>
    </p>
  </AuthShell>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.switch {
  margin: 18px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}
</style>
