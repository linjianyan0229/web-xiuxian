<script setup>
import { ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
import { useHeartbeat } from './composables/heartbeat.js'

// 玩家登录期间全局心跳（15 秒/跳，在线榜网络状态数据源）
useHeartbeat()

// 页面切换过渡：游戏内页面（home ↔ sect）按前进/返回方向滑动，其余路由轻淡入；
// 首次进入/刷新不做动画（from 无 name）
const GAME_PAGES = ['home', 'sect', 'my-sect', 'friends', 'pills', 'equipment']
const transitionName = ref('')
const router = useRouter()
router.afterEach((to, from) => {
  if (!from.name) {
    transitionName.value = ''
  } else if (GAME_PAGES.includes(to.name) && GAME_PAGES.includes(from.name)) {
    // home → sect 前进（新页自右滑入）；sect → home 返回（新页自左滑入）
    transitionName.value = to.name === 'home' ? 'page-back' : 'page-forward'
  } else {
    transitionName.value = 'page-fade'
  }
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition :name="transitionName" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <!-- 全局右上角通知 -->
  <ToastHost />
</template>

<style>
/* 路由页过渡（Transition 类挂在各路由组件根元素上，需全局样式） */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.22s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

.page-forward-enter-active,
.page-back-enter-active {
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.page-forward-leave-active,
.page-back-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.8, 0.4);
}
.page-forward-enter-from {
  opacity: 0;
  transform: translateX(46px);
}
.page-forward-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
.page-back-enter-from {
  opacity: 0;
  transform: translateX(-46px);
}
.page-back-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 尊重「减少动态效果」偏好：只保留极短淡入淡出 */
@media (prefers-reduced-motion: reduce) {
  .page-forward-enter-active,
  .page-forward-leave-active,
  .page-back-enter-active,
  .page-back-leave-active {
    transition: opacity 0.12s ease;
  }
  .page-forward-enter-from,
  .page-forward-leave-to,
  .page-back-enter-from,
  .page-back-leave-to {
    transform: none;
  }
}
</style>
