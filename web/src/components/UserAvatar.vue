<script setup>
import { ref, watch } from 'vue'

// 通用圆形头像：有 avatar 则显示图片，无（或加载失败）则以道号首字作占位。
// 配色可由父组件通过 CSS 变量 --ava-bg / --ava-fg / --ava-line 覆盖（默认取全局主题变量）。
const props = defineProps({
  avatar: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: Number, default: 28 },
})

const broken = ref(false)
watch(() => props.avatar, () => {
  broken.value = false
})
</script>

<template>
  <span
    class="avatar"
    :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.48) + 'px' }"
  >
    <img v-if="avatar && !broken" :src="avatar" :alt="name" @error="broken = true" />
    <i v-else>{{ (name || '道').slice(0, 1) }}</i>
  </span>
</template>

<style scoped>
.avatar {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  color: var(--ava-fg, var(--muted, #8b8e8a));
  background: var(--ava-bg, var(--field-bg, rgba(120, 120, 120, 0.12)));
  border: 1px solid var(--ava-line, var(--border, rgba(120, 120, 120, 0.25)));
  user-select: none;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.avatar i {
  font-style: normal;
  line-height: 1;
}
</style>
