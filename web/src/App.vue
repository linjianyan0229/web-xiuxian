<script setup>
import { RouterView } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
</script>

<template>
  <RouterView />
  <!-- 全局右上角通知 -->
  <ToastHost />
</template>
