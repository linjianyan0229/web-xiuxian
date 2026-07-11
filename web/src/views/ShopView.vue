<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/toast.js'
import shopImg from '../../image/shangdian.webp'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

// 商店本体（商品/货币结算）未实装，店铺分区为占位——实装时替换点击行为
const SHOPS = [
  { key: 'pill', ico: '丹', name: '丹阁', desc: '疗伤续命、辅修破境之丹药' },
  { key: 'artifact', ico: '器', name: '器阁', desc: '攻伐守御、温养随身之法宝' },
  { key: 'technique', ico: '书', name: '书斋', desc: '各阶功法心法之抄本残卷' },
  { key: 'misc', ico: '杂', name: '杂货铺', desc: '灵材符纸等修行杂项' },
]
function openShop(shop) {
  toast.info(`${shop.name}尚在筹建，掌柜正在进货，敬请期待`)
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchProfile()
    } catch {
      /* 401 由 http 拦截器接管跳登录 */
    }
  }
})
</script>

<template>
  <div class="shop-page" :style="{ backgroundImage: `url(${shopImg})` }">
    <div class="veil">
      <!-- 顶栏 -->
      <header class="topbar">
        <button class="back" @click="router.push({ name: 'home' })">‹ 返回洞府</button>
        <h1 class="title">坊市</h1>
        <span class="stone">灵石 {{ auth.user?.ling_shi ?? 0 }}</span>
        <span class="who">{{ auth.user?.dao_name }} · {{ auth.user?.realm_name || '凡人' }}</span>
      </header>

      <!-- 店铺分区（占位，待商店系统实装） -->
      <main class="stalls">
        <button v-for="s in SHOPS" :key="s.key" class="stall" @click="openShop(s)">
          <span class="st-ico">{{ s.ico }}</span>
          <span class="st-name">{{ s.name }}</span>
          <span class="st-desc">{{ s.desc }}</span>
          <span class="st-state">待启</span>
        </button>
      </main>

      <p class="notice">坊市尚在筹建——各铺货品待掌柜进货后开张，灵石且先攒着。</p>
    </div>
  </div>
</template>

<style scoped>
.shop-page {
  /* 与游戏首页同一套固定水墨浅色主题 */
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --panel: rgba(251, 250, 245, 0.86);
  --panel-line: rgba(60, 56, 46, 0.16);
  --gold: #b8933f;
  --gold-2: #e6cf93;

  /* 与 HUD 同规：锁一屏；背景勿用 fixed（过渡 transform 冲突） */
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
  background: linear-gradient(180deg, rgba(238, 240, 235, 0.9) 0%, rgba(238, 240, 235, 0.62) 30%, rgba(238, 240, 235, 0.5) 100%);
}

/* 顶栏 */
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
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
.stone {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  color: #4a3a12;
  background: linear-gradient(180deg, rgba(242, 221, 166, 0.75), rgba(212, 175, 91, 0.55));
  border: 1px solid rgba(184, 147, 63, 0.5);
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}
.who {
  margin-left: auto;
  padding: 6px 14px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}

/* 店铺分区 */
.stalls {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-content: center;
}
.stall {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 16px 22px;
  font-family: inherit;
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.stall:hover {
  border-color: var(--gold);
  transform: translateY(-2px);
  box-shadow: 0 14px 30px -16px rgba(40, 38, 30, 0.5);
}
.st-ico {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  font-size: 24px;
  font-weight: 700;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 50%;
}
.st-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink-h);
}
.st-desc {
  font-size: 12px;
  color: var(--ink-mut);
  text-align: center;
  line-height: 1.6;
}
.st-state {
  margin-top: 6px;
  padding: 2px 12px;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--ink-mut);
  background: rgba(60, 56, 46, 0.06);
  border: 1px dashed rgba(60, 56, 46, 0.25);
  border-radius: 999px;
}
.notice {
  margin: 16px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--ink-mut);
  letter-spacing: 1px;
}

/* 窄屏：双列、放开整页滚动 */
@media (max-width: 860px) {
  .shop-page {
    height: auto;
    min-height: 100svh;
    overflow: visible;
  }
  .veil {
    height: auto;
    min-height: 100svh;
    padding: 14px 14px 20px;
  }
  .topbar { flex-wrap: wrap; row-gap: 8px; }
  .stalls { grid-template-columns: repeat(2, 1fr); align-content: start; }
}

/* 手机屏：玩家信息独占一行 */
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
