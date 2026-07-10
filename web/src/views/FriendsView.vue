<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/toast.js'
import UserAvatar from '../components/UserAvatar.vue'
import {
  apiFriends,
  apiFriendAccept,
  apiFriendReject,
  apiFriendRemove,
  apiBlocks,
  apiBlock,
  apiUnblock,
  apiConversations,
  apiConversation,
  apiSendMessage,
} from '../api/game.js'
import { fmtDateTime } from '../utils/datetime.js'
import dongfuImg from '../../image/dongfu.webp'

// 伙伴页（独立路由页）：经典 IM 双栏布局。
//   左栏：会话/好友列表（好友 / 群聊[占位] / 结交请求 / 黑名单 四页签）
//   右栏：选中道友后的私聊区（消息滚动区）+ 底部发送区
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const meId = computed(() => Number(auth.user?.id))

// 左栏页签与各列表数据
const tab = ref('friends')
const friends = ref([])
const requests = ref([])
const blocks = ref([])
const conversations = ref([])
const loading = ref(false)
const acting = ref(false)

// 未读映射：对方 id -> 未读数（取自会话列表）
const unreadMap = computed(() => {
  const m = {}
  for (const c of conversations.value) m[c.id] = Number(c.unread) || 0
  return m
})
const unreadTotal = computed(() =>
  conversations.value.reduce((s, c) => s + (Number(c.unread) || 0), 0)
)
// 「陌生传音」：有私信往来但非好友的对象——后端允许向任意玩家传音，断交后会话也会脱离好友列表，
// 这些会话若不渲染就只剩未读角标没有阅读入口
const friendIdSet = computed(() => new Set(friends.value.map((u) => Number(u.id))))
const blockedIdSet = computed(() => new Set(blocks.value.map((u) => Number(u.id))))
const strangerConvs = computed(() =>
  conversations.value.filter((c) => !friendIdSet.value.has(Number(c.id)))
)
const isPeerFriend = computed(
  () => !!peer.value && friendIdSet.value.has(Number(peer.value.id))
)
// 已拉黑的会话仍可读（历史消息），但发送必被后端 403——输入区禁用并给「解除拉黑」入口
const isPeerBlocked = computed(
  () => !!peer.value && blockedIdSet.value.has(Number(peer.value.id))
)
const tabs = computed(() => [
  { key: 'friends', label: '好友', count: 0 },
  { key: 'groups', label: '群聊', count: 0 },
  { key: 'requests', label: '结交请求', count: requests.value.length },
  { key: 'blocks', label: '黑名单', count: blocks.value.length },
])

function fmt(t) {
  return fmtDateTime(t).slice(5, 16)
}

async function loadAll() {
  loading.value = true
  try {
    const [f, b, c] = await Promise.all([apiFriends(), apiBlocks(), apiConversations()])
    friends.value = f.friends || []
    requests.value = f.requests || []
    blocks.value = b.blocks || []
    conversations.value = c.conversations || []
  } catch (e) {
    toast.error(e?.response?.data?.error || e.message || '载入失败')
  } finally {
    loading.value = false
  }
}

/* ---------- 右栏：私聊会话 ---------- */
const peer = ref(null) // 当前对话的道友
const msgs = ref([])
const chatInput = ref('')
const chatSending = ref(false)
const chatLoading = ref(false)
const bodyEl = ref(null)
let chatTimer = null

