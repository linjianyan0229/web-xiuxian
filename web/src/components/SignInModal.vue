<script setup>
import { computed, ref, watch } from 'vue'
import { apiSignIn } from '../api/game.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  status: { type: Object, default: null },
})
const emit = defineEmits(['close', 'signed'])

const signing = ref(false)
const error = ref('')
const result = ref(null) // 签到成功后的响应 { reward, rewardLabel, ... }

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
function fmtTime(t) {
  if (!t) return '—'
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 打开弹窗时重置一次性状态
watch(
  () => props.visible,
  (v) => {
    if (v) {
      signing.value = false
      error.value = ''
      result.value = null
    }
  }
)

const realmName = computed(() => props.status?.realmName || '凡人')
const rewardLabel = computed(() => props.status?.rewardLabel || '修为')
const isFixed = computed(() => Number(props.status?.fixedReward) > 0)
const rewardMin = computed(() => Number(props.status?.rewardMin) || 0)
const rewardMax = computed(() => Number(props.status?.rewardMax) || 0)
const minPercent = computed(() => Number(props.status?.minPercent) || 0)
const maxPercent = computed(() => Number(props.status?.maxPercent) || 0)
const canSignIn = computed(() => !!props.status?.canSignIn && result.value === null)
const enabled = computed(() => props.status?.enabled !== false)
const nextText = computed(() => fmtTime(props.status?.nextSignTime))

// 奖励预览文案（区间/固定）
const previewText = computed(() => {
  if (isFixed.value) return `${rewardLabel.value} +${props.status?.fixedReward || 1}`
  if (rewardMin.value === rewardMax.value) return `${rewardLabel.value} +${fmtCn(rewardMin.value)}`
  return `${rewardLabel.value} +${fmtCn(rewardMin.value)} ~ +${fmtCn(rewardMax.value)}`
})
const ruleText = computed(() => {
  if (isFixed.value) return '道法领悟之境，每次签到得道法 +1'
  return `奖励为当前境界圆满${rewardLabel.value}的 ${minPercent.value}% ~ ${maxPercent.value}% 随机，境界越高得越多`
})

// 距下次签到剩余（打开时估算一次）
const remainText = computed(() => {
  const next = props.status?.nextSignTime
  if (!next) return ''
  const diff = new Date(next).getTime() - Date.now()
  if (diff <= 0) return ''
  const h = Math.floor(diff / 3.6e6)
  const m = Math.floor((diff % 3.6e6) / 6e4)
  return `约 ${h} 小时 ${m} 分后`
})

async function onSign() {
  if (signing.value || !canSignIn.value) return
  signing.value = true
  error.value = ''
  try {
    const res = await apiSignIn()
    result.value = res
    emit('signed', res)
  } catch (e) {
    error.value = e.message || '签到失败'
  } finally {
    signing.value = false
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
      <div class="seal">签</div>
      <h3 class="title">每日签到</h3>

      <!-- 功能未开启 -->
      <template v-if="!enabled">
        <p class="desc">签到功能暂未开启，敬请期待。</p>
        <button class="btn ghost" @click="onClose">知道了</button>
      </template>

      <!-- 签到成功 -->
      <template v-else-if="result !== null">
        <p class="desc">道友静心一日，机缘已至——</p>
        <div class="reward-big">{{ result.rewardLabel }} +{{ fmtCn(result.reward) }}</div>
        <p class="sub">下次签到：{{ nextText }}</p>
        <button class="btn gold" @click="onClose">收下机缘</button>
      </template>

      <!-- 可签到 -->
      <template v-else-if="canSignIn">
        <p class="desc">
          当前境界【<b class="gold-t">{{ realmName }}</b>】，签到可得
        </p>
        <div class="reward-big">{{ previewText }}</div>
        <p class="sub">{{ ruleText }}</p>
        <p v-if="error" class="err">{{ error }}</p>
        <button class="btn gold" :disabled="signing" @click="onSign">
          {{ signing ? '签到中…' : '签到领取' }}
        </button>
      </template>

      <!-- 已签到（冷却中） -->
      <template v-else>
        <p class="desc">今日已签到，静待下一次机缘。</p>
        <div class="reward-big small">{{ nextText }}</div>
        <p class="sub">{{ remainText || '稍后再来' }}可再次签到</p>
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
  width: min(390px, 90vw);
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
.reward-big {
  margin: 6px 0 10px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--gold);
  text-shadow: 0 2px 12px rgba(184, 147, 63, 0.28);
}
.reward-big.small {
  font-size: 20px;
  letter-spacing: 1px;
}
.sub {
  margin: 0 0 18px;
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
.btn.gold:hover:not(:disabled) { filter: brightness(1.05); }
.btn.gold:disabled { opacity: 0.6; cursor: default; }
.btn.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}
.btn.ghost:hover { color: var(--gold); border-color: var(--gold); }
</style>
