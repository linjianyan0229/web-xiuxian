<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { apiMeditationStatus, apiMeditationStart } from '../api/game.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
})
// started: 入定成功，回抛最新状态供首页倒计时；settled: 出定结算，回抛含 settled 的状态
const emit = defineEmits(['close', 'started', 'settled'])

const st = ref(null) // 打坐状态（apiMeditationStatus 返回）
const loading = ref(false)
const busy = ref(false) // 入定请求中
const error = ref('')
const step = ref('select') // select（择时辰）| confirm（是否打坐）
const chosen = ref(null) // 选中的时长选项 { minutes, label, gain }
const result = ref(null) // 出定结算结果 { gained, minutes, label, realmName }

// 倒计时：以拉取时的 remainSeconds 客户端锚定绝对结束时刻，避开时区/时钟漂移
const now = ref(Date.now())
const endAt = ref(0)
let timer = null
function startTimer() {
  stopTimer()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}
function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
onUnmounted(stopTimer)

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

const meditating = computed(() => !!st.value?.meditating)
const canMeditate = computed(() => !!st.value?.canMeditate)
const reason = computed(() => st.value?.reason || '')
const realmName = computed(() => st.value?.realmName || '凡人')
const options = computed(() => st.value?.options || [])

// 剩余秒数与 HH:MM:SS / MM:SS 文案
const remain = computed(() => {
  if (!endAt.value) return 0
  return Math.max(0, Math.ceil((endAt.value - now.value) / 1000))
})
const remainText = computed(() => {
  let s = remain.value
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const p = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
})
// 进行中场次的预计收益（按当前时长匹配选项，仅作展示）
const sessionGain = computed(() => {
  const mins = Number(st.value?.durationMinutes) || 0
  return options.value.find((o) => o.minutes === mins)?.gain ?? null
})

function anchorEnd(status) {
  endAt.value =
    status?.meditating && Number(status.remainSeconds) > 0
      ? Date.now() + Number(status.remainSeconds) * 1000
      : 0
}

async function load() {
  loading.value = true
  error.value = ''
  result.value = null
  step.value = 'select'
  chosen.value = null
  try {
    const s = await apiMeditationStatus()
    st.value = s
    anchorEnd(s)
    // 打开时顺带结算了上一场（惰性结算）——回抛供首页刷新
    if (s.settled) {
      result.value = s.settled
      emit('settled', s)
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      startTimer()
      load()
    } else {
      stopTimer()
    }
  }
)

// 出定：进行中场次的倒计时归零后拉取结算结果（后端 getMeditationStatus 会先行结算）
let settling = false
watch(remain, async (r, prev) => {
  if (!meditating.value || settling) return
  if (r === 0 && prev > 0) {
    settling = true
    try {
      const s = await apiMeditationStatus()
      st.value = s
      anchorEnd(s)
      if (s.settled) {
        result.value = s.settled
        emit('settled', s)
      }
    } catch {
      /* 结算失败，下次交互再补 */
    } finally {
      settling = false
    }
  }
})

// 择时辰 → 是否打坐
function pick(opt) {
  chosen.value = opt
  step.value = 'confirm'
}
function back() {
  step.value = 'select'
  chosen.value = null
}

// 确认入定：开始打坐（一旦入定不可中断）
async function confirm() {
  if (busy.value || !chosen.value) return
  busy.value = true
  error.value = ''
  try {
    const s = await apiMeditationStart(chosen.value.minutes)
    st.value = s
    anchorEnd(s)
    step.value = 'select'
    chosen.value = null
    emit('started', s)
  } catch (e) {
    error.value = e.message
    // 失败（已在打坐/修为圆满等）以最新状态为准
    try {
      const s = await apiMeditationStatus()
      st.value = s
      anchorEnd(s)
    } catch {
      /* 保持原状 */
    }
  } finally {
    busy.value = false
  }
}

