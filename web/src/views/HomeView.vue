<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const auth = useAuthStore()
const error = ref('')

onMounted(async () => {
  try {
    await auth.fetchProfile()
  } catch (e) {
    error.value = e.message
    // 令牌失效则退回登录
    auth.logout()
    router.replace({ name: 'login' })
  }
})

function onLogout() {
  auth.logout()
  router.replace({ name: 'login' })
}

function fmt(t) {
  return t ? String(t).replace('T', ' ').slice(0, 19) : '—'
}
</script>

<template>
  <div class="home">
    <header class="bar">
      <span class="logo">仙</span>
      <span class="title">文字修仙</span>
      <button class="ghost" @click="onLogout">离山</button>
    </header>

    <main class="center" v-if="auth.user">
      <p class="welcome">道友</p>
      <h1 class="dao">{{ auth.user.dao_name }}</h1>
      <p class="hint">仙途已开，静待后续机缘。</p>

      <div class="card">
        <div class="row"><span>邮箱</span><b>{{ auth.user.email }}</b></div>
        <div class="row"><span>状态</span><b>{{ auth.user.status === 1 ? '正常' : '禁用' }}</b></div>
        <div class="row"><span>注册时间</span><b>{{ fmt(auth.user.register_time) }}</b></div>
        <div class="row"><span>上次登录</span><b>{{ fmt(auth.user.login_time) }}</b></div>
      </div>
    </main>

    <p v-else class="loading">{{ error || '正在通灵…' }}</p>
  </div>
</template>

<style scoped>
.home {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.logo {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  font-family: var(--serif);
  color: #fff;
  background: var(--accent);
  border-radius: 8px;
}
.title {
  font-family: var(--serif);
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--text-h);
}
.ghost {
  margin-left: auto;
  padding: 7px 16px;
  font-size: 13px;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.ghost:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.center {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 22px;
  text-align: center;
}
.welcome {
  margin: 0;
  font-size: 13px;
  letter-spacing: 4px;
  color: var(--muted);
}
.dao {
  margin: 8px 0 4px;
  font-family: var(--serif);
  font-size: 40px;
  font-weight: 600;
  letter-spacing: 6px;
  color: var(--text-h);
}
.hint {
  margin: 0 0 26px;
  font-size: 13px;
  color: var(--muted);
}
.card {
  width: 100%;
  max-width: 380px;
  padding: 8px 20px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 13px 0;
  font-size: 14px;
  border-bottom: 1px solid var(--border);
}
.row:last-child {
  border-bottom: none;
}
.row > span {
  color: var(--muted);
}
.row > b {
  color: var(--text-h);
  font-weight: 500;
}
.loading {
  flex-grow: 1;
  display: grid;
  place-items: center;
  color: var(--muted);
  letter-spacing: 2px;
}
</style>
