<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { apiMyPills, apiMyPillMeta } from '../api/game.js'
import PillDetailModal from '../components/PillDetailModal.vue'
import { useToast } from '../composables/toast.js'
import dongfuImg from '../../image/dongfu.webp'

const router = useRouter()
const auth = useAuthStore()
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
const grade = ref('')
const meta = ref({ categories: [], realms: [] })
const loading = ref(false)

// 品质筛选为固定三档
const GRADE_OPTIONS = [
  { value: 'fan', label: '凡品' },
  { value: 'ling', label: '灵品' },
  { value: 'dao', label: '道品' },
]

// 详情弹窗（服用/赠送/丢弃）：行点击进主面板，行内按钮直达对应面板
const detailVisible = ref(false)
const detailMode = ref('main')
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

// 功效列：优先摘要文本，无摘要时由效果数组拼出简述
function effText(row) {
  if (row.summary) return row.summary
  let raw = row.effects
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }
  if (!Array.isArray(raw) || raw.length === 0) return '药力不明'
  return raw
    .map((e) => {
      const sign = e.polarity === 'negative' ? '−' : '+'
      return `${e.targetName || e.target}${sign}${e.value}${e.type === 'percent' ? '%' : ''}`
    })
    .join('、')
}

function openDetail(row, mode = 'main') {
  selected.value = row
  detailMode.value = mode
  detailVisible.value = true
}

// 服用：药力/buff 系统尚未接入，暂为占位
function consume() {
  toast.info('丹药药力尚未接入结算，服用玩法敬请期待')
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
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchProfile()
    } catch {
      return
    }
  }
  load()
  loadMeta()
})
</script>

<template>
  <div class="pill-page" :style="{ backgroundImage: `url(${dongfuImg})` }">
    <div class="veil">
      <!-- 顶栏 -->
      <header class="topbar">
        <button class="back" @click="router.push({ name: 'home' })">‹ 返回洞府</button>
        <h1 class="title">丹药纳戒</h1>
        <span class="count" v-if="state.total > 0">共 {{ state.total }} 项</span>
      </header>

      <!-- 工具栏：品质 / 品阶(境界) / 类型 / 名称 -->
      <div class="tools">
        <select v-model="grade" class="sel" @change="onSearch">
          <option value="">全部品质</option>
          <option v-for="g in GRADE_OPTIONS" :key="g.value" :value="g.value">{{ g.label }}</option>
        </select>
        <select v-model="realm" class="sel" @change="onSearch">
          <option value="">全部品阶</option>
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
          <button class="btn-sm ghost" @click="onSearch">搜索</button>
        </div>
      </div>

      <!-- 丹药列表 -->
      <main class="list-wrap">
        <div class="row row-head">
          <span></span>
          <span>丹药</span>
          <span>品阶</span>
          <span class="col-cat">类型</span>
          <span class="col-sum">功效</span>
          <span class="ta-r">数量</span>
          <span class="ta-c">操作</span>
        </div>
        <div
          v-for="row in state.list"
          :key="row.pill_id + '-' + row.grade"
          class="row row-item"
          role="button"
          tabindex="0"
          @click="openDetail(row)"
          @keyup.enter="openDetail(row)"
        >
          <span class="g-tag" :class="'g-' + row.grade">{{ row.grade_name }}</span>
          <span class="p-name">{{ row.item_name }}</span>
          <span class="p-realm">{{ row.realm }}</span>
          <span class="p-cat col-cat">{{ row.category_name }}</span>
          <span class="p-sum col-sum">{{ effText(row) }}</span>
          <span class="p-qty ta-r">×{{ row.quantity }}</span>
          <span class="acts" @click.stop>
            <button class="act gold" @click="consume">服用</button>
            <button class="act ghost" @click="openDetail(row, 'gift')">赠送</button>
            <button class="act ghost danger" @click="openDetail(row, 'discard')">丢弃</button>
          </span>
        </div>

        <p v-if="!loading && state.list.length === 0" class="empty">
          纳戒空空如也——丹药可待日后炼丹、机缘或道友相赠而得。
        </p>
        <p v-else-if="loading && state.list.length === 0" class="empty">正在清点纳戒…</p>
      </main>

      <!-- 分页 -->
      <footer class="pager" v-if="state.total > state.pageSize">
        <button class="btn-sm ghost" :disabled="state.page <= 1" @click="go(-1)">上一页</button>
        <span class="pageno">{{ state.page }} / {{ totalPages() }}</span>
        <button class="btn-sm ghost" :disabled="state.page >= totalPages()" @click="go(1)">
          下一页
        </button>
      </footer>
    </div>

    <!-- 丹药详情：服用 / 赠送 / 丢弃（行内按钮直达对应面板） -->
    <PillDetailModal
      :visible="detailVisible"
      :item="selected"
      :initial-mode="detailMode"
      @close="detailVisible = false"
      @changed="onItemChanged"
    />
  </div>
