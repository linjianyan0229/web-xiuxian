<script setup>
import { onMounted, reactive, ref } from 'vue'
import {
  apiAdminTechniques,
  apiTechniqueMeta,
  apiCreateTechnique,
  apiUpdateTechnique,
  apiDeleteTechnique,
  apiRealms,
} from '../../api/admin.js'
import { useToast } from '../../composables/toast.js'

const toast = useToast()
const state = reactive({
  list: [],
  total: 0,
  page: 1,
  pageSize: 10,
})
const keyword = ref('')
const type = ref('')
const tier = ref('')
const category = ref('')
const meta = ref({ tiers: [], categories: [] })
const realmOptions = ref([]) // 全部境界（id+name），供适用范围下拉
const loading = ref(false)

const TYPE_OPTIONS = [
  { value: 'main', label: '主功法' },
  { value: 'heart', label: '辅功法（心法）' },
]
// 品阶全集（新增时可选，不依赖库中已有）
const TIER_OPTIONS = [
  ['huang_low', '黄阶下品'], ['huang_mid', '黄阶中品'], ['huang_high', '黄阶上品'],
  ['xuan_low', '玄阶下品'], ['xuan_mid', '玄阶中品'], ['xuan_high', '玄阶上品'],
  ['di_low', '地阶下品'], ['di_mid', '地阶中品'], ['di_high', '地阶上品'],
  ['tian_low', '天阶下品'], ['tian_mid', '天阶中品'], ['tian_high', '天阶上品'],
  ['xian_low', '仙阶下品'], ['xian_mid', '仙阶中品'], ['xian_high', '仙阶上品'],
].map(([value, label]) => ({ value, label }))
const EFFECT_TARGETS = [
  { value: 'hp', label: '气血' },
  { value: 'attack', label: '攻击力' },
  { value: 'defense', label: '防御力' },
  { value: 'spirit', label: '精神力' },
  { value: 'lingQi', label: '灵气' },
]

// 编辑/新增弹窗（editRow=null 为新增）
const formVisible = ref(false)
const editRow = ref(null)
const form = reactive({
  name: '',
  type: 'main',
  tier: 'huang_low',
  category: '',
  categoryName: '',
  realmMin: 1,
  realmMax: 13,
  maxLevel: 4,
  multipliersText: '1, 1.6, 2.4, 3.4',
  baseProgress: 10,
  thresholdBase: 100,
  thresholdRatio: 2,
  effects: [],
  summary: '',
  intro: '',
})
const formBusy = ref(false)
const formError = ref('')

// 删除确认
const delRow = ref(null)
const delBusy = ref(false)

function totalPages() {
  return Math.max(1, Math.ceil(state.total / state.pageSize))
}

async function load() {
  loading.value = true
  try {
    const res = await apiAdminTechniques({
      page: state.page,
      pageSize: state.pageSize,
      keyword: keyword.value.trim(),
      type: type.value,
      tier: tier.value,
      category: category.value,
    })
    state.list = res.list
    state.total = res.total
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    meta.value = await apiTechniqueMeta()
  } catch {
    /* 元数据失败不影响列表 */
  }
  try {
    const r = await apiRealms()
    realmOptions.value = r.list || []
  } catch {
    /* 境界下拉失败则退化为数字输入提示 */
  }
}

function onSearch() {
  state.page = 1
  load()
}

function go(delta) {
  const next = state.page + delta
  if (next < 1 || next > totalPages()) return
  state.page = next
  load()
}

// mysql2 JSON 列已解析为对象，兜底兼容字符串
function parseJsonCol(raw, fallback) {
  if (raw == null) return fallback
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  }
  return raw
}

function effText(row) {
  const list = parseJsonCol(row.base_effects, [])
  return list
    .map((e) => `${e.targetName || e.target}${e.polarity === 'negative' ? '−' : '+'}${e.value}${e.type === 'percent' ? '%' : ''}`)
    .join('、')
}

function openCreate() {
  editRow.value = null
  Object.assign(form, {
    name: '',
    type: 'main',
    tier: 'huang_low',
    category: '',
    categoryName: '',
    realmMin: 1,
    realmMax: 13,
    maxLevel: 4,
    multipliersText: '1, 1.6, 2.4, 3.4',
    baseProgress: 10,
    thresholdBase: 100,
    thresholdRatio: 2,
    effects: [{ target: 'attack', type: 'percent', value: 3, polarity: 'positive' }],
    summary: '',
    intro: '',
  })
  formError.value = ''
  formVisible.value = true
}

