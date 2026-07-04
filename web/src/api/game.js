import http from './http.js'

// 玩家可见的排行榜（境界/在线/死亡，各前十）
export const apiGameRankings = () => http.get('/user/rankings')

// 每日签到：查询状态 / 执行签到
export const apiSignInStatus = () => http.get('/user/sign-in')
export const apiSignIn = () => http.post('/user/sign-in')
