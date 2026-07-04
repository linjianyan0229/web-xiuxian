<script setup>
import { reactive, ref, watch } from 'vue'
import { apiUpdateRealm } from '../api/admin.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  realm: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const saving = ref(false)
const error = ref('')

const form = reactive({
  realm: '',
  stage: '',
  name: '',
  next_realm: '',
  requirement_type: '',
  advance_exp: 0,
  dao_yun_required: 0,
  dao_law_required: 0,
  tribulation_type: '',
  tribulation_death_rate: 0,
  hp: 0,
  ling_qi: 0,
  attack: 0,
  defense: 0,
  spirit: 0,
  note: '',
})

// 文本字段 / 数值字段分组，便于模板与初始化
const textFields = [
  { key: 'name', label: '境界名' },
  { key: 'realm', label: '大境界' },
  { key: 'stage', label: '阶段' },
  { key: 'next_realm', label: '下一境界' },
  { key: 'requirement_type', label: '晋级要求' },
  { key: 'tribulation_type', label: '雷劫类型' },
]
const numFields = [
  { key: 'advance_exp', label: '圆满修为(经验)' },
  { key: 'dao_yun_required', label: '晋级道韵' },
  { key: 'dao_law_required', label: '晋级道法' },
  { key: 'tribulation_death_rate', label: '雷劫死亡率(%)', step: '0.1' },
  { key: 'hp', label: '气血' },
  { key: 'ling_qi', label: '灵气' },
  { key: 'attack', label: '攻击' },
  { key: 'defense', label: '防御' },
  { key: 'spirit', label: '神识' },
]

watch(
  () => props.visible,
  (v) => {
    if (v && props.realm) {
      error.value = ''
      saving.value = false
      const r = props.realm
      textFields.forEach(({ key }) => (form[key] = r[key] ?? ''))
      numFields.forEach(({ key }) => (form[key] = Number(r[key]) || 0))
      form.note = r.note ?? ''
    }
  }
)

async function submit() {
  error.value = ''
  if (!String(form.name).trim()) {
    error.value = '境界名不能为空'
    return
  }
  saving.value = true
  try {
    await apiUpdateRealm(props.realm.id, { ...form })
    emit('saved')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div class="modal">
      <header class="m-head">
        <h3>编辑境界 · <span class="id">#{{ realm?.id }}</span></h3>
        <button class="x" @click="emit('close')">×</button>
      </header>

      <div class="m-body">
        <div class="grid">
          <label v-for="f in textFields" :key="f.key" class="fld">
            <span>{{ f.label }}</span>
            <input v-model.trim="form[f.key]" type="text" />
          </label>
          <label v-for="f in numFields" :key="f.key" class="fld">
            <span>{{ f.label }}</span>
            <input v-model.number="form[f.key]" type="number" min="0" :step="f.step || '1'" />
          </label>
          <label class="fld wide">
            <span>备注</span>
            <input v-model.trim="form.note" type="text" />
          </label>
        </div>
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
.m-head .id {
  color: var(--muted);
  font-weight: 400;
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
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px 16px;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fld.wide {
  grid-column: 1 / -1;
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

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
