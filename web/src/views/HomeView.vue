<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { apiLogout } from '../api/auth.js'
import { apiGameRankings } from '../api/game.js'

const router = useRouter()
const auth = useAuthStore()
const hint = ref('')

// 排行榜（境界/在线/死亡，各前十）
const ranks = ref(null)
const rankTab = ref('realmTop')
const rankTabs = [
  { key: 'realmTop', label: '境界榜' },
  { key: 'onlineTop', label: '在线榜' },
  { key: 'deathTop', label: '死亡榜' },
]

// 左侧功能栏（游戏模块，多数待开发）
const navItems = ['修行', '洞府', '功法', '法宝', '丹药', '伙伴', '宗门', '历炼', '仙盟', '探索']

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
const resources = computed(() => {
  const u = auth.user || {}
  return [
    { label: '灵石', value: fmtCn(u.ling_shi) },
    { label: '修为', value: fmtCn(u.cultivation) },
    { label: '生命值', value: fmtCn(u.hp) },
    { label: '战力', value: fmtCn(u.attack) },
    { label: '防御', value: fmtCn(u.defense) },
    { label: '精神力', value: fmtCn(u.spirit) },
    { label: '道韵', value: fmtCn(u.dao_yun) },
    { label: '道法', value: fmtCn(u.dao_law) },
  ]
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
// 今日修炼（待修炼系统接入）
const today = [
  ['修炼时长', '00:00:00'],
  ['获得修为', '0'],
  ['突破几率', '0%'],
]

function fmt(t) {
  return t ? String(t).replace('T', ' ').slice(0, 19) : '—'
}

const realmName = computed(() => auth.user?.realm_name || '凡人')

// 修行日志：用真实账号数据 + 少量叙事
const logs = computed(() => {
  if (!auth.user) return []
  return [
    { time: fmt(auth.user.login_time).slice(11), text: `道友 ${auth.user.dao_name} 登临此界，境界【${realmName.value}】。` },
    { time: fmt(auth.user.register_time).slice(11), text: `你于凡尘立下道号，踏上仙途。`, hl: true },
    { time: '—', text: `静待修炼、宗门、历炼诸般机缘开启。` },
  ]
})

function soon(name) {
  hint.value = `【${name}】尚在开辟，敬请期待`
}

async function onLogout() {
  await apiLogout().catch(() => {})
  auth.logout()
  router.replace({ name: 'login' })
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
})
</script>

<template>
  <div class="hud">
    <!-- 顶部栏 -->
    <header class="topbar">
      <div class="brand">
        <h1>文字修仙</h1>
        <p>道心如砥 · 长生可期</p>
      </div>
      <div class="resources">
        <span v-for="r in resources" :key="r.label" class="res">
          <i>◆</i>{{ r.label }} <b>{{ r.value }}</b>
        </span>
      </div>
      <div class="top-actions">
        <button class="icon-btn" @click="soon('设置')" title="设置">⚙</button>
        <button class="icon-btn" @click="soon('公告')" title="公告">✉</button>
        <button class="leave" @click="onLogout">离山</button>
      </div>
    </header>

    <p v-if="hint" class="hint-bar" @click="hint = ''">{{ hint }}（点击关闭）</p>

    <div class="body" v-if="auth.user">
      <!-- 左侧功能栏 -->
      <nav class="rail">
        <button
          v-for="(n, i) in navItems"
          :key="n"
          class="rail-item"
          :class="{ active: i === 0 }"
          @click="i === 0 ? null : soon(n)"
        >
          {{ n }}
        </button>
      </nav>

      <!-- 角色卡 -->
      <aside class="card char">
        <div class="char-head">
          <div class="avatar">{{ auth.user.dao_name.slice(0, 1) }}</div>
          <div class="who">
            <span class="tag">道友</span>
            <h2>{{ auth.user.dao_name }}</h2>
          </div>
        </div>
        <dl class="char-stats">
          <div><dt>境界</dt><dd class="gold">{{ realmName }}</dd></div>
          <div><dt>状态</dt><dd>{{ auth.user.status === 1 ? '正常' : '禁用' }}</dd></div>
          <div><dt>灵根</dt><dd>金木水火土</dd></div>
          <div><dt>入道</dt><dd>{{ fmt(auth.user.register_time) }}</dd></div>
          <div><dt>上次登录</dt><dd>{{ fmt(auth.user.login_time) }}</dd></div>
          <div><dt>邮箱</dt><dd class="ellip">{{ auth.user.email }}</dd></div>
        </dl>
        <button class="ghost-btn" @click="soon('详细属性')">详细属性 ›</button>
      </aside>

      <!-- 中间：境界 + 常用功能 -->
      <main class="mid">
        <section class="card realm">
          <h3 class="panel-title">境界</h3>
          <div class="realm-name">{{ realmName }}</div>
          <div class="cultivate-info">修为：{{ fmtCn(auth.user.cultivation) }}</div>
          <div class="bar"><span :style="{ width: '2%' }"></span></div>
          <div class="cultivate-sub">每 5 秒自动修为：+0（修炼系统待开启）</div>
          <button class="gold-btn" @click="soon('修炼')">开始修炼</button>
        </section>

        <section class="card buffs">
          <h3 class="panel-title">修炼增益</h3>
          <div class="buff-grid">
            <div v-for="b in buffs" :key="b[0]" class="buff">
              <span>{{ b[0] }}</span><b>{{ b[1] }}</b>
            </div>
          </div>
        </section>

        <section class="card funcs">
          <h3 class="panel-title">常用功能</h3>
          <div class="func-row">
            <button v-for="f in funcs" :key="f" class="func" @click="soon(f)">
              <span class="func-ico">{{ f.slice(0, 1) }}</span>
              <span class="func-lbl">{{ f }}</span>
            </button>
          </div>
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
              <span class="rk-name">{{ row.dao_name }}</span>
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
        <section class="card">
          <h3 class="panel-title">修行日志</h3>
          <ul class="log">
            <li v-for="(l, i) in logs" :key="i">
              <span class="log-text" :class="{ hl: l.hl }">{{ l.text }}</span>
              <span class="log-time">{{ l.time }}</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>
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

.hint-bar {
  margin: 0;
  padding: 8px 26px;
  font-size: 13px;
  color: var(--gold);
  background: rgba(184, 147, 63, 0.1);
  cursor: pointer;
}

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

/* 各列在列内自行滚动（隐藏滚动条），避免整页出现滚动条 */
.rail,
.char,
.mid,
.side {
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.rail::-webkit-scrollbar,
.char::-webkit-scrollbar,
.mid::-webkit-scrollbar,
.side::-webkit-scrollbar {
  width: 0;
  height: 0;
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

/* 角色卡 */
.char-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.avatar {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  font-size: 24px;
  color: #fff;
  background: linear-gradient(160deg, #6f7783, #464b53);
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5);
}
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

/* 中列 */
.mid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.realm { text-align: center; }
.realm-name {
  margin: 10px 0 6px;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--gold);
  text-shadow: 0 2px 10px rgba(184, 147, 63, 0.25);
}
.cultivate-info { font-size: 14px; color: var(--ink); }
.bar {
  height: 12px;
  margin: 12px auto;
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
  margin-top: 14px;
  padding: 12px 40px;
  font-family: inherit;
  font-size: 17px;
  letter-spacing: 3px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 6px 16px -8px rgba(184, 147, 63, 0.8);
}
.gold-btn:hover { filter: brightness(1.05); }

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

/* 右列 */
.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
.log { list-style: none; margin: 0; padding: 0; }
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
  .rail { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .rail-item { flex: 0 0 auto; padding: 10px 14px; }
}
</style>