function openEdit(row) {
  editRow.value = row
  Object.assign(form, {
    name: row.name,
    type: row.type,
    tier: row.tier,
    category: row.category || '',
    categoryName: row.category_name || '',
    realmMin: row.realm_min,
    realmMax: row.realm_max,
    maxLevel: row.max_level,
    multipliersText: parseJsonCol(row.level_multipliers, []).join(', '),
    baseProgress: row.base_progress,
    thresholdBase: row.threshold_base,
    thresholdRatio: Number(row.threshold_ratio),
    effects: parseJsonCol(row.base_effects, []).map((e) => ({
      target: e.target,
      type: e.type,
      value: e.value,
      polarity: e.polarity,
    })),
    summary: row.summary || '',
    intro: row.intro || '',
  })
  formError.value = ''
  formVisible.value = true
}

function addEffect() {
  if (form.effects.length >= 6) return
  form.effects.push({ target: 'attack', type: 'percent', value: 1, polarity: 'positive' })
}
function removeEffect(i) {
  form.effects.splice(i, 1)
}

function buildPayload() {
  const multipliers = form.multipliersText
    .split(/[,，\s]+/)
    .filter(Boolean)
    .map(Number)
  return {
    name: form.name.trim(),
    type: form.type,
    tier: form.tier,
    category: form.category.trim(),
    categoryName: form.categoryName.trim() || form.category.trim(),
    realmMin: Number(form.realmMin),
    realmMax: Number(form.realmMax),
    maxLevel: Number(form.maxLevel),
    levelMultipliers: multipliers,
    baseProgress: Number(form.baseProgress),
    thresholdBase: Number(form.thresholdBase),
    thresholdRatio: Number(form.thresholdRatio),
    baseEffects: form.effects.map((e) => ({ ...e, value: Number(e.value) })),
    summary: form.summary.trim(),
    intro: form.intro.trim(),
  }
}

async function saveForm() {
  if (formBusy.value) return
  formBusy.value = true
  formError.value = ''
  try {
    const payload = buildPayload()
    if (editRow.value) {
      await apiUpdateTechnique(editRow.value.id, payload)
      toast.success('功法已更新')
    } else {
      await apiCreateTechnique(payload)
      toast.success('功法已创建')
    }
    formVisible.value = false
    load()
    loadMeta()
  } catch (e) {
    formError.value = e.message
  } finally {
    formBusy.value = false
  }
}

async function confirmDelete() {
  if (delBusy.value || !delRow.value) return
  delBusy.value = true
  try {
    await apiDeleteTechnique(delRow.value.id)
    toast.success(`「${delRow.value.name}」已删除`)
    delRow.value = null
    await load()
    if (state.list.length === 0 && state.page > 1) {
      state.page -= 1
      await load()
    }
    loadMeta()
  } catch (e) {
    toast.error(e.message)
  } finally {
    delBusy.value = false
  }
}

onMounted(() => {
  load()
  loadMeta()
})
</script>

