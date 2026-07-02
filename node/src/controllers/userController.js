import { rankByRealm, rankOnlineByRealm, rankByDeath } from '../models/userModel.js'

// 获取当前登录用户信息（鉴权中间件已挂载 req.user）
export async function getProfile(req, res) {
  res.json({ user: req.user })
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