</template>

<style scoped>
.pill-page {
  /* 与游戏首页同一套固定水墨浅色主题 */
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --panel: rgba(251, 250, 245, 0.86);
  --panel-line: rgba(60, 56, 46, 0.16);
  --gold: #b8933f;
  --gold-2: #e6cf93;
  --red: #a8452f;

  /* 与 HUD 同规：锁定一屏、列表内滚（body 永无滚动条，切页视口稳定）；
     背景勿用 fixed（过渡 transform 会使 fixed 失效致背景闪跳） */
  height: 100svh;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background-color: #e2e5df;
  background-size: cover;
  background-position: center;
}
/* 宣纸色轻纱：保证内容可读，又透出洞府山水 */
.veil {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 18px 26px 24px;
  background: linear-gradient(180deg, rgba(238, 240, 235, 0.92) 0%, rgba(238, 240, 235, 0.78) 30%, rgba(238, 240, 235, 0.66) 100%);
}

/* 顶栏 */
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.back {
  padding: 8px 14px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  cursor: pointer;
}
.back:hover { color: var(--gold); border-color: var(--gold); }
.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--ink-h);
}
.count {
  margin-left: auto;
  padding: 6px 14px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}

/* 工具栏 */
.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.search {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.search input,
.sel {
  padding: 9px 12px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  outline: none;
}
.search input { width: 200px; }
.search input:focus,
.sel:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.15);
}

/* 列表：占余高并内部滚动（隐藏滚动条，同 HUD 各内滚区块） */
.list-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
}
.list-wrap::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.row {
  display: grid;
  grid-template-columns: 44px minmax(140px, 1.2fr) 76px 90px 2fr 56px 176px;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 18px;
  font-size: 13px;
  text-align: left;
  border-bottom: 1px dashed var(--panel-line);
}
.row-head {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 10px 18px;
  font-size: 12px;
  color: var(--ink-mut);
  background: #f0efe7;
  border-bottom: 1px solid var(--panel-line);
}
.row-item {
  color: var(--ink);
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
.p-cat { color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
.ta-c { text-align: center; }

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
  border: 1px solid var(--panel-line);
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

/* 行内操作按钮 */
.acts {
  display: flex;
  gap: 6px;
  justify-content: center;
}
.act {
  padding: 5px 12px;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 1px;
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;
}
.act.gold {
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
}
.act.gold:hover { filter: brightness(1.05); }
.act.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
}
.act.ghost:hover { color: var(--gold); border-color: var(--gold); }
.act.ghost.danger:hover { color: var(--red); border-color: var(--red); }

.empty {
  margin: 0;
  padding: 56px 20px;
  text-align: center;
  font-size: 14px;
  color: var(--ink-mut);
}

/* 分页 */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding-top: 14px;
}
.pageno {
  font-size: 13px;
  color: var(--ink-h);
  font-variant-numeric: tabular-nums;
}
.btn-sm {
  padding: 7px 16px;
  font-family: inherit;
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
}
.btn-sm.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
}
.btn-sm.ghost:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.btn-sm:disabled { opacity: 0.5; cursor: default; }

/* 窄屏：恢复整页滚动，隐藏功效/类型列 */
@media (max-width: 860px) {
  .pill-page {
    height: auto;
    min-height: 100svh;
    overflow: visible;
  }
  .veil {
    height: auto;
    min-height: 100svh;
    padding: 14px 14px 20px;
  }
  .list-wrap { overflow-y: visible; }
  .row { grid-template-columns: 40px minmax(110px, 1.4fr) 64px 44px 150px; }
  .col-sum,
  .col-cat { display: none; }
  .search { margin-left: 0; }
  .acts { gap: 4px; }
  .act { padding: 5px 8px; }
}
</style>
