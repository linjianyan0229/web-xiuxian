<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import AuthShell from '../components/AuthShell.vue'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ account: '', password: '' })
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  if (!form.account || !form.password) {
    error.value = '请填写道号/邮箱与密码'
    return
  }
  loading.value = true
  try {
    await auth.login({ account: form.account, password: form.password })
    // 按角色分流：管理员进后台，玩家进游戏
    router.push({ name: auth.user?.role === 1 ? 'admin-dashboard' : 'home' })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="登入仙门" subtitle="以道号或邮箱踏入修行">
    <form class="auth-form" @submit.prevent="onSubmit">
      <div class="field">
        <label>道号 / 邮箱</label>
        <input v-model.trim="form.account" type="text" placeholder="输入你的道号或邮箱" autocomplete="username" />
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="form.password" type="password" placeholder="输入密码" autocomplete="current-password" />
      </div>

      <p class="form-error">{{ error }}</p>

      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? '入门中…' : '登 入' }}
      </button>
    </form>

    <p class="switch">
      尚未拜入仙门？<RouterLink to="/register">开宗立派</RouterLink>
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
