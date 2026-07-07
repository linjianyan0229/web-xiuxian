import {
  rankByRealm, rankOnlineByRealm, rankByDeath, findPublicById,
} from '../models/userModel.js'
import { listLogs } from '../models/playerLogModel.js'
import { settleDueMeditation } from './meditationController.js'

// 获取当前登录用户信息（鉴权中间件已挂载 req.user）；到期打坐先行结算，返回最新玩家视图
export async function getProfile(req, res, next) {
  try {
    await settleDueMeditation(req.user.id)
    const user = await findPublicById(req.user.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json({ user })
  } catch (err) {
    next(err)
  }
}

// 修行日志（最近 N 条，前台首页展示）
export async function getLogs(req, res, next) {
  try {
    await settleDueMeditation(req.user.id)
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
