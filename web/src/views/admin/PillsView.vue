<script setup>
import { onMounted, reactive, ref } from 'vue'
import { apiAdminPills, apiPillMeta } from '../../api/admin.js'
import PillFormModal from '../../components/PillFormModal.vue'
import { useToast } from '../../composables/toast.js'

const toast = useToast()
const state = reactive({
  list: [],
  total: 0,
  page: 1,
  pageSize: 10,
})
const keyword = ref('')
const realm = ref('')
const category = ref('')
const meta = ref({ categories: [], realms: [] })
const loading = ref(false)

// 编辑弹窗
const formVisible = ref(false)
const formPill = ref(null)

function openEdit(row) {
  formPill.value = row
  formVisible.value = true
}
function onSaved() {
  formVisible.value = false
  load()
}

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  try {
    const res = await apiAdminPills({
      page: state.page,
      pageSize: state.pageSize,
      keyword: keyword.value.trim(),
      realm: realm.value,
      category: category.value,
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

onMounted(async () => {
  load()
  try {
    meta.value = await apiPillMeta()
  } catch {
    /* 筛选元数据拉取失败不影响列表主流程 */
  }
})
</script>

<template>
  <section>
    <div class="head">
      <h2 class="page-title">丹药管理</h2>
      <div class="tools">
        <select v-model="realm" class="sel" @change="onSearch">
          <option value="">全部境界</option>
          <option v-for="r in meta.realms" :key="r.realm" :value="r.realm">{{ r.realm }}</option>
        </select>
        <select v-model="category" class="sel" @change="onSearch">
          <option value="">全部类型</option>
          <option v-for="c in meta.categories" :key="c.category" :value="c.category">
            {{ c.category_name }}
          </option>
        </select>
        <div class="search">
          <input v-model="keyword" type="text" placeholder="搜索丹药名" @keyup.enter="onSearch" />
          <button class="btn-sm" @click="onSearch">搜索</button>
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>丹药</th>
            <th>境界</th>
            <th>类型</th>
            <th>品质与效果</th>
            <th class="ta-r">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in state.list" :key="row.id">
            <td>
              <div class="strong">{{ row.name }}</div>
              <div class="pid">{{ row.id }}</div>
            </td>
            <td><span class="realm">{{ row.realm }}</span></td>
            <td><span class="cat">{{ row.category_name }}</span></td>
            <td class="grades-cell">
              <div v-for="g in row.grades" :key="g.grade" class="g-line">
                <span class="g-tag" :class="'g-' + g.grade">{{ g.grade_name }}</span>
                <span class="g-sum">{{ g.summary || '—' }}</span>
              </div>
            </td>
            <td class="ta-r">
              <button class="btn-sm ghost" @click="openEdit(row)">编辑</button>
            </td>
          </tr>
          <tr v-if="!loading && state.list.length === 0">
            <td colspan="5" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="total">共 {{ state.total }} 种</span>
      <div class="ctrl">
        <button class="btn-sm" :disabled="state.page <= 1" @click="go(-1)">上一页</button>
        <span class="pageno">{{ state.page }} / {{ totalPages() }}</span>
        <button class="btn-sm" :disabled="state.page >= totalPages()" @click="go(1)">下一页</button>
      </div>
    </div>

    <!-- 编辑丹药 -->
    <PillFormModal
      :visible="formVisible"
      :pill="formPill"
      @close="formVisible = false"
      @saved="onSaved"
    />
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
.search input,
.sel {
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
}
.search input {
  width: 180px;
}
.search input:focus,
.sel:focus {
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
  min-width: 720px;
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
tbody tr:last-child td {
  border-bottom: none;
}
.strong {
  color: var(--text-h);
  font-weight: 500;
  white-space: nowrap;
}
.pid {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
.realm,
.cat {
  color: var(--text-h);
  white-space: nowrap;
}
.grades-cell {
  min-width: 300px;
}
.g-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 0;
}
.g-tag {
  flex: none;
  display: inline-block;
  width: 22px;
  text-align: center;
  padding: 1px 0;
  font-size: 12px;
  border-radius: 6px;
}
.g-fan {
  color: var(--muted);
  background: var(--field-bg);
  border: 1px solid var(--border);
}
.g-ling {
  color: var(--accent);
  background: var(--accent-soft);
}
.g-dao {
  color: #b4453a;
  background: rgba(180, 69, 58, 0.12);
}
.g-sum {
  font-size: 13px;
  color: var(--text);
}
.ta-r {
  text-align: right;
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 28px;
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
