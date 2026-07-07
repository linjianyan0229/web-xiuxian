<script setup>
import { computed, ref, watch } from 'vue'
import { apiPillGift, apiPillDiscard } from '../api/game.js'
import { useToast } from '../composables/toast.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  item: { type: Object, default: null }, // 背包列表行（含丹药与品质档详情）
})
// changed: 赠送/丢弃成功后回抛剩余数量，供背包列表刷新
const emit = defineEmits(['close', 'changed'])

const toast = useToast()

const mode = ref('main') // main | gift | discard
const busy = ref(false)
const error = ref('')
const giftTarget = ref('')
const giftQty = ref(1)
const discardQty = ref(1)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      mode.value = 'main'
      error.value = ''
      giftTarget.value = ''
      giftQty.value = 1
      discardQty.value = 1
    }
  }
)

const DURATION_LABELS = {
  temporary: '临时',
  instant: '即时',
  permanent: '永久',
  until_triggered: '触发前有效',
  next_breakthrough: '下次突破',
}
const EFFECT_MODE_LABELS = {
  temporary_positive: '临时正面',
  permanent_positive: '永久正面',
  temporary_negative: '临时负面',
  permanent_negative: '永久负面',
  positive_and_negative: '正负混合',
  temporary_negative_and_positive: '临时负面与正面混合',
}

// mysql2 对 JSON 列通常已解析为对象，兜底兼容字符串
const effects = computed(() => {
  const raw = props.item?.effects
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  }
  return raw
})

const quantity = computed(() => Number(props.item?.quantity) || 0)
const modeLabel = computed(
  () => EFFECT_MODE_LABELS[props.item?.effect_mode] || props.item?.effect_mode || '—'
)
const targetLabel = computed(() =>
  props.item?.default_target === 'enemy' ? '施于敌手' : '自身服用'
)

// 效果数值：正面 +、负面 −，percent 带 %
function effectValue(e) {
  const sign = e.polarity === 'negative' ? '−' : '+'
  return `${sign}${e.value}${e.type === 'percent' ? '%' : ''}`
}
function effectDuration(e) {
  if (e.duration === 'temporary') return `临时 ${e.hours || 0} 小时`
  return DURATION_LABELS[e.duration] || e.duration || ''
}

// 数量输入收敛到 1~持有数
function clampQty(v) {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, Math.max(1, quantity.value))
}

// 服用：药力/буff 系统尚未接入，暂为占位
function consume() {
  toast.info('丹药药力尚未接入结算，服用玩法敬请期待')
}

function toGift() {
  mode.value = 'gift'
  error.value = ''
}
function toDiscard() {
  mode.value = 'discard'
  error.value = ''
}
function back() {
  mode.value = 'main'
  error.value = ''
}

