<script setup>
import { reactive, ref, watch } from 'vue'
import { apiUpdatePill, apiUpdatePillGrade } from '../api/admin.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  pill: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const saving = ref(false)
const error = ref('')

const form = reactive({
  name: '',
  note: '',
  grades: [], // { grade, gradeName, itemName, summary, effects: [...] }
})

const DURATION_LABELS = {
  temporary: '临时',
  instant: '即时',
  permanent: '永久',
  until_triggered: '触发前有效',
  next_breakthrough: '下次突破',
}

// 效果行说明：属性 · 数值类型 · 极性 · 时效
function effectLabel(e) {
  const type = e.type === 'percent' ? '百分比' : '固定值'
  const polarity = e.polarity === 'positive' ? '正面' : '负面'
  return `${e.targetName || e.target} · ${type} · ${polarity} · ${DURATION_LABELS[e.duration] || e.duration}`
}

function resetForm() {
  error.value = ''
  saving.value = false
  const p = props.pill
  if (!p) return
  form.name = p.name
  form.note = p.note || ''
  form.grades = (p.grades || []).map((g) => {
    // mysql2 对 JSON 列通常已解析为对象，兜底兼容字符串
    const effects = typeof g.effects === 'string' ? JSON.parse(g.effects) : g.effects
    return {
      grade: g.grade,
      gradeName: g.grade_name,
      itemName: g.item_name,
      summary: g.summary || '',
      effects: (effects || []).map((e) => ({ ...e })),
    }
  })
}

watch(
  () => props.visible,
  (v) => {
    if (v) resetForm()
  }
)

async function submit() {
  error.value = ''
  if (!form.name.trim()) {
    error.value = '丹药名不能为空'
    return
  }
  for (const g of form.grades) {
    if (!String(g.itemName).trim()) {
      error.value = `【${g.gradeName}品】成品名不能为空`
      return
    }
    for (const e of g.effects) {
      if (!Number.isFinite(Number(e.value)) || Number(e.value) < 0) {
        error.value = `【${g.gradeName}品】效果数值必须为非负数字`
        return
      }
      if (e.duration === 'temporary' && (!Number.isFinite(Number(e.hours)) || Number(e.hours) <= 0)) {
        error.value = `【${g.gradeName}品】临时效果需要大于 0 的持续小时数`
        return
      }
    }
  }
  saving.value = true
  try {
    await apiUpdatePill(props.pill.id, { name: form.name, note: form.note })
    for (const g of form.grades) {
      await apiUpdatePillGrade(props.pill.id, g.grade, {
        itemName: g.itemName,
        summary: g.summary,
        effects: g.effects,
      })
    }
    emit('saved')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="visible && pill" class="mask" @click.self="emit('close')">
    <div class="modal">
      <header class="m-head">
        <h3>编辑丹药 · {{ pill.realm }}{{ pill.category_name }}</h3>
        <button class="x" @click="emit('close')">×</button>
      </header>

      <div class="m-body">
        <div class="grid">
          <label class="fld">
            <span>丹药名</span>
            <input v-model.trim="form.name" />
          </label>
          <label class="fld">
            <span>备注</span>
            <input v-model.trim="form.note" />
          </label>
        </div>

        <section v-for="g in form.grades" :key="g.grade" class="grade-box">
          <h4 class="g-title">
            <span class="g-tag" :class="'g-' + g.grade">{{ g.gradeName }}品</span>
            {{ g.itemName }}
          </h4>
          <div class="grid">
            <label class="fld">
              <span>成品名</span>
              <input v-model.trim="g.itemName" />
            </label>
            <label class="fld">
              <span>效果摘要（供展示）</span>
              <input v-model.trim="g.summary" />
            </label>
          </div>
          <div v-for="(e, i) in g.effects" :key="i" class="effect">
            <div class="e-label">{{ effectLabel(e) }}</div>
            <div class="e-inputs">
              <label class="fld sm">
                <span>数值{{ e.type === 'percent' ? '(%)' : '' }}</span>
                <input v-model.number="e.value" type="number" min="0" step="0.01" />
              </label>
              <label v-if="e.duration === 'temporary'" class="fld sm">
                <span>持续(小时)</span>
                <input v-model.number="e.hours" type="number" min="0.1" step="0.1" />
              </label>
            </div>
          </div>
        </section>

        <p v-if="error" class="err">{{ error }}</p>
      </div>

      <footer class="m-foot">
        <button class="btn ghost" @click="emit('close')">取消</button>
        <button class="btn primary" :disabled="saving" @click="submit">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </footer>
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
  background: rgba(20, 22, 26, 0.5);
  backdrop-filter: blur(2px);
  padding: 20px;
}
.modal {
  width: min(640px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  overflow: hidden;
}
.m-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.m-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-h);
  letter-spacing: 1px;
}
.x {
  font-size: 22px;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.x:hover {
  color: var(--text-h);
}
.m-body {
  padding: 20px;
  overflow-y: auto;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fld > span {
  font-size: 13px;
  color: var(--muted);
}
.fld > input {
  padding: 9px 11px;
  font-size: 14px;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
}
.fld > input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.fld.sm > input {
  width: 130px;
}

.grade-box {
  margin-top: 18px;
  padding: 14px 16px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--field-bg);
}
.g-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-h);
  display: flex;
  align-items: center;
  gap: 8px;
}
.g-tag {
  display: inline-block;
  padding: 1px 8px;
  font-size: 12px;
  border-radius: 6px;
}
.g-fan {
  color: var(--muted);
  background: var(--panel);
  border: 1px solid var(--border);
}
.g-ling {
  color: var(--accent);
  background: var(--accent-soft);
}
.g-dao {
  color: #b4453a;
  background: rgba(180, 69, 58, 0.12);
}
.effect {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}
.e-label {
  font-size: 13px;
  color: var(--text);
  margin-bottom: 8px;
}
.e-inputs {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.err {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--danger);
}
.m-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
.btn {
  padding: 9px 20px;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn.primary {
  color: #fff;
  background: var(--accent);
}
.btn.primary:hover:not(:disabled) {
  background: var(--accent-h);
}
.btn.primary:disabled {
  opacity: 0.6;
  cursor: default;
}
.btn.ghost {
  color: var(--text);
  background: transparent;
  border-color: var(--border);
}
.btn.ghost:hover {
  color: var(--text-h);
  border-color: var(--muted);
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
