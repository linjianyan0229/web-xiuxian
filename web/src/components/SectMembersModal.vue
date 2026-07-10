<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { apiSectMembers, apiSectAppoint, apiSectKick, apiSectTransfer } from '../api/game.js'
import UserAvatar from './UserAvatar.vue'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/toast.js'
import { fmtDateTime } from '../utils/datetime.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  sectId: { type: Number, default: 0 },
  sectName: { type: String, default: '' },
})
// changed: 人事变动（任免/逐出/传位）成功，父级据此刷新详情/列表
const emit = defineEmits(['close', 'changed'])

const auth = useAuthStore()
const toast = useToast()

const state = reactive({ list: [], total: 0, page: 1, pageSize: 50 })
const my = ref(null) // { position, position_name, rank } | null
const leaderId = ref(0)
const appointable = ref([]) // [{ key, name, rank, quota }]
const loading = ref(false)
const busy = ref(false)
// 展开任免面板的成员 id 与所选职位
const appointTarget = ref(0)
const appointPos = ref('')

const iAmLeader = computed(() => leaderId.value === auth.user?.id)
const canManage = computed(() => !!my.value && my.value.rank <= 3)
const isDivine = computed(() => my.value?.position === 'divine_child')

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  try {
    const r = await apiSectMembers(props.sectId, { page: state.page, pageSize: state.pageSize })
    state.list = r.list
    state.total = r.total
    my.value = r.my
    leaderId.value = r.leaderId
    appointable.value = r.appointable || []
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

function go(delta) {
  const next = state.page + delta
  if (next < 1 || next > totalPages()) return
  state.page = next
  load()
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    state.page = 1
    appointTarget.value = 0
    load()
  }
)

// 某行是否可被我行使人事权（自己/宗主不可动；神子对长老级以上无直接权）
function canActOn(row) {
  if (!canManage.value || busy.value) return false
  if (row.user_id === auth.user?.id || row.position === 'sect_master') return false
  if (isDivine.value && row.rank <= 5) return false
  return true
}

function toggleAppoint(row) {
  if (appointTarget.value === row.user_id) {
    appointTarget.value = 0
    return
  }
  appointTarget.value = row.user_id
  appointPos.value = ''
}

// 任免下拉可选项：剔除其现职；神子不可授长老级以上
function optionsFor(row) {
  return appointable.value.filter((p) => {
    if (p.key === row.position) return false
    if (isDivine.value && p.rank <= 5) return false
    return true
  })
}

