import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/login' },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { requiresAuth: true },
  },

  /* ---------- 后台管理（登录统一走 /login，按 role 进入） ---------- */
  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('../views/admin/DashboardView.vue'),
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('../views/admin/UsersView.vue'),
      },
      {
        path: 'realms',
        name: 'admin-realms',
        component: () => import('../views/admin/RealmsView.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫：单一登录态（token），后台准入由用户 role 决定
router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const isAdmin = user?.role === 1

  if (to.meta.requiresAuth && !token) {
    return { name: 'login' }
  }
  if (to.meta.guestOnly && token) {
    // 已登录访问登录/注册页：管理员进后台，玩家进游戏
    return isAdmin ? { name: 'admin-dashboard' } : { name: 'home' }
  }
  if (to.meta.requiresAdmin) {
    if (!token) return { name: 'login' }
    if (!isAdmin) return { name: 'home' } // 已登录但非管理员，挡回游戏首页
  }
})

export default router
