import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

// 弹窗可访问性：焦点圈定（Tab 循环）、Esc 关闭、打开时焦点移入、关闭后焦点恢复。
// 用法：const { dialogRef } = useModalA11y(() => props.visible, () => emit('close'))
// 模板：<div ref="dialogRef" role="dialog" aria-modal="true" aria-labelledby="<标题id>" tabindex="-1">

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useModalA11y(visible, onClose) {
  const dialogRef = ref(null)
  let restoreEl = null

  function focusables() {
    const root = dialogRef.value
    if (!root) return []
    // offsetParent 为 null 即处于隐藏分支（v-show/display:none），不参与循环
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null
    )
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const root = dialogRef.value
    if (!root) return
    const list = focusables()
    if (list.length === 0) {
      e.preventDefault()
      root.focus()
      return
    }
    const first = list[0]
    const last = list[list.length - 1]
    const active = document.activeElement
    // 不在循环列表内（弹窗根节点自身持焦、焦点意外跑出弹窗）也一律拉回首尾
    if (e.shiftKey) {
      if (active === first || !list.includes(active)) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last || !list.includes(active)) {
      e.preventDefault()
      first.focus()
    }
  }

  function activate() {
    restoreEl = document.activeElement
    document.addEventListener('keydown', onKeydown, true)
    nextTick(() => {
      dialogRef.value?.focus()
    })
  }

  function deactivate() {
    document.removeEventListener('keydown', onKeydown, true)
    if (restoreEl && document.contains(restoreEl) && typeof restoreEl.focus === 'function') {
      restoreEl.focus()
    }
    restoreEl = null
  }

  watch(
    visible,
    (v, ov) => {
      if (v) activate()
      else if (ov) deactivate()
    },
    { immediate: true }
  )
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown, true)
  })

  return { dialogRef }
}
