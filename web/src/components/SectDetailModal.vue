<script setup>
import { ref, watch } from 'vue'
import { apiSectDetail } from '../api/game.js'
import UserAvatar from './UserAvatar.vue'
import dongfuImg from '../../image/dongfu.webp'

const props = defineProps({
  visible: { type: Boolean, default: false },
  sectId: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const sect = ref(null)
const loading = ref(false)
const error = ref('')

// 打开时按 id 拉取最新详情（人数/活跃度实时）
watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    sect.value = null
    error.value = ''
    loading.value = true
    try {
      const r = await apiSectDetail(props.sectId)
      sect.value = r.sect
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }
)

function fmt(t) {
  return t ? String(t).replace('T', ' ').slice(0, 19) : '—'
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

        <button class="btn ghost" @click="emit('close')">知道了</button>
      </template>
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

.btn {
  display: block;
  width: calc(100% - 48px);
  margin: 0 24px;
  padding: 11px 0;
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 3px;
  border-radius: 10px;
  cursor: pointer;
}
.btn.ghost {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}
.btn.ghost:hover { color: var(--gold); border-color: var(--gold); }
</style>
