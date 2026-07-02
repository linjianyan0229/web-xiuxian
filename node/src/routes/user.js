import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { getProfile, rankings } from '../controllers/userController.js'

const router = Router()

// 需鉴权：获取当前登录用户信息
router.get('/profile', authRequired, getProfile)
// 需鉴权：排行榜（境界/在线/死亡，各前十）
router.get('/rankings', authRequired, rankings)

export default router
