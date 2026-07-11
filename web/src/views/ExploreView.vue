<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/toast.js'
import tansuoImg from '../../image/tansuo.webp'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

// 备程页骨架（探索机制设计稿 §7.5）：先投入后揭晓——只选时长与加持，难度/区域出发后才揭晓。
// 后端探索接口（GET/POST /api/user/explore）未实装，「出发」为占位——实装时替换 setOut()。
const DURATIONS = [
  { minutes: 30, label: '一炷香' },
  { minutes: 60, label: '半个时辰' },
  { minutes: 120, label: '一个时辰' },
  { minutes: 240, label: '两个时辰' },
]
const minutes = ref(60)
const spend = ref(0)

function setOut() {
  toast.info('探索之途尚在开辟，各方秘境待勘，敬请期待')
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
  <div class="explore-page" :style="{ backgroundImage: `url(${tansuoImg})` }">
    <div class="veil">
      <!-- 顶栏 -->
      <header class="topbar">
        <button class="back" @click="router.push({ name: 'home' })">‹ 返回洞府</button>
        <h1 class="title">探索</h1>
        <span class="stone">灵石 {{ auth.user?.ling_shi ?? 0 }}</span>
        <span class="who">{{ auth.user?.dao_name }} · {{ auth.user?.realm_name || '凡人' }}</span>
      </header>

      <div class="cols">
        <!-- 左：备程（择时长 + 可选加持） -->
        <section class="panel plan">
          <h2 class="p-title">整装备程</h2>
          <p class="p-sub">选定历练时辰，亦可投入灵石加持此行——境况凶吉，出发方知。</p>

          <div class="d-grid" role="radiogroup" aria-label="历练时长">
            <label
              v-for="d in DURATIONS"
              :key="d.minutes"
              class="d-opt"
              :class="{ on: minutes === d.minutes }"
            >
              <input
                v-model="minutes"
                class="d-radio"
                type="radio"
                name="explore-duration"
                :value="d.minutes"
              />
              <span class="d-label">{{ d.label }}</span>
              <span class="d-min">{{ d.minutes }} 分钟</span>
            </label>
          </div>

          <label class="spend">
            <span class="sp-label">加持灵石（可选）</span>
            <input
              v-model.number="spend"
              type="number"
              min="0"
              step="100"
              placeholder="0"
            />
            <span class="sp-hint">投入越多收益越厚，此行无论吉凶概不退还</span>
          </label>

          <button class="go" @click="setOut">出发</button>
          <p class="go-hint">出发后不可中断，期满自动归来结算</p>
        </section>

        <!-- 右：行前须知 -->
        <section class="panel brief">
          <h2 class="p-title">行前须知</h2>
          <ul class="rules">
            <li><b>境况随缘</b>——此行是通幽之境还是凶险之地，出发后方才揭晓；愈险之地，机缘愈厚。</li>
            <li><b>所获</b>——以灵石与丹药为主，偶得稀有炼丹灵材；亦有小概率奇遇，机缘翻倍。</li>
            <li><b>凶险</b>——寻常之地至多所获平平；险地或有折损，绝险之地更有陨落之危，行前三思。</li>
            <li><b>心无旁骛</b>——历练期间不可修炼、打坐、突破，须待期满归来。</li>
          </ul>
          <p class="soon-tag">秘境尚在开辟，此界面先行备下</p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.explore-page {
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
  background: linear-gradient(180deg, rgba(238, 240, 235, 0.9) 0%, rgba(238, 240, 235, 0.6) 30%, rgba(238, 240, 235, 0.48) 100%);
}

/* 顶栏（与商店/装备页同款） */
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

/* 双栏 */
.cols {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 18px;
  align-items: center;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
  padding: 22px 24px;
}
.plan { flex: 0 0 440px; }
.brief { flex: 1 1 auto; min-width: 0; align-self: center; }
.p-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink-h);
  padding-left: 9px;
  border-left: 3px solid var(--gold);
}
.p-sub {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--ink-mut);
  line-height: 1.7;
}

/* 时长档 */
.d-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.d-opt {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 13px 0 11px;
  font-family: inherit;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
  border-radius: 11px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.d-opt:hover { border-color: var(--gold); }
/* 原生 radio 视觉隐藏（不可 display:none，保住键盘可达性与方向键切换） */
.d-radio {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip-path: inset(50%);
  overflow: hidden;
  white-space: nowrap;
}
.d-opt:focus-within {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.3);
}
.d-opt.on {
  border-color: var(--gold);
  background: linear-gradient(180deg, rgba(242, 221, 166, 0.4), rgba(212, 175, 91, 0.22));
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.14);
}
.d-label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
}
.d-min {
  font-size: 11px;
  color: var(--ink-mut);
  font-variant-numeric: tabular-nums;
}

/* 加持灵石 */
.spend {
  display: block;
  margin-bottom: 18px;
}
.sp-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--ink-h);
}
.spend input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  outline: none;
}
.spend input:focus { border-color: var(--gold); }
.sp-hint {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: var(--ink-mut);
}

/* 出发 */
.go {
  width: 100%;
  padding: 12px 0;
  font-family: inherit;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 8px;
  color: #3d2f0d;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.7);
  border-radius: 11px;
  cursor: pointer;
  transition: filter 0.15s, transform 0.15s;
}
.go:hover { filter: brightness(1.05); transform: translateY(-1px); }
.go-hint {
  margin: 8px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--ink-mut);
}

/* 须知 */
.rules {
  margin: 14px 0 0;
  padding: 0 0 0 2px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rules li {
  position: relative;
  padding-left: 16px;
  font-size: 13px;
  line-height: 1.8;
}
.rules li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gold);
}
.rules b { color: var(--ink-h); }
.soon-tag {
  margin: 18px 0 0;
  display: inline-block;
  padding: 3px 14px;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--ink-mut);
  background: rgba(60, 56, 46, 0.06);
  border: 1px dashed rgba(60, 56, 46, 0.25);
  border-radius: 999px;
}

/* 窄屏：上下堆叠、放开整页滚动 */
@media (max-width: 860px) {
  .explore-page {
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
  .cols { flex-direction: column; align-items: stretch; }
  .plan { flex: none; }
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
