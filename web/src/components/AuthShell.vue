<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="brand">
        <div class="seal">仙</div>
        <h1>文字修仙</h1>
        <p class="tagline">道法自然 · 逆天而行</p>
      </div>

      <div class="auth-head">
        <h2>{{ title }}</h2>
        <p v-if="subtitle" class="sub">{{ subtitle }}</p>
      </div>

      <slot />
    </div>
    <p class="footnote">仙路漫漫，唯心不改</p>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 24px;
}
.auth-card {
  width: 100%;
  max-width: 380px;
  padding: 36px 32px 32px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
}
.brand {
  text-align: center;
  margin-bottom: 26px;
}
.seal {
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  font-family: var(--serif);
  font-size: 26px;
  color: #fff;
  background: var(--accent);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.brand h1 {
  margin: 0;
  font-family: var(--serif);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 6px;
  color: var(--text-h);
}
.tagline {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--muted);
}
.auth-head {
  margin-bottom: 20px;
  text-align: center;
}
.auth-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 500;
  color: var(--text-h);
  letter-spacing: 1px;
}
.auth-head .sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--muted);
}
.footnote {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--muted);
  opacity: 0.7;
}
</style>
