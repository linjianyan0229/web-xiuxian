<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { apiSectDetail, apiSectMeta, apiSectQuit, apiSectDisband } from '../api/game.js'
import UserAvatar from '../components/UserAvatar.vue'
import SectMembersModal from '../components/SectMembersModal.vue'
import SectCreateModal from '../components/SectCreateModal.vue'
import { useToast } from '../composables/toast.js'
import { fmtDateTime } from '../utils/datetime.js'
import bgImg from '../../image/zongmenbeijing.webp'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const sect = ref(null)
const my = ref(null) // 我的职位视图 { position, position_name, rank, joined_time }
const meta = ref({ realms: [], createCost: 5000 }) // 修订资料弹窗的境界选项
const loading = ref(true)
const busy = ref(false)
const membersVisible = ref(false)
const editVisible = ref(false)

const isLeader = computed(() => !!sect.value && sect.value.leader_id === auth.user?.id)
const canEditInfo = computed(() => !!my.value && my.value.rank <= 3)

// 宗门设施（二期占位，对应文稿 docs/设计文档/宗门职位与权限机制.md §7/§8）
const facilities = [
  { icon: '📜', name: '藏经阁', desc: '功法秘典，兑换传承' },
  { icon: '🏪', name: '宗门商店', desc: '贡献灵石，兑换物资' },
  { icon: '🧘', name: '闭关室', desc: '静室清修，修炼增益' },
  { icon: '📦', name: '宗门仓库', desc: '公共资源，存取调配' },
  { icon: '🗒️', name: '宗门任务', desc: '领取宗务，赚取贡献' },
  { icon: '⚖️', name: '执法堂', desc: '门规刑罚，举报文书' },
  { icon: '🔒', name: '宗门大牢', desc: '关押违纪，听候发落' },
  { icon: '⛰️', name: '山峰', desc: '诸峰林立，真传所属' },
]

function soon(name) {
  toast.info(`「${name}」尚未开放，敬请期待`)
}

// 拉本宗详情；已不在宗门（退宗/被逐/解散）则回天下宗门列表
async function load() {
  const sectId = auth.user?.sect_id
  if (!sectId) {
    router.replace({ name: 'sect' })
    return
  }
  loading.value = true
  try {
    const r = await apiSectDetail(sectId)
    sect.value = r.sect
    my.value = r.my
    if (!r.my) {
      // 归属已失效（被逐出等），同步登录态后回列表
      await auth.fetchProfile().catch(() => {})
      toast.info('道友已不在此宗门下')
      router.replace({ name: 'sect' })
    }
  } catch (e) {
    toast.error(e.message)
    router.replace({ name: 'sect' })
  } finally {
    loading.value = false
  }
}

async function quit() {
  if (!window.confirm(`确定辞别【${sect.value.name}】？退宗后职位不再保留。`)) return
  busy.value = true
  try {
    const r = await apiSectQuit()
    if (r.user) auth.setUser(r.user)
    toast.success('已重归散修之列')
    router.replace({ name: 'sect' })
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
    router.replace({ name: 'sect' })
  } catch (e) {
    toast.error(e.message)
  } finally {
    busy.value = false
  }
}

// 人事变动（任免/逐出/传位）后刷新（宗主可能易位、我可能被改任）
async function onMembersChanged() {
  await auth.fetchProfile().catch(() => {})
  await load()
}

function onUpdated(r) {
  editVisible.value = false
  if (r?.sect) sect.value = r.sect
  toast.success('宗门资料已修订')
}

function fmt(t) {
  return fmtDateTime(t).slice(0, 10)
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchProfile()
    } catch {
      return
    }
  }
  load()
  apiSectMeta().then((m) => (meta.value = m)).catch(() => {})
})
</script>

