<script setup>
import { reactive, ref, watch } from 'vue'
import {
  apiSectWarehouse,
  apiSectWhDeposit,
  apiSectWhWithdraw,
  apiSectWhUpgrade,
  apiMyPills,
} from '../api/game.js'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/toast.js'
import { useModalA11y } from '../composables/modalA11y.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  sectId: { type: Number, default: 0 },
  sectName: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const auth = useAuthStore()
const toast = useToast()
const { dialogRef } = useModalA11y(
  () => props.visible,
  () => emit('close')
)

const tab = ref('store') // store=仓库 / deposit=存入
const busy = ref(false)

// 仓库概览 + 物品
const wh = reactive({ level: 1, capacity: 100, used: 0, maxLevel: 10, upgradeCost: null, canManage: false })
const items = reactive({ list: [], total: 0, page: 1, pageSize: 10 })
const whKeyword = ref('')
const whLoading = ref(false)

// 我的丹药（存入页）
const mine = reactive({ list: [], total: 0, page: 1, pageSize: 8 })
const mineKeyword = ref('')
const mineLoading = ref(false)

// 行内数量面板：key = `${pillId}|${grade}`，双页签共用（切页签时清空）
const activeKey = ref('')
const amount = ref(1)

function keyOf(row) {
  return `${row.pill_id}|${row.grade}`
}

function pages(t) {
  return Math.max(1, Math.ceil(t.total / t.pageSize))
}

