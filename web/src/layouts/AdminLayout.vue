<script setup>
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { apiAdminProfile } from '../api/admin.js'
import { apiLogout } from '../api/auth.js'
import logoUrl from '../../image/logo.webp'

const router = useRouter()
const auth = useAuthStore()

// 进入后台时校验管理员令牌有效性（401 由拦截器统一跳登录）
onMounted(async () => {
  try {
    const { admin } = await apiAdminProfile()
    auth.user = admin
  } catch {
    /* 拦截器已处理跳转 */
  }
})

async function onLogout() {
  await apiLogout().catch(() => {}) // 尽力置离线，失败不阻塞
  auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="admin">
    <aside class="side">
      <div class="brand">
        <img class="seal" :src="logoUrl" alt="文字修仙" />
        <span class="name">修仙后台</span>
      </div>
      <nav class="nav">
        <RouterLink :to="{ name: 'admin-dashboard' }">
          <span class="ico">▤</span> 仪表盘
        </RouterLink>
        <RouterLink :to="{ name: 'admin-users' }">
          <span class="ico">☰</span> 用户管理
        </RouterLink>
        <RouterLink :to="{ name: 'admin-realms' }">
          <span class="ico">☯</span> 境界列表
        </RouterLink>
        <RouterLink :to="{ name: 'admin-pills' }">
          <span class="ico">◉</span> 丹药管理
        </RouterLink>
        <RouterLink :to="{ name: 'admin-sects' }">
          <span class="ico">⛩</span> 宗门管理
        </RouterLink>
        <RouterLink :to="{ name: 'admin-announcements' }">
          <span class="ico">✉</span> 公告管理
        </RouterLink>
        <RouterLink :to="{ name: 'admin-configs' }">
          <span class="ico">⚙</span> 系统配置
        </RouterLink>
      </nav>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="crumb">控制台</div>
        <div class="account">
          <span class="who">{{ auth.user?.dao_name || '管理员' }}</span>
          <button class="ghost" @click="onLogout">退出</button>
        </div>
      </header>
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin {
  min-height: 100svh;
  display: flex;
}
.side {
  width: 208px;
  flex-shrink: 0;
  background: var(--panel);
  border-right: 1px solid var(--border);
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
}
/* 项目 logo（web/image/logo.webp，透明底），替代原色块印章 */
.seal {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.name {
  font-family: var(--serif);
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--text-h);
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text);
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}
.nav a .ico {
  opacity: 0.7;
}
.nav a:hover {
  background: var(--accent-soft);
  color: var(--text-h);
}
.nav a.router-link-active {
  background: var(--accent);
  color: #fff;
}
.nav a.router-link-active .ico {
  opacity: 1;
}
.main {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.crumb {
  font-size: 14px;
  color: var(--muted);
  letter-spacing: 1px;
}
.account {
  display: flex;
  align-items: center;
  gap: 14px;
}
.who {
  font-size: 14px;
  color: var(--text-h);
}
.ghost {
  padding: 6px 14px;
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
.content {
  flex: 1 1 0;
  padding: 24px;
  overflow: auto;
}

@media (max-width: 720px) {
  .admin {
    flex-direction: column;
  }
  .side {
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    gap: 12px;
  }
  .nav {
    flex-direction: row;
  }
}
</style>
