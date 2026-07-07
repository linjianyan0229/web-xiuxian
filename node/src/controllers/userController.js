import {
  rankByRealm, rankOnlineByRealm, rankByDeath, findPublicById, findBreakthroughInfo,
} from '../models/userModel.js'
import { listLogs } from '../models/playerLogModel.js'
import { findTodayStat } from '../models/userDailyStatModel.js'
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

// 今日修炼统计（前台首页「今日修炼」面板）：修炼次数/打坐时长/获得修为 + 当前境界突破成功率
export async function getTodayStats(req, res, next) {
  try {
    // 到期打坐先行结算入账，今日统计才完整
    await settleDueMeditation(req.user.id)
    const [stat, info] = await Promise.all([
      findTodayStat(req.user.id),
      findBreakthroughInfo(req.user.id),
    ])

    // 突破几率：终点(圣人)无下一境 → null；含雷劫按死亡率折算，无雷劫视为 100%
    // （口径与 breakthroughController.buildStatus 的 successRatePercent 一致）
    let breakthroughSuccessPercent = null
    if (info && (info.requirement_type || '') !== '终点') {
      const hasTribulation = (info.requirement_type || '').includes('雷劫')
      const deathRate = hasTribulation ? Number(info.tribulation_death_rate) || 0 : 0
      breakthroughSuccessPercent = Math.round((100 - deathRate) * 10) / 10
    }

    res.json({
      cultivateCount: Number(stat.cultivate_count) || 0,
      meditationSeconds: Number(stat.meditation_seconds) || 0,
      cultivationGained: Number(stat.cultivation_gained) || 0,
      breakthroughSuccessPercent,
    })
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
