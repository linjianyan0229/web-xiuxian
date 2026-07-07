<script setup>
import { reactive, ref, watch } from 'vue'
import { apiCreateUser, apiUpdateUser } from '../api/admin.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'add' }, // 'add' | 'edit'
  user: { type: Object, default: null },
  realms: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'saved'])

const saving = ref(false)
const error = ref('')

const form = reactive({
  daoName: '',
  email: '',
  password: '',
  realmId: 1,
  status: 1,
  gender: 1,
  lingShi: 0,
  cultivation: 0,
  daoYun: 0,
  daoLaw: 0,
  comprehension: 1,
  deathCount: 0,
})

function resetFrom() {
  error.value = ''
  saving.value = false
  if (props.mode === 'edit' && props.user) {
    const u = props.user
    form.daoName = u.dao_name
    form.email = u.email
    form.password = ''
    form.realmId = u.realm_id
    form.status = u.status
    form.gender = Number(u.gender) === 2 ? 2 : 1
    form.lingShi = Number(u.ling_shi) || 0
    form.cultivation = Number(u.cultivation) || 0
    form.daoYun = Number(u.dao_yun) || 0
    form.daoLaw = Number(u.dao_law) || 0
    form.comprehension = Number(u.comprehension) || 0
    form.deathCount = Number(u.death_count) || 0
  } else {
    form.daoName = ''
    form.email = ''
    form.password = ''
    form.realmId = 1
    form.status = 1
    form.gender = 1
    form.lingShi = 0
    form.cultivation = 0
    form.daoYun = 0
    form.daoLaw = 0
    form.comprehension = 1
    form.deathCount = 0
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) resetFrom()
  }
)

async function submit() {
  error.value = ''
  if (!form.daoName || !form.email) {
    error.value = '道号与邮箱为必填'
    return
  }
  if (props.mode === 'add' && !form.password) {
    error.value = '请设置初始密码'
    return
  }
  saving.value = true
  try {
    if (props.mode === 'add') {
      await apiCreateUser({
        daoName: form.daoName,
        email: form.email,
        password: form.password,
        realmId: form.realmId,
        status: form.status,
        gender: form.gender,
      })
    } else {
      const payload = {
        daoName: form.daoName,
        email: form.email,
        realmId: form.realmId,
        status: form.status,
        gender: form.gender,
        lingShi: form.lingShi,
        cultivation: form.cultivation,
        daoYun: form.daoYun,
        daoLaw: form.daoLaw,
        comprehension: form.comprehension,
        deathCount: form.deathCount,
      }
      if (form.password) payload.password = form.password
      await apiUpdateUser(props.user.id, payload)
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
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div class="modal">
      <header class="m-head">
        <h3>{{ mode === 'add' ? '添加用户' : '编辑用户' }}</h3>
        <button class="x" @click="emit('close')">×</button>
      </header>

      <div class="m-body">
        <div class="grid">
          <label class="fld">
            <span>道号</span>
            <input v-model.trim="form.daoName" placeholder="2-16位中英文/数字/下划线" />
          </label>
          <label class="fld">
            <span>邮箱</span>
            <input v-model.trim="form.email" placeholder="name@example.com" />
          </label>
          <label class="fld">
            <span>密码{{ mode === 'edit' ? '（留空不改）' : '' }}</span>
            <input v-model="form.password" type="password" placeholder="至少6位" />
          </label>
          <label class="fld">
            <span>境界</span>
            <select v-model.number="form.realmId">
              <option v-for="r in realms" :key="r.id" :value="r.id">{{ r.id }} · {{ r.name }}</option>
            </select>
          </label>
          <label class="fld">
            <span>状态</span>
            <select v-model.number="form.status">
              <option :value="1">正常</option>
              <option :value="0">禁用</option>
            </select>
          </label>
          <label class="fld">
            <span>性别</span>
            <select v-model.number="form.gender">
              <option :value="1">男</option>
              <option :value="2">女</option>
            </select>
          </label>

          <template v-if="mode === 'edit'">
            <label class="fld"><span>灵石</span><input v-model.number="form.lingShi" type="number" min="0" /></label>
            <label class="fld"><span>修为</span><input v-model.number="form.cultivation" type="number" min="0" /></label>
            <label class="fld"><span>道韵</span><input v-model.number="form.daoYun" type="number" min="0" /></label>
            <label class="fld"><span>道法</span><input v-model.number="form.daoLaw" type="number" min="0" /></label>
            <label class="fld"><span>悟性（%，上限100）</span><input v-model.number="form.comprehension" type="number" min="0" max="100" /></label>
            <label class="fld"><span>死亡次数</span><input v-model.number="form.deathCount" type="number" min="0" /></label>
          </template>
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
  width: min(560px, 100%);
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
.fld > input,
.fld > select {
  padding: 9px 11px;
  font-size: 14px;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
}
.fld > input:focus,
.fld > select:focus {
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

@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