async function loadWarehouse() {
  whLoading.value = true
  try {
    const r = await apiSectWarehouse(props.sectId, {
      page: items.page,
      pageSize: items.pageSize,
      keyword: whKeyword.value.trim(),
    })
    wh.level = r.level
    wh.capacity = r.capacity
    wh.used = r.used
    wh.maxLevel = r.maxLevel
    wh.upgradeCost = r.upgradeCost
    wh.canManage = r.canManage
    items.list = r.items.list
    items.total = r.items.total
    // 空页回退：末页最后一件被取走后总数下降，停在不存在的页会显示假空态
    if (items.list.length === 0 && items.page > 1) {
      items.page -= 1
      return loadWarehouse()
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    whLoading.value = false
  }
}

async function loadMine() {
  mineLoading.value = true
  try {
    const r = await apiMyPills({
      page: mine.page,
      pageSize: mine.pageSize,
      keyword: mineKeyword.value.trim(),
    })
    mine.list = r.list
    mine.total = r.total
    // 空页回退：同仓库列表，存完末页最后一件后回退到有内容的页
    if (mine.list.length === 0 && mine.page > 1) {
      mine.page -= 1
      return loadMine()
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    mineLoading.value = false
  }
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    tab.value = 'store'
    items.page = 1
    mine.page = 1
    whKeyword.value = ''
    mineKeyword.value = ''
    activeKey.value = ''
    loadWarehouse()
    loadMine()
  }
)

function switchTab(t) {
  tab.value = t
  activeKey.value = ''
}

function toggleAmount(row, max) {
  const k = keyOf(row)
  if (activeKey.value === k) {
    activeKey.value = ''
    return
  }
  activeKey.value = k
  amount.value = Math.min(1, max) || 1
}

// 取出（仓库页，管理权）
async function withdraw(row) {
  const qty = Number(amount.value)
  if (!Number.isInteger(qty) || qty <= 0 || qty > Number(row.quantity)) {
    toast.info('数量不合法')
    return
  }
  busy.value = true
  try {
    await apiSectWhWithdraw(props.sectId, { pillId: row.pill_id, grade: row.grade, quantity: qty })
    toast.success(`已取用「${row.item_name}」×${qty}`)
    activeKey.value = ''
    await Promise.all([loadWarehouse(), loadMine()])
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

// 存入（存入页，全体成员）
async function deposit(row) {
  const qty = Number(amount.value)
  if (!Number.isInteger(qty) || qty <= 0 || qty > Number(row.quantity)) {
    toast.info('数量不合法')
    return
  }
  busy.value = true
  try {
    await apiSectWhDeposit(props.sectId, { pillId: row.pill_id, grade: row.grade, quantity: qty })
    toast.success(`已向宗门仓库捐献「${row.item_name}」×${qty}`)
    activeKey.value = ''
    await Promise.all([loadWarehouse(), loadMine()])
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

// 修缮扩容（管理权，扣个人灵石）
async function upgrade() {
  if (wh.upgradeCost === null) return
  if (
    !window.confirm(
      `确定耗费 ${wh.upgradeCost} 灵石，将仓库修缮至 ${wh.level + 1} 级？（现有灵石 ${auth.user?.ling_shi ?? 0}）`
    )
  )
    return
  busy.value = true
  try {
    const r = await apiSectWhUpgrade(props.sectId)
    if (r.user) auth.setUser(r.user)
    toast.success(`仓库已修缮至 ${r.level} 级，容量 ${r.capacity} 格`)
    await loadWarehouse()
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

function go(t, delta, reload) {
  const next = t.page + delta
  if (next < 1 || next > pages(t)) return
  t.page = next
  reload()
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div
      ref="dialogRef"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sect-wh-title"
      tabindex="-1"
    >
      <button class="x" @click="emit('close')" title="关闭" aria-label="关闭">×</button>
      <h3 id="sect-wh-title" class="title">{{ sectName || '宗门' }} · 仓库</h3>
      <p class="sub">
        {{ wh.level }} 级 ｜ 已用 {{ wh.used }} / {{ wh.capacity }} 格
        <button
          v-if="wh.canManage && wh.upgradeCost !== null"
          class="op gold up"
          :disabled="busy"
          @click="upgrade"
        >修缮扩容（灵石 {{ wh.upgradeCost }}）</button>
        <i v-else-if="wh.upgradeCost === null" class="max-tag">已满级</i>
      </p>

      <!-- 页签 -->
      <div class="tabs">
        <button class="tab" :class="{ act: tab === 'store' }" @click="switchTab('store')">仓库</button>
        <button class="tab" :class="{ act: tab === 'deposit' }" @click="switchTab('deposit')">存入</button>
      </div>

      <!-- 仓库页 -->
      <template v-if="tab === 'store'">
        <div class="toolbar">
          <input
            v-model="whKeyword"
            type="text"
            placeholder="搜索仓库丹药"
            @keyup.enter="items.page = 1; loadWarehouse()"
          />
          <button class="op" @click="items.page = 1; loadWarehouse()">搜索</button>
        </div>
        <div class="list">
          <p v-if="whLoading && items.list.length === 0" class="state">正在清点仓库…</p>
          <p v-else-if="items.list.length === 0" class="state">仓库空空如也，门人可自「存入」页捐献</p>
          <div v-for="row in items.list" :key="keyOf(row)" class="row">
            <div class="line">
              <span class="g-tag" :class="`g-${row.grade}`">{{ row.grade_name }}</span>
              <span class="main">
                <b class="i-name">{{ row.item_name }}</b>
                <small class="i-sub">{{ row.realm }} · {{ row.category_name }}</small>
              </span>
              <span class="qty">×{{ row.quantity }}</span>
              <button
                v-if="wh.canManage"
                class="op"
                :class="{ act: activeKey === keyOf(row) }"
                @click="toggleAmount(row, Number(row.quantity))"
              >取出</button>
            </div>
            <div v-if="activeKey === keyOf(row)" class="panel">
              <input v-model.number="amount" type="number" min="1" :max="row.quantity" :disabled="busy" />
              <span class="hint">/ {{ row.quantity }}</span>
              <button class="op gold" :disabled="busy" @click="withdraw(row)">确认取出</button>
            </div>
          </div>
        </div>
        <footer class="pager" v-if="items.total > items.pageSize">
          <button class="op" :disabled="items.page <= 1" @click="go(items, -1, loadWarehouse)">上一页</button>
          <span class="pageno">{{ items.page }} / {{ pages(items) }}</span>
          <button class="op" :disabled="items.page >= pages(items)" @click="go(items, 1, loadWarehouse)">下一页</button>
        </footer>
      </template>

      <!-- 存入页（我的丹药） -->
      <template v-else>
        <div class="toolbar">
          <input
            v-model="mineKeyword"
            type="text"
            placeholder="搜索我的丹药"
            @keyup.enter="mine.page = 1; loadMine()"
          />
          <button class="op" @click="mine.page = 1; loadMine()">搜索</button>
        </div>
        <div class="list">
          <p v-if="mineLoading && mine.list.length === 0" class="state">正在翻检纳戒…</p>
          <p v-else-if="mine.list.length === 0" class="state">道友纳戒中暂无丹药</p>
          <div v-for="row in mine.list" :key="keyOf(row)" class="row">
            <div class="line">
              <span class="g-tag" :class="`g-${row.grade}`">{{ row.grade_name }}</span>
              <span class="main">
                <b class="i-name">{{ row.item_name }}</b>
                <small class="i-sub">{{ row.realm }} · {{ row.category_name }}</small>
              </span>
              <span class="qty">×{{ row.quantity }}</span>
              <button
                class="op"
                :class="{ act: activeKey === keyOf(row) }"
                @click="toggleAmount(row, Number(row.quantity))"
              >存入</button>
            </div>
            <div v-if="activeKey === keyOf(row)" class="panel">
              <input v-model.number="amount" type="number" min="1" :max="row.quantity" :disabled="busy" />
              <span class="hint">/ {{ row.quantity }}</span>
              <button class="op gold" :disabled="busy" @click="deposit(row)">确认存入</button>
            </div>
          </div>
        </div>
        <footer class="pager" v-if="mine.total > mine.pageSize">
          <button class="op" :disabled="mine.page <= 1" @click="go(mine, -1, loadMine)">上一页</button>
          <span class="pageno">{{ mine.page }} / {{ pages(mine) }}</span>
          <button class="op" :disabled="mine.page >= pages(mine)" @click="go(mine, 1, loadMine)">下一页</button>
        </footer>
      </template>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  background: rgba(30, 28, 22, 0.42);
  backdrop-filter: blur(2px);
}
.dialog {
  --gold: #b8933f;
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);

  position: relative;
  width: min(600px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  padding: 24px 22px 18px;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background: linear-gradient(160deg, #fbfaf5 0%, #f1f0e9 100%);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: 0 24px 60px -20px rgba(40, 38, 30, 0.6);
  animation: pop 0.2s ease-out;
}
.dialog:focus { outline: none; }
@keyframes pop {
  from { transform: scale(0.94); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.x {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 22px;
  line-height: 1;
  color: var(--ink-mut);
  background: none;
  border: none;
  cursor: pointer;
}
.x:hover { color: var(--gold); }
.title {
  margin: 0 0 2px;
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink-h);
}
.sub {
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--ink-mut);
}
.up { font-size: 12px; }
.max-tag { font-style: normal; color: var(--gold); }

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.tab {
  flex: 1 1 0;
  padding: 8px 0;
  font-family: inherit;
  font-size: 13.5px;
  letter-spacing: 3px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
  border-radius: 9px;
  cursor: pointer;
}
.tab.act {
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border-color: rgba(184, 147, 63, 0.6);
}

.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.toolbar input {
  flex: 1 1 auto;
  padding: 8px 11px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid var(--line);
  border-radius: 8px;
  outline: none;
}
.toolbar input:focus { border-color: var(--gold); }

.list {
  flex: 1 1 auto;
  min-height: 200px;
  overflow-y: auto;
  scrollbar-width: none;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}
.list::-webkit-scrollbar { width: 0; }
.state {
  margin: 0;
  padding: 48px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-mut);
}
.row { border-bottom: 1px dashed var(--line); }
.row:last-child { border-bottom: none; }
.line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
}
.g-tag {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  font-size: 11.5px;
  border-radius: 6px;
}
.g-fan { color: #5c5f57; background: rgba(120, 122, 116, 0.14); border: 1px solid rgba(120, 122, 116, 0.35); }
.g-ling { color: #3f6d8a; background: rgba(85, 140, 173, 0.13); border: 1px solid rgba(85, 140, 173, 0.4); }
.g-dao { color: #7a5a16; background: rgba(184, 147, 63, 0.16); border: 1px solid rgba(184, 147, 63, 0.5); }
.main {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.i-name {
  font-size: 13.5px;
  color: var(--ink-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.i-sub { font-size: 11px; color: var(--ink-mut); }
.qty {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--gold);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.op {
  padding: 4px 10px;
  font-family: inherit;
  font-size: 12px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--line);
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;
}
.op:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.op.act { color: var(--gold); border-color: var(--gold); }
.op.gold {
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border-color: rgba(184, 147, 63, 0.6);
}
.op.gold:hover:not(:disabled) { filter: brightness(1.05); color: #4a3a12; }
.op:disabled { opacity: 0.5; cursor: default; }

.panel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 10px 46px;
}
.panel input {
  width: 90px;
  padding: 6px 10px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--line);
  border-radius: 7px;
  outline: none;
}
.panel input:focus { border-color: var(--gold); }
.hint { font-size: 12px; color: var(--ink-mut); }

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 10px;
}
.pageno { font-size: 12.5px; color: var(--ink-h); font-variant-numeric: tabular-nums; }
</style>
