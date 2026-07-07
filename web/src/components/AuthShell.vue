<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
})

// 飘动的灵气光点（位置/大小/时长错落，纯装饰）
const motes = [
  { left: '8%', top: '18%', size: 5, delay: 0, dur: 9 },
  { left: '18%', top: '72%', size: 3, delay: 1.5, dur: 11 },
  { left: '32%', top: '38%', size: 4, delay: 3, dur: 10 },
  { left: '68%', top: '22%', size: 3, delay: 0.8, dur: 12 },
  { left: '82%', top: '60%', size: 5, delay: 2.2, dur: 9.5 },
  { left: '90%', top: '34%', size: 3, delay: 4, dur: 13 },
  { left: '52%', top: '80%', size: 4, delay: 1.2, dur: 10.5 },
  { left: '74%', top: '84%', size: 3, delay: 3.4, dur: 11.5 },
]
</script>

<template>
  <div class="auth-page">
    <!-- 分层水墨背景：远山 / 雾气 / 灵气光点 -->
    <div class="scenery" aria-hidden="true">
      <div class="mountain m-far"></div>
      <div class="mountain m-mid"></div>
      <div class="mountain m-near"></div>
      <div class="mist mist-1"></div>
      <div class="mist mist-2"></div>
      <span
        v-for="(mo, i) in motes"
        :key="i"
        class="mote"
        :style="{
          left: mo.left,
          top: mo.top,
          width: mo.size + 'px',
          height: mo.size + 'px',
          animationDelay: mo.delay + 's',
          animationDuration: mo.dur + 's',
        }"
      ></span>
    </div>

    <div class="auth-card" :class="{ wide: !!$slots.aside }">
      <!-- 四角墨纹 -->
      <span class="corner tl"></span>
      <span class="corner tr"></span>
      <span class="corner bl"></span>
      <span class="corner br"></span>

      <!-- 左侧展示栏（可选 aside 插槽：注册页的修仙角色展示等），提供则卡片变宽二分栏 -->
      <div v-if="$slots.aside" class="card-aside">
        <slot name="aside" />
      </div>

      <div class="card-main">
        <div class="brand">
          <div class="seal-wrap">
            <div class="seal-ring"></div>
            <div class="seal">仙</div>
          </div>
          <h1>文字修仙</h1>
          <p class="tagline">道法自然 · 逆天而行</p>
        </div>

        <div class="auth-head">
          <div class="divider"><i></i><b>◆</b><i></i></div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle" class="sub">{{ subtitle }}</p>
        </div>

        <slot />
      </div>
    </div>

    <p class="footnote">仙路漫漫 · 唯心不改</p>
  </div>
</template>

<style scoped>
.auth-page {
  /* 自成一套水墨浅色主题（金/墨/宣纸），不随系统深浅变化，贴合游戏首页 */
  --ink-h: #26282c;
  --ink: #55585f;
  --ink-mut: #8b8e8a;
  --gold: #b8933f;
  --gold-2: #e6cf93;
  --gold-deep: #96702a;
  --panel: rgba(252, 250, 244, 0.9);
  --panel-line: rgba(60, 56, 46, 0.16);
  --field-bg: rgba(255, 255, 255, 0.66);
  --danger: #b4453a;

  position: relative;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--ink);
  font-family: var(--serif, 'Songti SC', 'SimSun', serif);
  background:
    radial-gradient(1100px 520px at 72% -12%, rgba(255, 255, 255, 0.85), transparent 60%),
    radial-gradient(900px 640px at 8% 112%, rgba(190, 196, 188, 0.5), transparent 62%),
    linear-gradient(160deg, #eef0eb 0%, #e4e7e1 46%, #d8dcd5 100%);
}

