import { findSignInInfo, applySignIn } from '../models/userModel.js'
import { getBoolConfig } from '../models/systemConfigModel.js'
import { addLog } from '../models/playerLogModel.js'

const DAY_MS = 24 * 60 * 60 * 1000

// 依据境界晋级方式判定签到奖励类型：
//  - 经验(含雷劫)   → 修为(cultivation)，基准 = 圆满修为 advance_exp
//  - 道韵(含雷劫)   → 道韵(dao_yun)，基准 = 圆满道韵 dao_yun_required（沿用修为算法）
//  - 道法领悟/终点  → 道法(dao_law)，固定 +1（不按百分比）
function rewardTier(info) {
  const req = info.requirement_type || ''
  if (req.includes('道法') || req === '终点') {
    return { type: 'dao_law', label: '道法', base: 0, fixed: 1 }
  }
  if (req.includes('道韵')) {
    return { type: 'dao_yun', label: '道韵', base: Number(info.dao_yun_required) || 0, fixed: 0 }
  }
  return { type: 'cultivation', label: '修为', base: Number(info.advance_exp) || 0, fixed: 0 }
}

// 按百分比计算奖励：基准 × 百分比，向下取整，有效值最低 1
function calcByPercent(base, percent) {
  const b = Number(base) || 0
  const p = Number(percent) || 0
  if (b <= 0 || p <= 0) return 0
  return Math.max(1, Math.floor((b * p) / 100))
}

// 在 [min, max] 内随机取一个百分比（min>=max 时取 min）
function rollPercent(min, max) {
  const lo = Number(min) || 0
  const hi = Number(max) || 0
  if (hi <= lo) return lo
  return lo + Math.random() * (hi - lo)
}

// 下次可签到时间 = 上次签到 + 24 小时（从未签到则为 null）
function nextSignTime(lastSignTime) {
  if (!lastSignTime) return null
  return new Date(new Date(lastSignTime).getTime() + DAY_MS)
}

// 组装奖励预览（区间/固定），供前台展示
function buildPreview(info) {
  const tier = rewardTier(info)
  const min = Number(info.sign_in_min_percent) || 0
  const max = Number(info.sign_in_max_percent) || 0
  if (tier.fixed > 0) {
    return {
      rewardType: tier.type,
      rewardLabel: tier.label,
      fixedReward: tier.fixed,
      base: 0,
      minPercent: 0,
      maxPercent: 0,
      rewardMin: tier.fixed,
      rewardMax: tier.fixed,
    }
  }
  return {
    rewardType: tier.type,
    rewardLabel: tier.label,
    fixedReward: 0,
    base: tier.base,
    minPercent: min,
    maxPercent: max,
    rewardMin: calcByPercent(tier.base, min),
    rewardMax: calcByPercent(tier.base, max),
  }
}

// 签到状态：供前台判断是否弹窗、展示奖励类型与预计区间、冷却时间
export async function getSignInStatus(req, res, next) {
  try {
    const enabled = await getBoolConfig('sign_in_enabled', true)
    const info = await findSignInInfo(req.user.id)
    if (!info) return res.status(404).json({ error: '用户不存在' })

    res.json({
      enabled,
      canSignIn: enabled && Number(info.can_sign) === 1,
      lastSignTime: info.last_sign_time,
      nextSignTime: nextSignTime(info.last_sign_time),
      realmName: info.realm_name || '凡人',
      ...buildPreview(info),
    })
  } catch (err) {
    next(err)
  }
}

// 执行签到：校验总开关 + 24 小时冷却，按境界档位随机发放对应资源
export async function doSignIn(req, res, next) {
  try {
    const enabled = await getBoolConfig('sign_in_enabled', true)
    if (!enabled) return res.status(403).json({ error: '签到功能暂未开启' })

    const info = await findSignInInfo(req.user.id)
    if (!info) return res.status(404).json({ error: '用户不存在' })
    if (Number(info.can_sign) !== 1) {
      return res
        .status(409)
        .json({ error: '还未到下次签到时间', nextSignTime: nextSignTime(info.last_sign_time) })
    }

    const tier = rewardTier(info)
    let reward
    if (tier.fixed > 0) {
      reward = tier.fixed
    } else {
      const pct = rollPercent(info.sign_in_min_percent, info.sign_in_max_percent)
      reward = calcByPercent(tier.base, pct)
    }

    const affected = await applySignIn(req.user.id, tier.type, reward)
    if (!affected) {
      // 并发下他处已抢先签到
      const latest = await findSignInInfo(req.user.id)
      return res
        .status(409)
        .json({ error: '还未到下次签到时间', nextSignTime: nextSignTime(latest?.last_sign_time) })
    }

    await addLog(req.user.id, 'sign_in', `每日签到，获得${tier.label} +${reward}`)

    const latest = await findSignInInfo(req.user.id)
    res.json({
      reward,
      rewardType: tier.type,
      rewardLabel: tier.label,
      cultivation: Number(latest.cultivation) || 0,
      dao_yun: Number(latest.dao_yun) || 0,
      dao_law: Number(latest.dao_law) || 0,
      lastSignTime: latest.last_sign_time,
      nextSignTime: nextSignTime(latest.last_sign_time),
      realmName: info.realm_name || '凡人',
    })
  } catch (err) {
    next(err)
  }
}
