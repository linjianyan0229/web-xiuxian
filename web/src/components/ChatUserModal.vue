<script setup>
import { computed, ref, watch } from 'vue'
import UserAvatar from './UserAvatar.vue'
import boyImg from '../../image/boy.webp'
import girlImg from '../../image/girl.webp'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/toast.js'
import {
  apiRelation,
  apiFriendRequest,
  apiFriendAccept,
  apiBlock,
  apiUnblock,
} from '../api/game.js'

// 世界频道用户名片：点击频道内某位道友后弹出，展示其公开信息。
// 左侧为性别立绘图，右侧为玩家信息（头像/道号/境界/性别/所属宗门）+ 社交操作按钮。
// 基本信息取自频道消息项本身；关系状态（好友/待通过/拉黑）打开时按 user_id 拉取一次。
const props = defineProps({
  visible: { type: Boolean, default: false },
  user: { type: Object, default: null },
})
const emit = defineEmits(['close', 'private', 'changed'])

const auth = useAuthStore()
const toast = useToast()

const isFemale = computed(() => Number(props.user?.gender) === 2)
const genderLabel = computed(() => (isFemale.value ? '女修' : '男修'))
const genderImg = computed(() => (isFemale.value ? girlImg : boyImg))

// 目标玩家 id（频道消息的发送者）
const targetId = computed(() => Number(props.user?.user_id) || 0)
const isSelf = computed(() => targetId.value === Number(auth.user?.id))

// 关系状态与请求中标记
const rel = ref(null)
const relLoading = ref(false)
const acting = ref(false)

async function loadRelation() {
  if (!targetId.value || isSelf.value) {
    rel.value = null
    return
  }
  relLoading.value = true
  try {
    rel.value = await apiRelation(targetId.value)
  } catch {
    rel.value = null
  } finally {
    relLoading.value = false
  }
}

// 打开或切换查看对象时拉取关系
watch(
  () => [props.visible, targetId.value],
  ([v]) => {
    if (v) loadRelation()
  },
  { immediate: true }
)

// 结交按钮的文案与行为随关系而变
const friendBtn = computed(() => {
  const r = rel.value
  if (!r) return { label: '结交', disabled: true }
  if (r.isBlockedByMe || r.hasBlockedMe) return { label: '结交', disabled: true }
  if (r.isFriend) return { label: '已是道友', disabled: true }
  if (r.incomingRequestId) return { label: '接受结交', disabled: false, action: 'accept' }
  if (r.outgoingPending) return { label: '待通过', disabled: true }
  return { label: '结交', disabled: false, action: 'request' }
})
const blockBtn = computed(() => {
  const r = rel.value
  if (r?.isBlockedByMe) return { label: '解除拉黑', action: 'unblock' }
  return { label: '拉黑', action: 'block' }
})
// 拉黑关系下禁止私信
const canPrivate = computed(() => !(rel.value?.isBlockedByMe || rel.value?.hasBlockedMe))

async function onFriend() {
  const btn = friendBtn.value
  if (btn.disabled || acting.value) return
  acting.value = true
  try {
    if (btn.action === 'accept') {
      await apiFriendAccept(rel.value.incomingRequestId)
      toast.success(`已与【${props.user.dao_name}】结为道友`)
    } else {
      await apiFriendRequest(targetId.value)
      toast.success(`已向【${props.user.dao_name}】发出结交之邀`)
    }
    await loadRelation()
    emit('changed')
  } catch (e) {
    toast.error(e?.response?.data?.error || '操作失败')
  } finally {
    acting.value = false
  }
}

async function onBlock() {
  if (acting.value) return
  const unblock = blockBtn.value.action === 'unblock'
  if (!unblock && !window.confirm(`确定拉黑【${props.user.dao_name}】？将解除既有道友关系。`)) return
  acting.value = true
  try {
    if (unblock) {
      await apiUnblock(targetId.value)
      toast.success('已解除拉黑')
    } else {
      await apiBlock(targetId.value)
      toast.success(`已拉黑【${props.user.dao_name}】`)
    }
    await loadRelation()
    emit('changed')
  } catch (e) {
    toast.error(e?.response?.data?.error || '操作失败')
  } finally {
    acting.value = false
  }
}

function onPrivate() {
  if (!canPrivate.value) {
    toast.info('因拉黑关系，无法传音')
    return
  }
  emit('private', {
    id: targetId.value,
    dao_name: props.user.dao_name,
    avatar: props.user.avatar,
    gender: props.user.gender,
    realm_name: props.user.realm_name,
    sect_name: props.user.sect_name,
  })
}

