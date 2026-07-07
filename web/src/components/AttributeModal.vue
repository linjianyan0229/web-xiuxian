<script setup>
import { computed } from 'vue'
import UserAvatar from './UserAvatar.vue'
import { fmtDateTime } from '../utils/datetime.js'

// 详细属性弹窗：展示当前玩家的完整属性。
// 道韵/道法按后端下发的 dao_yun/dao_law_unlocked 标志隐藏（境界未达对应阶段不显示）。
const props = defineProps({
  visible: { type: Boolean, default: false },
  user: { type: Object, default: null },
})
const emit = defineEmits(['close'])

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
function fmtTime(t) {
  return fmtDateTime(t)
}

const genderLabel = computed(() => (Number(props.user?.gender) === 2 ? '女修' : '男修'))

// 属性行（道韵/道法未解锁自动跳过）
const rows = computed(() => {
  const u = props.user || {}
  const list = [
    ['性别', genderLabel.value],
    ['所属宗门', u.sect_name || '散修'],
    ['灵石', fmtCn(u.ling_shi)],
    ['修为', fmtCn(u.cultivation)],
    ['生命值', fmtCn(u.hp)],
    ['战力', fmtCn(u.attack)],
    ['防御', fmtCn(u.defense)],
    ['精神力', fmtCn(u.spirit)],
  ]
  if (Number(u.dao_yun_unlocked) === 1) list.push(['道韵', fmtCn(u.dao_yun)])
  if (Number(u.dao_law_unlocked) === 1) list.push(['道法', fmtCn(u.dao_law)])
  list.push(['悟性', `${Number(u.comprehension) || 0}%`])
  list.push(['上次登录', fmtTime(u.login_time)])
  return list
})
</script>

<template>
  <div v-if="visible && user" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <button class="x" @click="emit('close')">×</button>

      <header class="head">
        <UserAvatar class="ava" :avatar="user.avatar" :name="user.dao_name" :size="64" />
        <div class="who">
          <h3>{{ user.dao_name }}</h3>
          <span class="realm">{{ user.realm_name || '凡人' }}</span>
        </div>
      </header>

      <dl class="attrs">
        <div v-for="r in rows" :key="r[0]">
          <dt>{{ r[0] }}</dt>
          <dd>{{ r[1] }}</dd>
        </div>
      </dl>
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
  width: min(420px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  padding: 26px 28px 24px;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background:
    radial-gradient(600px 200px at 50% -20%, rgba(255, 255, 255, 0.8), transparent 70%),
    linear-gradient(160deg, #fbfaf5 0%, #f1f0e9 100%);
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

.head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.head .ava {
  --ava-bg: linear-gradient(160deg, #6f7783, #464b53);
  --ava-fg: #fff;
  --ava-line: transparent;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.6);
}
.who h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--ink-h);
}
.who .realm {
  display: inline-block;
  margin-top: 6px;
  font-size: 13px;
  color: var(--gold);
  border: 1px solid rgba(184, 147, 63, 0.45);
  border-radius: 6px;
  padding: 1px 8px;
}

.attrs {
  margin: 6px 0 0;
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
</style>
