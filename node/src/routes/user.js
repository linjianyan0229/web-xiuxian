import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { getProfile, rankings, getLogs } from '../controllers/userController.js'
import { getSignInStatus, doSignIn } from '../controllers/signInController.js'
import { getCultivateStatus, doCultivate } from '../controllers/cultivateController.js'
import { getBreakthroughStatus, doBreakthrough } from '../controllers/breakthroughController.js'
import { getMeditationStatus, startMeditation } from '../controllers/meditationController.js'

const router = Router()

// 需鉴权：获取当前登录用户信息
router.get('/profile', authRequired, getProfile)
// 需鉴权：排行榜（境界/在线/死亡，各前十）
router.get('/rankings', authRequired, rankings)
// 需鉴权：每日签到 —— 查询状态 / 执行签到
router.get('/sign-in', authRequired, getSignInStatus)
router.post('/sign-in', authRequired, doSignIn)
// 需鉴权：修炼 —— 查询状态 / 执行修炼（收益=当前境界圆满修为的5%，冷却见系统配置）
router.get('/cultivate', authRequired, getCultivateStatus)
router.post('/cultivate', authRequired, doCultivate)
// 需鉴权：境界突破 —— 查询条件与雷劫信息 / 执行突破
router.get('/breakthrough', authRequired, getBreakthroughStatus)
router.post('/breakthrough', authRequired, doBreakthrough)
// 需鉴权：打坐 —— 查询状态（打坐中剩余/可选时长与预估收益）/ 开始打坐（期满自动结算，不可中断）
router.get('/meditation', authRequired, getMeditationStatus)
router.post('/meditation', authRequired, startMeditation)
// 需鉴权：修行日志（最近 N 条）
router.get('/logs', authRequired, getLogs)

export default router
