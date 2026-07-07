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