/* ---- 背景山水 ---- */
.scenery {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.mountain {
  position: absolute;
  left: -5%;
  right: -5%;
  bottom: 0;
  background: linear-gradient(180deg, transparent, currentColor);
  -webkit-mask: linear-gradient(180deg, transparent, #000 62%);
  mask: linear-gradient(180deg, transparent, #000 62%);
}
.m-far {
  height: 46%;
  color: rgba(120, 132, 128, 0.22);
  clip-path: polygon(0 78%, 14% 50%, 26% 66%, 40% 34%, 55% 60%, 68% 40%, 82% 62%, 100% 44%, 100% 100%, 0 100%);
}
.m-mid {
  height: 38%;
  color: rgba(96, 108, 106, 0.28);
  clip-path: polygon(0 70%, 12% 46%, 30% 68%, 46% 40%, 60% 64%, 76% 44%, 90% 66%, 100% 52%, 100% 100%, 0 100%);
}
.m-near {
  height: 28%;
  color: rgba(66, 74, 72, 0.32);
  clip-path: polygon(0 64%, 18% 40%, 34% 60%, 52% 34%, 70% 58%, 86% 40%, 100% 60%, 100% 100%, 0 100%);
}
.mist {
  position: absolute;
  left: -20%;
  right: -20%;
  height: 160px;
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.7), transparent 70%);
  filter: blur(6px);
  animation: drift 26s ease-in-out infinite;
}
.mist-1 { bottom: 26%; animation-duration: 30s; }
.mist-2 { bottom: 12%; opacity: 0.8; animation-duration: 38s; animation-direction: reverse; }
@keyframes drift {
  0%, 100% { transform: translateX(-4%); }
  50% { transform: translateX(6%); }
}
.mote {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, var(--gold-2), rgba(184, 147, 63, 0.15));
  box-shadow: 0 0 8px rgba(184, 147, 63, 0.55);
  opacity: 0.5;
  animation: float linear infinite;
}
@keyframes float {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  15% { opacity: 0.7; }
  85% { opacity: 0.5; }
  100% { transform: translateY(-46px) scale(0.5); opacity: 0; }
}

/* ---- 卡片 ---- */
.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 404px;
  padding: 0;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 18px;
  box-shadow:
    0 30px 70px -28px rgba(40, 38, 30, 0.55),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(3px);
  animation: rise 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
/* 内容区承接原卡片内边距（单栏视觉不变），双栏时作为右栏 */
.card-main {
  min-width: 0;
  padding: 30px 36px 28px;
}
/* 带 aside 的宽卡片：左展示 / 右表单 二分栏。
   整卡高度锁在视口内（预留页面内边距+落款），矮屏时右栏内部滚动，页面不出滚动条 */
.auth-card.wide {
  max-width: 900px;
  max-height: calc(100svh - 96px);
  display: flex;
  align-items: stretch;
}
.card-aside {
  position: relative;
  flex: 0 0 44%;
  min-height: 0;
  border-right: 1px solid var(--panel-line);
  background: linear-gradient(170deg, #e7e9e3 0%, #d9ddd5 100%);
}
.auth-card.wide .card-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 24px 30px 20px;
}
.auth-card.wide .card-main::-webkit-scrollbar {
  width: 0;
  height: 0;
}
/* 二分栏下右栏纵向紧凑化：压缩金印/标题/表单间距，保证常见屏高一屏放下 */
.auth-card.wide .brand { margin-bottom: 10px; }
.auth-card.wide .seal-wrap {
  width: 46px;
  height: 46px;
  margin-bottom: 8px;
}
.auth-card.wide .seal { font-size: 21px; }
.auth-card.wide .brand h1 { font-size: 21px; letter-spacing: 5px; text-indent: 5px; }
.auth-card.wide .tagline { margin-top: 4px; font-size: 11px; }
.auth-card.wide .auth-head { margin-bottom: 12px; }
.auth-card.wide .divider { margin-bottom: 8px; }
.auth-card.wide .auth-head h2 { font-size: 17px; }
.auth-card.wide .auth-head .sub { margin-top: 5px; font-size: 12px; }
.auth-card.wide :deep(.auth-form) { gap: 10px; }
.auth-card.wide :deep(.field > input) {
  padding: 10px 12px;
  font-size: 14px;
}
.auth-card.wide :deep(.form-error) { min-height: 16px; }
.auth-card.wide :deep(.btn) { padding: 11px 16px; font-size: 15px; }
.auth-card.wide :deep(.switch) { margin-top: 12px; }
@keyframes rise {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
/* 四角墨纹 */
.corner {
  position: absolute;
  z-index: 2;
  width: 18px;
  height: 18px;
  border: 1px solid var(--gold);
  opacity: 0.5;
}
.corner.tl { top: 12px; left: 12px; border-right: 0; border-bottom: 0; }
.corner.tr { top: 12px; right: 12px; border-left: 0; border-bottom: 0; }
.corner.bl { bottom: 12px; left: 12px; border-right: 0; border-top: 0; }
.corner.br { bottom: 12px; right: 12px; border-left: 0; border-top: 0; }

/* 品牌 / 金印 */
.brand {
  text-align: center;
  margin-bottom: 16px;
}
.seal-wrap {
  position: relative;
  width: 58px;
  height: 58px;
  margin: 0 auto 12px;
}
.seal-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px solid rgba(184, 147, 63, 0.5);
  animation: spin 14s linear infinite;
}
.seal-ring::before {
  content: '';
  position: absolute;
  top: -3px;
  left: 50%;
  width: 5px;
  height: 5px;
  margin-left: -2.5px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 8px var(--gold-2);
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.seal {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 27px;
  font-weight: 700;
  color: #fff9ec;
  background: radial-gradient(circle at 32% 28%, #d9b661, #b8933f 62%, #96702a);
  border-radius: 50%;
  box-shadow:
    0 10px 22px -8px rgba(150, 112, 42, 0.8),
    inset 0 1px 3px rgba(255, 255, 255, 0.5);
}
.brand h1 {
  margin: 0;
  font-size: 25px;
  font-weight: 700;
  letter-spacing: 7px;
  text-indent: 7px;
  color: var(--ink-h);
}
.tagline {
  margin: 7px 0 0;
  font-size: 12px;
  letter-spacing: 4px;
  text-indent: 4px;
  color: var(--gold-deep);
}

/* 分节标题 */
.auth-head {
  margin-bottom: 18px;
  text-align: center;
}
.divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--gold);
}
.divider i {
  height: 1px;
  width: 58px;
  background: linear-gradient(90deg, transparent, rgba(184, 147, 63, 0.6));
}
.divider i:last-child {
  background: linear-gradient(90deg, rgba(184, 147, 63, 0.6), transparent);
}
.divider b {
  font-size: 9px;
  font-weight: 400;
}
.auth-head h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 3px;
  text-indent: 3px;
  color: var(--ink-h);
}
.auth-head .sub {
  margin: 8px 0 0;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--ink-mut);
}

