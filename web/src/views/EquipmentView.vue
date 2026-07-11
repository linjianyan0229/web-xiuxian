<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { apiMyPills } from '../api/game.js'
import PillDetailModal from '../components/PillDetailModal.vue'
import { useToast } from '../composables/toast.js'
import dongfuImg from '../../image/dongfu.webp'
import boyImg from '../../image/boy.webp'
import girlImg from '../../image/girl.webp'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

// 人物立绘随性别（同首页角色卡）
const charImg = computed(() => (Number(auth.user?.gender) === 2 ? girlImg : boyImg))

// 装备槽位（功法/法宝穿戴系统未实装，槽位为占位——数据接入后由 user_techniques/user_artifacts 填充）
// 布局按设计稿：人物图 左=装备槽、中=心法槽、右=武器/法宝槽；图下方=三个功法槽（1主2辅）
const SOON_TECH = '功法穿戴尚在炼制，敬请期待'
const SOON_ARTIFACT = '法宝穿戴尚在炼制，敬请期待'
function slotSoon(kind) {
  toast.info(kind === 'tech' ? SOON_TECH : SOON_ARTIFACT)
}

// 纳戒储物：真实丹药背包数据（当前唯一实装的持有物），列表展示
const state = reactive({ list: [], total: 0 })
const loading = ref(false)

async function loadStorage() {
  loading.value = true
  try {
    // 请求 100 件（与后端 listUserPills 单页上限一致，勿单方调大）；超出以实际取到的件数提示
    const res = await apiMyPills({ page: 1, pageSize: 100 })
    state.list = res.list
    state.total = res.total
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

// 物品详情（复用丹药详情弹窗：服用占位/赠送/丢弃）
const detailVisible = ref(false)
const selected = ref(null)
function openItem(row) {
  selected.value = row
  detailVisible.value = true
}
async function onItemChanged(remaining) {
  if (selected.value) selected.value = { ...selected.value, quantity: remaining }
  if (remaining <= 0) detailVisible.value = false
  loadStorage()
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchProfile()
    } catch {
      return
    }
  }
  loadStorage()
})
</script>

<template>
  <div class="equip-page" :style="{ backgroundImage: `url(${dongfuImg})` }">
    <div class="veil">
      <!-- 顶栏 -->
      <header class="topbar">
        <button class="back" @click="router.push({ name: 'home' })">‹ 返回洞府</button>
        <h1 class="title">随身装备</h1>
        <span class="who">{{ auth.user?.dao_name }} · {{ auth.user?.realm_name || '凡人' }}</span>
      </header>

      <div class="cols">
        <!-- 左：人物与装备槽 -->
        <section class="char-panel">
          <div class="portrait" :style="{ backgroundImage: `url(${charImg})` }">
            <!-- 人物左：装备槽（防具） -->
            <div class="side-slots left">
              <button class="slot" @click="slotSoon('artifact')">
                <span class="s-ico">甲</span>
                <span class="s-name">装备</span>
                <span class="s-state">空</span>
              </button>
            </div>
            <!-- 人物中：心法槽 -->
            <div class="center-slot">
              <button class="slot heart" @click="slotSoon('tech')">
                <span class="s-ico">心</span>
                <span class="s-name">心法</span>
                <span class="s-state">空</span>
              </button>
            </div>
            <!-- 人物右：武器 / 法宝槽 -->
            <div class="side-slots right">
              <button class="slot" @click="slotSoon('artifact')">
                <span class="s-ico">剑</span>
                <span class="s-name">武器</span>
                <span class="s-state">空</span>
              </button>
              <button class="slot" @click="slotSoon('artifact')">
                <span class="s-ico">宝</span>
                <span class="s-name">法宝</span>
                <span class="s-state">空</span>
              </button>
            </div>
          </div>

          <!-- 图下：三个功法槽（1 主 + 2 辅） -->
          <div class="tech-slots">
            <button class="slot wide" @click="slotSoon('tech')">
              <span class="s-ico gold">主</span>
              <span class="s-name">主功法</span>
              <span class="s-state">空</span>
            </button>
            <button class="slot wide" @click="slotSoon('tech')">
              <span class="s-ico">辅</span>
              <span class="s-name">辅功法</span>
              <span class="s-state">空</span>
            </button>
            <button class="slot wide" @click="slotSoon('tech')">
              <span class="s-ico">辅</span>
              <span class="s-name">辅功法</span>
              <span class="s-state">空</span>
            </button>
          </div>
        </section>

        <!-- 右：纳戒储物 -->
        <section class="storage">
          <header class="st-head">
            <h2 class="st-title">纳戒储物</h2>
            <span class="st-count">{{ state.total }} 件</span>
            <span v-if="state.total > state.list.length" class="st-more">
              仅展示前 {{ state.list.length }} 件，完整清单见「丹药」页
            </span>
          </header>
          <div class="list-wrap">
            <div class="row row-head">
              <span></span>
              <span>物品</span>
              <span class="col-realm">品阶</span>
              <span class="col-cat">类型</span>
              <span class="ta-r">数量</span>
            </div>
            <button
              v-for="row in state.list"
              :key="row.pill_id + '-' + row.grade"
              class="row row-item"
              @click="openItem(row)"
            >
              <span class="g-tag" :class="'g-' + row.grade">{{ row.grade_name }}</span>
              <span class="i-name">{{ row.item_name }}</span>
              <span class="i-realm col-realm">{{ row.realm }}</span>
              <span class="i-cat col-cat">{{ row.category_name }}</span>
              <span class="i-qty ta-r">×{{ row.quantity }}</span>
            </button>
            <p v-if="!loading && state.total === 0" class="st-empty">
              纳戒空空如也——丹药可待日后炼丹、机缘或道友相赠而得。
            </p>
          </div>
        </section>
      </div>
    </div>

    <!-- 物品详情（复用丹药详情：服用占位/赠送/丢弃） -->
    <PillDetailModal
      :visible="detailVisible"
      :item="selected"
      @close="detailVisible = false"
      @changed="onItemChanged"
    />
  </div>
