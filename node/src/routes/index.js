import { Router } from 'express'
import authRouter from './auth.js'
import userRouter from './user.js'
import adminRouter from './admin.js'

const router = Router()

// 健康检查
router.get('/health', (req, res) => {
  res.json({ status: 'ok', game: 'web-xiuxian' })
})

// 业务模块
router.use('/auth', authRouter)
router.use('/user', userRouter)
router.use('/admin', adminRouter)

export default router
