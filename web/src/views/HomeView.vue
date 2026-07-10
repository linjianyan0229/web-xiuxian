<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { apiLogout } from '../api/auth.js'
import { apiGameRankings, apiSignInStatus, apiCultivateStatus, apiCultivate, apiPlayerLogs, apiMeditationStatus, apiTodayStats, apiWorldChat, apiWorldChatSend, apiAnnouncements, apiUnreadCount, apiFriends } from '../api/game.js'
import SignInModal from '../components/SignInModal.vue'
import BreakthroughModal from '../components/BreakthroughModal.vue'
import MeditationModal from '../components/MeditationModal.vue'
import UserAvatar from '../components/UserAvatar.vue'
import AvatarModal from '../components/AvatarModal.vue'
import AttributeModal from '../components/AttributeModal.vue'
import ChatUserModal from '../components/ChatUserModal.vue'
import NotificationModal from '../components/NotificationModal.vue'
import PrivateChatModal from '../components/PrivateChatModal.vue'
import { useToast } from '../composables/toast.js'
import boyImg from '../../image/boy.webp'
import girlImg from '../../image/girl.webp'
import logoUrl from '../../image/logo.webp'
import { netStatus } from '../utils/network.js'
import { fmtDateTime } from '../utils/datetime.js'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

// 每日签到
const signStatus = ref(null)
const signVisible = ref(false)

// 修炼（状态 + 冷却倒计时）
const cult = ref(null)
const cultBusy = ref(false)
const nowTick = ref(Date.now())
let tickTimer = null

// 境界突破弹窗
const btVisible = ref(false)

// 更换头像弹窗（点击角色卡头像）
const avatarVisible = ref(false)
// 详细属性弹窗（角色卡「详细属性」按钮）
const attrVisible = ref(false)
// 头像更换成功：后端已回最新用户视图，直接落到登录态并刷新日志
function onAvatarUpdated(u) {
  auth.user = u
  loadLogs()
}

// 打坐（定时挂机修炼）：状态 + 弹窗 + 到期自动结算
const med = ref(null)
const medVisible = ref(false)
const medEndAt = ref(0) // 打坐结束绝对时刻(ms)，以 remainSeconds 客户端锚定
let medSettling = false

// 排行榜（境界/在线/死亡，各前十）
const ranks = ref(null)
const rankTab = ref('realmTop')
const rankTabs = [
  { key: 'realmTop', label: '境界榜' },
  { key: 'onlineTop', label: '在线榜' },
  { key: 'deathTop', label: '死亡榜' },
]

// 左侧功能栏（游戏模块，多数待开发）
const navItems = ['修行', '探索', '功法', '法宝', '丹药', '宗门', '伙伴']

// 世界频道（全服聊天：进页拉最新一批，此后 5 秒一轮增量拉取；发言冷却由服务端把关）
const chatMsgs = ref([])
const chatInput = ref('')
const chatSending = ref(false)
const chatListEl = ref(null)
let chatLastId = 0
let chatTimer = null
let socialTimer = null

// 频道用户名片：点击某条消息的头像/道号弹出该道友公开信息
const chatUser = ref(null)
function openChatUser(m) {
  chatUser.value = m
}

// 社交：私信会话弹窗（名片「私信」打开）+ 未读私信/待处理请求角标（伙伴导航红点）
const privatePeer = ref(null)
const unreadPm = ref(0)
const pendingReq = ref(0)
const socialBadge = computed(() => unreadPm.value + pendingReq.value)

async function loadSocialBadge() {
  try {
    const [u, f] = await Promise.all([apiUnreadCount(), apiFriends()])
    unreadPm.value = Number(u.unread) || 0
    pendingReq.value = (f.requests || []).length
  } catch {
    /* 角标拉取失败不影响主界面 */
  }
}

// 打开私信会话（来自名片「私信」或伙伴弹窗），关闭时刷新角标
function openPrivate(peer) {
  privatePeer.value = peer
}
function closePrivate() {
  privatePeer.value = null
  loadSocialBadge()
}

// 通知（顶栏「通知」按钮）：已发布修仙公告 + 本人系统通知（丹药赠礼等）
// 数据由本页拉取传给 NotificationModal；未读红点以「最新通知签名」与本地已读记录比对
const noticeVisible = ref(false)
const announcements = ref([])
const notices = ref([])
const noticeLoading = ref(false)
const noticeSeen = ref(localStorage.getItem('noticeSeen') || '')

// 最新通知签名：最大公告id : 最大通知id（公告按置顶排序，最大 id 需显式求）
const noticeSig = computed(() => {
  const maxA = announcements.value.reduce((m, a) => Math.max(m, Number(a.id) || 0), 0)
  const maxN = notices.value.reduce((m, n) => Math.max(m, Number(n.id) || 0), 0)
  return `${maxA}:${maxN}`
})
const hasUnread = computed(() => noticeSig.value !== '0:0' && noticeSig.value !== noticeSeen.value)

async function loadNotices() {
  noticeLoading.value = true
  try {
    const r = await apiAnnouncements()
    announcements.value = r.announcements || []
    notices.value = r.notices || []
  } catch {
    /* 通知拉取失败不影响主界面 */
  } finally {
    noticeLoading.value = false
  }
}

function markNoticeSeen() {
  noticeSeen.value = noticeSig.value
  localStorage.setItem('noticeSeen', noticeSeen.value)
}

// 打开通知弹窗：刷新一次数据，并将当前最新签名记为已读（清除红点）
async function openNotice() {
  noticeVisible.value = true
  await loadNotices()
  markNoticeSeen()
}

