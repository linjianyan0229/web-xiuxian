import { Router } from 'express'
import { authRequired } from '../middleware/auth.js'
import { getProfile, rankings, getLogs, getTodayStats, heartbeat } from '../controllers/userController.js'
import { getSignInStatus, doSignIn } from '../controllers/signInController.js'
import { getCultivateStatus, doCultivate } from '../controllers/cultivateController.js'
import { getBreakthroughStatus, doBreakthrough } from '../controllers/breakthroughController.js'
import { getMeditationStatus, startMeditation } from '../controllers/meditationController.js'
import { avatarUpload, uploadAvatar, setAvatarUrl } from '../controllers/avatarController.js'
import { getMyPills, getMyPillMeta, giftPill, discardPill } from '../controllers/userPillController.js'
import { getWorldMessages, postWorldMessage } from '../controllers/worldChatController.js'
import { getSects, getSectMeta, getSectDetail, doCreateSect } from '../controllers/sectController.js'
import { checkSensitive } from '../controllers/sensitiveController.js'

const router = Router()

// 需鉴权：获取当前登录用户信息
router.get('/profile', authRequired, getProfile)
// 需鉴权：排行榜（境界/在线/死亡，各前十）
router.get('/rankings', authRequired, rankings)
// 需鉴权：心跳（前台每 15 秒上报，带上一跳实测延迟；在线榜网络状态数据源）
router.post('/heartbeat', authRequired, heartbeat)
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
// 需鉴权：丹药背包 —— 列表（筛选/分页）/ 筛选元数据 / 赠送 / 丢弃
router.get('/pills', authRequired, getMyPills)
router.get('/pills/meta', authRequired, getMyPillMeta)
router.post('/pills/gift', authRequired, giftPill)
router.post('/pills/discard', authRequired, discardPill)
// 需鉴权：修行日志（最近 N 条）
router.get('/logs', authRequired, getLogs)
// 需鉴权：今日修炼统计（修炼次数/打坐时长/获得修为 + 突破成功率，首页「今日修炼」面板）
router.get('/today', authRequired, getTodayStats)
// 需鉴权：头像 —— 上传图片（multipart/form-data，文件字段名 avatar）/ 以外链 URL 设置（传空清除）
router.post('/avatar', authRequired, avatarUpload, uploadAvatar)
router.post('/avatar/url', authRequired, setAvatarUrl)
// 需鉴权：世界频道 —— 拉取消息（afterId 增量轮询）/ 发言（冷却见系统配置）
router.get('/world-chat', authRequired, getWorldMessages)
router.post('/world-chat', authRequired, postWorldMessage)
// 需鉴权：敏感词检测（通用预检；世界频道发言已服务端强制拦截）
router.post('/sensitive/check', authRequired, checkSensitive)
// 需鉴权：宗门 —— 列表（搜索/筛选/分页）/ 元数据 / 详情 / 创建（meta 须先于 :id 声明）
router.get('/sects/meta', authRequired, getSectMeta)
router.get('/sects', authRequired, getSects)
router.get('/sects/:id', authRequired, getSectDetail)
router.post('/sects', authRequired, doCreateSect)

export default router