function scrollToBottom() {
  nextTick(() => {
    const el = bodyEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function loadChat(scroll = true) {
  if (!peer.value?.id) return
  try {
    const r = await apiConversation(peer.value.id)
    msgs.value = r.list || []
    if (r.peer) peer.value = { ...peer.value, ...r.peer }
    if (scroll) scrollToBottom()
    // 拉取会刷新已读态，同步会话列表的未读角标
    refreshConversationsQuietly()
  } catch (e) {
    if (chatLoading.value) toast.error(e?.response?.data?.error || '载入失败')
  }
}

async function refreshConversationsQuietly() {
  try {
    const c = await apiConversations()
    conversations.value = c.conversations || []
  } catch {
    /* 静默 */
  }
}

async function selectPeer(u) {
  stopChatPolling()
  peer.value = {
    id: u.id,
    dao_name: u.dao_name,
    avatar: u.avatar,
    gender: u.gender,
    realm_name: u.realm_name,
    sect_name: u.sect_name,
    is_online: u.is_online,
  }
  msgs.value = []
  chatInput.value = ''
  chatLoading.value = true
  await loadChat()
  chatLoading.value = false
  startChatPolling()
}

function closeChat() {
  stopChatPolling()
  peer.value = null
  msgs.value = []
}

async function sendChat() {
  const content = chatInput.value.trim()
  if (!content || chatSending.value || !peer.value) return
  chatSending.value = true
  try {
    await apiSendMessage(peer.value.id, content)
    chatInput.value = ''
    await loadChat()
  } catch (e) {
    toast.error(e?.response?.data?.error || '传音失败')
  } finally {
    chatSending.value = false
  }
}

function startChatPolling() {
  stopChatPolling()
  chatTimer = setInterval(() => {
    if (!document.hidden && peer.value) loadChat(false)
  }, 5000)
}
function stopChatPolling() {
  if (chatTimer) {
    clearInterval(chatTimer)
    chatTimer = null
  }
}

/* ---------- 好友/请求/拉黑操作 ---------- */
async function runAction(fn, okMsg) {
  if (acting.value) return
  acting.value = true
  try {
    await fn()
    if (okMsg) toast.success(okMsg)
    await loadAll()
  } catch (e) {
    toast.error(e?.response?.data?.error || '操作失败')
  } finally {
    acting.value = false
  }
}

function accept(r) {
  runAction(() => apiFriendAccept(r.friendship_id), `已与【${r.dao_name}】结为道友`)
}
function reject(r) {
  runAction(() => apiFriendReject(r.friendship_id), '已婉拒')
}
function removeFriend(u) {
  if (!window.confirm(`确定与【${u.dao_name}】断交？`)) return
  if (peer.value?.id === u.id) closeChat()
  runAction(() => apiFriendRemove(u.id), '已断交')
}
function blockFromChat(u) {
  if (!window.confirm(`确定拉黑【${u.dao_name}】？将解除道友关系。`)) return
  if (peer.value?.id === u.id) closeChat()
  runAction(() => apiBlock(u.id), `已拉黑【${u.dao_name}】`)
}
function unblock(u) {
  runAction(() => apiUnblock(u.id), '已解除拉黑')
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchProfile()
    } catch {
      return
    }
  }
  loadAll()
})
onUnmounted(stopChatPolling)
</script>

