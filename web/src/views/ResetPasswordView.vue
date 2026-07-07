<script setup>
import { onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiSendEmailCode, apiResetPassword } from '../api/auth.js'
import AuthShell from '../components/AuthShell.vue'
import { useToast } from '../composables/toast.js'

const router = useRouter()
const toast = useToast()

const form = reactive({ email: '', emailCode: '', password: '', confirm: '' })
const error = ref('')
const loading = ref(false)

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
    const r = await apiSendEmailCode(form.email, 'reset')
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
  if (!form.email || !form.emailCode || !form.password) {
    error.value = '邮箱、验证码、新密码均为必填'
    return
  }
  if (form.password.length < 6) {
    error.value = '新密码至少 6 位'
    return
  }
  if (form.password !== form.confirm) {
    error.value = '两次输入的密码不一致'
    return
  }
  loading.value = true
  try {
    await apiResetPassword({
      email: form.email,
      emailCode: form.emailCode.trim(),
      newPassword: form.password,
    })
    toast.success('道基重铸功成，请以新密令登入')
    router.push({ name: 'login' })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="重铸道基" subtitle="以邮箱为凭，另立新密令">
    <form class="auth-form" @submit.prevent="onSubmit">
      <div class="field">
        <label>邮箱</label>
        <input v-model.trim="form.email" type="email" placeholder="注册时所留邮箱" autocomplete="email" />
      </div>
      <div class="field">
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
      <div class="field">
        <label>新密码</label>
        <input v-model="form.password" type="password" placeholder="至少 6 位" autocomplete="new-password" />
      </div>
      <div class="field">
        <label>确认新密码</label>
        <input v-model="form.confirm" type="password" placeholder="再次输入新密码" autocomplete="new-password" />
      </div>

      <p class="form-error">{{ error }}</p>

      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? '重铸中…' : '重铸道基' }}
      </button>
    </form>

    <p class="switch">
      想起密令了？<RouterLink to="/login">返回登入</RouterLink>
    </p>
  </AuthShell>
</template>

<style scoped>
/* 验证码输入 + 获取按钮同行（input 非 .field 直接子元素，补齐 AuthShell 同款样式，单栏标准档） */
.code-row {
  display: flex;
  gap: 8px;
}
.code-row input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 12px 14px;
  font-family: inherit;
  font-size: 15px;
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
  padding: 0 16px;
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
</style>
