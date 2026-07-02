<script setup>
import { onMounted, ref } from 'vue'
import { apiRealms } from '../../api/admin.js'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const err = ref('')

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : n
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await apiRealms()
    list.value = res.list
    total.value = res.total
  } catch (e) {
    err.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section>
    <div class="head">
      <h2 class="page-title">境界列表</h2>
      <span class="count">共 {{ total }} 个境界</span>
    </div>
    <p class="tip">凡人 → 圣人，共 {{ total }} 阶。数值为该境界基础属性，晋级要求指向下一境界。</p>

    <p v-if="err" class="err">{{ err }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>境界</th>
            <th>大境界</th>
            <th>阶段</th>
            <th>下一境界</th>
            <th>晋级要求</th>
            <th class="ta-r">经验</th>
            <th class="ta-r">道韵</th>
            <th class="ta-r">道法</th>
            <th>雷劫</th>
            <th class="ta-r">死亡率</th>
            <th class="ta-r">气血</th>
            <th class="ta-r">灵气</th>
            <th class="ta-r">攻击</th>
            <th class="ta-r">防御</th>
            <th class="ta-r">神识</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in list" :key="r.id">
            <td class="muted">{{ r.id }}</td>
            <td class="strong">{{ r.name }}</td>
            <td>{{ r.realm }}</td>
            <td class="muted">{{ r.stage || '—' }}</td>
            <td class="muted">{{ r.next_realm || '—' }}</td>
            <td>{{ r.requirement_type }}</td>
            <td class="ta-r">{{ fmt(r.advance_exp) }}</td>
            <td class="ta-r">{{ fmt(r.dao_yun_required) }}</td>
            <td class="ta-r">{{ fmt(r.dao_law_required) }}</td>
            <td class="muted">{{ r.tribulation_type || '—' }}</td>
            <td class="ta-r" :class="{ danger: Number(r.tribulation_death_rate) > 0 }">
              {{ Number(r.tribulation_death_rate) > 0 ? r.tribulation_death_rate + '%' : '—' }}
            </td>
            <td class="ta-r">{{ fmt(r.hp) }}</td>
            <td class="ta-r">{{ fmt(r.ling_qi) }}</td>
            <td class="ta-r">{{ fmt(r.attack) }}</td>
            <td class="ta-r">{{ fmt(r.defense) }}</td>
            <td class="ta-r">{{ fmt(r.spirit) }}</td>
          </tr>
          <tr v-if="!loading && list.length === 0">
            <td colspan="16" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 6px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-h);
  letter-spacing: 1px;
}
.count {
  font-size: 13px;
  color: var(--muted);
}
.tip {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--muted);
}
.table-wrap {
  overflow-x: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 1100px;
}
th, td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
th {
  font-weight: 500;
  font-size: 12px;
  color: var(--muted);
  background: var(--field-bg);
  position: sticky;
  top: 0;
}
tbody tr:last-child td {
  border-bottom: none;
}
tbody tr:hover td {
  background: var(--accent-soft);
}
td.strong {
  color: var(--text-h);
  font-weight: 500;
}
td.muted {
  color: var(--muted);
}
.ta-r {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
td.danger {
  color: var(--danger);
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 28px;
}
.err {
  color: var(--danger);
  margin: 0 0 12px;
}
</style>
