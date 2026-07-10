<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { apiSectCreate, apiSectUpdate } from '../api/game.js'
import { useAuthStore } from '../stores/auth.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  // { realms: [{realm, realm_rank}], createCost }
  meta: { type: Object, default: () => ({ realms: [], createCost: 5000 }) },
  // 编辑模式：mode='edit' 时以 sect 预填并提交到 PUT /sects/:id（宗门信息管理权，后端校验）
  mode: { type: String, default: 'create' },
  sect: { type: Object, default: null },
})
// created: 立派成功，回抛 { sect, user }（user 含扣减后的灵石与 sect_id）
// updated: 资料修改成功，回抛 { sect }
const emit = defineEmits(['close', 'created', 'updated'])

const auth = useAuthStore()
const isEdit = computed(() => props.mode === 'edit')

const form = reactive({
  name: '',
  realmReq: '',
  avatarUrl: '',
  backgroundUrl: '',
  intro: '',
})
const busy = ref(false)
const error = ref('')

watch(
  () => props.visible,
  (v) => {
    if (v) {
      form.name = isEdit.value ? (props.sect?.name ?? '') : ''
      form.realmReq = isEdit.value ? (props.sect?.realm_req ?? '') : ''
      form.avatarUrl = isEdit.value ? (props.sect?.avatar ?? '') : ''
      form.backgroundUrl = isEdit.value ? (props.sect?.background ?? '') : ''
      form.intro = isEdit.value ? (props.sect?.intro ?? '') : ''
      error.value = ''
      busy.value = false
    }
  }
)

function validUrl(s) {
  return !s || /^https?:\/\//i.test(s)
}

async function submit() {
  if (busy.value) return
  const name = form.name.trim()
  if (name.length < 2 || name.length > 16) {
    error.value = '宗门名称须为 2~16 个字符'
    return
  }
  if (!validUrl(form.avatarUrl.trim()) || !validUrl(form.backgroundUrl.trim())) {
    error.value = '头像/背景仅支持 http/https 图片链接'
    return
  }
  if (form.intro.trim().length > 500) {
    error.value = '宗门简介最多 500 字'
    return
  }
  if (!isEdit.value && (Number(auth.user?.ling_shi) || 0) < props.meta.createCost) {
    error.value = `立派需耗费灵石 ${props.meta.createCost}，道友囊中尚且不足`
    return
  }
  busy.value = true
  error.value = ''
  try {
    const payload = {
      name,
      realmReq: form.realmReq,
      avatarUrl: form.avatarUrl.trim(),
      backgroundUrl: form.backgroundUrl.trim(),
      intro: form.intro.trim(),
    }
    if (isEdit.value) {
      const r = await apiSectUpdate(props.sect.id, payload)
      emit('updated', r)
    } else {
      const r = await apiSectCreate(payload)
      emit('created', r)
    }
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <button class="x" @click="emit('close')" title="关闭">×</button>
      <h3 class="title">{{ isEdit ? '修订宗门资料' : '开宗立派' }}</h3>
      <p class="desc" v-if="isEdit">修订【{{ sect?.name }}】的名号、门规与形象</p>
      <p class="desc" v-else>立派需耗费灵石 <b class="gold-t">{{ meta.createCost }}</b>（现有 {{ auth.user?.ling_shi ?? 0 }}），立派者自任宗主</p>

      <div class="form">
        <label class="fld">
          <span>宗门名称 <i>*</i></span>
          <input v-model.trim="form.name" type="text" placeholder="2~16 字，独一无二" :disabled="busy" />
        </label>
        <label class="fld">
          <span>入门境界要求</span>
          <select v-model="form.realmReq" :disabled="busy">
            <option value="">无要求（来者皆客）</option>
            <option v-for="r in meta.realms" :key="r.realm" :value="r.realm">
              {{ r.realm }}及以上
            </option>
          </select>
        </label>
        <label class="fld">
          <span>宗门头像（图片链接，可空）</span>
          <input v-model.trim="form.avatarUrl" type="text" placeholder="https://…（留空以宗门首字为徽）" :disabled="busy" />
        </label>
        <label class="fld">
          <span>宗门背景（图片链接，可空）</span>
          <input v-model.trim="form.backgroundUrl" type="text" placeholder="https://…（留空用默认洞府图）" :disabled="busy" />
        </label>
        <label class="fld">
          <span>宗门简介</span>
          <textarea
            v-model="form.intro"
            rows="3"
            maxlength="500"
            placeholder="立派宗旨、门规传承…（最多 500 字）"
            :disabled="busy"
          ></textarea>
        </label>
      </div>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="btn-row">
        <button class="btn ghost" :disabled="busy" @click="emit('close')">再想想</button>
        <button class="btn gold" :disabled="busy" @click="submit">
          <template v-if="isEdit">{{ busy ? '修订中…' : '修 订' }}</template>
          <template v-else>{{ busy ? '立派中…' : `立 派（灵石 -${meta.createCost}）` }}</template>
        </button>
      </div>
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
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);

  position: relative;
  width: min(440px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  padding: 26px 28px 22px;
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
.title {
  margin: 0 0 6px;
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink-h);
}
.desc {
  margin: 0 0 16px;
  text-align: center;
  font-size: 12.5px;
  color: var(--ink-mut);
}
.gold-t { color: var(--gold); }

.form {
  display: flex;
  flex-direction: column;
  gap: 11px;
  text-align: left;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fld span {
  font-size: 12px;
  color: var(--ink-mut);
}
.fld span i {
  color: #b4453b;
  font-style: normal;
}
.fld input,
.fld select,
.fld textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid var(--line);
  border-radius: 9px;
  outline: none;
  resize: vertical;
}
.fld input:focus,
.fld select:focus,
.fld textarea:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.15);
}

.err {
  margin: 10px 0 0;
  font-size: 13px;
  color: #b4453b;
}
.btn-row {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.btn {
  flex: 1 1 0;
  padding: 12px 0;
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
.btn:disabled { opacity: 0.55; cursor: default; box-shadow: none; }
</style>
