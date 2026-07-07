<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { apiSects, apiSectMeta } from '../api/game.js'
import SectCreateModal from '../components/SectCreateModal.vue'
import SectDetailModal from '../components/SectDetailModal.vue'
import UserAvatar from '../components/UserAvatar.vue'
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
  mySectId: null,
})
const keyword = ref('')
const realmReq = ref('')
const meta = ref({ realms: [], createCost: 5000 })
const loading = ref(false)

// 创建 / 详情弹窗
const createVisible = ref(false)
const detailVisible = ref(false)
const detailId = ref(0)

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  try {
    const res = await apiSects({
      page: state.page,
      pageSize: state.pageSize,
      keyword: keyword.value.trim(),
      realmReq: realmReq.value,
    })
    state.list = res.list
    state.total = res.total
    state.mySectId = res.mySectId
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    meta.value = await apiSectMeta()
  } catch {
    /* 元数据失败不影响列表 */
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
  detailId.value = row.id
  detailVisible.value = true
}

function openCreate() {
  if (state.mySectId) {
    toast.info('道友已有宗门在身，不可另立门户')
    return
  }
  createVisible.value = true
}

// 创建成功：后端已回最新用户视图（灵石扣减/入驻），落登录态并刷新列表
async function onCreated(payload) {
  if (payload?.user) auth.user = payload.user
  createVisible.value = false
  toast.success(`【${payload.sect.name}】开宗立派，道友已为一派宗主`)
  await load()
}

function fmt(t) {
  return t ? String(t).replace('T', ' ').slice(0, 10) : '—'
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
  <div class="sect-page" :style="{ backgroundImage: `url(${dongfuImg})` }">
    <div class="veil">
      <!-- 顶栏 -->
      <header class="topbar">
        <button class="back" @click="router.push({ name: 'home' })">‹ 返回洞府</button>
        <h1 class="title">天下宗门</h1>
        <div class="mine">
          <span class="ling-shi">灵石 <b>{{ auth.user?.ling_shi ?? '—' }}</b></span>
        </div>
      </header>

      <!-- 工具栏：搜索 / 筛选 / 创建 -->
      <div class="tools">
        <div class="search">
          <input v-model="keyword" type="text" placeholder="搜索宗门名号" @keyup.enter="onSearch" />
          <button class="btn-sm ghost" @click="onSearch">搜索</button>
        </div>
        <select v-model="realmReq" class="sel" @change="onSearch">
          <option value="">全部境界要求</option>
          <option value="none">无要求</option>
          <option v-for="r in meta.realms" :key="r.realm" :value="r.realm">
            {{ r.realm }}及以上
          </option>
        </select>
        <button class="btn-gold create" @click="openCreate">
          开宗立派<span class="cost">耗灵石 {{ meta.createCost }}</span>
        </button>
      </div>

      <!-- 宗门列表 -->
      <main class="list-wrap">
        <div class="row row-head">
          <span></span>
          <span>宗门</span>
          <span>宗主</span>
          <span>境界要求</span>
          <span class="ta-r">人数</span>
          <span class="ta-r">活跃度</span>
          <span class="ta-r">创建于</span>
        </div>
        <button
          v-for="row in state.list"
          :key="row.id"
          class="row row-item"
          :class="{ mine: row.id === state.mySectId }"
          @click="openDetail(row)"
        >
          <UserAvatar class="s-ava" :avatar="row.avatar" :name="row.name" :size="38" />
          <span class="s-main">
            <b class="s-name">
              {{ row.name }}
              <i v-if="row.id === state.mySectId" class="mine-tag">本宗</i>
            </b>
            <small class="s-intro">{{ row.intro || '此宗尚无简介' }}</small>
          </span>
          <span class="s-leader">{{ row.leader_name || '—' }}</span>
          <span class="s-req">{{ row.realm_req ? row.realm_req + '及以上' : '无要求' }}</span>
          <span class="s-num ta-r">{{ row.member_count }}</span>
          <span class="s-num ta-r">{{ row.activity }}</span>
          <span class="s-time ta-r">{{ fmt(row.created_time) }}</span>
        </button>

        <p v-if="!loading && state.list.length === 0" class="empty">
          天下尚无此类宗门——道友何不开宗立派，执掌一方气运？
        </p>
        <p v-else-if="loading && state.list.length === 0" class="empty">正在查阅仙门名录…</p>
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

    <!-- 创建宗门 -->
    <SectCreateModal
      :visible="createVisible"
      :meta="meta"
      @close="createVisible = false"
      @created="onCreated"
    />

    <!-- 宗门详情 -->
    <SectDetailModal
      :visible="detailVisible"
      :sect-id="detailId"
      @close="detailVisible = false"
    />
  </div>
</template>

<style scoped>
.sect-page {
  /* 与游戏首页同一套固定水墨浅色主题 */
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --panel: rgba(251, 250, 245, 0.86);
  --panel-line: rgba(60, 56, 46, 0.16);
  --gold: #b8933f;
  --gold-2: #e6cf93;

  /* 与 HUD 同规：锁定一屏、列表内滚——保证 home ⇄ sect 切换时 body 永无滚动条，
     视口宽高稳定（滚动条出没会让页面切换时宽高跳动）。fixed 背景与过渡 transform
     冲突（transform 使 fixed 失效致背景闪跳），改为随元素定位 */
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
.mine {
  margin-left: auto;
  font-size: 13px;
}
.ling-shi {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}
.ling-shi b { color: var(--gold); }

/* 工具栏 */
.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.search { display: flex; gap: 8px; }
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
.create {
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.cost { font-size: 11px; opacity: 0.8; }
.btn-gold {
  padding: 10px 20px;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 2px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 6px 16px -8px rgba(184, 147, 63, 0.8);
}
.btn-gold:hover { filter: brightness(1.05); }

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
  grid-template-columns: 54px minmax(200px, 2fr) 110px 120px 64px 72px 96px;
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
.row-item.mine { background: rgba(184, 147, 63, 0.05); }
.s-ava {
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #f4e6c2;
  --ava-line: transparent;
}
.s-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.s-name {
  font-size: 15px;
  color: var(--ink-h);
  letter-spacing: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mine-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  font-size: 11px;
  font-style: normal;
  color: #4a3a12;
  background: rgba(184, 147, 63, 0.2);
  border: 1px solid rgba(184, 147, 63, 0.45);
  border-radius: 6px;
  vertical-align: 1px;
}
.s-intro {
  color: var(--ink-mut);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.s-leader,
.s-req { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.s-num { color: var(--gold); font-weight: 700; font-variant-numeric: tabular-nums; }
.s-time { color: var(--ink-mut); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ta-r { text-align: right; }
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

/* 窄屏：恢复整页滚动（取消一屏锁定），隐藏次要列 */
@media (max-width: 860px) {
  .sect-page {
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
  .row { grid-template-columns: 46px minmax(140px, 2fr) 90px 60px; }
  .s-req, .s-time, .row > .s-num:nth-of-type(6), .row-head > span:nth-child(4), .row-head > span:nth-child(6), .row-head > span:nth-child(7) { display: none; }
  .create { margin-left: 0; }
}
</style>
