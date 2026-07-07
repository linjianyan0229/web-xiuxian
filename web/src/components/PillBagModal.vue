<script setup>
import { reactive, ref, watch } from 'vue'
import { apiMyPills, apiMyPillMeta } from '../api/game.js'
import PillDetailModal from './PillDetailModal.vue'
import { useToast } from '../composables/toast.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})
// changed: 赠送/丢弃改变了背包（首页据此刷新修行日志）
const emit = defineEmits(['close', 'changed'])

const toast = useToast()

const state = reactive({
  list: [],
  total: 0,
  page: 1,
  pageSize: 8,
})
const keyword = ref('')
const realm = ref('')
const category = ref('')
const grade = ref('')
const meta = ref({ categories: [], realms: [] })
const loading = ref(false)

// 品质筛选为固定三档
const GRADE_OPTIONS = [
  { value: 'fan', label: '凡品' },
  { value: 'ling', label: '灵品' },
  { value: 'dao', label: '道品' },
]

// 详情小窗
const detailVisible = ref(false)
const selected = ref(null)

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  try {
    const res = await apiMyPills({
      page: state.page,
      pageSize: state.pageSize,
      keyword: keyword.value.trim(),
      realm: realm.value,
      category: category.value,
      grade: grade.value,
    })
    state.list = res.list
    state.total = res.total
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    meta.value = await apiMyPillMeta()
  } catch {
    /* 筛选元数据拉取失败不影响列表主流程 */
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

function openDetail(row) {
  selected.value = row
  detailVisible.value = true
}

// 赠送/丢弃成功：同步详情数量并刷新列表与筛选项；本页被清空时回退一页
async function onItemChanged(remaining) {
  if (selected.value) selected.value = { ...selected.value, quantity: remaining }
  if (remaining <= 0) detailVisible.value = false
  await load()
  if (state.list.length === 0 && state.page > 1) {
    state.page -= 1
    await load()
  }
  loadMeta()
  emit('changed')
}

// 打开背包：重置筛选并拉取列表与筛选项
watch(
  () => props.visible,
  (v) => {
    if (v) {
      keyword.value = ''
      realm.value = ''
      category.value = ''
      grade.value = ''
      state.page = 1
      detailVisible.value = false
      selected.value = null
      load()
      loadMeta()
    }
  }
)
</script>

<template>
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <header class="head">
        <h3 class="title">丹药背包</h3>
        <span class="count" v-if="state.total > 0">共 {{ state.total }} 项</span>
        <button class="x" @click="emit('close')" title="关闭">×</button>
      </header>

      <!-- 筛选栏：品质 / 境界 / 类型 / 关键字 -->
      <div class="tools">
        <select v-model="grade" class="sel" @change="onSearch">
          <option value="">全部品质</option>
          <option v-for="g in GRADE_OPTIONS" :key="g.value" :value="g.value">{{ g.label }}</option>
        </select>
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

      <!-- 背包列表 -->
      <div class="list">
        <div class="row row-head">
          <span></span>
          <span>丹药</span>
          <span>境界</span>
          <span>类型</span>
          <span class="col-sum">药效</span>
          <span class="ta-r">数量</span>
        </div>
        <button
          v-for="row in state.list"
          :key="row.pill_id + '-' + row.grade"
          class="row row-item"
          @click="openDetail(row)"
        >
          <span class="g-tag" :class="'g-' + row.grade">{{ row.grade_name }}</span>
          <span class="p-name">{{ row.item_name }}</span>
          <span class="p-realm">{{ row.realm }}</span>
          <span class="p-cat">{{ row.category_name }}</span>
          <span class="p-sum col-sum">{{ row.summary || '—' }}</span>
          <span class="p-qty ta-r">×{{ row.quantity }}</span>
        </button>

        <p v-if="!loading && state.list.length === 0" class="empty">
          纳戒空空如也——丹药可待日后炼丹、机缘或道友相赠而得。
        </p>
        <p v-else-if="loading && state.list.length === 0" class="empty">正在清点纳戒…</p>
      </div>

      <!-- 分页 -->
      <footer class="pager" v-if="state.total > state.pageSize">
        <button class="btn-sm ghost" :disabled="state.page <= 1" @click="go(-1)">上一页</button>
        <span class="pageno">{{ state.page }} / {{ totalPages() }}</span>
        <button class="btn-sm ghost" :disabled="state.page >= totalPages()" @click="go(1)">
          下一页
        </button>
      </footer>

      <!-- 丹药详情：服用 / 赠送 / 丢弃 -->
      <PillDetailModal
        :visible="detailVisible"
        :item="selected"
        @close="detailVisible = false"
        @changed="onItemChanged"
      />
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(30, 28, 22, 0.42);
  backdrop-filter: blur(2px);
}
.dialog {
  --gold: #b8933f;
  --gold-2: #e6cf93;
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);
  --red: #a8452f;

  position: relative;
  width: min(880px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  padding: 22px 24px 18px;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background:
    radial-gradient(700px 220px at 50% -20%, rgba(255, 255, 255, 0.8), transparent 70%),
    linear-gradient(160deg, #fbfaf5 0%, #f1f0e9 100%);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: 0 24px 60px -20px rgba(40, 38, 30, 0.6);
  animation: pop 0.2s ease-out;
}
@keyframes pop {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
}
.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink-h);
  padding-left: 10px;
  border-left: 3px solid var(--gold);
}
.count {
  font-size: 12px;
  color: var(--ink-mut);
}
.x {
  margin-left: auto;
  font-size: 22px;
  line-height: 1;
  color: var(--ink-mut);
  background: none;
  border: none;
  cursor: pointer;
}
.x:hover { color: var(--gold); }