// 关闭「功成」结果页：回到当前状态（可再次入定或提示需突破）
function dismissResult() {
  result.value = null
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="onClose">
    <div class="dialog">
      <button class="x" @click="onClose" title="关闭">×</button>
      <div class="seal" :class="{ pulse: meditating && !result }">坐</div>
      <h3 class="title">打坐入定</h3>

      <!-- 加载中 -->
      <template v-if="loading">
        <p class="desc">正在收敛心神…</p>
      </template>

      <!-- 出定功成（结算结果） -->
      <template v-else-if="result">
        <p class="desc">静极生慧，一场入定圆满——</p>
        <div class="big gold-t" v-if="result.gained > 0">修为 +{{ fmtCn(result.gained) }}</div>
        <div class="big gold-t" v-else>未得寸进</div>
        <p class="sub">
          打坐{{ result.label }}，{{
            result.gained > 0 ? '道行随之精进。' : '然修为早已圆满，需先破境。'
          }}
        </p>
        <button class="btn gold" @click="dismissResult">收 功</button>
      </template>

      <!-- 入定中：倒计时，不可中断 -->
      <template v-else-if="meditating">
        <p class="desc">心神归一，正自入定——</p>
        <div class="big count">{{ remainText }}</div>
        <p class="sub">
          本次【{{ st.durationLabel }}】<template v-if="sessionGain !== null"
            > · 期满约得修为 +{{ fmtCn(sessionGain) }}</template
          ><br />
          一旦入定不可中断，其间无法修炼、突破或再次打坐。<br />
          <b class="gold-t">闭窗不扰道心</b>，期满自会出定入账。
        </p>
        <button class="btn ghost" @click="onClose">静候出定</button>
      </template>

      <!-- 不可打坐（修为圆满需突破 / 此境无修为可进） -->
      <template v-else-if="!canMeditate">
        <p class="desc">当前无法入定打坐。</p>
        <div class="reason">{{ reason || '尚不能打坐' }}</div>
        <button class="btn ghost" @click="onClose">知道了</button>
      </template>

      <!-- 择时辰：选择打坐时长 -->
      <template v-else-if="step === 'select'">
        <p class="desc">
          当前境界【<b class="gold-t">{{ realmName }}</b>】，择一时辰入定
        </p>
        <ul class="opts">
          <li v-for="o in options" :key="o.minutes">
            <button class="opt" @click="pick(o)">
              <span class="opt-name">{{ o.label }}</span>
              <span class="opt-min">约 {{ o.minutes }} 分钟</span>
              <span class="opt-gain">修为 +{{ fmtCn(o.gain) }}</span>
            </button>
          </li>
        </ul>
        <p class="sub">每小时得当前境界圆满修为的 {{ st.gainPerHourPercent }}%，期满一次性结算。</p>
      </template>

      <!-- 是否打坐：二次确认，强调不可中断 -->
      <template v-else-if="step === 'confirm'">
        <p class="desc">是否就此入定？</p>
        <div class="confirm-box">
          <div class="confirm-line">
            将入定【<b class="gold-t">{{ chosen.label }}</b>】· 约 {{ chosen.minutes }} 分钟
          </div>
          <div class="confirm-line">期满约得 <b class="gold-t">修为 +{{ fmtCn(chosen.gain) }}</b></div>
          <div class="confirm-warn">
            一旦入定，<b>期满之前不可中断</b>，其间无法修炼、突破或再次打坐。
          </div>
        </div>
        <p v-if="error" class="err">{{ error }}</p>
        <div class="btn-row">
          <button class="btn ghost" :disabled="busy" @click="back">再想想</button>
          <button class="btn gold" :disabled="busy" @click="confirm">
            {{ busy ? '入定中…' : '确认入定' }}
          </button>
        </div>
      </template>

      <!-- 状态拉取失败 -->
      <template v-else>
        <p class="desc">{{ error || '心神难宁，稍后再试。' }}</p>
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
  --gold-2: #e6cf93;
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
  background: linear-gradient(160deg, #d4af5b, #b8933f);
  border-radius: 14px;
  box-shadow: 0 8px 18px -8px rgba(184, 147, 63, 0.8);
}
.seal.pulse { animation: breathe 2.4s ease-in-out infinite; }
@keyframes breathe {
  0%, 100% { box-shadow: 0 8px 18px -8px rgba(184, 147, 63, 0.8); }
  50% { box-shadow: 0 0 0 6px rgba(184, 147, 63, 0.18); }
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
.big {
  margin: 6px 0 10px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--gold);
  text-shadow: 0 2px 12px rgba(184, 147, 63, 0.28);
}
.big.count {
  font-variant-numeric: tabular-nums;
  letter-spacing: 3px;
}
.sub {
  margin: 0 0 18px;
  font-size: 12px;
  color: var(--ink-mut);
  line-height: 1.7;
}
/* 时长选项 */
.opts {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.opt {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  font-family: inherit;
  text-align: left;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.opt:hover {
  border-color: var(--gold);
  background: rgba(184, 147, 63, 0.08);
}
.opt-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1px;
}
.opt-min {
  font-size: 12px;
  color: var(--ink-mut);
}
.opt-gain {
  margin-left: auto;
  font-size: 14px;
  font-weight: 700;
  color: var(--gold);
}
/* 不可打坐提示 */
.reason {
  margin: 6px 0 16px;
  padding: 14px;
  font-size: 15px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
  border-radius: 10px;
}
/* 是否打坐确认框 */
.confirm-box {
  margin: 0 0 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.confirm-line {
  font-size: 15px;
  color: var(--ink-h);
  margin-bottom: 6px;
}
.confirm-warn {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  font-size: 13px;
  line-height: 1.6;
  color: #a8452f;
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
.btn.gold:hover:not(:disabled) { filter: brightness(1.05); }
.btn:disabled { opacity: 0.55; cursor: default; box-shadow: none; }
.btn.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}
.btn.ghost:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.btn-row {
  display: flex;
  gap: 12px;
}
.btn-row .btn { letter-spacing: 2px; }
</style>
