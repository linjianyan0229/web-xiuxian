<script setup>
import { onMounted, reactive, ref } from 'vue'
import {
  apiAdminAnnouncements,
  apiCreateAnnouncement,
  apiUpdateAnnouncement,
  apiDeleteAnnouncement,
} from '../../api/admin.js'
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

// 编辑/发布弹窗（editRow 为 null 表示新建）
const editVisible = ref(false)
const editRow = ref(null)
const editForm = reactive({ title: '', content: '', pinned: false, status: 1 })
const editBusy = ref(false)
const editError = ref('')

// 删除确认
const delRow = ref(null)
const delBusy = ref(false)

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  try {
    const res = await apiAdminAnnouncements({
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

function openCreate() {
  editRow.value = null
  editForm.title = ''
  editForm.content = ''
  editForm.pinned = false
  editForm.status = 1
  editError.value = ''
  editVisible.value = true
}

function openEdit(row) {
  editRow.value = row
  editForm.title = row.title
  editForm.content = row.content || ''
  editForm.pinned = Number(row.pinned) === 1
  editForm.status = Number(row.status) === 0 ? 0 : 1
  editError.value = ''
  editVisible.value = true
}

async function saveEdit() {
  if (editBusy.value) return
  const title = editForm.title.trim()
  if (title.length < 1 || title.length > 60) {
    editError.value = '公告标题须为 1~60 个字符'
    return
  }
  editBusy.value = true
  editError.value = ''
  const payload = {
    title,
    content: editForm.content.trim(),
    pinned: editForm.pinned ? 1 : 0,
    status: Number(editForm.status) === 0 ? 0 : 1,
  }
  try {
    if (editRow.value) {
      await apiUpdateAnnouncement(editRow.value.id, payload)
      toast.success('公告已更新')
    } else {
      await apiCreateAnnouncement(payload)
      toast.success('公告已发布')
      state.page = 1
    }
    editVisible.value = false
    load()
  } catch (e) {
    editError.value = e.message
  } finally {
    editBusy.value = false
  }
}

async function confirmDelete() {
  if (delBusy.value || !delRow.value) return
  delBusy.value = true
  try {
    await apiDeleteAnnouncement(delRow.value.id)
    toast.success('公告已删除')
    delRow.value = null
    // 删至本页空则回退一页
    if (state.list.length === 1 && state.page > 1) state.page -= 1
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    delBusy.value = false
  }
}

function fmt(t) {
  return fmtDateTime(t)
}

onMounted(load)
</script>

<template>
  <section>
    <div class="head">
      <h2 class="page-title">公告管理</h2>
      <div class="tools">
        <div class="search">
          <input v-model="keyword" type="text" placeholder="搜索公告标题" @keyup.enter="onSearch" />
          <button class="btn-sm" @click="onSearch">搜索</button>
        </div>
        <button class="btn-sm" @click="openCreate">＋ 发布公告</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>状态</th>
            <th>置顶</th>
            <th>发布时间</th>
            <th>更新时间</th>
            <th class="ta-r">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in state.list" :key="row.id">
            <td>{{ row.id }}</td>
            <td>
              <div class="strong">{{ row.title }}</div>
              <div class="sub">{{ row.content || '—' }}</div>
            </td>
            <td>
              <span class="badge" :class="Number(row.status) === 1 ? 'on' : 'off'">
                {{ Number(row.status) === 1 ? '已发布' : '下架' }}
              </span>
            </td>
            <td>{{ Number(row.pinned) === 1 ? '置顶' : '—' }}</td>
            <td class="time">{{ fmt(row.created_time) }}</td>
            <td class="time">{{ fmt(row.updated_time) }}</td>
            <td class="ta-r">
              <button class="btn-sm ghost" @click="openEdit(row)">编辑</button>
              <button class="btn-sm danger" @click="delRow = row">删除</button>
            </td>
          </tr>
          <tr v-if="!loading && state.list.length === 0">
            <td colspan="7" class="empty">暂无公告</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="total">共 {{ state.total }} 条公告</span>
      <div class="ctrl">
        <button class="btn-sm" :disabled="state.page <= 1" @click="go(-1)">上一页</button>
        <span class="pageno">{{ state.page }} / {{ totalPages() }}</span>
        <button class="btn-sm" :disabled="state.page >= totalPages()" @click="go(1)">下一页</button>
      </div>
    </div>

    <!-- 发布 / 编辑弹窗 -->
    <div v-if="editVisible" class="mask" @click.self="editVisible = false">
      <div class="modal">
        <header class="m-head">
          <h3>{{ editRow ? '编辑公告' : '发布公告' }}</h3>
          <button class="x" @click="editVisible = false">×</button>
        </header>
        <div class="m-body">
          <label class="fld">
            <span>标题</span>
            <input v-model.trim="editForm.title" maxlength="60" :disabled="editBusy" placeholder="公告标题" />
          </label>
          <label class="fld">
            <span>正文</span>
            <textarea
              v-model="editForm.content"
              rows="6"
              maxlength="2000"
              :disabled="editBusy"
              placeholder="公告正文…"
            ></textarea>
          </label>
          <div class="fld-row">
            <label class="chk">
              <input v-model="editForm.pinned" type="checkbox" :disabled="editBusy" />
              <span>置顶</span>
            </label>
            <label class="fld inline">
              <span>状态</span>
              <select v-model.number="editForm.status" :disabled="editBusy">
                <option :value="1">已发布</option>
                <option :value="0">下架</option>
              </select>
            </label>
          </div>
          <p v-if="editError" class="m-err">{{ editError }}</p>
        </div>
        <footer class="m-foot">
          <button class="btn-sm ghost" :disabled="editBusy" @click="editVisible = false">取消</button>
          <button class="btn-sm" :disabled="editBusy" @click="saveEdit">
            {{ editBusy ? '保存中…' : editRow ? '保存' : '发布' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="delRow" class="mask" @click.self="delRow = null">
      <div class="modal slim">
        <header class="m-head">
          <h3>删除公告</h3>
          <button class="x" @click="delRow = null">×</button>
        </header>
        <div class="m-body">
          <p class="confirm-text">
            确定删除公告【<b>{{ delRow.title }}</b>】？<b>此操作不可撤销</b>。
          </p>
        </div>
        <footer class="m-foot">
          <button class="btn-sm ghost" :disabled="delBusy" @click="delRow = null">取消</button>
          <button class="btn-sm danger" :disabled="delBusy" @click="confirmDelete">
            {{ delBusy ? '删除中…' : '确认删除' }}
          </button>
        </footer>
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
.search { display: flex; gap: 8px; }
.search input {
  width: 200px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
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
  min-width: 860px;
}
th, td {
  padding: 13px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
th {
  font-weight: 500;
  font-size: 13px;
  color: var(--muted);
  background: var(--field-bg);
  white-space: nowrap;
}
tbody tr:last-child td { border-bottom: none; }
.strong { color: var(--text-h); font-weight: 500; }
.sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time { white-space: nowrap; color: var(--muted); font-size: 13px; }
.ta-r { text-align: right; white-space: nowrap; }
.empty { text-align: center; color: var(--muted); padding: 28px; }
.badge {
  display: inline-block;
  padding: 2px 9px;
  font-size: 12px;
  border-radius: 999px;
}
.badge.on { color: #2f7d46; background: rgba(47, 125, 70, 0.12); }
.badge.off { color: #9a6a2a; background: rgba(154, 106, 42, 0.14); }

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
.btn-sm:hover { background: var(--accent-h); }
.btn-sm.ghost {
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border);
}
.btn-sm.ghost:hover { color: var(--text-h); border-color: var(--muted); background: transparent; }
.btn-sm.danger {
  margin-left: 6px;
  background: #b4453a;
}
.btn-sm.danger:hover { background: #9c392f; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.total { font-size: 13px; color: var(--muted); }
.ctrl { display: flex; align-items: center; gap: 12px; }
.pageno { font-size: 13px; color: var(--text-h); }

/* 弹窗（沿用后台通用视觉） */
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(20, 20, 24, 0.45);
  padding: 20px;
}
.modal {
  width: min(520px, 92vw);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  overflow: hidden;
}
.modal.slim { width: min(400px, 92vw); }
.m-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.m-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}
.x {
  font-size: 20px;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.x:hover { color: var(--text-h); }
.m-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fld { display: flex; flex-direction: column; gap: 5px; }
.fld span { font-size: 12px; color: var(--muted); }
.fld input,
.fld textarea,
.fld select {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  font-size: 14px;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  resize: vertical;
}
.fld input:focus,
.fld textarea:focus,
.fld select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.fld-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.fld.inline { flex-direction: row; align-items: center; gap: 8px; }
.fld.inline select { width: auto; }
.chk {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  color: var(--text-h);
  cursor: pointer;
}
.chk input { width: 16px; height: 16px; cursor: pointer; }
.m-err { margin: 0; font-size: 13px; color: #b4453a; }
.confirm-text { margin: 0; font-size: 14px; line-height: 1.8; color: var(--text); }
.m-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
}
</style>
