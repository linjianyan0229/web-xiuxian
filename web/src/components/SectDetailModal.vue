<script setup>
import { computed, ref, watch } from 'vue'
import { apiSectDetail, apiSectJoin, apiSectQuit, apiSectDisband } from '../api/game.js'
import UserAvatar from './UserAvatar.vue'
import SectMembersModal from './SectMembersModal.vue'
import SectCreateModal from './SectCreateModal.vue'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/toast.js'
import { fmtDateTime } from '../utils/datetime.js'
import dongfuImg from '../../image/dongfu.webp'

const props = defineProps({
  visible: { type: Boolean, default: false },
  sectId: { type: Number, default: 0 },
  // { realms, createCost }（修订资料弹窗的境界选项；SectView 传入）
  meta: { type: Object, default: () => ({ realms: [], createCost: 5000 }) },
})
// changed: 入宗/退宗/解散/人事变动等成功，父级据此刷新列表
// joined: 拜入成功（父级可跳转「我的宗门」主页）
const emit = defineEmits(['close', 'changed', 'joined'])

const auth = useAuthStore()
const toast = useToast()

const sect = ref(null)
const my = ref(null) // 我在此宗的职位视图 { position, position_name, rank } | null
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const membersVisible = ref(false)
const editVisible = ref(false)

const isLeader = computed(() => !!sect.value && sect.value.leader_id === auth.user?.id)
const canEditInfo = computed(() => !!my.value && my.value.rank <= 3)
// 无宗门方可拜入；境界须达门槛
const canJoin = computed(() => !my.value && !auth.user?.sect_id)
const realmEnough = computed(() => {
  if (!sect.value) return false
  const req = Number(sect.value.realm_req_rank) || 0
  return req === 0 || Number(auth.user?.realm_id) >= req
})