.footnote {
  position: relative;
  z-index: 1;
  font-size: 12px;
  letter-spacing: 3px;
  text-indent: 3px;
  color: var(--ink-mut);
  opacity: 0.75;
}

/* ---- 表单基元美化（仅作用于插槽内的登录/注册表单，不影响后台）---- */
.auth-card :deep(.auth-form) {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.auth-card :deep(.field) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}
.auth-card :deep(.field > label) {
  font-size: 12.5px;
  letter-spacing: 1px;
  color: var(--ink-mut);
}
.auth-card :deep(.field > input) {
  width: 100%;
  padding: 12px 14px;
  font-family: inherit;
  font-size: 15px;
  color: var(--ink-h);
  background: var(--field-bg);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.auth-card :deep(.field > input::placeholder) {
  color: var(--ink-mut);
  opacity: 0.65;
}
.auth-card :deep(.field > input:focus) {
  border-color: var(--gold);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 3px rgba(184, 147, 63, 0.16);
}
.auth-card :deep(.form-error) {
  min-height: 18px;
  margin: 0;
  font-size: 12.5px;
  color: var(--danger);
  text-align: left;
}
.auth-card :deep(.btn) {
  width: 100%;
  margin-top: 4px;
  padding: 13px 16px;
  font-family: inherit;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 5px;
  text-indent: 5px;
  color: #4a3a12;
  background: linear-gradient(180deg, #f2dda6, #d4af5b);
  border: 1px solid rgba(184, 147, 63, 0.6);
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 10px 22px -10px rgba(184, 147, 63, 0.85);
  transition: filter 0.2s, transform 0.08s, box-shadow 0.2s;
}
.auth-card :deep(.btn:hover:not(:disabled)) {
  filter: brightness(1.05);
}
.auth-card :deep(.btn:active:not(:disabled)) {
  transform: translateY(1px);
}
.auth-card :deep(.btn:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

/* 底部切换链接 */
.auth-card :deep(.switch) {
  margin: 16px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--ink-mut);
}
.auth-card :deep(.switch a) {
  color: var(--gold-deep);
  font-weight: 700;
  border-bottom: 1px solid rgba(150, 112, 42, 0.4);
  padding-bottom: 1px;
  transition: color 0.2s, border-color 0.2s;
}
.auth-card :deep(.switch a:hover) {
  color: var(--gold);
  border-color: var(--gold);
}

/* 窄屏：宽卡片改上下堆叠，展示栏收成横幅（恢复整页滚动，取消卡内滚动与高度锁定） */
@media (max-width: 860px) {
  .auth-card.wide {
    max-width: 404px;
    max-height: none;
    flex-direction: column;
  }
  .auth-card.wide .card-main {
    overflow-y: visible;
  }
  .card-aside {
    flex: none;
    min-height: 0;
    height: 240px;
    border-right: none;
    border-bottom: 1px solid var(--panel-line);
  }
}

@media (max-width: 480px) {
  .card-main { padding: 32px 24px 28px; }
  .brand h1 { font-size: 24px; letter-spacing: 5px; }
}

/* 尊重「减少动态效果」偏好：关闭飘动/旋转/浮现动画 */
@media (prefers-reduced-motion: reduce) {
  .mist,
  .mote,
  .seal-ring,
  .auth-card {
    animation: none;
  }
  .mote { opacity: 0.5; }
}
</style>