<template>
  <section>
    <div class="head">
      <h2 class="page-title">功法管理</h2>
      <div class="tools">
        <select v-model="type" class="sel" @change="onSearch">
          <option value="">全部类型</option>
          <option v-for="t in TYPE_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <select v-model="tier" class="sel" @change="onSearch">
          <option value="">全部品阶</option>
          <option v-for="t in meta.tiers" :key="t.tier" :value="t.tier">{{ t.tier_name }}</option>
        </select>
        <select v-model="category" class="sel" @change="onSearch">
          <option value="">全部流派</option>
          <option v-for="c in meta.categories" :key="c.category" :value="c.category">
            {{ c.category_name || c.category }}
          </option>
        </select>
        <div class="search">
          <input v-model="keyword" type="text" placeholder="搜索功法名" @keyup.enter="onSearch" />
          <button class="btn-sm" @click="onSearch">搜索</button>
        </div>
        <button class="btn-sm" @click="openCreate">新增功法</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>功法</th>
            <th>类型</th>
            <th>品阶</th>
            <th>流派</th>
            <th>适用境界</th>
            <th>满层</th>
            <th>基础加成</th>
            <th class="ta-r">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in state.list" :key="row.id">
            <td>
              <div class="strong">{{ row.name }}</div>
              <div class="sub">{{ row.intro || '—' }}</div>
            </td>
            <td>{{ row.type === 'main' ? '主功法' : '心法' }}</td>
            <td>{{ row.tier_name }}</td>
            <td>{{ row.category_name || '—' }}</td>
            <td class="nowrap">{{ row.realm_min_name }} ~ {{ row.realm_max_name }}</td>
            <td>{{ row.max_level }}</td>
            <td class="fx">{{ effText(row) }}</td>
            <td class="ta-r">
              <button class="btn-sm ghost" @click="openEdit(row)">编辑</button>
              <button class="btn-sm danger" @click="delRow = row">删除</button>
            </td>
          </tr>
          <tr v-if="!loading && state.list.length === 0">
            <td colspan="8" class="empty">暂无功法</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="total">共 {{ state.total }} 部功法</span>
      <div class="ctrl">
        <button class="btn-sm" :disabled="state.page <= 1" @click="go(-1)">上一页</button>
        <span class="pageno">{{ state.page }} / {{ totalPages() }}</span>
        <button class="btn-sm" :disabled="state.page >= totalPages()" @click="go(1)">下一页</button>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="formVisible" class="mask" @click.self="formVisible = false">
      <div class="modal wide">
        <header class="m-head">
          <h3>{{ editRow ? `编辑功法 · ${editRow.name}` : '新增功法' }}</h3>
          <button class="x" @click="formVisible = false">×</button>
        </header>
        <div class="m-body">
          <div class="grid-2">
            <label class="fld">
              <span>功法名</span>
              <input v-model.trim="form.name" :disabled="formBusy" />
            </label>
            <label class="fld">
              <span>类型</span>
              <select v-model="form.type" :disabled="formBusy">
                <option v-for="t in TYPE_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </label>
            <label class="fld">
              <span>品阶</span>
              <select v-model="form.tier" :disabled="formBusy">
                <option v-for="t in TIER_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </label>
            <label class="fld">
              <span>流派（标识 / 名称）</span>
              <div class="pair">
                <input v-model.trim="form.category" placeholder="如 sword" :disabled="formBusy" />
                <input v-model.trim="form.categoryName" placeholder="如 剑修" :disabled="formBusy" />
              </div>
            </label>
            <label class="fld">
              <span>适用境界下限</span>
              <select v-model.number="form.realmMin" :disabled="formBusy">
                <option v-for="r in realmOptions" :key="r.id" :value="r.id">{{ r.id }} · {{ r.name }}</option>
              </select>
            </label>
            <label class="fld">
              <span>适用境界上限</span>
              <select v-model.number="form.realmMax" :disabled="formBusy">
                <option v-for="r in realmOptions" :key="r.id" :value="r.id">{{ r.id }} · {{ r.name }}</option>
              </select>
            </label>
            <label class="fld">
              <span>满层数（1~6）</span>
              <input v-model.number="form.maxLevel" type="number" min="1" max="6" :disabled="formBusy" />
            </label>
            <label class="fld">
              <span>层数倍率（逗号分隔，长度=满层数）</span>
              <input v-model="form.multipliersText" placeholder="1, 1.6, 2.4, 3.4" :disabled="formBusy" />
            </label>
            <label class="fld">
              <span>熟练度基数</span>
              <input v-model.number="form.baseProgress" type="number" min="1" :disabled="formBusy" />
            </label>
            <label class="fld">
              <span>层阈值基数 / 公比</span>
              <div class="pair">
                <input v-model.number="form.thresholdBase" type="number" min="1" :disabled="formBusy" />
                <input v-model.number="form.thresholdRatio" type="number" min="1" max="10" step="0.1" :disabled="formBusy" />
              </div>
            </label>
          </div>

          <div class="fx-edit">
            <div class="fx-head">
              <span>基础五维加成（实际加成 = 基础 × 层数倍率）</span>
              <button class="btn-sm ghost" :disabled="formBusy || form.effects.length >= 6" @click="addEffect">+ 加一条</button>
            </div>
            <div v-for="(e, i) in form.effects" :key="i" class="fx-row">
              <select v-model="e.target" :disabled="formBusy">
                <option v-for="t in EFFECT_TARGETS" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
              <select v-model="e.type" :disabled="formBusy">
                <option value="percent">百分比</option>
                <option value="flat">固定值</option>
              </select>
              <input v-model.number="e.value" type="number" min="0.01" step="0.01" :disabled="formBusy" />
              <select v-model="e.polarity" :disabled="formBusy">
                <option value="positive">正面</option>
                <option value="negative">负面</option>
              </select>
              <button class="btn-sm danger" :disabled="formBusy" @click="removeEffect(i)">删</button>
            </div>
          </div>

          <label class="fld">
            <span>效果摘要（手填展示文本）</span>
            <input v-model="form.summary" maxlength="255" :disabled="formBusy" />
          </label>
          <label class="fld">
            <span>简介</span>
            <textarea v-model="form.intro" rows="2" maxlength="255" :disabled="formBusy"></textarea>
          </label>
          <p v-if="formError" class="m-err">{{ formError }}</p>
        </div>
        <footer class="m-foot">
          <button class="btn-sm ghost" :disabled="formBusy" @click="formVisible = false">取消</button>
          <button class="btn-sm" :disabled="formBusy" @click="saveForm">
            {{ formBusy ? '保存中…' : editRow ? '保存' : '创建' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="delRow" class="mask" @click.self="delRow = null">
      <div class="modal slim">
        <header class="m-head">
          <h3>删除功法</h3>
          <button class="x" @click="delRow = null">×</button>
        </header>
        <div class="m-body">
          <p class="confirm-text">
            确定删除【<b>{{ delRow.name }}</b>】（{{ delRow.tier_name }}）？<b>此操作不可撤销</b>。
          </p>
        </div>
        <footer class="m-foot">
          <button class="btn-sm ghost" :disabled="delBusy" @click="delRow = null">取消</button>
          <button class="btn-sm danger" :disabled="delBusy" @click="confirmDelete">
            {{ delBusy ? '删除中…' : '确认删除' }}
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-h);
  letter-spacing: 1px;
}
.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.search { display: flex; gap: 8px; }
.search input,
.sel {
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
}
.search input { width: 160px; }
.search input:focus,
.sel:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.table-wrap {
  overflow-x: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  min-width: 980px;
}
th, td {
  padding: 13px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
th {
  font-weight: 500;
  font-size: 13px;
  color: var(--muted);
  background: var(--field-bg);
  white-space: nowrap;
}
tbody tr:last-child td { border-bottom: none; }
.strong { color: var(--text-h); font-weight: 500; white-space: nowrap; }
.sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nowrap { white-space: nowrap; }
.fx { font-size: 13px; color: var(--muted); max-width: 260px; }
.ta-r { text-align: right; white-space: nowrap; }
.empty { text-align: center; color: var(--muted); padding: 28px; }

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.btn-sm:hover { background: var(--accent-h); }
.btn-sm.ghost {
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border);
}
.btn-sm.ghost:hover { color: var(--text-h); border-color: var(--muted); background: transparent; }
.btn-sm.danger {
  margin-left: 6px;
  background: #b4453a;
}
.btn-sm.danger:hover { background: #9c392f; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.total { font-size: 13px; color: var(--muted); }
.ctrl { display: flex; align-items: center; gap: 12px; }
.pageno { font-size: 13px; color: var(--text-h); }

/* 弹窗（沿用后台通用视觉） */
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(20, 20, 24, 0.45);
}
.modal {
  width: min(460px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
.modal.wide { width: min(680px, 94vw); }
.modal.slim { width: min(400px, 92vw); }
.m-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.m-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}
.x {
  font-size: 20px;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.x:hover { color: var(--text-h); }
.m-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 640px) {
  .grid-2 { grid-template-columns: 1fr; }
}
.fld { display: flex; flex-direction: column; gap: 5px; }
.fld span { font-size: 12px; color: var(--muted); }
.fld input,
.fld select,
.fld textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  font-size: 14px;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  resize: vertical;
}
.fld input:focus,
.fld select:focus,
.fld textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.pair {
  display: flex;
  gap: 8px;
}
.pair input { flex: 1 1 0; min-width: 0; }

.fx-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.fx-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
}
.fx-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr auto;
  gap: 8px;
}
.fx-row input,
.fx-row select {
  box-sizing: border-box;
  width: 100%;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text-h);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
}
.fx-row .btn-sm { margin-left: 0; padding: 6px 10px; }

.m-err { margin: 0; font-size: 13px; color: #b4453a; }
.confirm-text { margin: 0; font-size: 14px; line-height: 1.8; color: var(--text); }
.m-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
}
</style>
