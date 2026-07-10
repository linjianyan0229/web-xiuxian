import { Router } from 'express'
import { register, login, logout, sendEmailCode, resetPassword, registerConfig } from '../controllers/authController.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

// 注册页配置（公开）：返回注册是否需要邮箱验证码，前端据此隐藏验证码输入
router.get('/register-config', registerConfig)
router.post('/register', register)
router.post('/login', login)
router.post('/logout', authRequired, logout)
// 邮箱验证码（公开）：注册/重置密码共用，purpose 取 register|reset；同邮箱同用途 60 秒限频
router.post('/email-code', sendEmailCode)
// 重置密码（公开）：邮箱+验证码+新密码，成功后吊销该账号现有登录
router.post('/reset-password', resetPassword)

export default router