<template>
  <div class="friends-page" :style="{ backgroundImage: `url(${dongfuImg})` }">
    <div class="veil">
      <!-- 顶栏 -->
      <header class="topbar">
        <button class="back" @click="router.push({ name: 'home' })">‹ 返回洞府</button>
        <h1 class="title">道友往来</h1>
        <button class="refresh" :disabled="loading" @click="loadAll">刷新</button>
      </header>

      <!-- IM 双栏 -->
      <div class="im">
        <!-- 左栏：列表 -->
        <aside class="side">
          <div class="side-tabs">
            <button
              v-for="t in tabs"
              :key="t.key"
              class="stab"
              :class="{ active: tab === t.key }"
              @click="tab = t.key"
            >
              {{ t.label }}
              <span v-if="t.count" class="stab-count">{{ t.count > 99 ? '99+' : t.count }}</span>
            </button>
          </div>

          <div class="side-list">
            <p v-if="loading" class="empty sm">载入中…</p>

            <!-- 好友 -->
            <template v-else-if="tab === 'friends'">
              <button
                v-for="u in friends"
                :key="u.id"
                class="li"
                :class="{ sel: peer && peer.id === u.id }"
                @click="selectPeer(u)"
              >
                <UserAvatar class="ava" :avatar="u.avatar" :name="u.dao_name" :size="40" />
                <span class="li-main">
                  <b class="li-nm">{{ u.dao_name }}</b>
                  <small class="li-sub">
                    <i class="dot" :class="{ on: u.is_online }"></i>
                    {{ u.realm_name || '凡人' }} · {{ u.is_online ? '在线' : '离线' }}
                  </small>
                </span>
                <span v-if="unreadMap[u.id]" class="badge">
                  {{ unreadMap[u.id] > 99 ? '99+' : unreadMap[u.id] }}
                </span>
              </button>
              <p v-if="friends.length === 0" class="empty sm">尚无道友，去世界频道结交吧</p>

              <!-- 陌生传音：非好友的私信会话（点开可读可回） -->
              <template v-if="strangerConvs.length">
                <p class="grp">陌生传音</p>
                <button
                  v-for="c in strangerConvs"
                  :key="'s' + c.id"
                  class="li"
                  :class="{ sel: peer && peer.id === c.id }"
                  @click="selectPeer(c)"
                >
                  <UserAvatar class="ava" :avatar="c.avatar" :name="c.dao_name" :size="40" />
                  <span class="li-main">
                    <b class="li-nm">
                      {{ c.dao_name }}
                      <em v-if="blockedIdSet.has(Number(c.id))" class="blk">已拉黑</em>
                    </b>
                    <small class="li-sub">
                      <i class="dot" :class="{ on: c.is_online }"></i>
                      {{ c.realm_name || '凡人' }} · {{ c.last_content }}
                    </small>
                  </span>
                  <span v-if="unreadMap[c.id]" class="badge">
                    {{ unreadMap[c.id] > 99 ? '99+' : unreadMap[c.id] }}
                  </span>
                </button>
              </template>
            </template>

            <!-- 群聊（占位） -->
            <template v-else-if="tab === 'groups'">
              <div class="soon-box">
                <p class="soon-t">群聊开辟中</p>
                <p class="soon-d">宗门群聊 / 组队论道等功能敬请期待</p>
              </div>
            </template>

            <!-- 结交请求 -->
            <template v-else-if="tab === 'requests'">
              <div v-for="r in requests" :key="r.friendship_id" class="li req">
                <UserAvatar class="ava" :avatar="r.avatar" :name="r.dao_name" :size="40" />
                <span class="li-main">
                  <b class="li-nm">{{ r.dao_name }}</b>
                  <small class="li-sub">{{ r.realm_name || '凡人' }} · {{ fmt(r.created_time) }}</small>
                </span>
                <span class="li-ops">
                  <button class="mini gold" :disabled="acting" @click="accept(r)">应允</button>
                  <button class="mini" :disabled="acting" @click="reject(r)">婉拒</button>
                </span>
              </div>
              <p v-if="requests.length === 0" class="empty sm">暂无结交请求</p>
            </template>

            <!-- 黑名单 -->
            <template v-else>
              <div v-for="u in blocks" :key="u.id" class="li req">
                <UserAvatar class="ava" :avatar="u.avatar" :name="u.dao_name" :size="40" />
                <span class="li-main">
                  <b class="li-nm">{{ u.dao_name }}</b>
                  <small class="li-sub">{{ u.realm_name || '凡人' }}</small>
                </span>
                <span class="li-ops">
                  <button class="mini" :disabled="acting" @click="unblock(u)">解除</button>
                </span>
              </div>
              <p v-if="blocks.length === 0" class="empty sm">黑名单空空如也</p>
            </template>
          </div>
        </aside>

        <!-- 右栏：聊天区 -->
        <section class="main">
          <template v-if="peer">
            <header class="chat-head">
              <UserAvatar class="c-ava" :avatar="peer.avatar" :name="peer.dao_name" :size="40" />
              <div class="c-who">
                <b class="c-nm">{{ peer.dao_name }}</b>
                <small class="c-sub">{{ peer.realm_name || '凡人' }} · {{ peer.sect_name || '散修' }}</small>
              </div>
              <div class="c-ops">
                <button v-if="isPeerFriend" class="mini" :disabled="acting" @click="removeFriend(peer)">断交</button>
                <button v-if="!isPeerBlocked" class="mini danger" :disabled="acting" @click="blockFromChat(peer)">拉黑</button>
                <button v-else class="mini" :disabled="acting" @click="unblock(peer)">解除拉黑</button>
              </div>
            </header>

            <div ref="bodyEl" class="chat-body">
              <p v-if="chatLoading" class="empty">载入中…</p>
              <template v-else>
                <div
                  v-for="m in msgs"
                  :key="m.id"
                  class="msg"
                  :class="{ mine: Number(m.sender_id) === meId }"
                >
                  <div class="bubble">
                    <p class="btxt">{{ m.content }}</p>
                    <span class="btime">{{ fmt(m.created_time) }}</span>
                  </div>
                </div>
                <p v-if="msgs.length === 0" class="empty">尚无传音，道一句问候吧</p>
              </template>
            </div>

            <div class="chat-foot">
              <input
                v-model="chatInput"
                class="c-ipt"
                type="text"
                maxlength="200"
                :disabled="isPeerBlocked"
                :placeholder="isPeerBlocked ? '已拉黑此道友，解除拉黑后方可传音' : '传音入密…（≤200 字，回车发送）'"
                @keyup.enter="sendChat"
              />
              <button
                class="c-send"
                :disabled="isPeerBlocked || chatSending || !chatInput.trim()"
                @click="sendChat"
              >
                传音
              </button>
            </div>
          </template>

          <!-- 未选中会话 -->
          <div v-else class="chat-empty">
            <div class="ce-inner">
              <p class="ce-t">道友往来处</p>
              <p class="ce-d">于左侧择一位道友，与之传音论道</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.friends-page {
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --panel: rgba(251, 250, 245, 0.86);
  --panel-line: rgba(60, 56, 46, 0.16);
  --gold: #b8933f;
  --gold-2: #e6cf93;

  height: 100svh;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background-color: #e2e5df;
  background-size: cover;
  background-position: center;
}
.veil {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 18px 26px 24px;
  background: linear-gradient(180deg, rgba(238, 240, 235, 0.92) 0%, rgba(238, 240, 235, 0.78) 30%, rgba(238, 240, 235, 0.66) 100%);
}

