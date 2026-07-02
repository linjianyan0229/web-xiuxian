import { Router } from 'express'
import { adminAuthRequired } from '../middleware/adminAuth.js'
import { adminProfile } from '../controllers/adminAuthController.js'
import {
  dashboard,
  getUsers,
  setUserStatus,
  getRealms,
  rankings,
} from '../controllers/adminController.js'

const router = Router()

// 全部需管理员鉴权（登录统一走 /api/auth/login，令牌带 role=admin）
router.get('/profile', adminAuthRequired, adminProfile)
router.get('/dashboard', adminAuthRequired, dashboard)
router.get('/users', adminAuthRequired, getUsers)
router.patch('/users/:id/status', adminAuthRequired, setUserStatus)
router.get('/realms', adminAuthRequired, getRealms)
router.get('/rankings', adminAuthRequired, rankings)

export default router
