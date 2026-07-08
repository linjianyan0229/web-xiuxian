<script setup>
import { computed, nextTick, ref, watch, onUnmounted } from 'vue'
import UserAvatar from './UserAvatar.vue'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/toast.js'
import { apiConversation, apiSendMessage } from '../api/game.js'
import { fmtDateTime } from '../utils/datetime.js'

// 私信会话弹窗：与某位道友一对一传音。
// 打开时拉取往来消息并标记已读，此后每 5 秒轮询增量，输入框发送。
const props = defineProps({
  visible: { type: Boolean, default: false },
  peer: { type: Object, default: null },
})
const emit = defineEmits(['close', 'sent'])

const auth = useAuthStore()
const toast = useToast()

const msgs = ref([])
const input = ref('')
const sending = ref(false)
const loading = ref(false)
const listEl = ref(null)
let timer = null

const meId = computed(() => Number(auth.user?.id))

function fmt(t) {
  return fmtDateTime(t).slice(5, 16) // MM-DD HH:MM
}

function scrollToBottom() {
  nextTick(() => {
    const el = listEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function load(scroll = true) {
  if (!props.peer?.id) return
  try {
    const r = await apiConversation(props.peer.id)
    msgs.value = r.list || []
    if (scroll) scrollToBottom()
  } catch (e) {
    if (loading.value) toast.error(e?.response?.data?.error || '载入失败')
  }
}

async function send() {
  const content = input.value.trim()
  if (!content || sending.value) return
  sending.value = true
  try {
    await apiSendMessage(props.peer.id, content)
    input.value = ''
    await load()
    emit('sent')
  } catch (e) {
    toast.error(e?.response?.data?.error || '传音失败')
  } finally {
    sending.value = false
  }
}

function startPolling() {
  stopPolling()
  timer = setInterval(() => {
    if (!document.hidden) load(false)
  }, 5000)
}
function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => [props.visible, props.peer?.id],
  async ([v]) => {
    if (v && props.peer?.id) {
      loading.value = true
      await load()
      loading.value = false
      startPolling()
    } else {
      stopPolling()
      msgs.value = []
      input.value = ''
    }
  },
  { immediate: true }
)

onUnmounted(stopPolling)
</script>

<template>
  <div v-if="visible && peer" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <header class="d-head">
        <UserAvatar class="ava" :avatar="peer.avatar" :name="peer.dao_name" :size="38" />
        <div class="who">
          <h3 class="name">{{ peer.dao_name || '无名散修' }}</h3>
          <span class="realm">{{ peer.realm_name || '凡人' }}</span>
        </div>
        <button class="x" @click="emit('close')">×</button>
      </header>

      <div ref="listEl" class="d-body">
        <p v-if="loading" class="empty">载入中…</p>
        <template v-else>
          <div
            v-for="m in msgs"
            :key="m.id"
            class="row"
            :class="{ mine: Number(m.sender_id) === meId }"
          >
            <div class="bubble">
              <p class="text">{{ m.content }}</p>
              <span class="time">{{ fmt(m.created_time) }}</span>
            </div>
          </div>
          <p v-if="msgs.length === 0" class="empty">尚无传音，道一句问候吧</p>
        </template>
      </div>

      <div class="d-foot">
        <input
          v-model="input"
          class="ipt"
          type="text"
          maxlength="200"
          placeholder="传音入密…（≤200 字）"
          @keyup.enter="send"
        />
        <button class="send" :disabled="sending || !input.trim()" @click="send">传音</button>
      </div>
    </div>
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
  padding: 20px;
}
.dialog {
  --gold: #b8933f;
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);

  display: flex;
  flex-direction: column;
  width: min(460px, 94vw);
  height: min(72vh, 620px);
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background:
    radial-gradient(700px 220px at 50% -20%, rgba(255, 255, 255, 0.85), transparent 70%),
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
.d-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.d-head .ava {
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #fff;
  --ava-line: transparent;
}
.who { flex: 1 1 auto; min-width: 0; }
.name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--ink-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.realm {
  font-size: 12px;
  color: var(--gold);
}
.x {
  font-size: 22px;
  line-height: 1;
  color: var(--ink-mut);
  background: none;
  border: none;
  cursor: pointer;
}
.x:hover { color: var(--gold); }

.d-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
}
.empty {
  margin: auto;
  text-align: center;
  color: var(--ink-mut);
  font-size: 13px;
}
.row {
  display: flex;
  justify-content: flex-start;
}
.row.mine { justify-content: flex-end; }
.bubble {
  max-width: 76%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.row.mine .bubble {
  background: linear-gradient(160deg, #f3e6c4, #ecdcaf);
  border-color: rgba(184, 147, 63, 0.4);
}
.text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-h);
  word-break: break-word;
  white-space: pre-wrap;
}
.time {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--ink-mut);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.d-foot {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}
.ipt {
  flex: 1 1 auto;
  min-width: 0;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--line);
  border-radius: 8px;
  outline: none;
}
.ipt:focus { border-color: var(--gold); }
.send {
  flex-shrink: 0;
  padding: 0 18px;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 2px;
  color: #fff;
  background: linear-gradient(180deg, #cdaa5c, #b8933f);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
