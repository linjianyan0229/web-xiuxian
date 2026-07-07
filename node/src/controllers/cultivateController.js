import { findCultivateInfo, applyCultivate } from '../models/userModel.js'
import { getNumberConfig } from '../models/systemConfigModel.js'
import { cultivationGainPerSession } from '../utils/cultivationGain.js'
import { addLog } from '../models/playerLogModel.js'
import { bumpDailyStat } from '../models/userDailyStatModel.js'
import { settleDueMeditation } from './meditationController.js'

// 冷却秒数来自系统配置，收敛到 [1, 86400]，默认 60
async function getCooldownSeconds() {
  const raw = await getNumberConfig('cultivate_cooldown_seconds', 60)
  return Math.min(86400, Math.max(1, Math.floor(raw) || 60))
}

// 下次可修炼时间 = 上次修炼 + 冷却（从未修炼则为 null，即随时可修）
function nextCultivateTime(lastCultivateTime, cooldownSeconds) {
  if (!lastCultivateTime) return null
  return new Date(new Date(lastCultivateTime).getTime() + cooldownSeconds * 1000)
}

// 修为是否已圆满（advance_exp=0 的境界不以修为论圆满）
function isFull(info) {
  const total = Number(info.advance_exp) || 0
  return total > 0 && (Number(info.cultivation) || 0) >= total
}

// 组装状态响应（status 与 do 共用）
function buildStatus(info, cooldownSeconds) {
  // 修为丹系统尚未接入服用流程，丹药加成暂为 0（机制已就绪：资源文件/机制相关/修为修炼机制.md）
  const gain = cultivationGainPerSession(info.advance_exp, 0)
  const full = isFull(info)
  const meditating = Number(info.is_meditating) === 1
  return {
    canCultivate: Number(info.can_cultivate) === 1 && gain > 0 && !full && !meditating,
    isFull: full,
    meditating,
    gain,
    cooldownSeconds,
    lastCultivateTime: info.last_cultivate_time,
    nextCultivateTime: nextCultivateTime(info.last_cultivate_time, cooldownSeconds),
    cultivation: Number(info.cultivation) || 0,
    advanceExp: Number(info.advance_exp) || 0,
    realmName: info.realm_name || '凡人',
  }
}

// 修炼状态：单次收益预览、冷却与进度（供前台首页境界卡展示）
export async function getCultivateStatus(req, res, next) {
  try {
    // 到期的打坐先行入账，返回的修为/圆满状态才是最新
    await settleDueMeditation(req.user.id)
    const cooldown = await getCooldownSeconds()
    const info = await findCultivateInfo(req.user.id, cooldown)
    if (!info) return res.status(404).json({ error: '用户不存在' })
    res.json(buildStatus(info, cooldown))
  } catch (err) {
    next(err)
  }
}

// 执行修炼：校验冷却后按机制结算修为（当前境界圆满修为的5%，最后取整保底1）
export async function doCultivate(req, res, next) {
  try {
    await settleDueMeditation(req.user.id)
    const cooldown = await getCooldownSeconds()
    const info = await findCultivateInfo(req.user.id, cooldown)
    if (!info) return res.status(404).json({ error: '用户不存在' })

    if (Number(info.is_meditating) === 1) {
      // 打坐不可中断，入定期间也不可分心行功
      return res.status(409).json({ error: '入定打坐之中，心神归一，不可分心修炼' })
    }

    const gain = cultivationGainPerSession(info.advance_exp, 0)
    if (gain <= 0) {
      // 仙王及以上境界 advance_exp=0，靠道法领悟晋级，打坐已无修为可得
      return res.status(400).json({ error: '此境已非打坐修为可进，需另觅道法机缘' })
    }
    if (isFull(info)) {
      // 修为圆满后停止修炼收益，需突破境界（突破系统未实装前按钮为占位）
      return res.status(409).json({ error: '修为已圆满，当前需突破境界' })
    }
    if (Number(info.can_cultivate) !== 1) {
      return res.status(409).json({
        error: '道心未稳，需调息片刻',
        nextCultivateTime: nextCultivateTime(info.last_cultivate_time, cooldown),
      })
    }

    const affected = await applyCultivate(req.user.id, gain, cooldown)
    if (!affected) {
      // 并发连点时他处已抢先结算
      const latest = await findCultivateInfo(req.user.id, cooldown)
      return res.status(409).json({
        error: '道心未稳，需调息片刻',
        nextCultivateTime: nextCultivateTime(latest?.last_cultivate_time, cooldown),
      })
    }

    await bumpDailyStat(req.user.id, { cultivateCount: 1, cultivationGained: gain })
    const latest = await findCultivateInfo(req.user.id, cooldown)
    const status = buildStatus(latest, cooldown)
    await addLog(
      req.user.id,
      'cultivate',
      status.isFull
        ? `打坐修炼，修为 +${gain}，已臻【${status.realmName}】圆满`
        : `打坐修炼，修为 +${gain}`
    )
    res.json({ ...status, gained: gain })
  } catch (err) {
    next(err)
  }
}
