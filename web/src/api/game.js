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

// 修行日志（最近 N 条）
export const apiPlayerLogs = (limit) => http.get('/user/logs', { params: { limit } })
