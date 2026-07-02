import http from './http.js'

// 玩家可见的排行榜（境界/在线/死亡，各前十）
export const apiGameRankings = () => http.get('/user/rankings')
