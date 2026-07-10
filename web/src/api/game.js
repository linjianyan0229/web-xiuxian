import http from './http.js'

// 玩家可见的排行榜（境界/在线/死亡，各前十）
export const apiGameRankings = () => http.get('/user/rankings')

// 每日签到：查询状态 / 执行签到
export const apiSignInStatus = () => http.get('/user/sign-in')
export const apiSignIn = () => http.post('/user/sign-in')

// 修炼：查询状态（单次收益/冷却/进度）/ 执行修炼
export const apiCultivateStatus = () => http.get('/user/cultivate')
export const apiCultivate = () => http.post('/user/cultivate')

// 境界突破：查询条件与雷劫信息 / 执行突破
export const apiBreakthroughStatus = () => http.get('/user/breakthrough')
export const apiBreakthrough = () => http.post('/user/breakthrough')

// 打坐：查询状态（可选时长 / 进行中剩余）/ 开始打坐
export const apiMeditationStatus = () => http.get('/user/meditation')
export const apiMeditationStart = (minutes) => http.post('/user/meditation', { minutes })

// 丹药背包：列表（筛选/分页）/ 筛选元数据 / 赠送 / 丢弃
export const apiMyPills = (params) => http.get('/user/pills', { params })
export const apiMyPillMeta = () => http.get('/user/pills/meta')
export const apiPillGift = (payload) => http.post('/user/pills/gift', payload)
export const apiPillDiscard = (payload) => http.post('/user/pills/discard', payload)

// 头像：上传本地图片（multipart）/ 以外链 URL 设置（url 传空字符串恢复默认首字占位）
export const apiUploadAvatar = (file) => {
  const fd = new FormData()
  fd.append('avatar', file)
  return http.post('/user/avatar', fd)
}
export const apiSetAvatarUrl = (url) => http.post('/user/avatar/url', { url })

// 修行日志（最近 N 条）
export const apiPlayerLogs = (limit) => http.get('/user/logs', { params: { limit } })

// 今日修炼统计（修炼次数/打坐时长/获得修为 + 突破成功率，首页「今日修炼」面板）
export const apiTodayStats = () => http.get('/user/today')

// 世界频道：拉取消息（afterId>0 时增量轮询，只回新消息）/ 发言
export const apiWorldChat = (afterId = 0) => http.get('/user/world-chat', { params: { afterId } })
export const apiWorldChatSend = (content) => http.post('/user/world-chat', { content })

// 宗门：列表（搜索/筛选/分页）/ 元数据（境界要求选项+立派费用）/ 详情 / 创建（扣灵石）
export const apiSects = (params) => http.get('/user/sects', { params })
export const apiSectMeta = () => http.get('/user/sects/meta')
export const apiSectDetail = (id) => http.get(`/user/sects/${id}`)
export const apiSectCreate = (payload) => http.post('/user/sects', payload)

// 宗门成员与职位：成员列表 / 加入 / 退出 / 任免 / 逐出 / 传位 / 改资料 / 解散
export const apiSectMembers = (id, params) => http.get(`/user/sects/${id}/members`, { params })
export const apiSectJoin = (id) => http.post(`/user/sects/${id}/join`)
export const apiSectQuit = () => http.post('/user/sects/quit')
export const apiSectAppoint = (id, targetId, position) =>
  http.post(`/user/sects/${id}/appoint`, { targetId, position })
export const apiSectKick = (id, targetId) => http.post(`/user/sects/${id}/kick`, { targetId })
export const apiSectTransfer = (id, targetId) => http.post(`/user/sects/${id}/transfer`, { targetId })
export const apiSectUpdate = (id, payload) => http.put(`/user/sects/${id}`, payload)
export const apiSectDisband = (id) => http.post(`/user/sects/${id}/disband`)

// 心跳：登录期间每 15 秒上报一次（pingMs 为上一跳实测往返延迟，在线榜网络状态数据源）
export const apiHeartbeat = (pingMs) => http.post('/user/heartbeat', { pingMs })

// 通知：已发布修仙公告 + 本人系统通知（如收到丹药赠礼），供首页「通知」弹窗展示
export const apiAnnouncements = () => http.get('/user/announcements')

// 关系状态：我与某道友（是否好友/待通过/拉黑），供频道名片按钮态判定
export const apiRelation = (userId) => http.get(`/user/relations/${userId}`)

// 好友（结交）：列表（好友 + 收到的待通过请求）/ 发起 / 应允 / 婉拒 / 断交
export const apiFriends = () => http.get('/user/friends')
export const apiFriendRequest = (targetId) => http.post('/user/friends/request', { targetId })
export const apiFriendAccept = (requestId) => http.post('/user/friends/accept', { requestId })
export const apiFriendReject = (requestId) => http.post('/user/friends/reject', { requestId })
export const apiFriendRemove = (targetId) => http.post('/user/friends/remove', { targetId })

// 拉黑：黑名单 / 拉黑 / 解除
export const apiBlocks = () => http.get('/user/blocks')
export const apiBlock = (targetId) => http.post('/user/blocks', { targetId })
export const apiUnblock = (targetId) => http.post('/user/blocks/remove', { targetId })

// 私信：会话列表 / 未读数 / 某会话消息（并标记已读）/ 发送
export const apiConversations = () => http.get('/user/messages')
export const apiUnreadCount = () => http.get('/user/messages/unread')
export const apiConversation = (userId) => http.get(`/user/messages/${userId}`)
export const apiSendMessage = (targetId, content) => http.post('/user/messages', { targetId, content })
