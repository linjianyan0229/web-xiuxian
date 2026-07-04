<script setup>
import { onMounted, ref } from 'vue'
import { apiConfigs, apiUpdateConfig, apiRealms, apiUpdateRealmSignIn } from '../../api/admin.js'

const configs = ref([])
const realms = ref([]) // { id, name, type, label, base, fixed, minP, maxP }
const loading = ref(false)
const err = ref('')

// 单行反馈状态
const configSavingKey = ref('')
const savingId = ref(0)
const savedId = ref(0)
const rowErr = ref('')

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : n
}

// 依据晋级方式判定签到奖励档位（与后端一致）
function tierOf(r) {
  const req = r.requirement_type || ''
  if (req.includes('道法') || req === '终点') {
    return { type: 'dao_law', label: '道法', base: 0, fixed: 1 }
  }
  if (req.includes('道韵')) {
    return { type: 'dao_yun', label: '道韵', base: Number(r.dao_yun_required) || 0, fixed: 0 }
  }
  return { type: 'cultivation', label: '修为', base: Number(r.advance_exp) || 0, fixed: 0 }
}

// 按百分比算奖励：基准 × 百分比，向下取整，最低 1
function calc(base, pct) {
  const b = Number(base) || 0
  const p = Number(pct) || 0
  if (b <= 0 || p <= 0) return 0
  return Math.max(1, Math.floor((b * p) / 100))
}

// 预计奖励文案：固定档显示固定值，百分比档显示区间
function previewText(row) {
  if (row.fixed > 0) return `+${row.fixed} ${row.label}`
  return `+${fmt(calc(row.base, row.minP))} ~ +${fmt(calc(row.base, row.maxP))} ${row.label}`
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    const [cfg, rlm] = await Promise.all([apiConfigs(), apiRealms()])
    configs.value = cfg.list
    realms.value = rlm.list.map((r) => {
      const t = tierOf(r)
      return {
        id: r.id,
        name: r.name,
        type: t.type,
        label: t.label,
        base: t.base,
        fixed: t.fixed,
        minP: Number(r.sign_in_min_percent) || 0,
        maxP: Number(r.sign_in_max_percent) || 0,
      }
    })
  } catch (e) {
    err.value = e.message
  } finally {
    loading.value = false
  }
}

// 切换布尔型配置（如签到开关）
async function toggleConfig(cfg) {
  const next = cfg.config_value === '1' ? '0' : '1'
  configSavingKey.value = cfg.config_key
  try {
    await apiUpdateConfig(cfg.config_key, next)
    cfg.config_value = next
  } catch (e) {
    err.value = e.message
  } finally {
    configSavingKey.value = ''
  }
}

// 保存某境界的签到百分比区间
async function saveRealm(row) {
  rowErr.value = ''
  savedId.value = 0
  let lo = Number(row.minP)
  let hi = Number(row.maxP)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    rowErr.value = `【${row.name}】百分比无效`
    return
  }
  // 前端先收敛到 [0.1, 3]，并保证下限≤上限
  lo = Math.round(Math.min(3, Math.max(0.1, lo)) * 100) / 100
  hi = Math.round(Math.min(3, Math.max(0.1, hi)) * 100) / 100
  if (lo > hi) [lo, hi] = [hi, lo]
  row.minP = lo
  row.maxP = hi
  savingId.value = row.id
  try {
    const { realm } = await apiUpdateRealmSignIn(row.id, lo, hi)
    row.minP = Number(realm.sign_in_min_percent) || lo
    row.maxP = Number(realm.sign_in_max_percent) || hi
    savedId.value = row.id
    setTimeout(() => {
      if (savedId.value === row.id) savedId.value = 0
    }, 1500)
  } catch (e) {
    rowErr.value = `【${row.name}】保存失败：${e.message}`
  } finally {
    savingId.value = 0
  }
}

onMounted(load)
</script>

