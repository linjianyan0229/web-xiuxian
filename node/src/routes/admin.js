import { Router } from 'express'
import { adminAuthRequired } from '../middleware/adminAuth.js'
import { adminLogin, adminProfile } from '../controllers/adminAuthController.js'
import { dashboard, getUsers, setUserStatus } from '../controllers/adminController.js'

const router = Router()

// 公开：管理员登录
router.post('/login', adminLogin)

// 以下均需管理员鉴权
router.get('/profile', adminAuthRequired, adminProfile)
router.get('/dashboard', adminAuthRequired, dashboard)
router.get('/users', adminAuthRequired, getUsers)
router.patch('/users/:id/status', adminAuthRequired, setUserStatus)

export default router
