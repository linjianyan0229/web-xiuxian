<script setup>
import { onMounted, reactive, ref } from 'vue'
import { apiAdminSects, apiAdminSectUpdate, apiAdminSectDisband } from '../../api/admin.js'
import { useToast } from '../../composables/toast.js'

const toast = useToast()
const state = reactive({
  list: [],
  total: 0,
  page: 1,
  pageSize: 10,
})
const keyword = ref('')
const loading = ref(false)

// 编辑弹窗（名称/简介/活跃度；头像背景等由玩家侧维护）
const editVisible = ref(false)
const editRow = ref(null)
const editForm = reactive({ name: '', intro: '', activity: 0 })
const editBusy = ref(false)
const editError = ref('')

// 解散确认
const disbandRow = ref(null)
const disbandBusy = ref(false)

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  try {
    const res = await apiAdminSects({
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

function openEdit(row) {
  editRow.value = row
  editForm.name = row.name
  editForm.intro = row.intro || ''
  editForm.activity = Number(row.activity) || 0
  editError.value = ''
  editVisible.value = true
}

async function saveEdit() {
  if (editBusy.value || !editRow.value) return
  const name = editForm.name.trim()
  if (name.length < 2 || name.length > 16) {
    editError.value = '宗门名称须为 2~16 个字符'
    return
  }
  if (!Number.isInteger(Number(editForm.activity)) || Number(editForm.activity) < 0) {
    editError.value = '活跃度须为非负整数'
    return
  }
  editBusy.value = true
  editError.value = ''
  try {
    await apiAdminSectUpdate(editRow.value.id, {
      name,
      intro: editForm.intro.trim(),
      activity: Number(editForm.activity),
    })
    toast.success('宗门信息已更新')
    editVisible.value = false
    load()
  } catch (e) {
    editError.value = e.message
  } finally {
    editBusy.value = false
  }
}

async function confirmDisband() {
  if (disbandBusy.value || !disbandRow.value) return
  disbandBusy.value = true
  try {
    await apiAdminSectDisband(disbandRow.value.id)
    toast.success(`【${disbandRow.value.name}】已解散，成员归属已清空`)
    disbandRow.value = null
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    disbandBusy.value = false
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
      <h2 class="page-title">宗门管理</h2>
      <div class="tools">
        <div class="search">
          <input v-model="keyword" type="text" placeholder="搜索宗门名称" @keyup.enter="onSearch" />
          <button class="btn-sm" @click="onSearch">搜索</button>
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>宗门</th>
            <th>宗主</th>
            <th>境界要求</th>
            <th>人数</th>
            <th>活跃度</th>
            <th>创建时间</th>
            <th class="ta-r">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in state.list" :key="row.id">
            <td>{{ row.id }}</td>
            <td>
              <div class="strong">{{ row.name }}</div>
              <div class="sub">{{ row.intro || '—' }}</div>
            </td>
            <td>{{ row.leader_name || '—' }}</td>
            <td>{{ row.realm_req ? row.realm_req + '及以上' : '无要求' }}</td>
            <td>{{ row.member_count }}</td>
            <td>{{ row.activity }}</td>
            <td class="time">{{ fmt(row.created_time) }}</td>
            <td class="ta-r">
              <button class="btn-sm ghost" @click="openEdit(row)">编辑</button>
              <button class="btn-sm danger" @click="disbandRow = row">解散</button>
            </td>
          </tr>
          <tr v-if="!loading && state.list.length === 0">
            <td colspan="8" class="empty">暂无宗门</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="total">共 {{ state.total }} 个宗门</span>
      <div class="ctrl">
        <button class="btn-sm" :disabled="state.page <= 1" @click="go(-1)">上一页</button>
        <span class="pageno">{{ state.page }} / {{ totalPages() }}</span>
        <button class="btn-sm" :disabled="state.page >= totalPages()" @click="go(1)">下一页</button>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editVisible" class="mask" @click.self="editVisible = false">
      <div class="modal">
        <header class="m-head">
          <h3>编辑宗门 · {{ editRow?.name }}</h3>
          <button class="x" @click="editVisible = false">×</button>
        </header>
        <div class="m-body">
          <label class="fld">
            <span>宗门名称</span>
            <input v-model.trim="editForm.name" :disabled="editBusy" />
          </label>
          <label class="fld">
            <span>活跃度</span>
            <input v-model.number="editForm.activity" type="number" min="0" :disabled="editBusy" />
          </label>
          <label class="fld">
            <span>宗门简介</span>
            <textarea v-model="editForm.intro" rows="3" maxlength="500" :disabled="editBusy"></textarea>
          </label>
          <p v-if="editError" class="m-err">{{ editError }}</p>
        </div>
        <footer class="m-foot">
          <button class="btn-sm ghost" :disabled="editBusy" @click="editVisible = false">取消</button>
          <button class="btn-sm" :disabled="editBusy" @click="saveEdit">
            {{ editBusy ? '保存中…' : '保存' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- 解散确认 -->
    <div v-if="disbandRow" class="mask" @click.self="disbandRow = null">
      <div class="modal slim">
        <header class="m-head">
          <h3>解散宗门</h3>
          <button class="x" @click="disbandRow = null">×</button>
        </header>
        <div class="m-body">
          <p class="confirm-text">
            确定解散【<b>{{ disbandRow.name }}</b>】？宗门将被删除，
            {{ disbandRow.member_count }} 名成员的宗门归属会被清空，<b>此操作不可撤销</b>。
          </p>
        </div>
        <footer class="m-foot">
          <button class="btn-sm ghost" :disabled="disbandBusy" @click="disbandRow = null">取消</button>
          <button class="btn-sm danger" :disabled="disbandBusy" @click="confirmDisband">
            {{ disbandBusy ? '解散中…' : '确认解散' }}
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
.strong { color: var(--text-h); font-weight: 500; white-space: nowrap; }
.sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time { white-space: nowrap; color: var(--muted); font-size: 13px; }
.ta-r { text-align: right; white-space: nowrap; }
.empty { text-align: center; color: var(--muted); padding: 28px; }

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
}
.modal {
  width: min(460px, 92vw);
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
.fld textarea {
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
.fld textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
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
