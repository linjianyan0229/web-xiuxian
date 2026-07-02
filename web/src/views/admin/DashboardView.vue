<script setup>
import { onMounted, ref } from 'vue'
import { apiDashboard, apiRankings } from '../../api/admin.js'

const stats = ref(null)
const ranks = ref(null)
const error = ref('')

const cards = [
  { key: 'totalUsers', label: '总用户', accent: true },
  { key: 'activeUsers', label: '正常' },
  { key: 'disabledUsers', label: '禁用' },
  { key: 'newUsersToday', label: '今日新增' },
  { key: 'totalAdmins', label: '管理员' },
  { key: 'totalRealms', label: '境界数' },
]

const boards = [
  { key: 'realmTop', title: '境界排行榜', hint: '按当前境界高低', metric: 'realm' },
  { key: 'onlineTop', title: '在线排行榜', hint: '在线玩家 · 按境界', metric: 'realm' },
  { key: 'deathTop', title: '死亡排行榜', hint: '按死亡次数', metric: 'death' },
]

onMounted(async () => {
  try {
    const [s, r] = await Promise.all([apiDashboard(), apiRankings()])
    stats.value = s
    ranks.value = r
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

    <div class="boards" v-if="ranks">
      <div v-for="b in boards" :key="b.key" class="board">
        <div class="board-head">
          <h3>{{ b.title }}</h3>
          <span class="hint">{{ b.hint }}</span>
        </div>
        <ol class="rank-list">
          <li v-for="(row, i) in ranks[b.key]" :key="row.id">
            <span class="no" :class="'no-' + (i + 1)">{{ i + 1 }}</span>
            <span class="name">{{ row.dao_name }}</span>
            <span class="val">
              {{ b.metric === 'death' ? row.death_count + ' 次' : (row.realm_name || '凡人') }}
            </span>
          </li>
          <li v-if="ranks[b.key].length === 0" class="empty">暂无数据</li>
        </ol>
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
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
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

/* 排行榜 */
.boards {
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}
.board {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 18px 20px 10px;
}
.board-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.board-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
  letter-spacing: 1px;
}
.board-head .hint {
  font-size: 12px;
  color: var(--muted);
}
.rank-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rank-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  font-size: 14px;
  border-top: 1px solid var(--border);
}
.rank-list li:first-child {
  border-top: none;
}
.no {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--muted);
  background: var(--field-bg);
  border-radius: 6px;
}
.no-1 { color: #fff; background: #c9a24b; }
.no-2 { color: #fff; background: #9aa0a6; }
.no-3 { color: #fff; background: #b07a4a; }
.name {
  flex: 1 1 auto;
  color: var(--text-h);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.val {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 13px;
}
.rank-list .empty {
  justify-content: center;
  color: var(--muted);
  font-size: 13px;
  padding: 18px 0;
}
.loading {
  color: var(--muted);
}
.err {
  color: var(--danger);
}
</style>