async function load() {
  sect.value = null
  my.value = null
  error.value = ''
  loading.value = true
  try {
    const r = await apiSectDetail(props.sectId)
    sect.value = r.sect
    my.value = r.my
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// 打开时按 id 拉取最新详情（人数/活跃度/我的职位实时）
watch(
  () => props.visible,
  (v) => {
    if (v) load()
  }
)

async function join() {
  if (!window.confirm(`确定拜入【${sect.value.name}】门下？入宗即为外门弟子。`)) return
  busy.value = true
  try {
    const r = await apiSectJoin(sect.value.id)
    if (r.user) auth.setUser(r.user)
    toast.success(`已拜入【${sect.value.name}】门下`)
    emit('changed')
    emit('joined')
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

async function quit() {
  if (!window.confirm(`确定辞别【${sect.value.name}】？退宗后职位不再保留。`)) return
  busy.value = true
  try {
    const r = await apiSectQuit()
    if (r.user) auth.setUser(r.user)
    toast.success('已重归散修之列')
    await load()
    emit('changed')
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

async function disband() {
  if (
    !window.confirm(
      `确定解散【${sect.value.name}】？全体 ${sect.value.member_count} 名门人将散去，此举不可撤销！`
    )
  )
    return
  busy.value = true
  try {
    const r = await apiSectDisband(sect.value.id)
    if (r.user) auth.setUser(r.user)
    toast.success('宗门已解散')
    emit('changed')
    emit('close')
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

// 人事变动（任免/逐出/传位）后：刷新详情（宗主可能已易位）并上抛
async function onMembersChanged() {
  await load()
  emit('changed')
}

// 修订资料成功：落最新宗门视图并上抛
function onUpdated(r) {
  editVisible.value = false
  if (r?.sect) sect.value = r.sect
  toast.success('宗门资料已修订')
  emit('changed')
}

function fmt(t) {
  return fmtDateTime(t)
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <button class="x" @click="emit('close')" title="关闭">×</button>

      <template v-if="loading">
        <p class="state">正在查阅仙门名录…</p>
      </template>
      <template v-else-if="error">
        <p class="state err">{{ error }}</p>
      </template>
      <template v-else-if="sect">
        <!-- 背景横幅（无背景则用默认洞府图） -->
        <div
          class="banner"
          :style="{ backgroundImage: `url(${sect.background || dongfuImg})` }"
        >
          <UserAvatar class="s-ava" :avatar="sect.avatar" :name="sect.name" :size="64" />
        </div>

        <h3 class="name">{{ sect.name }}</h3>
        <p class="req">
          入门要求：{{ sect.realm_req ? sect.realm_req + '及以上' : '无要求，来者皆客' }}
          <template v-if="my">｜道友现居「{{ my.position_name }}」之位</template>
        </p>

        <dl class="info">
          <div>
            <dt>宗主</dt>
            <dd>{{ sect.leader_name || '—' }}<small v-if="sect.leader_realm_name">（{{ sect.leader_realm_name }}）</small></dd>
          </div>
          <div><dt>宗门人数</dt><dd>{{ sect.member_count }} 人</dd></div>
          <div><dt>活跃度</dt><dd>{{ sect.activity }}</dd></div>
          <div><dt>创建时间</dt><dd>{{ fmt(sect.created_time) }}</dd></div>
        </dl>

        <div class="intro">
          <h4>宗门简介</h4>
          <p>{{ sect.intro || '此宗尚无简介，一切尽在不言中。' }}</p>
        </div>

        <p v-if="canJoin && !realmEnough" class="deny">
          此宗收徒须【{{ sect.realm_req }}】及以上境界，道友修为尚浅
        </p>

        <div class="btns">
          <button class="btn ghost" :disabled="busy" @click="membersVisible = true">门人名录</button>
          <button
            v-if="canJoin"
            class="btn gold"
            :disabled="busy || !realmEnough"
            @click="join"
          >拜入此宗</button>
          <button
            v-if="canEditInfo"
            class="btn gold"
            :disabled="busy"
            @click="editVisible = true"
          >修订资料</button>
          <button v-if="isLeader" class="btn danger" :disabled="busy" @click="disband">解散宗门</button>
          <button v-else-if="my" class="btn danger" :disabled="busy" @click="quit">退出宗门</button>
          <button v-if="!my && !canJoin" class="btn ghost" @click="emit('close')">知道了</button>
        </div>
      </template>
    </div>

    <!-- 门人名录（含任免/逐出/传位管理） -->
    <SectMembersModal
      :visible="membersVisible"
      :sect-id="sect?.id ?? 0"
      :sect-name="sect?.name ?? ''"
      @close="membersVisible = false"
      @changed="onMembersChanged"
    />

    <!-- 修订宗门资料（复用创建弹窗的编辑模式） -->
    <SectCreateModal
      :visible="editVisible"
      mode="edit"
      :sect="sect"
      :meta="meta"
      @close="editVisible = false"
      @updated="onUpdated"
    />
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 110;
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
  width: min(430px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  padding: 0 0 22px;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background: linear-gradient(160deg, #fbfaf5 0%, #f1f0e9 100%);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow-x: hidden;
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
  z-index: 2;
  font-size: 22px;
  line-height: 1;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  background: none;
  border: none;
  cursor: pointer;
}
.x:hover { color: var(--gold-2, #e6cf93); }

.state {
  margin: 0;
  padding: 46px 24px;
  text-align: center;
  font-size: 14px;
  color: var(--ink-mut);
}
.state.err { color: #b4453b; }

/* 背景横幅 + 压底渐变 + 悬浮宗徽 */
.banner {
  position: relative;
  height: 132px;
  background-size: cover;
  background-position: center;
  margin-bottom: 40px;
}
.banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(30, 28, 22, 0.1), rgba(251, 250, 245, 0.06) 70%, rgba(251, 250, 245, 0.95));
}
.s-ava {
  position: absolute;
  left: 50%;
  bottom: -30px;
  transform: translateX(-50%);
  z-index: 1;
  box-shadow: 0 0 0 4px rgba(251, 250, 245, 0.95);
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #f4e6c2;
  --ava-line: transparent;
}

.name {
  margin: 0 24px 4px;
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink-h);
}
.req {
  margin: 0 24px 14px;
  text-align: center;
  font-size: 12px;
  color: var(--gold);
}

.info {
  margin: 0 24px 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.info > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.info dt {
  font-size: 11px;
  color: var(--ink-mut);
}
.info dd {
  margin: 0;
  font-size: 14px;
  color: var(--ink-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.info dd small { color: var(--ink-mut); font-size: 12px; }

.intro {
  margin: 0 24px 16px;
  padding: 12px 14px;
  text-align: left;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.intro h4 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
  padding-left: 8px;
  border-left: 3px solid var(--gold);
}
.intro p {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
}

.deny {
  margin: -6px 24px 10px;
  text-align: center;
  font-size: 12px;
  color: #b4453b;
}

.btns {
  display: flex;
  gap: 10px;
  margin: 0 24px;
}
.btn {
  flex: 1 1 0;
  padding: 11px 0;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 2px;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
}
.btn.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}
.btn.ghost:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.btn.gold {
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  box-shadow: 0 6px 16px -8px rgba(184, 147, 63, 0.8);
}
.btn.gold:hover:not(:disabled) { filter: brightness(1.05); }
.btn.danger {
  color: #b4453b;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(180, 69, 59, 0.4);
}
.btn.danger:hover:not(:disabled) { background: rgba(180, 69, 59, 0.08); border-color: #b4453b; }
.btn:disabled { opacity: 0.55; cursor: default; box-shadow: none; }
</style>
