<script setup>
import { onMounted, reactive, ref } from 'vue'
import { apiAdminUsers, apiSetUserStatus, apiDeleteUser, apiRealms } from '../../api/admin.js'
import UserFormModal from '../../components/UserFormModal.vue'
import UserAvatar from '../../components/UserAvatar.vue'
import { useToast } from '../../composables/toast.js'
import { fmtDateTime } from '../../utils/datetime.js'

const toast = useToast()
const state = reactive({
  list: [],
  total: 0,
  page: 1,
  pageSize: 10,
})
const keyword = ref('')
const loading = ref(false)
const busyId = ref(0)

// 增/改 弹窗 + 删除确认
const realms = ref([])
const formVisible = ref(false)
const formMode = ref('add')
const formUser = ref(null)
const confirmRow = ref(null)
const deleting = ref(false)

function openAdd() {
  formMode.value = 'add'
  formUser.value = null
  formVisible.value = true
}
function openEdit(row) {
  formMode.value = 'edit'
  formUser.value = row
  formVisible.value = true
}
function onSaved() {
  formVisible.value = false
  load()
}
async function doDelete() {
  if (!confirmRow.value) return
  deleting.value = true
  try {
    await apiDeleteUser(confirmRow.value.id)
    // 删除后若当前页仅剩这一条且非首页，回退一页
    if (state.list.length === 1 && state.page > 1) state.page -= 1
    confirmRow.value = null
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    deleting.value = false
  }
}

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  try {
    const res = await apiAdminUsers({
      page: state.page,
      pageSize: state.pageSize,
      keyword: keyword.value.trim(),
    })
    state.list = res.list
    state.total = res.total
  } catch (e) {
    toast.error(e.message)
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
    toast.error(e.message)
  } finally {
    busyId.value = 0
  }
}

function fmt(t) {
  return fmtDateTime(t)
}

onMounted(async () => {
  load()
  try {
    const r = await apiRealms()
    realms.value = r.list
  } catch {
    /* 境界列表拉取失败不影响用户管理主流程 */
  }
})
</script>

<template>
  <section>
    <div class="head">
      <h2 class="page-title">用户管理</h2>
      <div class="tools">
        <div class="search">
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索道号 / 邮箱"
            @keyup.enter="onSearch"
          />
          <button class="btn-sm" @click="onSearch">搜索</button>
        </div>
        <button class="btn-sm add" @click="openAdd">＋ 添加用户</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>道号</th>
            <th>邮箱</th>
            <th>境界</th>
            <th>悟性</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>上次登录</th>
            <th class="ta-r">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in state.list" :key="row.id">
            <td>{{ row.id }}</td>
            <td class="strong">
              <span class="who">
                <UserAvatar :avatar="row.avatar" :name="row.dao_name" :size="28" />
                {{ row.dao_name }}
              </span>
            </td>
            <td>{{ row.email }}</td>
            <td><span class="realm">{{ row.realm_name || '—' }}</span></td>
            <td>{{ Number(row.comprehension) || 0 }}%</td>
            <td>
              <span class="tag" :class="row.status === 1 ? 'ok' : 'off'">
                {{ row.status === 1 ? '正常' : '禁用' }}
              </span>
            </td>
            <td class="muted">{{ fmt(row.register_time) }}</td>
            <td class="muted">{{ fmt(row.login_time) }}</td>
            <td class="ta-r">
              <div class="actions">
                <button class="btn-sm ghost" @click="openEdit(row)">编辑</button>
                <button
                  class="btn-sm"
                  :class="row.status === 1 ? 'danger' : ''"
                  :disabled="busyId === row.id"
                  @click="toggleStatus(row)"
                >
                  {{ row.status === 1 ? '禁用' : '启用' }}
                </button>
                <button class="btn-sm danger" @click="confirmRow = row">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && state.list.length === 0">
            <td colspan="9" class="empty">暂无数据</td>
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

    <!-- 添加 / 编辑 用户 -->
    <UserFormModal
      :visible="formVisible"
      :mode="formMode"
      :user="formUser"
      :realms="realms"
      @close="formVisible = false"
      @saved="onSaved"
    />

    <!-- 删除确认 -->
    <div v-if="confirmRow" class="mask" @click.self="confirmRow = null">
      <div class="confirm">
        <h3>删除用户</h3>
        <p>
          确定删除道号「<b>{{ confirmRow.dao_name }}</b>」（ID {{ confirmRow.id }}）？<br />
          此操作不可恢复。
        </p>
        <div class="cf-actions">
          <button class="btn-sm ghost" @click="confirmRow = null">取消</button>
          <button class="btn-sm danger" :disabled="deleting" @click="doDelete">
            {{ deleting ? '删除中…' : '确认删除' }}
          </button>
        </div>
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
.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.search {
  display: flex;
  gap: 8px;
}
.btn-sm.add {
  background: var(--accent);
  white-space: nowrap;
}
.actions {
  display: inline-flex;
  gap: 6px;
  justify-content: flex-end;
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
.who {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
.realm {
  color: var(--text-h);
  font-weight: 500;
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
.btn-sm.ghost {
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border);
}
.btn-sm.ghost:hover {
  color: var(--text-h);
  border-color: var(--muted);
  background: transparent;
}
.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 删除确认弹窗 */
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(20, 22, 26, 0.5);
  backdrop-filter: blur(2px);
  padding: 20px;
}
.confirm {
  width: min(400px, 100%);
  padding: 22px 24px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
.confirm h3 {
  margin: 0 0 10px;
  font-size: 17px;
  color: var(--text-h);
}
.confirm p {
  margin: 0 0 18px;
  font-size: 14px;
  color: var(--text);
  line-height: 1.7;
}
.cf-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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
</style>
