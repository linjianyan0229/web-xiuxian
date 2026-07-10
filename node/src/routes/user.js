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
import {
  getSects,
  getSectMeta,
  getSectDetail,
  doCreateSect,
  getSectMembers,
  doJoinSect,
  doQuitSect,
  doAppoint,
  doKick,
  doTransferLeader,
  doUpdateMySect,
  doDisbandMySect,
} from '../controllers/sectController.js'
import { checkSensitive } from '../controllers/sensitiveController.js'
import { getAnnouncements } from '../controllers/announcementController.js'
import {
  getRelation,
  getFriends,
  requestFriend,
  acceptFriend,
  rejectFriend,
  removeFriend,
  getBlocks,
  blockUser,
  unblockUser,
} from '../controllers/relationController.js'
import {
  getConversations,
  getUnreadCount,
  getConversation,
  sendMessage,
} from '../controllers/privateMessageController.js'

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
// 需鉴权：通知弹窗数据（已发布修仙公告 + 本人系统通知，如收到丹药赠礼）
router.get('/announcements', authRequired, getAnnouncements)
// 需鉴权：宗门 —— 列表（搜索/筛选/分页）/ 元数据 / 详情 / 创建（meta 须先于 :id 声明）
router.get('/sects/meta', authRequired, getSectMeta)
router.get('/sects', authRequired, getSects)
router.get('/sects/:id', authRequired, getSectDetail)
router.post('/sects', authRequired, doCreateSect)
// 需鉴权：宗门成员与职位 —— 成员列表 / 加入 / 退出 / 任免 / 逐出 / 传位 / 改资料 / 解散
router.get('/sects/:id/members', authRequired, getSectMembers)
router.post('/sects/quit', authRequired, doQuitSect)
router.post('/sects/:id/join', authRequired, doJoinSect)
router.post('/sects/:id/appoint', authRequired, doAppoint)
router.post('/sects/:id/kick', authRequired, doKick)
router.post('/sects/:id/transfer', authRequired, doTransferLeader)
router.put('/sects/:id', authRequired, doUpdateMySect)
router.post('/sects/:id/disband', authRequired, doDisbandMySect)
// 需鉴权：好友（结交）—— 列表(好友+待通过请求) / 发起 / 应允 / 婉拒 / 断交
router.get('/friends', authRequired, getFriends)
router.post('/friends/request', authRequired, requestFriend)
router.post('/friends/accept', authRequired, acceptFriend)
router.post('/friends/reject', authRequired, rejectFriend)
router.post('/friends/remove', authRequired, removeFriend)
// 需鉴权：拉黑 —— 黑名单 / 拉黑 / 解除
router.get('/blocks', authRequired, getBlocks)
router.post('/blocks', authRequired, blockUser)
router.post('/blocks/remove', authRequired, unblockUser)
// 需鉴权：关系状态（名片按钮态判定：是否好友/待通过/拉黑）
router.get('/relations/:userId', authRequired, getRelation)
// 需鉴权：私信 —— 会话列表 / 未读数 / 某会话消息 / 发送（unread 须先于 :userId 声明）
router.get('/messages', authRequired, getConversations)
router.get('/messages/unread', authRequired, getUnreadCount)
router.get('/messages/:userId', authRequired, getConversation)
router.post('/messages', authRequired, sendMessage)

export default router