/* 筛选栏 */
.tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sel,
.search input {
  padding: 8px 10px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--line);
  border-radius: 8px;
  outline: none;
}
.sel:focus,
.search input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.15);
}
.search {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.search input { width: 150px; }

/* 列表：表头 + 条目行（条目为按钮，整行可点开详情） */
.list {
  flex: 1 1 auto;
  min-height: 120px;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.45);
}
.row {
  display: grid;
  grid-template-columns: 44px minmax(150px, 1.3fr) 72px 90px 2fr 56px;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 14px;
  font-size: 13px;
  text-align: left;
  border-bottom: 1px dashed var(--line);
}
.row-head {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 14px;
  font-size: 12px;
  color: var(--ink-mut);
  background: #f3f2ea;
  border-bottom: 1px solid var(--line);
}
.row-item {
  font-family: inherit;
  color: var(--ink);
  background: transparent;
  border-left: none;
  border-right: none;
  border-top: none;
  cursor: pointer;
  transition: background 0.12s;
}
.row-item:hover { background: rgba(184, 147, 63, 0.08); }
.row-item:last-of-type { border-bottom: none; }
.p-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p-realm,
.p-cat { color: var(--ink); white-space: nowrap; }
.p-sum {
  color: var(--ink-mut);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p-qty {
  font-weight: 700;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.ta-r { text-align: right; }

.g-tag {
  display: inline-block;
  width: 26px;
  text-align: center;
  padding: 2px 0;
  font-size: 12px;
  border-radius: 7px;
}
.g-fan {
  color: var(--ink-mut);
  background: rgba(60, 56, 46, 0.07);
  border: 1px solid var(--line);
}
.g-ling {
  color: #4a3a12;
  background: rgba(184, 147, 63, 0.18);
  border: 1px solid rgba(184, 147, 63, 0.4);
}
.g-dao {
  color: #fff;
  background: linear-gradient(160deg, #c96a4a, #a8452f);
  border: 1px solid rgba(168, 69, 47, 0.5);
}

.empty {
  margin: 0;
  padding: 42px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-mut);
}

/* 分页 */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding-top: 12px;
}
.pageno {
  font-size: 13px;
  color: var(--ink-h);
  font-variant-numeric: tabular-nums;
}
.btn-sm {
  padding: 6px 14px;
  font-family: inherit;
  font-size: 13px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 7px;
  cursor: pointer;
}
.btn-sm.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}
.btn-sm.ghost:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.btn-sm:disabled { opacity: 0.5; cursor: default; }

/* 窄屏：隐藏药效列，收紧栅格 */
@media (max-width: 720px) {
  .row { grid-template-columns: 40px minmax(120px, 1.4fr) 64px 80px 48px; }
  .col-sum { display: none; }
  .search { margin-left: 0; }
}
</style>
