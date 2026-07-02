<script setup>
import { onMounted, ref } from 'vue'
import { apiDashboard } from '../../api/admin.js'

const stats = ref(null)
const error = ref('')

const cards = [
  { key: 'totalUsers', label: '总用户', accent: true },
  { key: 'activeUsers', label: '正常' },
  { key: 'disabledUsers', label: '禁用' },
  { key: 'newUsersToday', label: '今日新增' },
  { key: 'totalAdmins', label: '管理员' },
]

onMounted(async () => {
  try {
    stats.value = await apiDashboard()
  } catch (e) {
    error.value = e.message
  }
})
</script>

<template>
  <section>
    <h2 class="page-title">仪表盘</h2>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="grid" v-if="stats">
      <div v-for="c in cards" :key="c.key" class="stat" :class="{ hi: c.accent }">
        <div class="num">{{ stats[c.key] }}</div>
        <div class="lbl">{{ c.label }}</div>
      </div>
    </div>
    <p v-else-if="!error" class="loading">加载中…</p>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-h);
  letter-spacing: 1px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
.stat {
  padding: 22px 20px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
.stat.hi {
  background: var(--accent);
  border-color: transparent;
}
.num {
  font-size: 34px;
  font-weight: 600;
  color: var(--text-h);
  line-height: 1.1;
}
.stat.hi .num {
  color: #fff;
}
.lbl {
  margin-top: 8px;
  font-size: 13px;
  color: var(--muted);
  letter-spacing: 1px;
}
.stat.hi .lbl {
  color: rgba(255, 255, 255, 0.85);
}
.loading {
  color: var(--muted);
}
.err {
  color: var(--danger);
}
</style>