<template>
  <section>
    <h2 class="page-title">系统配置</h2>
    <p class="tip">管理游戏内的系统级开关与数值。当前已接入「每日签到」功能。</p>
    <p v-if="err" class="err">{{ err }}</p>

    <!-- 系统配置列表 -->
    <div class="panel">
      <div class="panel-head">
        <h3>系统配置列表</h3>
        <span class="count">共 {{ configs.length }} 项</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>配置项</th>
              <th>说明</th>
              <th class="ta-c">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in configs" :key="c.config_key">
              <td class="strong">{{ c.label || c.config_key }}</td>
              <td class="muted desc-cell">{{ c.description }}</td>
              <td class="ta-c">
                <label v-if="c.value_type === 'bool'" class="switch">
                  <input
                    type="checkbox"
                    :checked="c.config_value === '1'"
                    :disabled="configSavingKey === c.config_key"
                    @change="toggleConfig(c)"
                  />
                  <span class="slider"></span>
                  <span class="switch-txt">{{ c.config_value === '1' ? '开启' : '关闭' }}</span>
                </label>
                <span v-else class="muted">{{ c.config_value }}</span>
              </td>
            </tr>
            <tr v-if="!loading && configs.length === 0">
              <td colspan="3" class="empty">暂无配置</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 境界签到奖励配置 -->
    <div class="panel">
      <div class="panel-head">
        <h3>境界签到奖励配置</h3>
        <span class="count">共 {{ realms.length }} 个境界</span>
      </div>
      <p class="tip inner">
        奖励随境界档位不同：<b class="t-xf">修为档</b>（经验晋级）按圆满修为、<b class="t-dy">道韵档</b
        >（道韵晋级）按圆满道韵，各在配置的百分比区间（0.1%~3%）内<b>随机</b>发放；<b class="t-df"
          >道法档</b
        >（道法领悟/终点）每次固定 +1 道法。
      </p>
      <p v-if="rowErr" class="err">{{ rowErr }}</p>

      <div class="table-wrap scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>境界</th>
              <th class="ta-c">奖励类型</th>
              <th class="ta-r">圆满基准</th>
              <th class="ta-c">下限%</th>
              <th class="ta-c">上限%</th>
              <th class="ta-r">预计奖励</th>
              <th class="ta-c">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in realms" :key="r.id">
              <td class="muted">{{ r.id }}</td>
              <td class="strong">{{ r.name }}</td>
              <td class="ta-c">
                <span class="tag" :class="'tag-' + r.type">{{ r.label }}</span>
              </td>
              <td class="ta-r">{{ r.fixed > 0 ? '—' : fmt(r.base) }}</td>
              <template v-if="r.fixed > 0">
                <td class="ta-c muted">—</td>
                <td class="ta-c muted">—</td>
                <td class="ta-r gold">+{{ r.fixed }} {{ r.label }}</td>
                <td class="ta-c muted">固定</td>
              </template>
              <template v-else>
                <td class="ta-c">
                  <input
                    class="pct"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="3"
                    v-model.number="r.minP"
                    @keyup.enter="saveRealm(r)"
                  />
                </td>
                <td class="ta-c">
                  <input
                    class="pct"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="3"
                    v-model.number="r.maxP"
                    @keyup.enter="saveRealm(r)"
                  />
                </td>
                <td class="ta-r gold">{{ previewText(r) }}</td>
                <td class="ta-c">
                  <button class="save" :disabled="savingId === r.id" @click="saveRealm(r)">
                    {{ savingId === r.id ? '…' : savedId === r.id ? '已保存' : '保存' }}
                  </button>
                </td>
              </template>
            </tr>
            <tr v-if="!loading && realms.length === 0">
              <td colspan="8" class="empty">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-h);
  letter-spacing: 1px;
}
.tip {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--muted);
}
.tip.inner {
  margin: 0 16px 12px;
  line-height: 1.7;
}
.t-xf {
  color: #3f7a6d;
}
.t-dy {
  color: #6a5acd;
}
.t-df {
  color: #b8933f;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  margin-bottom: 22px;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 16px 18px 12px;
}
.panel-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-h);
  letter-spacing: 1px;
}
.count {
  font-size: 13px;
  color: var(--muted);
}
.table-wrap {
  overflow-x: auto;
}
.table-wrap.scroll {
  max-height: 460px;
  overflow-y: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  padding: 10px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
th {
  font-weight: 500;
  font-size: 12px;
  color: var(--muted);
  background: var(--field-bg);
  position: sticky;
  top: 0;
  z-index: 1;
}
tbody tr:last-child td {
  border-bottom: none;
}
tbody tr:hover td {
  background: var(--accent-soft);
}
td.strong {
  color: var(--text-h);
  font-weight: 500;
}
td.muted {
  color: var(--muted);
}
.desc-cell {
  white-space: normal;
  max-width: 520px;
}
.ta-r {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ta-c {
  text-align: center;
}
td.gold {
  color: #b8933f;
  font-weight: 600;
}
.tag {
  display: inline-block;
  padding: 2px 10px;
  font-size: 12px;
  border-radius: 999px;
}
.tag-cultivation {
  color: #2f6b5e;
  background: rgba(63, 122, 109, 0.14);
}
.tag-dao_yun {
  color: #5548b0;
  background: rgba(106, 90, 205, 0.14);
}
.tag-dao_law {
  color: #916c1f;
  background: rgba(184, 147, 63, 0.16);
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 28px;
}
.err {
  color: var(--danger);
  margin: 0 0 12px;
}

/* 开关 */
.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.switch input {
  display: none;
}
.slider {
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--border);
  position: relative;
  transition: background 0.2s;
}
.slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s;
}
.switch input:checked + .slider {
  background: var(--accent);
}
.switch input:checked + .slider::before {
  transform: translateX(18px);
}
.switch-txt {
  font-size: 13px;
  color: var(--text);
}

/* 百分比输入 */
.pct {
  width: 66px;
  padding: 6px 8px;
  font-size: 13px;
  text-align: center;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
}
.pct:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.save {
  padding: 6px 14px;
  font-size: 13px;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}
.save:hover:not(:disabled) {
  background: var(--accent-h);
}
.save:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
