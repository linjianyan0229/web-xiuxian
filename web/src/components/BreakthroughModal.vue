<script setup>
import { computed, ref, watch } from 'vue'
import { apiBreakthroughStatus, apiBreakthrough } from '../api/game.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'done'])

const st = ref(null) // 突破状态
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const result = ref(null) // 突破结果 { success, died, ... }

// 数值格式化：大数转 万/亿
function trimNum(x) {
  return x.toFixed(2).replace(/\.?0+$/, '')
}
function fmtCn(n) {
  const v = Number(n) || 0
  if (v >= 1e8) return trimNum(v / 1e8) + '亿'
  if (v >= 1e4) return trimNum(v / 1e4) + '万'
  return String(v)
}

async function load() {
  loading.value = true
  error.value = ''
  result.value = null
  st.value = null
  try {
    st.value = await apiBreakthroughStatus()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) load()
  }
)

const canGo = computed(() => !!st.value?.canBreakthrough && !busy.value && result.value === null)

async function onBreakthrough() {
  if (!canGo.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await apiBreakthrough()
    result.value = res
    // 无论晋级还是身陨，玩家数据都已变化，通知外层刷新
    emit('done', res)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="onClose">
    <div class="dialog">
      <button class="x" @click="onClose" title="关闭">×</button>
      <div class="seal" :class="{ dead: result?.died }">{{ result?.died ? '陨' : '破' }}</div>
      <h3 class="title">境界突破</h3>

      <!-- 加载中 -->
      <template v-if="loading">
        <p class="desc">推演天机中…</p>
      </template>

      <!-- 突破成功 -->
      <template v-else-if="result && result.success">
        <p class="desc">
          {{ result.tribulationType ? `${result.tribulationType}雷光散尽，天地为贺——` : '水到渠成，一朝顿悟——' }}
        </p>
        <div class="big gold-t">晋入【{{ result.newRealm }}】</div>
        <p class="sub">境界属性已随之精进，前路漫漫，道友继续修行。</p>
        <button class="btn gold" @click="onClose">继续前行</button>
      </template>

      <!-- 身陨道消 -->
      <template v-else-if="result && result.died">
        <p class="desc">{{ result.tribulationType }}轰然落下，道友未能扛过——</p>
        <div class="big dead-t">身陨道消</div>
        <p class="sub">
          第 {{ result.deathCount }} 次陨落，{{ result.lossLabel }}折损半数。<br />
          境界未失，重整道心，来日再战。
        </p>
        <button class="btn ghost" @click="onClose">重整道心</button>
      </template>

      <!-- 已至巅峰 -->
      <template v-else-if="st && st.atPeak">
        <p class="desc">道友已是【<b class="gold-t">{{ st.realmName }}</b>】。</p>
        <div class="big gold-t">大道尽头</div>
        <p class="sub">此界之上再无境界，愿道友逍遥天地间。</p>
        <button class="btn ghost" @click="onClose">关闭</button>
      </template>

      <!-- 待突破：展示条件与雷劫 -->
      <template v-else-if="st">
        <p class="desc">
          【<b class="gold-t">{{ st.realmName }}</b>】 →
          【<b class="gold-t">{{ st.nextRealm }}</b>】
        </p>

        <div class="req" :class="st.met ? 'ok' : 'lack'">
          所需{{ st.reqLabel }}：{{ fmtCn(st.current) }} / {{ fmtCn(st.required) }}
          <b>{{ st.met ? '✓ 已圆满' : '未足' }}</b>
        </div>

        <div v-if="st.hasTribulation" class="trib">
          <div class="trib-name">⚡ 需渡「{{ st.tribulationType }}」</div>
          <div class="trib-rate">
            成功率 <b>{{ st.successRatePercent }}%</b> · 陨落率 <b class="dead-t">{{ st.deathRatePercent }}%</b>
          </div>
          <div class="trib-note">若渡劫失败：身陨道消（死亡 +1），{{ st.reqLabel }}折损半数，境界不失</div>
        </div>
        <p v-else class="sub">此境无雷劫，条件圆满即可稳妥晋升。</p>

        <p v-if="error" class="err">{{ error }}</p>
        <button
          class="btn"
          :class="st.hasTribulation ? 'crimson' : 'gold'"
          :disabled="!canGo"
          @click="onBreakthrough"
        >
          {{ busy ? '渡劫中…' : st.met ? (st.hasTribulation ? '踏 劫 而 行' : '突 破') : `${st.reqLabel}未至圆满` }}
        </button>
      </template>

      <!-- 状态拉取失败 -->
      <template v-else>
        <p class="desc">{{ error || '天机晦暗，稍后再试。' }}</p>
        <button class="btn ghost" @click="onClose">关闭</button>
      </template>
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
  --crimson: #a8452f;
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);

  position: relative;
  width: min(400px, 90vw);
  padding: 30px 30px 26px;
  text-align: center;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background:
    radial-gradient(600px 200px at 50% -20%, rgba(255, 255, 255, 0.8), transparent 70%),
    linear-gradient(160deg, #fbfaf5 0%, #f1f0e9 100%);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: 0 24px 60px -20px rgba(40, 38, 30, 0.6);
  animation: pop 0.2s ease-out;
}
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
.seal {
  width: 54px;
  height: 54px;
  margin: 0 auto 10px;
  display: grid;
  place-items: center;
  font-size: 26px;
  color: #fff;
  background: linear-gradient(160deg, #d4794b, #a8452f);
  border-radius: 14px;
  box-shadow: 0 8px 18px -8px rgba(168, 69, 47, 0.8);
}
.seal.dead {
  background: linear-gradient(160deg, #6b6f76, #3d4046);
  box-shadow: 0 8px 18px -8px rgba(40, 42, 46, 0.8);
}
.title {
  margin: 0 0 14px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink-h);
}
.desc {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--ink);
}
.gold-t { color: var(--gold); }
.dead-t { color: var(--crimson); }
.big {
  margin: 6px 0 10px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 2px;
  text-shadow: 0 2px 12px rgba(184, 147, 63, 0.28);
}
.sub {
  margin: 0 0 18px;
  font-size: 12px;
  color: var(--ink-mut);
  line-height: 1.7;
}
.req {
  margin: 0 0 12px;
  padding: 10px 14px;
  font-size: 14px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.5);
}
.req b { margin-left: 8px; }
.req.ok b { color: #3f7a56; }
.req.lack b { color: var(--crimson); }
.trib {
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(168, 69, 47, 0.35);
  background: rgba(168, 69, 47, 0.06);
}
.trib-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--crimson);
  margin-bottom: 4px;
}
.trib-rate {
  font-size: 14px;
  color: var(--ink-h);
  margin-bottom: 6px;
}
.trib-note {
  font-size: 12px;
  color: var(--ink-mut);
  line-height: 1.6;
}
.err {
  margin: 0 0 12px;
  font-size: 13px;
  color: #b4453b;
}
.btn {
  width: 100%;
  padding: 12px;
  font-family: inherit;
  font-size: 16px;
  letter-spacing: 3px;
  border-radius: 10px;
  cursor: pointer;
}
.btn.gold {
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  box-shadow: 0 6px 16px -8px rgba(184, 147, 63, 0.8);
}
.btn.crimson {
  color: #fff;
  background: linear-gradient(180deg, #c96a4a, #a8452f);
  border: 1px solid rgba(168, 69, 47, 0.6);
  box-shadow: 0 6px 16px -8px rgba(168, 69, 47, 0.8);
}
.btn.gold:hover:not(:disabled),
.btn.crimson:hover:not(:disabled) { filter: brightness(1.05); }
.btn:disabled { opacity: 0.55; cursor: default; box-shadow: none; }
.btn.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}
.btn.ghost:hover { color: var(--gold); border-color: var(--gold); }
</style>
