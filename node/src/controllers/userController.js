import { rankByRealm, rankOnlineByRealm, rankByDeath } from '../models/userModel.js'
import { listLogs } from '../models/playerLogModel.js'

// 获取当前登录用户信息（鉴权中间件已挂载 req.user）
export async function getProfile(req, res) {
  res.json({ user: req.user })
}

// 修行日志（最近 N 条，前台首页展示）
export async function getLogs(req, res, next) {
  try {
    const list = await listLogs(req.user.id, req.query.limit)
    res.json({ list })
  } catch (err) {
    next(err)
  }
}

// 玩家可见的排行榜：境界/在线/死亡，各前十
export async function rankings(req, res, next) {
  try {
    const [realmTop, onlineTop, deathTop] = await Promise.all([
      rankByRealm(10),
      rankOnlineByRealm(10),
      rankByDeath(10),
    ])
    res.json({ realmTop, onlineTop, deathTop })
  } catch (err) {
    next(err)
  }
}
