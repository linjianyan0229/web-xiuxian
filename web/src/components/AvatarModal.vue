<script setup>
import { computed, ref, watch } from 'vue'
import { apiUploadAvatar, apiSetAvatarUrl } from '../api/game.js'
import UserAvatar from './UserAvatar.vue'
import { useToast } from '../composables/toast.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  avatar: { type: String, default: '' },
  name: { type: String, default: '' },
})
// updated: 头像已变更，回抛最新用户视图（含新 avatar）供首页更新登录态
const emit = defineEmits(['close', 'updated'])

const toast = useToast()

const busy = ref(false)
const error = ref('')
const urlInput = ref('')
const fileInput = ref(null)

// 与后端 avatarController 的白名单/大小限制保持一致
const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 2 * 1024 * 1024

watch(
  () => props.visible,
  (v) => {
    if (v) {
      busy.value = false
      error.value = ''
      urlInput.value = ''
    }
  }
)

// 预览：URL 输入框有内容时即时预览，否则显示当前头像
const previewAvatar = computed(() => urlInput.value.trim() || props.avatar)

function pickFile() {
  if (busy.value) return
  fileInput.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // 允许连续选择同一文件
  if (!file) return
  if (!ACCEPT_TYPES.includes(file.type)) {
    error.value = '仅支持 JPG/PNG/WebP/GIF 图片'
    return
  }
  if (file.size > MAX_SIZE) {
    error.value = '图片不能超过 2MB'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const r = await apiUploadAvatar(file)
    toast.success('法相已焕新')
    emit('updated', r.user)
    emit('close')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function submitUrl() {
  if (busy.value) return
  const url = urlInput.value.trim()
  if (!url) {
    error.value = '请先填写图片链接'
    return
  }
  if (!/^https?:\/\//i.test(url)) {
    error.value = '仅支持 http/https 图片链接'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const r = await apiSetAvatarUrl(url)
    toast.success('法相已焕新')
    emit('updated', r.user)
    emit('close')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

// 恢复默认（清除头像，回到道号首字占位）
async function resetAvatar() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await apiSetAvatarUrl('')
    toast.success('已恢复默认法相')
    emit('updated', r.user)
    emit('close')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <button class="x" @click="emit('close')" title="关闭">×</button>
      <h3 class="title">更换法相</h3>
      <p class="desc">上传一张图片，或以图片链接为凭</p>

      <div class="preview">
        <UserAvatar :avatar="previewAvatar" :name="name" :size="84" />
      </div>

      <button class="btn gold" :disabled="busy" @click="pickFile">
        {{ busy ? '施法中…' : '上传本地图片' }}
      </button>
      <input
        ref="fileInput"
        type="file"
        class="hidden-input"
        accept="image/jpeg,image/png,image/webp,image/gif"
        @change="onFileChange"
      />
      <p class="hint">支持 JPG / PNG / WebP / GIF，不超过 2MB</p>

      <div class="divider"><i></i><b>或</b><i></i></div>

      <div class="url-row">
        <input
          v-model.trim="urlInput"
          type="text"
          placeholder="粘贴图片链接（http/https）"
          :disabled="busy"
          @keyup.enter="submitUrl"
        />
        <button class="btn-sm" :disabled="busy" @click="submitUrl">使用</button>
      </div>

      <p v-if="error" class="err">{{ error }}</p>

      <button v-if="avatar" class="btn ghost reset" :disabled="busy" @click="resetAvatar">
        恢复默认（道号首字）
      </button>
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
}
.dialog {
  --gold: #b8933f;
  --ink-h: #26282c;
  --ink: #52555b;
  --ink-mut: #8b8e8a;
  --line: rgba(60, 56, 46, 0.16);

  position: relative;
  width: min(380px, 92vw);
  padding: 28px 28px 24px;
  text-align: center;
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
.title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  color: var(--ink-h);
}
.desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--ink-mut);
}
.preview {
  display: grid;
  place-items: center;
  margin-bottom: 16px;
  /* 预览头像在水墨浅色底上的配色 */
  --ava-bg: rgba(255, 255, 255, 0.6);
  --ava-fg: var(--ink-mut);
  --ava-line: var(--line);
}
.hidden-input { display: none; }
.btn {
  width: 100%;
  padding: 12px;
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 2px;
  border-radius: 10px;
  cursor: pointer;
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
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}
.btn.ghost:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
.btn:disabled { opacity: 0.55; cursor: default; box-shadow: none; }
.hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--ink-mut);
}
.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0;
}
.divider i {
  flex: 1 1 auto;
  height: 1px;
  background: var(--line);
}
.divider b {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-mut);
}
.url-row {
  display: flex;
  gap: 8px;
}
.url-row input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-h);
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--line);
  border-radius: 8px;
  outline: none;
}
.url-row input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.15);
}
.btn-sm {
  flex: none;
  padding: 0 18px;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 1px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 8px;
  cursor: pointer;
}
.btn-sm:hover:not(:disabled) { filter: brightness(1.05); }
.btn-sm:disabled { opacity: 0.55; cursor: default; }
.err {
  margin: 10px 0 0;
  font-size: 13px;
  color: #b4453b;
}
.reset { margin-top: 14px; }
</style>