async function submitGift() {
  if (busy.value || !props.item) return
  const target = giftTarget.value.trim()
  if (!target) {
    error.value = '请填写受赠道友的道号'
    return
  }
  const qty = clampQty(giftQty.value)
  giftQty.value = qty
  busy.value = true
  error.value = ''
  try {
    const r = await apiPillGift({
      pillId: props.item.pill_id,
      grade: props.item.grade,
      quantity: qty,
      targetDaoName: target,
    })
    toast.success(`已将 ${props.item.item_name} ×${qty} 赠予道友【${r.targetDaoName}】`)
    emit('changed', r.remaining)
    if (r.remaining <= 0) emit('close')
    else back()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function submitDiscard() {
  if (busy.value || !props.item) return
  const qty = clampQty(discardQty.value)
  discardQty.value = qty
  busy.value = true
  error.value = ''
  try {
    const r = await apiPillDiscard({
      pillId: props.item.pill_id,
      grade: props.item.grade,
      quantity: qty,
    })
    toast.success(`已丢弃 ${props.item.item_name} ×${qty}`)
    emit('changed', r.remaining)
    if (r.remaining <= 0) emit('close')
    else back()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="visible && item" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <button class="x" @click="emit('close')" title="关闭">×</button>

      <header class="head">
        <span class="g-tag" :class="'g-' + item.grade">{{ item.grade_name }}</span>
        <h3 class="title">{{ item.item_name }}</h3>
      </header>
      <p class="lineage">{{ item.realm }} · {{ item.category_name }}</p>

      <dl class="info">
        <div><dt>药性</dt><dd>{{ modeLabel }}</dd></div>
        <div><dt>用法</dt><dd>{{ targetLabel }}</dd></div>
        <div><dt>持有</dt><dd class="gold-t">×{{ quantity }}</dd></div>
      </dl>

      <div class="fx">
        <h4 class="fx-title">药力</h4>
        <ul class="fx-list">
          <li v-for="(e, i) in effects" :key="i">
            <span class="fx-name">{{ e.targetName || e.target }}</span>
            <b class="fx-val" :class="e.polarity === 'negative' ? 'bad' : 'good'">
              {{ effectValue(e) }}
            </b>
            <span class="fx-dur">{{ effectDuration(e) }}</span>
          </li>
          <li v-if="effects.length === 0" class="fx-none">药力不明</li>
        </ul>
        <p v-if="item.summary" class="summary">{{ item.summary }}</p>
        <p v-if="item.note" class="note">{{ item.note }}</p>
      </div>

      <p v-if="error" class="err">{{ error }}</p>

      <!-- 主操作：服用 / 赠送 / 丢弃 -->
      <div v-if="mode === 'main'" class="btn-row">
        <button class="btn gold" @click="consume">服 用</button>
        <button class="btn ghost" @click="toGift">赠 送</button>
        <button class="btn ghost danger" @click="toDiscard">丢 弃</button>
      </div>

      <!-- 赠送：填道号与数量 -->
      <div v-else-if="mode === 'gift'" class="sub-panel">
        <div class="fields">
          <label class="fld">
            <span>受赠道友（道号）</span>
            <input v-model.trim="giftTarget" type="text" placeholder="输入对方道号" :disabled="busy" />
          </label>
          <label class="fld qty">
            <span>数量</span>
            <input
              v-model.number="giftQty"
              type="number"
              min="1"
              :max="quantity"
              :disabled="busy"
              @change="giftQty = clampQty(giftQty)"
            />
          </label>
        </div>
        <p class="hint">赠出之后物归他人，勿赠错道友。</p>
        <div class="btn-row">
          <button class="btn ghost" :disabled="busy" @click="back">返 回</button>
          <button class="btn gold" :disabled="busy" @click="submitGift">
            {{ busy ? '传物中…' : '确认赠送' }}
          </button>
        </div>
      </div>

      <!-- 丢弃：选数量并确认 -->
      <div v-else class="sub-panel">
        <div class="fields">
          <label class="fld qty">
            <span>丢弃数量</span>
            <input
              v-model.number="discardQty"
              type="number"
              min="1"
              :max="quantity"
              :disabled="busy"
              @change="discardQty = clampQty(discardQty)"
            />
          </label>
        </div>
        <p class="hint warn">丹药一经丢弃便散于天地，<b>不可寻回</b>。</p>
        <div class="btn-row">
          <button class="btn ghost" :disabled="busy" @click="back">返 回</button>
          <button class="btn gold danger-solid" :disabled="busy" @click="submitDiscard">
            {{ busy ? '丢弃中…' : '确认丢弃' }}
          </button>
        </div>
      </div>
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
  --gold-2: #e6cf93;
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);
  --red: #a8452f;

  position: relative;
  width: min(440px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  padding: 26px 26px 22px;
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

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: 20px;
}
.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
}
.lineage {
  margin: 4px 0 14px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-mut);
}
.g-tag {
  flex: none;
  display: inline-block;
  min-width: 24px;
  text-align: center;
  padding: 2px 6px;
  font-size: 13px;
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

.info {
  margin: 0 0 12px;
  display: flex;
  gap: 8px;
}
.info > div {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.info dt {
  font-size: 11px;
  color: var(--ink-mut);
}
.info dd {
  margin: 0;
  font-size: 13px;
  color: var(--ink-h);
}
.gold-t { color: var(--gold) !important; font-weight: 700; }

.fx {
  margin-bottom: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
  border-radius: 10px;
  text-align: left;
}
.fx-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
  padding-left: 8px;
  border-left: 3px solid var(--gold);
}
.fx-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.fx-list li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 0;
  font-size: 14px;
  border-bottom: 1px dashed var(--line);
}
.fx-list li:last-child { border-bottom: none; }
.fx-name { color: var(--ink-h); }
.fx-val { font-variant-numeric: tabular-nums; }
.fx-val.good { color: var(--gold); }
.fx-val.bad { color: var(--red); }
.fx-dur {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-mut);
}
.fx-none {
  color: var(--ink-mut);
  font-size: 13px;
}
.summary {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink);
}
.note {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--ink-mut);
}

.err {
  margin: 0 0 10px;
  font-size: 13px;
  color: #b4453b;
}

.btn-row {
  display: flex;
  gap: 10px;
}
.btn {
  flex: 1 1 0;
  padding: 11px 0;
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 2px;
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
.btn.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}
.btn.ghost:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.btn.ghost.danger:hover:not(:disabled) { color: var(--red); border-color: var(--red); }
.btn.danger-solid {
  color: #fff;
  background: linear-gradient(180deg, #c96a4a, #a8452f);
  border-color: rgba(168, 69, 47, 0.6);
  box-shadow: 0 6px 16px -8px rgba(168, 69, 47, 0.7);
}
.btn:disabled { opacity: 0.55; cursor: default; box-shadow: none; }

.sub-panel { text-align: left; }
.fields {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}
.fld {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fld.qty { flex: 0 0 96px; }
.fld span {
  font-size: 12px;
  color: var(--ink-mut);
}
.fld input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 10px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--line);
  border-radius: 8px;
  outline: none;
}
.fld input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.15);
}
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-mut);
}
.hint.warn { color: var(--red); }
</style>
