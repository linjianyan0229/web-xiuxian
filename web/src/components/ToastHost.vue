<script setup>
import { useToast } from '../composables/toast.js'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="t.type"
        @click="dismiss(t.id)"
      >
        <span class="dot"></span>
        <span class="msg">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
  /* 固定宽度而非 max-width：离场动画中元素转为 absolute 后，
     容器宽度若塌陷会把文字挤成竖排 */
  width: min(360px, calc(100vw - 32px));
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: baseline;
  gap: 9px;
  padding: 11px 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-h);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  cursor: pointer;
  max-width: 100%;
}
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transform: translateY(-1px);
}
.toast.info .dot { background: var(--muted); }
.toast.success .dot { background: var(--accent); }
.toast.error .dot { background: var(--danger); }
.toast.error { border-color: var(--danger); }
.msg {
  word-break: break-word;
}

/* 出入场：自右侧滑入，列表位移平滑 */
.toast-enter-active,
.toast-leave-active,
.toast-move {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
.toast-leave-active {
  position: absolute;
  right: 0;
}
</style>