function onSpar() {
  toast.info('切磋论道尚在开辟，敬请期待')
}
</script>

<template>
  <div v-if="visible && user" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <button class="x" @click="emit('close')">×</button>

      <!-- 左：性别立绘 -->
      <div class="portrait">
        <img :src="genderImg" :alt="genderLabel" />
      </div>

      <!-- 右：玩家信息 -->
      <div class="info">
        <header class="who">
          <UserAvatar class="ava" :avatar="user.avatar" :name="user.dao_name" :size="52" />
          <div class="who-txt">
            <h3 class="name">{{ user.dao_name || '无名散修' }}</h3>
            <span class="realm">{{ user.realm_name || '凡人' }}</span>
          </div>
        </header>

        <dl class="attrs">
          <div><dt>性别</dt><dd>{{ genderLabel }}</dd></div>
          <div><dt>所属宗门</dt><dd>{{ user.sect_name || '散修' }}</dd></div>
        </dl>

        <!-- 社交操作（查看自己时不显示） -->
        <div v-if="!isSelf" class="acts">
          <button class="act" :disabled="friendBtn.disabled || acting || relLoading" @click="onFriend">
            {{ friendBtn.label }}
          </button>
          <button class="act" :disabled="acting" @click="onSpar">切磋</button>
          <button class="act" :disabled="acting || relLoading" @click="onPrivate">私信</button>
          <button class="act danger" :disabled="acting || relLoading" @click="onBlock">
            {{ blockBtn.label }}
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
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(30, 28, 22, 0.42);
  backdrop-filter: blur(2px);
  padding: 20px;
}
.dialog {
  --gold: #b8933f;
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);

  position: relative;
  display: flex;
  width: min(460px, 92vw);
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background:
    radial-gradient(600px 200px at 50% -20%, rgba(255, 255, 255, 0.8), transparent 70%),
    linear-gradient(160deg, #fbfaf5 0%, #f1f0e9 100%);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 24px 60px -20px rgba(40, 38, 30, 0.6);
  animation: pop 0.2s ease-out;
}
@keyframes pop {
  from { transform: scale(0.94); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.x {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 2;
  font-size: 22px;
  line-height: 1;
  color: var(--ink-mut);
  background: none;
  border: none;
  cursor: pointer;
}
.x:hover { color: var(--gold); }

/* 左：性别立绘 */
.portrait {
  flex-shrink: 0;
  width: 172px;
  background: linear-gradient(160deg, #eceae1, #dedbcf);
  border-right: 1px solid var(--line);
}
.portrait img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}

/* 右：玩家信息 */
.info {
  flex: 1;
  min-width: 0;
  padding: 24px 22px 20px;
}
.who {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.ava {
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #fff;
  --ava-line: transparent;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.7);
}
.who-txt { min-width: 0; }
.name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.realm {
  display: inline-block;
  margin-top: 6px;
  font-size: 13px;
  color: var(--gold);
  border: 1px solid rgba(184, 147, 63, 0.55);
  border-radius: 6px;
  padding: 1px 9px;
}
.attrs {
  margin: 12px 0 0;
}
.attrs > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 2px;
  font-size: 14px;
  border-bottom: 1px dashed var(--line);
}
.attrs > div:last-child { border-bottom: none; }
.attrs dt { color: var(--ink-mut); flex-shrink: 0; }
.attrs dd {
  margin: 0;
  color: var(--ink-h);
  font-weight: 500;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 社交操作按钮 */
.acts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 16px;
}
.act {
  padding: 8px 6px;
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(184, 147, 63, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.act:hover:not(:disabled) {
  color: #fff;
  background: linear-gradient(180deg, #cdaa5c, #b8933f);
  border-color: var(--gold);
}
.act:disabled {
  color: var(--ink-mut);
  background: rgba(0, 0, 0, 0.03);
  border-color: var(--line);
  cursor: not-allowed;
}
.act.danger {
  border-color: rgba(180, 69, 58, 0.5);
}
.act.danger:hover:not(:disabled) {
  background: linear-gradient(180deg, #c85a4e, #b4453a);
  border-color: #b4453a;
}

/* 窄屏：立绘收成顶部横幅 */
@media (max-width: 420px) {
  .dialog { flex-direction: column; }
  .portrait {
    width: 100%;
    height: 130px;
    border-right: none;
    border-bottom: 1px solid var(--line);
  }
}
</style>
