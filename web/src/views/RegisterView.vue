<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { apiRegisterConfig, apiSendEmailCode } from '../api/auth.js'
import AuthShell from '../components/AuthShell.vue'
// 修仙角色展示：男/女修视频立绘（web/video/boy.mp4、girl.mp4），随表单性别选择切换
import boyVideo from '../../video/boy.mp4'
import girlVideo from '../../video/girl.mp4'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ daoName: '', email: '', password: '', confirm: '', gender: 1, emailCode: '' })
const error = ref('')
const loading = ref(false)

// 注册是否需要邮箱验证码（系统配置 register_email_code_enabled）。
// 默认 true（保守：拉取失败时仍显示验证码框，由后端最终判定）
const codeRequired = ref(true)
onMounted(async () => {
  try {
    const r = await apiRegisterConfig()
    codeRequired.value = r.emailCodeEnabled !== false
  } catch {
    // 拉取失败保持默认显示验证码，避免误放行
  }
})

// 获取验证码：60 秒重发倒计时（以服务端返回的 resendSeconds 为准）
const codeSending = ref(false)
const codeCountdown = ref(0)
let codeTimer = null
onUnmounted(() => {
  if (codeTimer) clearInterval(codeTimer)
})

async function sendCode() {
  if (codeSending.value || codeCountdown.value > 0) return
  error.value = ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    error.value = '请先填写正确的邮箱'
    return
  }
  codeSending.value = true
  try {
    const r = await apiSendEmailCode(form.email, 'register')
    codeCountdown.value = Number(r.resendSeconds) || 60
    codeTimer = setInterval(() => {
      codeCountdown.value -= 1
      if (codeCountdown.value <= 0) {
        clearInterval(codeTimer)
        codeTimer = null
      }
    }, 1000)
  } catch (e) {
    error.value = e.message
  } finally {
    codeSending.value = false
  }
}

async function onSubmit() {
  error.value = ''
  if (!form.daoName || !form.email || !form.password) {
    error.value = '道号、邮箱、密码均为必填'
    return
  }
  if (form.password.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (form.password !== form.confirm) {
    error.value = '两次输入的密码不一致'
    return
  }
  if (codeRequired.value && !form.emailCode.trim()) {
    error.value = '请填写邮箱验证码'
    return
  }
  loading.value = true
  try {
    const payload = {
      daoName: form.daoName,
      email: form.email,
      password: form.password,
      gender: form.gender,
    }
    // 开关关闭时不携带 emailCode（后端也不校验）
    if (codeRequired.value) payload.emailCode = form.emailCode.trim()
    await auth.register(payload)
    router.push({ name: 'home' })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="开宗立派" subtitle="取一道号，自此踏上仙途">
    <!-- 左侧：修仙角色展示（随右侧性别选择切换） -->
    <template #aside>
      <div class="stage">
        <!-- key 随性别变化强制重建 video，确保切换时立即换源重播 -->
        <video
          :key="form.gender"
          class="stage-video"
          :src="form.gender === 1 ? boyVideo : girlVideo"
          autoplay
          loop
          :muted="true"
          playsinline
          preload="auto"
        ></video>
        <div class="stage-cap">
          <b>{{ form.gender === 1 ? '男修法相' : '女修法相' }}</b>
          <span>择尔道体 · 入我仙门</span>
        </div>
      </div>
    </template>

    <form class="auth-form" @submit.prevent="onSubmit">
      <div class="field">
        <label>道号</label>
        <input v-model.trim="form.daoName" type="text" placeholder="2-16位中英文/数字" autocomplete="nickname" />
      </div>
      <div class="field">
        <label>邮箱</label>
        <input v-model.trim="form.email" type="email" placeholder="用于找回与验证" autocomplete="email" />
      </div>
      <div v-if="codeRequired" class="field">
        <label>邮箱验证码</label>
        <div class="code-row">
          <input
            v-model.trim="form.emailCode"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="6 位数字"
            autocomplete="one-time-code"
          />
          <button
            type="button"
            class="code-btn"
            :disabled="codeSending || codeCountdown > 0"
            @click="sendCode"
          >
            {{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : codeSending ? '发送中…' : '获取验证码' }}
          </button>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>密码</label>
          <input v-model="form.password" type="password" placeholder="至少 6 位" autocomplete="new-password" />
        </div>
        <div class="field">
          <label>确认密码</label>
          <input v-model="form.confirm" type="password" placeholder="再次输入" autocomplete="new-password" />
        </div>
      </div>
      <div class="field">
        <label>性别</label>
        <div class="gender-opts">
          <label class="gender-opt" :class="{ active: form.gender === 1 }">
            <input v-model.number="form.gender" type="radio" name="gender" :value="1" />男修
          </label>
          <label class="gender-opt" :class="{ active: form.gender === 2 }">
            <input v-model.number="form.gender" type="radio" name="gender" :value="2" />女修
          </label>
        </div>
      </div>

      <p class="form-error">{{ error }}</p>

      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? '结缘中…' : '立 派' }}
      </button>
    </form>

    <p class="switch">
      已入仙门？<RouterLink to="/login">返回登入</RouterLink>
    </p>
  </AuthShell>
</template>

<style scoped>
/* 验证码输入 + 获取按钮同行。
   input 非 .field 直接子元素，AuthShell 的 :deep(.field > input) 不命中，此处补齐同款样式
   （尺寸对齐二分栏紧凑档：padding 10/12、字号 14） */
.code-row {
  display: flex;
  gap: 8px;
}
.code-row input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink-h, #26282c);
  background: var(--field-bg, rgba(255, 255, 255, 0.66));
  border: 1px solid var(--panel-line, rgba(60, 56, 46, 0.16));
  border-radius: 10px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.code-row input::placeholder {
  color: var(--ink-mut, #8b8e8a);
  opacity: 0.65;
}
.code-row input:focus {
  border-color: var(--gold, #b8933f);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.16);
}
.code-btn {
  flex: none;
  padding: 0 14px;
  font-family: inherit;
  font-size: 13px;
  white-space: nowrap;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 10px;
  cursor: pointer;
}
.code-btn:hover:not(:disabled) { filter: brightness(1.05); }
.code-btn:disabled { opacity: 0.55; cursor: default; }

/* 密码/确认密码并排，压缩表单纵向高度（窄屏恢复上下排列） */
.field-row {
  display: flex;
  gap: 10px;
}
.field-row .field {
  flex: 1 1 0;
  min-width: 0;
}
@media (max-width: 480px) {
  .field-row { flex-direction: column; gap: 13px; }
}

/* ---- 左侧修仙角色展示（渲染于 AuthShell 的 card-aside 内） ---- */
.stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.stage-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* 底部说明条：深色渐变压底保证文字可读 */
.stage-cap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 26px 16px 12px;
  background: linear-gradient(180deg, transparent, rgba(30, 28, 22, 0.62));
}
.stage-cap b {
  font-size: 15px;
  letter-spacing: 2px;
  color: #f4e6c2;
}
.stage-cap span {
  font-size: 11px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.75);
}

.gender-opts {
  display: flex;
  gap: 10px;
}
.gender-opt {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 0;
  font-size: 14px;
  color: var(--text);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.gender-opt input {
  margin: 0;
  accent-color: var(--accent);
}
.gender-opt.active {
  color: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
</style>
