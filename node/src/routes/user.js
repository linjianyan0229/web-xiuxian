import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { getProfile } from '../controllers/userController.js'

const router = Router()

// 需鉴权：获取当前登录用户信息
router.get('/profile', authRequired, getProfile)

export default router