<template>
  <div class="msect-page" :style="{ backgroundImage: `url(${bgImg})` }">
    <div class="veil">
      <!-- 顶栏 -->
      <header class="topbar">
        <button class="back" @click="router.push({ name: 'home' })">‹ 返回洞府</button>
        <h1 class="title">{{ sect?.name || '我的宗门' }}</h1>
        <span v-if="my" class="pos-tag">{{ my.position_name }}</span>
        <div class="mine">
          <span class="ling-shi">灵石 <b>{{ auth.user?.ling_shi ?? '—' }}</b></span>
        </div>
      </header>

      <div v-if="loading && !sect" class="loading">正在踏入山门…</div>

      <div v-else-if="sect" class="body">
        <!-- 左：宗门信息卡 -->
        <aside class="card info">
          <div class="emblem">
            <UserAvatar class="s-ava" :avatar="sect.avatar" :name="sect.name" :size="72" />
          </div>
          <h2 class="s-name">{{ sect.name }}</h2>
          <p class="s-req">
            入门要求：{{ sect.realm_req ? sect.realm_req + '及以上' : '无要求，来者皆客' }}
          </p>

          <dl class="s-stats">
            <div>
              <dt>宗主</dt>
              <dd>{{ sect.leader_name || '—' }}<small v-if="sect.leader_realm_name">（{{ sect.leader_realm_name }}）</small></dd>
            </div>
            <div><dt>门人</dt><dd>{{ sect.member_count }} 人</dd></div>
            <div><dt>活跃度</dt><dd>{{ sect.activity }}</dd></div>
            <div><dt>立派于</dt><dd>{{ fmt(sect.created_time) }}</dd></div>
            <div v-if="my"><dt>入宗于</dt><dd>{{ fmt(my.joined_time) }}</dd></div>
          </dl>

          <div class="s-intro">
            <h4>宗门简介</h4>
            <p>{{ sect.intro || '此宗尚无简介，一切尽在不言中。' }}</p>
          </div>

          <div class="ops">
            <button class="btn gold" :disabled="busy" @click="membersVisible = true">门人名录</button>
            <button v-if="canEditInfo" class="btn ghost" :disabled="busy" @click="editVisible = true">修订资料</button>
            <button class="btn ghost" :disabled="busy" @click="router.push({ name: 'sect' })">天下宗门</button>
            <button v-if="isLeader" class="btn danger" :disabled="busy" @click="disband">解散宗门</button>
            <button v-else class="btn danger" :disabled="busy" @click="quit">退出宗门</button>
          </div>
        </aside>

        <!-- 右：宗门设施（二期占位） -->
        <main class="facilities">
          <h3 class="fac-title">宗门设施</h3>
          <div class="fac-grid">
            <button v-for="f in facilities" :key="f.name" class="fac" @click="soon(f.name)">
              <span class="fac-icon">{{ f.icon }}</span>
              <b class="fac-name">{{ f.name }}</b>
              <small class="fac-desc">{{ f.desc }}</small>
              <i class="fac-soon">待启</i>
            </button>
          </div>
        </main>
      </div>
    </div>

    <!-- 门人名录（含任免/逐出/传位管理） -->
    <SectMembersModal
      :visible="membersVisible"
      :sect-id="sect?.id ?? 0"
      :sect-name="sect?.name ?? ''"
      @close="membersVisible = false"
      @changed="onMembersChanged"
    />

    <!-- 修订宗门资料 -->
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
.msect-page {
  /* 与游戏首页/宗门列表页同一套固定水墨浅色主题 */
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --panel: rgba(251, 250, 245, 0.88);
  --panel-line: rgba(60, 56, 46, 0.16);
  --gold: #b8933f;
  --gold-2: #e6cf93;

  /* 与 HUD 同规：锁一屏、内滚；背景随元素定位（勿 fixed，防过渡 transform 闪跳） */
  height: 100svh;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background-color: #dfe3dc;
  background-size: cover;
  background-position: center;
}
.veil {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 18px 26px 24px;
  background: linear-gradient(180deg, rgba(238, 240, 235, 0.82) 0%, rgba(238, 240, 235, 0.55) 30%, rgba(238, 240, 235, 0.45) 100%);
}