function scrollChatToBottom() {
  nextTick(() => {
    const el = chatListEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// 追加消息（按 id 去重，客户端最多留 100 条）
function appendChatMsgs(list) {
  if (!list?.length) return
  const known = new Set(chatMsgs.value.map((m) => m.id))
  const fresh = list.filter((m) => !known.has(m.id))
  if (!fresh.length) return
  chatMsgs.value.push(...fresh)
  if (chatMsgs.value.length > 100) {
    chatMsgs.value.splice(0, chatMsgs.value.length - 100)
  }
  chatLastId = chatMsgs.value[chatMsgs.value.length - 1].id
}

async function loadChat() {
  try {
    const r = await apiWorldChat()
    chatMsgs.value = r.list
    chatLastId = r.lastId || 0
    scrollChatToBottom()
  } catch {
    /* 频道拉取失败不影响主界面 */
  }
}

async function pollChat() {
  if (document.hidden) return // 页签后台时省一轮请求
  try {
    const r = await apiWorldChat(chatLastId)
    if (!r.list.length) return
    const el = chatListEl.value
    // 原本就停在底部才跟随滚动，翻看历史时不打断
    const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 40
    appendChatMsgs(r.list)
    if (nearBottom) scrollChatToBottom()
  } catch {
    /* 轮询失败下轮再试 */
  }
}

async function sendChat() {
  const text = chatInput.value.trim()
  if (!text || chatSending.value) return
  chatSending.value = true
  try {
    const r = await apiWorldChatSend(text)
    chatInput.value = ''
    if (r.message) appendChatMsgs([r.message])
    scrollChatToBottom()
  } catch (e) {
    toast.error(e.message)
  } finally {
    chatSending.value = false
  }
}

// 消息时间：MM-DD HH:MM（与修行日志同格式）
function fmtChatTime(t) {
  return fmt(t).slice(5, 16)
}

// 数值格式化：大数转 万/亿
function trimNum(x) {
  return x.toFixed(2).replace(/\.?0+$/, '')
}
function fmtCn(n) {
  const v = Number(n) || 0
  if (v >= 1e8) return trimNum(v / 1e8) + '亿'
  if (v >= 1e4) return trimNum(v / 1e4) + '万'
  return String(v)
}

// 顶部资源栏：全部取自当前玩家真实数据
// 灵石/修为/道韵/道法 存于 users；战力(攻击)/防御/精神力 取自玩家当前境界(realms)
// 道韵/道法按后端 dao_yun/dao_law_unlocked 标志展示——境界未达对应阶段自动隐藏（与详细属性弹窗同规则）
const resources = computed(() => {
  const u = auth.user || {}
  const list = [
    { label: '灵石', value: fmtCn(u.ling_shi) },
    { label: '修为', value: fmtCn(u.cultivation) },
    { label: '生命值', value: fmtCn(u.hp) },
    { label: '战力', value: fmtCn(u.attack) },
    { label: '防御', value: fmtCn(u.defense) },
    { label: '精神力', value: fmtCn(u.spirit) },
  ]
  if (Number(u.dao_yun_unlocked) === 1) list.push({ label: '道韵', value: fmtCn(u.dao_yun) })
  if (Number(u.dao_law_unlocked) === 1) list.push({ label: '道法', value: fmtCn(u.dao_law) })
  list.push({ label: '悟性', value: `${Number(u.comprehension) || 0}%` })
  return list
})
// 常用功能
const funcs = ['纳戒', '传功', '吐纳', '打坐', '炼丹', '炼器', '阵法']
// 修炼增益（凡人无加成）
const buffs = [
  ['修为获取', '+0%'],
  ['灵石获取', '+0%'],
  ['突破几率', '+0%'],
  ['修炼速度', '+0%'],
]
// 今日修炼：真实统计（后端 user_daily_stats 按天累计，/api/user/today）
const todayStats = ref(null)
async function loadToday() {
  try {
    todayStats.value = await apiTodayStats()
  } catch {
    /* 统计拉取失败不影响主界面 */
  }
}
// 秒数 → HH:MM:SS（面板固定带小时位）
function fmtHMS(sec) {
  let s = Math.max(0, Math.floor(Number(sec) || 0))
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const p = (n) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(s)}`
}
const today = computed(() => {
  const t = todayStats.value
  const rate = t?.breakthroughSuccessPercent
  return [
    ['修炼次数', t ? `${t.cultivateCount} 次` : '—'],
    ['打坐时长', t ? fmtHMS(t.meditationSeconds) : '—'],
    ['获得修为', t ? fmtCn(t.cultivationGained) : '—'],
    // 突破几率为当前境界突破成功率（100-雷劫死亡率）；圣人无下一境显示 —
    ['突破几率', t ? (rate == null ? '—' : `${rate}%`) : '—'],
  ]
})

// 时间展示统一按东八区（utils/datetime.js），勿再截 ISO 串
function fmt(t) {
  return fmtDateTime(t)
}

const realmName = computed(() => auth.user?.realm_name || '凡人')

// 性别（1=男 2=女；旧数据缺省按男处理）
const isFemale = computed(() => Number(auth.user?.gender) === 2)
const genderLabel = computed(() => (isFemale.value ? '女修' : '男修'))
// 角色卡背景：按性别绑定立绘（男=web/image/boy.webp，女=web/image/girl.webp，由原 PNG 压制 720 宽）。
// 立绘本身即浅色水墨调，只覆一层轻纱渐变防遮图；文字可读性由 .char 的文字光晕兜底
const charBgStyle = computed(() => ({
  backgroundImage:
    'linear-gradient(180deg, rgba(251, 250, 245, 0.5) 0%, rgba(251, 250, 245, 0.28) 40%, rgba(251, 250, 245, 0.1) 100%), ' +
    `url(${isFemale.value ? girlImg : boyImg})`,
}))

// 修行日志：真实操作记录（注册/登录/签到/修炼等，后端 player_logs 表）
const logRows = ref([])
async function loadLogs() {
  try {
    const r = await apiPlayerLogs()
    logRows.value = r.list
  } catch {
    /* 日志拉取失败不影响主界面 */
  }
}
const logs = computed(() =>
  logRows.value.map((l) => ({
    id: l.id,
    time: fmt(l.created_time).slice(5, 16),
    text: l.content,
    hl: ['register', 'sign_in', 'breakthrough'].includes(l.type),
  }))
)

// 突破结束（晋级或身陨）：玩家境界/资源/属性已变，全量刷新
async function onBreakthroughDone() {
  try {
    await auth.fetchProfile()
  } catch {
    /* 刷新失败保持现状 */
  }
  try {
    cult.value = await apiCultivateStatus()
  } catch {
    /* 同上 */
  }
  loadLogs()
  loadToday()
  try {
    ranks.value = await apiGameRankings()
  } catch {
    /* 榜单刷新失败不影响 */
  }
}

function soon(name) {
  toast.info(`【${name}】尚在开辟，敬请期待`)
}

// 修炼冷却剩余秒数（nowTick 每秒刷新驱动倒计时）
const cultRemain = computed(() => {
  if (!cult.value?.nextCultivateTime) return 0
  const diff = new Date(cult.value.nextCultivateTime).getTime() - nowTick.value
  return diff > 0 ? Math.ceil(diff / 1000) : 0
})

// 当前境界修为进度（advance_exp=0 的境界靠道法晋级，进度视为圆满）
const cultProgress = computed(() => {
  const u = auth.user || {}
  const total = Number(u.advance_exp) || 0
  if (total <= 0) return 100
  return Math.min(100, ((Number(u.cultivation) || 0) / total) * 100)
})

// 修为已圆满（服务端 isFull 为准，签到等本地加修为后也即时判断）
const cultFull = computed(() => {
  if (cult.value?.isFull) return true
  const total = Number(cult.value?.advanceExp) || 0
  return total > 0 && (Number(auth.user?.cultivation) || 0) >= total
})

// 打坐倒计时（以 remainSeconds 锚定 medEndAt，避开时区/时钟漂移）
function anchorMed(status) {
  medEndAt.value =
    status?.meditating && Number(status.remainSeconds) > 0
      ? Date.now() + Number(status.remainSeconds) * 1000
      : 0
}
const medRemain = computed(() => {
  if (!med.value?.meditating || !medEndAt.value) return 0
  return Math.max(0, Math.ceil((medEndAt.value - nowTick.value) / 1000))
})
const medActive = computed(() => !!med.value?.meditating && medRemain.value > 0)
// 秒数 → HH:MM:SS / MM:SS
function fmtClock(sec) {
  let s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const p = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

// 执行修炼：结算修为并进入调息冷却
async function doCultivate() {
  if (cultBusy.value || cultRemain.value > 0 || !cult.value?.gain) return
  cultBusy.value = true
  try {
    const r = await apiCultivate()
    cult.value = r
    if (auth.user) auth.user.cultivation = r.cultivation
    toast.success(`修炼有成，修为 +${fmtCn(r.gained)}`)
    loadLogs()
    loadToday()
  } catch (e) {
    toast.error(e.message)
    // 冷却未到/并发抢先等情况，以服务端状态为准
    try {
      cult.value = await apiCultivateStatus()
    } catch {
      /* 状态刷新失败保持原样 */
    }
  } finally {
    cultBusy.value = false
  }
}

// 打坐功成：修为入账已由后端完成，这里刷新展示并提示
async function onMeditationSettled(settled) {
  toast.success(
    settled.gained > 0
      ? `打坐${settled.label}功成，修为 +${fmtCn(settled.gained)}`
      : `打坐${settled.label}期满，然修为早已圆满`
  )
  try {
    await auth.fetchProfile()
  } catch {
    /* 刷新失败保持现状 */
  }
  try {
    cult.value = await apiCultivateStatus()
  } catch {
    /* 同上 */
  }
  loadLogs()
  loadToday()
  try {
    ranks.value = await apiGameRankings()
  } catch {
    /* 同上 */
  }
}

// 打坐到期结算（后台：仅弹窗关闭时由本页负责，弹窗打开时交给弹窗以免重复）
async function settleMeditationBg() {
  if (medSettling) return
  medSettling = true
  try {
    const s = await apiMeditationStatus()
    med.value = s
    anchorMed(s)
    if (s.settled) onMeditationSettled(s.settled)
  } catch {
    /* 结算失败下次交互再补 */
  } finally {
    medSettling = false
  }
}

// 弹窗内「开始打坐」成功：同步本页状态并进入倒计时
function onMeditationStarted(status) {
  med.value = status
  anchorMed(status)
  toast.info(`收摄心神，盘膝入定（${status.durationLabel || '打坐'}）`)
  loadLogs()
}

// 弹窗内「出定结算」回抛：同步状态并走统一结算展示
function onMeditationModalSettled(status) {
  med.value = status
  anchorMed(status)
  if (status.settled) onMeditationSettled(status.settled)
}

function openMeditation() {
  medVisible.value = true
}

// 常用功能点击：打坐进入定时挂机弹窗，其余暂为占位
function onFunc(name) {
  if (name === '打坐') openMeditation()
  else soon(name)
}

// 左侧导航点击：丹药/宗门/伙伴进入各自独立页，修行为当前页，其余暂为占位
// 宗门按归属分流：已入宗 → 我的宗门主页；散修 → 天下宗门列表
function onNav(name, index) {
  if (index === 0) return
  if (name === '丹药') router.push({ name: 'pills' })
  else if (name === '宗门') router.push({ name: auth.user?.sect_id ? 'my-sect' : 'sect' })
  else if (name === '伙伴') router.push({ name: 'friends' })
  else soon(name)
}

// 打坐倒计时归零：弹窗关闭时由本页自动结算（弹窗打开时交给弹窗，避免重复结算/提示）
watch(medRemain, (r, prev) => {
  if (!medVisible.value && med.value?.meditating && r === 0 && prev > 0) {
    settleMeditationBg()
  }
})

async function onLogout() {
  await apiLogout().catch(() => {})
  auth.logout()
  router.replace({ name: 'login' })
}

// 手动打开签到弹窗（先刷新一次状态）
async function openSign() {
  try {
    signStatus.value = await apiSignInStatus()
  } catch {
    /* 拉取失败则用已有状态兜底 */
  }
  signVisible.value = true
}

// 签到成功：即时更新对应资源（修为/道韵/道法）与状态（转为冷却态）
function onSigned(payload) {
  if (auth.user) {
    auth.user.cultivation = payload.cultivation
    auth.user.dao_yun = payload.dao_yun
    auth.user.dao_law = payload.dao_law
  }
  if (signStatus.value) {
    signStatus.value = {
      ...signStatus.value,
      canSignIn: false,
      lastSignTime: payload.lastSignTime,
      nextSignTime: payload.nextSignTime,
    }
  }
  loadLogs()
  loadToday()
}

onMounted(async () => {
  try {
    await auth.fetchProfile()
  } catch {
    auth.logout()
    router.replace({ name: 'login' })
    return
  }
  try {
    ranks.value = await apiGameRankings()
  } catch {
    /* 榜单拉取失败不影响主界面 */
  }
  try {
    signStatus.value = await apiSignInStatus()
    // 满足条件（功能开启且满24小时）时自动弹出签到窗口
    if (signStatus.value.canSignIn) signVisible.value = true
  } catch {
    /* 签到状态拉取失败不影响主界面 */
  }
  // 打坐状态先于修炼状态拉取：让打坐接口负责结算离线到期的场次（返回 settled 以刷新 HUD/提示），
  // 否则修炼状态接口会先行惰性结算而拿不到 settled，导致修为增长不即时反映到资源栏
  try {
    med.value = await apiMeditationStatus()
    anchorMed(med.value)
    // 进入首页时若上一场打坐已到期，惰性结算的结果即时展示
    if (med.value.settled) onMeditationSettled(med.value.settled)
  } catch {
    /* 打坐状态拉取失败不影响主界面 */
  }
  try {
    cult.value = await apiCultivateStatus()
  } catch {
    /* 修炼状态拉取失败不影响主界面 */
  }
  loadLogs()
  loadToday()
  loadChat()
  loadNotices() // 背景拉取通知，用于未读红点（不弹窗）
  loadSocialBadge() // 未读私信 + 待处理结交请求角标
  tickTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
  chatTimer = setInterval(pollChat, 5000)
  socialTimer = setInterval(() => {
    if (!document.hidden) loadSocialBadge()
  }, 30000)
})

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
  if (chatTimer) clearInterval(chatTimer)
  if (socialTimer) clearInterval(socialTimer)
})
</script>

<template>
  <div class="hud">
    <!-- 顶部栏 -->
    <header class="topbar">
      <div class="brand">
        <img class="brand-logo" :src="logoUrl" alt="文字修仙" />
        <div class="brand-text">
          <h1>文字修仙</h1>
          <p>道心如砥 · 长生可期</p>
        </div>
      </div>
      <div class="resources">
        <span v-for="r in resources" :key="r.label" class="res">
          <i>◆</i>{{ r.label }} <b>{{ r.value }}</b>
        </span>
      </div>
      <div class="top-actions">
        <button
          class="icon-btn sign-btn"
          :class="{ ready: signStatus?.canSignIn }"
          @click="openSign"
          title="每日签到"
        >
          签
        </button>
        <button class="icon-btn notice-btn" @click="openNotice" title="通知">
          ✉
          <span v-if="hasUnread" class="notice-dot"></span>
        </button>
        <button class="leave" @click="onLogout">离山</button>
      </div>
    </header>

    <div class="body" v-if="auth.user">
      <!-- 左侧功能栏 -->
      <nav class="rail">
        <button
          v-for="(n, i) in navItems"
          :key="n"
          class="rail-item"
          :class="{ active: i === 0 }"
          @click="onNav(n, i)"
        >
          {{ n }}
          <span v-if="n === '伙伴' && socialBadge" class="rail-badge">
            {{ socialBadge > 99 ? '99+' : socialBadge }}
          </span>
        </button>
      </nav>

      <!-- 角色卡（背景立绘按性别绑定） -->
      <aside class="card char" :style="charBgStyle">
        <div class="char-head">
          <button class="avatar-btn" title="更换头像" @click="avatarVisible = true">
            <UserAvatar :avatar="auth.user.avatar" :name="auth.user.dao_name" :size="52" />
            <span class="ava-edit">换</span>
          </button>
          <div class="who">
            <span class="tag">道友</span>
            <h2>{{ auth.user.dao_name }}</h2>
          </div>
        </div>
        <dl class="char-stats">
          <div><dt>境界</dt><dd class="gold">{{ realmName }}</dd></div>
          <div><dt>性别</dt><dd>{{ genderLabel }}</dd></div>
          <div><dt>宗门</dt><dd class="ellip">{{ auth.user.sect_name || '散修' }}</dd></div>
          <div><dt>状态</dt><dd>{{ auth.user.status === 1 ? '正常' : '禁用' }}</dd></div>
          <div><dt>入道</dt><dd>{{ fmt(auth.user.register_time) }}</dd></div>
          <div><dt>上次登录</dt><dd>{{ fmt(auth.user.login_time) }}</dd></div>
          <div><dt>邮箱</dt><dd class="ellip">{{ auth.user.email }}</dd></div>
        </dl>
        <!-- 修炼增益（自中列移入；凡人无加成，功法/丹药系统接入后走真实数据） -->
        <div class="char-buffs">
          <h4>修炼增益</h4>
          <div class="buff-grid">
            <div v-for="b in buffs" :key="b[0]" class="buff">
              <span>{{ b[0] }}</span><b>{{ b[1] }}</b>
            </div>
          </div>
        </div>
        <button class="ghost-btn" @click="attrVisible = true">详细属性 ›</button>
      </aside>

      <!-- 中间：境界 + 常用功能 -->
      <main class="mid">
        <section class="card realm">
          <h3 class="panel-title">境界</h3>
          <div class="realm-name">{{ realmName }}</div>
          <div class="cultivate-info">
            修为：{{ fmtCn(auth.user.cultivation) }}<template v-if="Number(auth.user.advance_exp) > 0"> / {{ fmtCn(auth.user.advance_exp) }}</template>
          </div>
          <div class="bar"><span :style="{ width: cultProgress + '%' }"></span></div>
          <div class="cultivate-sub">
            <template v-if="medActive">入定打坐中 · 心神归一，静候出定，期满自得修为</template>
            <template v-else-if="!cult">修炼准备中…</template>
            <template v-else-if="cultFull">修为已臻圆满，天时已至，可尝试突破境界</template>
            <template v-else-if="cult.gain > 0">每次修炼 +{{ fmtCn(cult.gain) }} 修为 · 调息 {{ cult.cooldownSeconds }} 秒</template>
            <template v-else>此境已非打坐可进，需另觅道法机缘</template>
          </div>
          <button v-if="medActive" class="gold-btn" disabled>入定中 · {{ fmtClock(medRemain) }}</button>
          <button v-else-if="cultFull" class="gold-btn breakthrough" @click="btVisible = true">
            突 破
          </button>
          <button
            v-else
            class="gold-btn"
            :disabled="!cult || cult.gain <= 0 || cultRemain > 0 || cultBusy"
            @click="doCultivate"
          >
            {{ cultRemain > 0 ? `调息中 ${cultRemain}s` : cultBusy ? '修炼中…' : '开始修炼' }}
          </button>
        </section>

        <section class="card funcs">
          <h3 class="panel-title">常用功能</h3>
          <div class="func-row">
            <button
              v-for="f in funcs"
              :key="f"
              class="func"
              :class="{ meditating: f === '打坐' && medActive }"
              @click="onFunc(f)"
            >
              <span class="func-ico">{{ f.slice(0, 1) }}</span>
              <span class="func-lbl">{{ f === '打坐' && medActive ? fmtClock(medRemain) : f }}</span>
            </button>
          </div>
        </section>

        <!-- 世界频道（全服聊天，5 秒轮询增量拉取） -->
        <section class="card chat">
          <h3 class="panel-title">世界频道</h3>
          <div ref="chatListEl" class="chat-list">
            <div
              v-for="m in chatMsgs"
              :key="m.id"
              class="chat-msg"
              :class="{ mine: m.user_id === auth.user.id }"
            >
              <UserAvatar
                class="chat-ava"
                :avatar="m.avatar"
                :name="m.dao_name"
                :size="24"
                @click="openChatUser(m)"
              />
              <div class="chat-main">
                <div class="chat-meta">
                  <span class="chat-name" @click="openChatUser(m)">{{ m.dao_name || '无名散修' }}</span>
                  <span class="chat-realm">{{ m.realm_name || '凡人' }}</span>
                  <span class="chat-time">{{ fmtChatTime(m.created_time) }}</span>
                </div>
                <p class="chat-text">{{ m.content }}</p>
              </div>
            </div>
            <p v-if="chatMsgs.length === 0" class="chat-empty">此界静谧，尚无道友传音</p>
          </div>
          <form class="chat-form" @submit.prevent="sendChat">
            <input
              v-model="chatInput"
              type="text"
              maxlength="200"
              placeholder="传音此界，与众道友论道…"
            />
            <button type="submit" class="chat-send" :disabled="chatSending || !chatInput.trim()">
              {{ chatSending ? '传音中' : '传音' }}
            </button>
          </form>
        </section>
      </main>

      <!-- 右侧：排行榜 + 今日修炼 + 修行日志 -->
      <aside class="side">
        <section class="card ranks">
          <div class="ranks-head">
            <h3 class="panel-title">修仙榜</h3>
            <div class="tabs">
              <button
                v-for="t in rankTabs"
                :key="t.key"
                class="tab"
                :class="{ active: rankTab === t.key }"
                @click="rankTab = t.key"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
          <ol class="rank-list" v-if="ranks">
            <li v-for="(row, i) in ranks[rankTab]" :key="row.id">
              <span class="rk" :class="'rk-' + (i + 1)">{{ i + 1 }}</span>
              <UserAvatar class="rk-ava" :avatar="row.avatar" :name="row.dao_name" :size="24" />
              <span class="rk-name">{{ row.dao_name }}</span>
              <!-- 在线榜：网络状态（心跳延迟/掉线） -->
              <span
                v-if="rankTab === 'onlineTop'"
                class="rk-net"
                :class="'net-' + netStatus(row).key"
                title="网络状态"
              >
                <i></i>{{ netStatus(row).label }}
              </span>
              <span class="rk-val">
                {{ rankTab === 'deathTop' ? row.death_count + ' 次' : (row.realm_name || '凡人') }}
              </span>
            </li>
            <li v-if="ranks[rankTab].length === 0" class="rk-empty">
              {{ rankTab === 'deathTop' ? '尚无道友陨落' : rankTab === 'onlineTop' ? '暂无道友在线' : '暂无排名' }}
            </li>
          </ol>
          <p v-else class="rk-loading">榜单加载中…</p>
        </section>

        <section class="card">
          <h3 class="panel-title">今日修炼</h3>
          <dl class="kv">
            <div v-for="t in today" :key="t[0]"><dt>{{ t[0] }}</dt><dd>{{ t[1] }}</dd></div>
          </dl>
        </section>
        <section class="card log-card">
          <h3 class="panel-title">修行日志</h3>
          <ul class="log">
            <li v-for="l in logs" :key="l.id">
              <span class="log-text" :class="{ hl: l.hl }">{{ l.text }}</span>
              <span class="log-time">{{ l.time }}</span>
            </li>
            <li v-if="logs.length === 0">
              <span class="log-text">尚无修行记录，且去打坐修炼一番。</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <!-- 每日签到弹窗 -->
    <SignInModal
      :visible="signVisible"
      :status="signStatus"
      @close="signVisible = false"
      @signed="onSigned"
    />

    <!-- 境界突破 -->
    <BreakthroughModal
      :visible="btVisible"
      @close="btVisible = false"
      @done="onBreakthroughDone"
    />

    <!-- 打坐入定 -->
    <MeditationModal
      :visible="medVisible"
      @close="medVisible = false"
      @started="onMeditationStarted"
      @settled="onMeditationModalSettled"
    />

    <!-- 更换头像（上传本地图片或外链 URL，成功后回抛最新用户视图） -->
    <AvatarModal
      :visible="avatarVisible"
      :avatar="auth.user?.avatar || ''"
      :name="auth.user?.dao_name || ''"
      @close="avatarVisible = false"
      @updated="onAvatarUpdated"
    />

    <!-- 详细属性（道韵/道法按境界解锁标志自动隐藏） -->
    <AttributeModal
      :visible="attrVisible"
      :user="auth.user"
      @close="attrVisible = false"
    />

    <!-- 世界频道用户名片（点击频道内道友弹出；含结交/切磋/私信/拉黑操作） -->
    <ChatUserModal
      :visible="!!chatUser"
      :user="chatUser"
      @close="chatUser = null"
      @private="openPrivate"
      @changed="loadSocialBadge"
    />

    <!-- 私信会话（一对一传音；由频道名片「私信」打开；伙伴列表在独立 /friends 页） -->
    <PrivateChatModal
      :visible="!!privatePeer"
      :peer="privatePeer"
      @close="closePrivate"
      @sent="loadSocialBadge"
    />

    <!-- 通知（修仙公告 + 系统通知；顶栏「通知」按钮打开） -->
    <NotificationModal
      :visible="noticeVisible"
      :announcements="announcements"
      :notices="notices"
      :loading="noticeLoading"
      @close="noticeVisible = false"
    />
  </div>
</template>

<style scoped>
.hud {
  /* 自成一套水墨浅色主题，不随系统深浅变化，贴合参考图 */
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --panel: rgba(251, 250, 245, 0.86);
  --panel-line: rgba(60, 56, 46, 0.14);
  --gold: #b8933f;
  --gold-2: #e6cf93;
  --rail-bg: #23262b;
  --rail-line: rgba(255, 255, 255, 0.08);

  height: 100svh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background:
    radial-gradient(1200px 500px at 70% -10%, rgba(255, 255, 255, 0.7), transparent 60%),
    radial-gradient(900px 600px at 10% 110%, rgba(190, 196, 188, 0.5), transparent 60%),
    linear-gradient(160deg, #eceee9 0%, #e2e5df 45%, #d7dbd4 100%);
}

/* 顶部栏 */
.topbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 26px;
  border-bottom: 1px solid var(--panel-line);
  background: rgba(255, 255, 255, 0.28);
}
/* 顶栏品牌：项目 logo + 标题 */
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-logo {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  object-fit: contain;
  filter: drop-shadow(0 3px 8px rgba(40, 90, 84, 0.3));
}
.brand h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink-h);
}
.brand p {
  margin: 2px 0 0;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--ink-mut);
}
.resources {
  display: flex;
  gap: 10px;
  flex: 1 1 auto;
  flex-wrap: wrap;
  justify-content: center;
}
.res {
  font-size: 13px;
  color: var(--ink);
  padding: 5px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid var(--panel-line);
  white-space: nowrap;
}
.res i {
  color: var(--gold);
  margin-right: 6px;
  font-style: normal;
}
.res b {
  color: var(--ink-h);
  margin-left: 4px;
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-btn {
  width: 34px;
  height: 34px;
  font-size: 15px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  cursor: pointer;
}
.icon-btn:hover { color: var(--gold); }
.sign-btn {
  font-family: inherit;
  font-weight: 700;
}
.sign-btn.ready {
  color: var(--gold);
  border-color: var(--gold);
  animation: signPulse 1.6s ease-in-out infinite;
}
@keyframes signPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(184, 147, 63, 0); }
  50% { box-shadow: 0 0 0 4px rgba(184, 147, 63, 0.2); }
}
/* 通知按钮：未读时右上角赤色小红点 */
.notice-btn { position: relative; }
.notice-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #b4453a;
  box-shadow: 0 0 0 2px var(--panel, #fbfaf5);
}
.leave {
  padding: 7px 16px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  cursor: pointer;
}
.leave:hover { color: var(--gold); border-color: var(--gold); }

/* 主体：左栏 + 三列，整体锁定在一屏内 */
.body {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 96px 300px 1fr 320px;
  grid-template-rows: minmax(0, 1fr);
  gap: 16px;
  padding: 16px 20px 20px;
  align-items: stretch;
}

/* 左两列在列内自行滚动（隐藏滚动条），避免整页出现滚动条 */
.rail,
.char {
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.rail::-webkit-scrollbar,
.char::-webkit-scrollbar {
  width: 0;
  height: 0;
}
/* 中右两列不整列滚动：作为定高 flex 容器锁在一屏内，
   滚动交给内部占余高的卡片（中列「世界频道」/右列「修行日志」） */
.mid,
.side {
  min-height: 0;
  max-height: 100%;
}

/* 左侧功能栏 */
.rail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
  background: var(--rail-bg);
  border-radius: 14px;
}
.rail-item {
  position: relative;
  padding: 12px 0;
  font-family: inherit;
  font-size: 17px;
  letter-spacing: 3px;
  color: #b9bcc2;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.rail-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: inline-grid;
  place-items: center;
  font-size: 10px;
  line-height: 1;
  letter-spacing: 0;
  color: #fff;
  background: #b4453a;
  border-radius: 999px;
}
.rail-item:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
.rail-item.active {
  color: #f4e6c2;
  background: linear-gradient(180deg, rgba(184, 147, 63, 0.35), rgba(184, 147, 63, 0.12));
  box-shadow: inset 0 0 0 1px rgba(230, 207, 147, 0.4);
}

/* 通用面板 */
.card {
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
  backdrop-filter: blur(2px);
}
.panel-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
  padding-left: 10px;
  border-left: 3px solid var(--gold);
}

/* 角色卡（背景立绘竖版 720x1280 webp，裁上半身居中）；
   蒙版已减淡，卡内文字用宣纸色光晕保证立绘深色处（发丝等）依然可读 */
.char {
  background-size: cover;
  background-position: center top;
  text-shadow:
    0 0 4px rgba(251, 250, 245, 0.95),
    0 0 10px rgba(251, 250, 245, 0.8);
}
.char-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
/* 角色卡头像：可点击更换（悬停浮现「换」角标）；占位配色沿用原水墨深色圆底 */
.avatar-btn {
  position: relative;
  flex-shrink: 0;
  padding: 0;
  background: none;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5);
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #fff;
  --ava-line: transparent;
}
.ava-edit {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  font-size: 11px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s;
}
.avatar-btn:hover .ava-edit { opacity: 1; }
.who .tag {
  font-size: 11px;
  color: var(--ink-mut);
  border: 1px solid var(--panel-line);
  padding: 1px 7px;
  border-radius: 6px;
}
.who h2 {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--ink-h);
}
.char-stats {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.char-stats > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 4px;
  border-bottom: 1px dashed var(--panel-line);
  font-size: 14px;
}
.char-stats dt {
  color: var(--ink-mut);
  flex-shrink: 0;
}
.char-stats dd {
  margin: 0;
  color: var(--ink-h);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.char-stats dd.gold { color: var(--gold); font-weight: 700; }
.ellip { max-width: 160px; }
.ghost-btn {
  width: 100%;
  margin-top: 14px;
  padding: 10px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.35);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  cursor: pointer;
}
.ghost-btn:hover { color: var(--gold); border-color: var(--gold); }

/* 中列：境界/常用功能定高，「世界频道」占余高（同右列日志卡模式） */
.mid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.mid > section:not(.chat) {
  flex: 0 0 auto;
}
/* 境界卡整体压紧，给下方「世界频道」让出高度 */
.realm {
  text-align: center;
  padding-top: 14px;
  padding-bottom: 14px;
}
.realm .panel-title { margin-bottom: 8px; }
.realm-name {
  margin: 4px 0 4px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 5px;
  color: var(--gold);
  text-shadow: 0 2px 10px rgba(184, 147, 63, 0.25);
}
.cultivate-info { font-size: 14px; color: var(--ink); }
.bar {
  height: 10px;
  margin: 8px auto;
  max-width: 460px;
  background: rgba(60, 56, 46, 0.12);
  border-radius: 999px;
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--gold-2), var(--gold));
  border-radius: 999px;
}
.cultivate-sub { font-size: 12px; color: var(--ink-mut); }
.gold-btn {
  margin-top: 10px;
  padding: 9px 34px;
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 3px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 6px 16px -8px rgba(184, 147, 63, 0.8);
}
.gold-btn:hover:not(:disabled) { filter: brightness(1.05); }
.gold-btn:disabled {
  opacity: 0.55;
  cursor: default;
  box-shadow: none;
}
/* 突破按钮：赤金色调，与日常修炼区分 */
.gold-btn.breakthrough {
  color: #4a2012;
  background: linear-gradient(180deg, #f0c39c, #d4794b);
  border-color: rgba(184, 105, 63, 0.6);
  box-shadow: 0 6px 16px -8px rgba(184, 105, 63, 0.8);
}

.buff-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 22px;
}
.buff {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--panel-line);
}
.buff span { color: var(--ink-mut); }
.buff b { color: var(--gold); }
/* 角色卡内「修炼增益」小节（自中列移入）：窄卡里网格收紧 */
.char-buffs { margin-top: 14px; }
.char-buffs h4 {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
  padding-left: 8px;
  border-left: 3px solid var(--gold);
}
.char-buffs .buff-grid { gap: 2px 14px; }
.char-buffs .buff { font-size: 13px; }

.func-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: space-between;
}
.func {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.func-ico {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  font-size: 18px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
  border-radius: 50%;
  transition: border-color 0.15s, color 0.15s;
}
.func:hover .func-ico { color: var(--gold); border-color: var(--gold); }
.func-lbl { font-size: 12px; color: var(--ink); }
/* 打坐进行中：高亮并显示剩余时间 */
.func.meditating .func-ico {
  color: var(--gold);
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.16);
}
.func.meditating .func-lbl {
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}

/* 世界频道：占中列余高（不把列撑高），消息区内部滚动 */
.card.chat {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 160px;
  overflow: hidden;
}
.card.chat .panel-title {
  flex: 0 0 auto;
}
.chat-list {
  flex: 1 1 auto;
  min-height: 60px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
  scrollbar-width: thin;
}
.chat-msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.chat-ava {
  margin-top: 2px;
  cursor: pointer;
  --ava-bg: rgba(60, 56, 46, 0.08);
  --ava-fg: var(--ink-mut);
  --ava-line: var(--panel-line);
}
.chat-main { min-width: 0; }
.chat-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
}
.chat-name { color: var(--ink-h); font-weight: 600; cursor: pointer; }
.chat-name:hover { color: var(--gold); }
.chat-msg.mine .chat-name { color: var(--gold); }
.chat-realm {
  color: var(--ink-mut);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  padding: 0 5px;
  font-size: 11px;
}
.chat-time { color: var(--ink-mut); font-size: 11px; }
.chat-text {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--ink);
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}
.chat-empty {
  margin: auto;
  text-align: center;
  color: var(--ink-mut);
  font-size: 13px;
}
.chat-form {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.chat-form input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 9px 12px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  outline: none;
}
.chat-form input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.14);
}
.chat-send {
  flex-shrink: 0;
  padding: 9px 18px;
  font-family: inherit;
  font-size: 13px;
  color: #fff;
  background: linear-gradient(180deg, #c9a558, var(--gold));
  border: 1px solid rgba(140, 108, 40, 0.5);
  border-radius: 9px;
  cursor: pointer;
}
.chat-send:hover:not(:disabled) { filter: brightness(1.06); }
.chat-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 右列：整列锁定一屏高，前两块固定，「修行日志」占余高并内部滚动 */
.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.side > section:not(.log-card) {
  flex: 0 0 auto;
}
/* 修行日志卡片：撑满剩余空间，列表在卡内滚动（隐藏滚动条），整体不超屏 */
.log-card {
  flex: 1 1 auto;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.log-card .panel-title {
  flex: 0 0 auto;
}

/* 排行榜 */
.ranks-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.ranks-head .panel-title { margin: 0; }
.tabs {
  display: flex;
  gap: 4px;
}
.tab {
  padding: 4px 10px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-mut);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
}
.tab:hover { color: var(--ink-h); }
.tab.active {
  color: #4a3a12;
  background: rgba(184, 147, 63, 0.18);
  border-color: rgba(184, 147, 63, 0.4);
}
.rank-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 232px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.rank-list::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.rank-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 2px;
  font-size: 13px;
  border-bottom: 1px dashed var(--panel-line);
}
.rank-list li:last-child { border-bottom: none; }
.rk {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--ink-mut);
  background: rgba(60, 56, 46, 0.08);
  border-radius: 5px;
}
.rk-1 { color: #fff; background: #c9a24b; }
.rk-2 { color: #fff; background: #9aa0a6; }
.rk-3 { color: #fff; background: #b07a4a; }
/* 榜单头像沿用页面固定水墨配色（不随系统深浅变化） */
.rk-ava {
  --ava-bg: rgba(60, 56, 46, 0.08);
  --ava-fg: var(--ink-mut);
  --ava-line: var(--panel-line);
}
.rk-name {
  flex: 1 1 auto;
  color: var(--ink-h);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rk-val {
  flex-shrink: 0;
  color: var(--gold);
  font-size: 12px;
}
/* 在线榜网络状态：色点 + 延迟/掉线文字 */
.rk-net {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--ink-mut);
  font-variant-numeric: tabular-nums;
}
.rk-net i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.rk-net.net-good { color: #4a9e5f; }
.rk-net.net-fair { color: #c9a24b; }
.rk-net.net-poor { color: #b4453a; }
.rk-net.net-lost { color: #9aa0a6; }
.rk-net.net-unknown { color: var(--ink-mut); }
.rk-net.net-unknown i { background: transparent; border: 1px solid currentColor; }
.rk-empty, .rk-loading {
  text-align: center;
  color: var(--ink-mut);
  font-size: 13px;
  padding: 16px 0;
  margin: 0;
}
.kv { margin: 0; display: flex; flex-direction: column; gap: 2px; }
.kv > div {
  display: flex;
  justify-content: space-between;
  padding: 8px 4px;
  font-size: 14px;
  border-bottom: 1px dashed var(--panel-line);
}
.kv dt { color: var(--ink-mut); }
.kv dd { margin: 0; color: var(--ink-h); }
/* 修行日志列表：卡内滚动，隐藏滚动条 */
.log {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.log::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.log li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 2px;
  font-size: 13px;
  border-bottom: 1px dashed var(--panel-line);
}
.log-text { color: var(--ink); }
.log-text.hl { color: var(--gold); }
.log-time { color: var(--ink-mut); flex-shrink: 0; }

/* 响应式：窄屏堆叠，恢复整页滚动，取消一屏锁定 */
@media (max-width: 1100px) {
  .hud { height: auto; overflow: visible; }
  .body {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    align-items: start;
  }
  .rail, .char, .mid, .side {
    max-height: none;
    overflow-y: visible;
  }
  .rank-list { max-height: none; }
  /* 窄屏恢复整页滚动：日志卡不再定高内滚，随内容展开 */
  .log-card {
    flex: 0 0 auto;
    min-height: 0;
    overflow: visible;
  }
  /* 世界频道：窄屏下卡片随内容排布，消息区固定高度内滚，不把页面拉长 */
  .card.chat {
    flex: 0 0 auto;
    overflow: visible;
  }
  .chat-list { max-height: 320px; }
  .log {
    overflow-y: visible;
    max-height: none;
  }
  .rail { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .rail-item { flex: 0 0 auto; padding: 10px 14px; }
}
</style>