</template>

<style scoped>
.equip-page {
  /* 与游戏首页同一套固定水墨浅色主题 */
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --panel: rgba(251, 250, 245, 0.86);
  --panel-line: rgba(60, 56, 46, 0.16);
  --gold: #b8933f;
  --gold-2: #e6cf93;

  /* 与 HUD 同规：锁一屏、区域内滚；背景勿用 fixed（过渡 transform 冲突） */
  height: 100svh;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background-color: #e2e5df;
  background-size: cover;
  background-position: center;
}
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
.who {
  margin-left: auto;
  padding: 6px 14px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}

/* 双栏 */
.cols {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 18px;
}

/* 左：人物与槽位 */
.char-panel {
  flex: 0 0 400px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.portrait {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border-radius: 14px;
  border: 1px solid var(--panel-line);
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
  background-color: #dfe3dc;
  background-size: cover;
  background-position: top center;
  overflow: hidden;
}
/* 立绘上压一层轻纱保证槽位可读 */
.portrait::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(238, 240, 235, 0.18), rgba(238, 240, 235, 0.05) 45%, rgba(238, 240, 235, 0.28));
  pointer-events: none;
}
.side-slots {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.side-slots.left { left: 12px; }
.side-slots.right { right: 12px; }
.center-slot {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

/* 槽位 */
.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 72px;
  padding: 9px 0 7px;
  font-family: inherit;
  color: var(--ink);
  background: rgba(251, 250, 245, 0.82);
  border: 1.5px dashed rgba(184, 147, 63, 0.55);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}
.slot:hover {
  border-color: var(--gold);
  background: rgba(251, 250, 245, 0.95);
  transform: translateY(-1px);
}
.slot.heart {
  background: rgba(251, 250, 245, 0.72);
}
.s-ico {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  font-size: 15px;
  color: var(--ink-mut);
  background: rgba(60, 56, 46, 0.06);
  border: 1px solid var(--panel-line);
  border-radius: 50%;
}
.s-ico.gold {
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border-color: rgba(184, 147, 63, 0.6);
}
.s-name {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-h);
}
.s-state {
  font-size: 11px;
  color: var(--ink-mut);
}

/* 功法槽（图下横排三格） */
.tech-slots {
  flex: none;
  display: flex;
  gap: 10px;
}
.slot.wide {
  flex: 1 1 0;
  flex-direction: row;
  justify-content: flex-start;
  gap: 8px;
  padding: 9px 12px;
}
.slot.wide .s-state { margin-left: auto; }

/* 右：纳戒储物 */
.storage {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
}
.st-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--panel-line);
}
.st-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink-h);
  padding-left: 9px;
  border-left: 3px solid var(--gold);
}
.st-count {
  font-size: 12px;
  color: var(--gold);
  font-weight: 700;
}
.st-more {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-mut);
}
.list-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 6px 18px 14px;
}
.list-wrap::-webkit-scrollbar { width: 0; }
.row {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 110px 90px 64px;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(60, 56, 46, 0.09);
}
.row-head {
  padding-top: 12px;
  padding-bottom: 8px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-mut);
  border-bottom: 1px solid var(--panel-line);
}
.row-item {
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  color: var(--ink);
  background: transparent;
  border-left: none;
  border-right: none;
  border-top: none;
  cursor: pointer;
  transition: background 0.15s;
}
.row-item:hover { background: rgba(184, 147, 63, 0.08); }
.g-tag {
  justify-self: start;
  padding: 1px 8px;
  font-size: 11px;
  border-radius: 6px;
  white-space: nowrap;
}
.g-fan { color: var(--ink-mut); background: rgba(60, 56, 46, 0.07); border: 1px solid var(--panel-line); }
.g-ling { color: #4a3a12; background: rgba(184, 147, 63, 0.18); border: 1px solid rgba(184, 147, 63, 0.4); }
.g-dao { color: #fff; background: linear-gradient(160deg, #c96a4a, #a8452f); border: 1px solid rgba(168, 69, 47, 0.5); }
.i-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  color: var(--ink-h);
}
.i-realm,
.i-cat {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--ink-mut);
}
.i-qty {
  font-weight: 700;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.ta-r { text-align: right; }
.st-empty {
  margin: 0;
  padding: 42px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-mut);
}

/* 窄屏：上下堆叠、放开整页滚动、储物格降列数 */
@media (max-width: 860px) {
  .equip-page {
    height: auto;
    min-height: 100svh;
    overflow: visible;
  }
  .veil {
    height: auto;
    min-height: 100svh;
    padding: 14px 14px 20px;
  }
  .topbar { flex-wrap: wrap; row-gap: 8px; } /* 放不下时整块换行，不再挤断内部文字 */
  .cols { flex-direction: column; }
  .char-panel { flex: none; }
  .portrait { min-height: 420px; }
  .list-wrap { overflow-y: visible; }
  /* 窄屏收起品阶/类型列，保留 品质/名称/数量 */
  .row { grid-template-columns: 46px minmax(0, 1fr) 64px; }
  .col-realm,
  .col-cat { display: none; }
}

/* 手机屏：首行=返回+标题（缩字距保证 320px 一行放下），玩家信息独占第二行 */
@media (max-width: 560px) {
  .title { font-size: 20px; letter-spacing: 4px; }
  .who {
    order: 3;
    flex: 1 1 100%;
    margin-left: 0;
    text-align: center;
  }
}
</style>