/* 顶栏 */
.topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.back {
  padding: 8px 14px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
  cursor: pointer;
}
.back:hover { color: var(--gold); border-color: var(--gold); }
.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--ink-h);
}
.pos-tag {
  padding: 3px 12px;
  font-size: 12px;
  color: #4a3a12;
  background: rgba(184, 147, 63, 0.2);
  border: 1px solid rgba(184, 147, 63, 0.45);
  border-radius: 999px;
  white-space: nowrap;
}
.mine { margin-left: auto; font-size: 13px; }
.ling-shi {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}
.ling-shi b { color: var(--gold); }

.loading {
  flex: 1;
  display: grid;
  place-items: center;
  font-size: 15px;
  color: var(--ink-mut);
}

/* 主体两栏 */
.body {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 18px;
}
.card {
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  box-shadow: 0 10px 26px -16px rgba(40, 38, 30, 0.4);
}

/* 信息卡（内滚） */
.info {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 22px 20px 18px;
  display: flex;
  flex-direction: column;
}
.info::-webkit-scrollbar { width: 0; }
.emblem { display: grid; place-items: center; }
.s-ava {
  box-shadow: 0 0 0 4px rgba(251, 250, 245, 0.9);
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #f4e6c2;
  --ava-line: transparent;
}
.s-name {
  margin: 10px 0 2px;
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink-h);
}
.s-req {
  margin: 0 0 14px;
  text-align: center;
  font-size: 12px;
  color: var(--gold);
}
.s-stats {
  margin: 0 0 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.s-stats > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 11px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.s-stats dt { font-size: 11px; color: var(--ink-mut); }
.s-stats dd {
  margin: 0;
  font-size: 13.5px;
  color: var(--ink-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.s-stats dd small { color: var(--ink-mut); font-size: 11.5px; }

.s-intro {
  padding: 11px 13px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.s-intro h4 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
  padding-left: 8px;
  border-left: 3px solid var(--gold);
}
.s-intro p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
}

.ops {
  margin-top: auto;
  padding-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.btn {
  padding: 10px 0;
  font-family: inherit;
  font-size: 13.5px;
  letter-spacing: 2px;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
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
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--panel-line);
}
.btn.ghost:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.btn.danger {
  color: #b4453b;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(180, 69, 59, 0.4);
}
.btn.danger:hover:not(:disabled) { background: rgba(180, 69, 59, 0.08); border-color: #b4453b; }
.btn:disabled { opacity: 0.55; cursor: default; box-shadow: none; }

/* 设施宫格（内滚） */
.facilities {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 4px 2px;
}
.facilities::-webkit-scrollbar { width: 0; }
.fac-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink-h);
  text-shadow: 0 0 8px rgba(251, 250, 245, 0.9);
}
.fac-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.fac {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 16px 16px 14px;
  font-family: inherit;
  text-align: left;
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  cursor: pointer;
  box-shadow: 0 10px 26px -18px rgba(40, 38, 30, 0.5);
  transition: transform 0.12s, border-color 0.12s;
}
.fac:hover {
  transform: translateY(-2px);
  border-color: rgba(184, 147, 63, 0.5);
}
.fac-icon { font-size: 26px; line-height: 1; }
.fac-name {
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--ink-h);
}
.fac-desc { font-size: 11.5px; color: var(--ink-mut); }
.fac-soon {
  position: absolute;
  top: 10px;
  right: 12px;
  padding: 1px 7px;
  font-size: 10.5px;
  font-style: normal;
  color: var(--ink-mut);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.5);
}

/* 窄屏：放开整页滚动、单列堆叠 */
@media (max-width: 860px) {
  .msect-page {
    height: auto;
    min-height: 100svh;
    overflow: visible;
  }
  .veil {
    height: auto;
    min-height: 100svh;
    padding: 14px 14px 20px;
  }
  .body { grid-template-columns: 1fr; }
  .info, .facilities { overflow-y: visible; }
  .title { letter-spacing: 3px; font-size: 20px; }
}
</style>