async function confirmAppoint(row) {
  if (!appointPos.value) {
    toast.info('请先择定职位')
    return
  }
  busy.value = true
  try {
    await apiSectAppoint(props.sectId, row.user_id, appointPos.value)
    toast.success(`已改任「${row.dao_name}」`)
    appointTarget.value = 0
    await load()
    emit('changed')
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

async function kick(row) {
  if (!window.confirm(`确定将「${row.dao_name}」逐出师门？此举不可撤销。`)) return
  busy.value = true
  try {
    await apiSectKick(props.sectId, row.user_id)
    toast.success(`已将「${row.dao_name}」逐出师门`)
    await load()
    emit('changed')
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

async function transfer(row) {
  if (
    !window.confirm(
      `确定将宗主之位传于「${row.dao_name}」？传位后道友将退居太上长老，此举不可撤销。`
    )
  )
    return
  busy.value = true
  try {
    await apiSectTransfer(props.sectId, row.user_id)
    toast.success(`已将宗主之位传于「${row.dao_name}」`)
    await load()
    emit('changed')
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

function fmt(t) {
  return fmtDateTime(t).slice(0, 10)
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <button class="x" @click="emit('close')" title="关闭">×</button>
      <h3 class="title">{{ sectName || '宗门' }} · 门人名录</h3>
      <p class="sub">
        共 {{ state.total }} 人<template v-if="my"> ｜ 道友现居「{{ my.position_name }}」之位</template>
      </p>

      <div class="list">
        <p v-if="loading && state.list.length === 0" class="state">正在查阅门人名录…</p>
        <div v-for="row in state.list" :key="row.user_id" class="m-row">
          <div class="m-line">
            <span class="dot" :class="{ on: row.is_online === 1 }" :title="row.is_online === 1 ? '在线' : '离线'"></span>
            <UserAvatar :avatar="row.avatar" :name="row.dao_name" :size="36" />
            <span class="m-main">
              <b class="m-name">
                {{ row.dao_name }}
                <i v-if="row.user_id === auth.user?.id" class="me-tag">道友</i>
              </b>
              <small class="m-realm">{{ row.realm_name || '—' }} · 入宗 {{ fmt(row.joined_time) }}</small>
            </span>
            <span class="pos" :class="{ high: row.rank <= 5 }">{{ row.position_name }}</span>
            <span class="ops">
              <button
                v-if="canActOn(row)"
                class="op"
                :class="{ act: appointTarget === row.user_id }"
                @click="toggleAppoint(row)"
              >任免</button>
              <button v-if="canActOn(row)" class="op danger" @click="kick(row)">逐出</button>
              <button
                v-if="iAmLeader && row.user_id !== auth.user?.id"
                class="op gold"
                @click="transfer(row)"
              >传位</button>
            </span>
          </div>
          <!-- 任免面板 -->
          <div v-if="appointTarget === row.user_id" class="appoint">
            <select v-model="appointPos" :disabled="busy">
              <option value="">改任为…</option>
              <option v-for="p in optionsFor(row)" :key="p.key" :value="p.key">
                {{ p.name }}{{ p.quota !== null ? `（限 ${p.quota} 人）` : '' }}
              </option>
            </select>
            <button class="op gold" :disabled="busy" @click="confirmAppoint(row)">照准</button>
            <p v-if="isDivine" class="hint">神子/神女不可直接任免长老级以上，须呈罢免信由宗主/太上长老定夺</p>
          </div>
        </div>
        <p v-if="!loading && state.list.length === 0" class="state">此宗暂无门人</p>
      </div>

      <footer class="pager" v-if="state.total > state.pageSize">
        <button class="op" :disabled="state.page <= 1" @click="go(-1)">上一页</button>
        <span class="pageno">{{ state.page }} / {{ totalPages() }}</span>
        <button class="op" :disabled="state.page >= totalPages()" @click="go(1)">下一页</button>
      </footer>
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
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);

  position: relative;
  width: min(560px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  padding: 24px 22px 18px;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background: linear-gradient(160deg, #fbfaf5 0%, #f1f0e9 100%);
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
  margin: 0 0 2px;
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink-h);
}
.sub {
  margin: 0 0 12px;
  text-align: center;
  font-size: 12px;
  color: var(--ink-mut);
}

.list {
  flex: 1 1 auto;
  min-height: 120px;
  overflow-y: auto;
  scrollbar-width: none;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}
.list::-webkit-scrollbar { width: 0; }
.state {
  margin: 0;
  padding: 40px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-mut);
}
.m-row { border-bottom: 1px dashed var(--line); }
.m-row:last-child { border-bottom: none; }
.m-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
}
.dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #c7c9c3;
}
.dot.on { background: #4d9e56; box-shadow: 0 0 5px rgba(77, 158, 86, 0.7); }
.m-main {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.m-name {
  font-size: 14px;
  color: var(--ink-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.me-tag {
  display: inline-block;
  margin-left: 5px;
  padding: 0 5px;
  font-size: 10.5px;
  font-style: normal;
  color: #4a3a12;
  background: rgba(184, 147, 63, 0.18);
  border: 1px solid rgba(184, 147, 63, 0.4);
  border-radius: 5px;
  vertical-align: 1px;
}
.m-realm { font-size: 11.5px; color: var(--ink-mut); }
.pos {
  flex: 0 0 auto;
  padding: 2px 9px;
  font-size: 12px;
  color: var(--ink);
  background: rgba(120, 122, 116, 0.1);
  border: 1px solid var(--line);
  border-radius: 999px;
  white-space: nowrap;
}
.pos.high {
  color: #7a5a16;
  background: rgba(184, 147, 63, 0.14);
  border-color: rgba(184, 147, 63, 0.4);
}
.ops { flex: 0 0 auto; display: flex; gap: 6px; }
.op {
  padding: 4px 10px;
  font-family: inherit;
  font-size: 12px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--line);
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;
}
.op:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.op.act { color: var(--gold); border-color: var(--gold); }
.op.danger:hover:not(:disabled) { color: #b4453b; border-color: #b4453b; }
.op.gold {
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border-color: rgba(184, 147, 63, 0.6);
}
.op.gold:hover:not(:disabled) { filter: brightness(1.05); color: #4a3a12; }
.op:disabled { opacity: 0.5; cursor: default; }

.appoint {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 14px 10px 62px;
}
.appoint select {
  padding: 6px 10px;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--line);
  border-radius: 7px;
  outline: none;
}
.appoint select:focus { border-color: var(--gold); }
.hint {
  flex: 1 1 100%;
  margin: 0;
  font-size: 11px;
  color: var(--ink-mut);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 10px;
}
.pageno { font-size: 12.5px; color: var(--ink-h); font-variant-numeric: tabular-nums; }
</style>
