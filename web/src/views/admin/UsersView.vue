<script setup>
import { onMounted, reactive, ref } from 'vue'
import { apiAdminUsers, apiSetUserStatus } from '../../api/admin.js'

const state = reactive({
  list: [],
  total: 0,
  page: 1,
  pageSize: 10,
})
const keyword = ref('')
const loading = ref(false)
const error = ref('')
const busyId = ref(0)

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiAdminUsers({
      page: state.page,
      pageSize: state.pageSize,
      keyword: keyword.value.trim(),
    })
    state.list = res.list
    state.total = res.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function onSearch() {
  state.page = 1
  load()
}

function go(delta) {
  const next = state.page + delta
  if (next < 1 || next > totalPages()) return
  state.page = next
  load()
}

async function toggleStatus(row) {
  busyId.value = row.id
  try {
    const next = row.status === 1 ? 0 : 1
    const { user } = await apiSetUserStatus(row.id, next)
    row.status = user.status
  } catch (e) {
    error.value = e.message
  } finally {
    busyId.value = 0
  }
}

function fmt(t) {
  return t ? String(t).replace('T', ' ').slice(0, 19) : '—'
}

onMounted(load)
</script>

<template>
  <section>
    <div class="head">
      <h2 class="page-title">用户管理</h2>
      <div class="search">
        <input
          v-model="keyword"
          type="text"
          placeholder="搜索道号 / 邮箱"
          @keyup.enter="onSearch"
        />
        <button class="btn-sm" @click="onSearch">搜索</button>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>道号</th>
            <th>邮箱</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>上次登录</th>
            <th class="ta-r">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in state.list" :key="row.id">
            <td>{{ row.id }}</td>
            <td class="strong">{{ row.dao_name }}</td>
            <td>{{ row.email }}</td>
            <td>
              <span class="tag" :class="row.status === 1 ? 'ok' : 'off'">
                {{ row.status === 1 ? '正常' : '禁用' }}
              </span>
            </td>
            <td class="muted">{{ fmt(row.register_time) }}</td>
            <td class="muted">{{ fmt(row.login_time) }}</td>
            <td class="ta-r">
              <button
                class="btn-sm"
                :class="row.status === 1 ? 'danger' : ''"
                :disabled="busyId === row.id"
                @click="toggleStatus(row)"
              >
                {{ row.status === 1 ? '禁用' : '启用' }}
              </button>
            </td>
          </tr>
          <tr v-if="!loading && state.list.length === 0">
            <td colspan="7" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="total">共 {{ state.total }} 条</span>
      <div class="ctrl">
        <button class="btn-sm" :disabled="state.page <= 1" @click="go(-1)">上一页</button>
        <span class="pageno">{{ state.page }} / {{ totalPages() }}</span>
        <button class="btn-sm" :disabled="state.page >= totalPages()" @click="go(1)">下一页</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-h);
  letter-spacing: 1px;
}
.search {
  display: flex;
  gap: 8px;
}
.search input {
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  width: 200px;
}
.search input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
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
  font-size: 14px;
  min-width: 640px;
}
th, td {
  padding: 13px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
th {
  font-weight: 500;
  font-size: 13px;
  color: var(--muted);
  background: var(--field-bg);
}
tbody tr:last-child td {
  border-bottom: none;
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
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 28px;
}
.tag {
  display: inline-block;
  padding: 2px 10px;
  font-size: 12px;
  border-radius: 999px;
}
.tag.ok {
  color: var(--accent);
  background: var(--accent-soft);
}
.tag.off {
  color: var(--danger);
  background: rgba(180, 69, 58, 0.12);
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.btn-sm:hover {
  background: var(--accent-h);
}
.btn-sm.danger {
  background: var(--danger);
}
.btn-sm.danger:hover {
  filter: brightness(1.08);
}
.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.total {
  font-size: 13px;
  color: var(--muted);
}
.ctrl {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pageno {
  font-size: 13px;
  color: var(--text-h);
}
.err {
  color: var(--danger);
  margin: 0 0 12px;
}
</style>