/* 顶栏 */
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.back,
.refresh {
  padding: 8px 14px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  cursor: pointer;
}
.back:hover,
.refresh:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.refresh { margin-left: auto; }
.refresh:disabled { opacity: 0.5; cursor: default; }
.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--ink-h);
}

/* IM 双栏容器 */
.im {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 14px;
}

/* 左栏 */
.side {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
  overflow: hidden;
}
.side-tabs {
  display: flex;
  flex-shrink: 0;
  padding: 6px;
  gap: 2px;
  border-bottom: 1px solid var(--panel-line);
}
.stab {
  position: relative;
  flex: 1 1 0;
  padding: 8px 2px;
  font-family: inherit;
  font-size: 12.5px;
  letter-spacing: 0.5px;
  color: var(--ink-mut);
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.stab:hover { color: var(--ink-h); }
.stab.active {
  color: #4a3a12;
  background: rgba(184, 147, 63, 0.16);
}
.stab-count {
  position: absolute;
  top: 2px;
  right: 6px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  display: inline-grid;
  place-items: center;
  font-size: 10px;
  line-height: 1;
  color: #fff;
  background: #b4453a;
  border-radius: 999px;
}

.side-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.li {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  font-family: inherit;
  text-align: left;
  color: var(--ink);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.li:hover { background: rgba(184, 147, 63, 0.08); }
.li.sel {
  background: rgba(184, 147, 63, 0.14);
  border-color: rgba(184, 147, 63, 0.4);
}
.li.req { cursor: default; }
.li.req:hover { background: transparent; }
.ava {
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #f4e6c2;
  --ava-line: transparent;
  flex-shrink: 0;
}
.li-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.li-nm {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.li-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--ink-mut);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b9b9b0;
  flex-shrink: 0;
}
.dot.on { background: #4a9d5b; }
.badge {
  flex-shrink: 0;
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  display: inline-grid;
  place-items: center;
  font-size: 10.5px;
  line-height: 1;
  color: #fff;
  background: #b4453a;
  border-radius: 999px;
}
.li-ops {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}
.mini {
  padding: 5px 9px;
  font-family: inherit;
  font-size: 12px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(184, 147, 63, 0.45);
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.mini:hover:not(:disabled) { color: #fff; background: linear-gradient(180deg, #cdaa5c, #b8933f); }
.mini:disabled { opacity: 0.5; cursor: not-allowed; }
.mini.gold {
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border-color: rgba(184, 147, 63, 0.6);
}
.mini.gold:hover:not(:disabled) { filter: brightness(1.05); color: #4a3a12; }
.mini.danger { border-color: rgba(180, 69, 58, 0.45); }
.mini.danger:hover:not(:disabled) { background: linear-gradient(180deg, #c85a4e, #b4453a); }

.grp {
  margin: 8px 6px 2px;
  font-size: 11.5px;
  letter-spacing: 2px;
  color: var(--ink-mut);
}
.blk {
  margin-left: 6px;
  padding: 1px 5px;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  color: #b4453a;
  border: 1px solid rgba(180, 69, 58, 0.45);
  border-radius: 6px;
  vertical-align: 1px;
}
.c-ipt:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.soon-box {
  margin: auto;
  padding: 40px 16px;
  text-align: center;
}
.soon-t { margin: 0 0 6px; font-size: 15px; color: var(--ink-h); letter-spacing: 2px; }
.soon-d { margin: 0; font-size: 12px; color: var(--ink-mut); }

/* 右栏 */
.main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
  overflow: hidden;
}
.chat-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--panel-line);
  flex-shrink: 0;
}
.c-ava {
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #f4e6c2;
  --ava-line: transparent;
}
.c-who { flex: 1 1 auto; min-width: 0; }
.c-nm {
  display: block;
  font-size: 16px;
  color: var(--ink-h);
  letter-spacing: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.c-sub { font-size: 12px; color: var(--ink-mut); }
.c-ops { display: flex; gap: 6px; flex-shrink: 0; }

.chat-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg { display: flex; justify-content: flex-start; }
.msg.mine { justify-content: flex-end; }
.bubble {
  max-width: 70%;
  padding: 9px 13px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.msg.mine .bubble {
  background: linear-gradient(160deg, #f3e6c4, #ecdcaf);
  border-color: rgba(184, 147, 63, 0.4);
}
.btxt {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-h);
  word-break: break-word;
  white-space: pre-wrap;
}
.btime {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--ink-mut);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.chat-foot {
  display: flex;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid var(--panel-line);
  flex-shrink: 0;
}
.c-ipt {
  flex: 1 1 auto;
  min-width: 0;
  padding: 10px 14px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  outline: none;
}
.c-ipt:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.15); }
.c-send {
  flex-shrink: 0;
  padding: 0 22px;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 2px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 9px;
  cursor: pointer;
}
.c-send:hover:not(:disabled) { filter: brightness(1.05); }
.c-send:disabled { opacity: 0.5; cursor: not-allowed; }

.chat-empty {
  flex: 1 1 auto;
  display: grid;
  place-items: center;
}
.ce-inner { text-align: center; }
.ce-t { margin: 0 0 8px; font-size: 18px; letter-spacing: 4px; color: var(--ink-h); }
.ce-d { margin: 0; font-size: 13px; color: var(--ink-mut); }

.empty {
  margin: auto;
  padding: 40px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--ink-mut);
}
.empty.sm { padding: 30px 12px; font-size: 13px; }

/* 窄屏：上下堆叠，未选会话时列表占主，选中后聊天占主 */
@media (max-width: 860px) {
  .friends-page { height: auto; min-height: 100svh; overflow: visible; }
  .veil { height: auto; min-height: 100svh; padding: 14px 14px 20px; }
  .im { flex-direction: column; }
  .side { flex: 0 0 auto; max-height: 42vh; }
  .main { min-height: 52vh; }
}
</style>
