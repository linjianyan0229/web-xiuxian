<script setup>
import { computed, ref, watch } from 'vue'
import { fmtDateTime } from '../utils/datetime.js'

// 通知弹窗：点击顶栏「通知」按钮弹出，分两页——
//   修仙公告：管理员发布的全服公告（后端 announcements 表，仅已发布）
//   通知请求：本人收到的系统通知（复用 player_logs，如收到丹药赠礼）
// 数据由首页拉取后以 props 传入，弹窗自身不发请求。
const props = defineProps({
  visible: { type: Boolean, default: false },
  announcements: { type: Array, default: () => [] },
  notices: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const tab = ref('announce')
const tabs = computed(() => [
  { key: 'announce', label: '修仙公告', count: props.announcements.length },
  { key: 'notice', label: '通知请求', count: props.notices.length },
])

// 每次打开回到公告页
watch(
  () => props.visible,
  (v) => {
    if (v) tab.value = 'announce'
  }
)

function fmt(t) {
  return fmtDateTime(t)
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <header class="d-head">
        <h3 class="d-title">通知</h3>
        <button class="x" @click="emit('close')">×</button>
      </header>

      <div class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.label }}
          <span v-if="t.count" class="tab-count">{{ t.count > 99 ? '99+' : t.count }}</span>
        </button>
      </div>

      <div class="d-body">
        <p v-if="loading" class="empty">载入中…</p>

        <!-- 修仙公告 -->
        <ul v-else-if="tab === 'announce'" class="ann-list">
          <li v-for="a in announcements" :key="a.id" class="ann">
            <div class="ann-head">
              <span v-if="a.pinned" class="pin">置顶</span>
              <h4 class="ann-title">{{ a.title }}</h4>
              <span class="ann-time">{{ fmt(a.created_time).slice(0, 16) }}</span>
            </div>
            <p v-if="a.content" class="ann-content">{{ a.content }}</p>
          </li>
          <li v-if="announcements.length === 0" class="empty">仙门暂无公告，静待宗门法旨</li>
        </ul>

        <!-- 通知请求（系统通知） -->
        <ul v-else class="notice-list">
          <li v-for="n in notices" :key="n.id" class="notice">
            <span class="dot"></span>
            <div class="notice-main">
              <p class="notice-text">{{ n.content }}</p>
              <span class="notice-time">{{ fmt(n.created_time).slice(0, 16) }}</span>
            </div>
          </li>
          <li v-if="notices.length === 0" class="empty">暂无新通知，道途清净</li>
        </ul>
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

  display: flex;
  flex-direction: column;
  width: min(520px, 94vw);
  max-height: min(76vh, 640px);
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
  justify-content: space-between;
  padding: 16px 20px 12px;
  flex-shrink: 0;
}
.d-title {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 3px;
  color: var(--ink-h);
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

/* 分页标签 */
.tabs {
  display: flex;
  gap: 8px;
  padding: 0 20px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--line);
}
.tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 4px 12px;
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--ink-mut);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s;
}
.tab:hover { color: var(--ink-h); }
.tab.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}
.tab-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-grid;
  place-items: center;
  font-size: 11px;
  line-height: 1;
  color: #fff;
  background: #b4453a;
  border-radius: 999px;
}

/* 内容区（内部滚动） */
.d-body {
  flex: 1 1 auto;
  min-height: 120px;
  overflow-y: auto;
  padding: 16px 20px 20px;
  scrollbar-width: thin;
}
.empty {
  margin: 40px 0;
  text-align: center;
  color: var(--ink-mut);
  font-size: 14px;
}

/* 公告列表 */
.ann-list, .notice-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ann {
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.ann-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pin {
  flex-shrink: 0;
  font-size: 11px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border-radius: 5px;
  padding: 1px 6px;
}
.ann-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ann-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ink-mut);
  font-variant-numeric: tabular-nums;
}
.ann-content {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.75;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 通知请求列表 */
.notice {
  display: flex;
  gap: 10px;
  padding: 12px 4px;
  border-bottom: 1px dashed var(--line);
}
.notice:last-child { border-bottom: none; }
.dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--gold);
}
.notice-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.notice-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink);
  word-break: break-word;
}
.notice-time {
  font-size: 12px;
  color: var(--ink-mut);
  font-variant-numeric: tabular-nums;
}
</style>
