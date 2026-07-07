import {
  findBreakthroughInfo,
  applyBreakthroughSuccess,
  applyBreakthroughDeath,
} from '../models/userModel.js'
import { addLog } from '../models/playerLogModel.js'
import { settleDueMeditation } from './meditationController.js'

// 解析当前境界的晋级要求（境界行即描述晋级到 next_realm 的条件）
// 机制见 资源文件/机制相关/境界突破机制.md
function parseRequirement(info) {
  const req = info.requirement_type || ''
  if (req === '终点') return { kind: 'end' }
  if (req.includes('道法')) {
    return {
      kind: 'dao_law',
      label: '道法',
      required: Number(info.dao_law_required) || 0,
      current: Number(info.dao_law) || 0,
      costField: null, // 道法领悟是境界，晋升不消耗
    }
  }
  if (req.includes('道韵')) {
    return {
      kind: 'dao_yun',
      label: '道韵',
      required: Number(info.dao_yun_required) || 0,
      current: Number(info.dao_yun) || 0,
      costField: 'dao_yun',
    }
  }
  return {
    kind: 'cultivation',
    label: '修为',
    required: Number(info.advance_exp) || 0,
    current: Number(info.cultivation) || 0,
    costField: 'cultivation',
  }
}

// 组装突破状态（status 与 do 共用）
function buildStatus(info) {
  const r = parseRequirement(info)
  const meditating = Number(info.is_meditating) === 1
  if (r.kind === 'end') {
    return {
      atPeak: true,
      meditating,
      canBreakthrough: false,
      realmName: info.realm_name || '',
      nextRealm: '',
      blockReason: meditating ? '入定打坐之中，心神归一，不可强行冲关' : '',
    }
  }
  const hasTribulation = (info.requirement_type || '').includes('雷劫')
  const deathRate = hasTribulation ? Number(info.tribulation_death_rate) || 0 : 0
  const met = r.required > 0 && r.current >= r.required
  return {
    atPeak: false,
    meditating,
    canBreakthrough: met && !meditating,
    realmName: info.realm_name || '',
    nextRealm: info.next_realm || '',
    reqKind: r.kind,
    reqLabel: r.label,
    required: r.required,
    current: r.current,
    met,
    willConsume: !!r.costField,
    hasTribulation,
    tribulationType: hasTribulation ? info.tribulation_type || '雷劫' : '',
    deathRatePercent: deathRate,
    successRatePercent: Math.round((100 - deathRate) * 10) / 10,
    blockReason: meditating ? '入定打坐之中，心神归一，不可强行冲关' : '',
  }
}

// 突破状态：下一境界、条件达成度、雷劫与死亡率（前台突破弹窗展示）
export async function getBreakthroughStatus(req, res, next) {
  try {
    // 到期的打坐先行入账，条件达成度里的修为才是最新
    await settleDueMeditation(req.user.id)
    const info = await findBreakthroughInfo(req.user.id)
    if (!info) return res.status(404).json({ error: '用户不存在' })
    res.json(buildStatus(info))
  } catch (err) {
    next(err)
  }
}

// 执行突破：校验条件 → 雷劫掷骰 → 晋级（扣资源）或身陨（死亡+1、资源折半）
export async function doBreakthrough(req, res, next) {
  try {
    await settleDueMeditation(req.user.id)
    const info = await findBreakthroughInfo(req.user.id)
    if (!info) return res.status(404).json({ error: '用户不存在' })

    if (Number(info.is_meditating) === 1) {
      // 打坐不可中断，入定期间不可动念冲关
      return res.status(409).json({ error: '入定打坐之中，心神归一，不可强行冲关' })
    }

    const status = buildStatus(info)
    if (status.atPeak) {
      return res.status(400).json({ error: '已至大道尽头，再无境界可破' })
    }
    if (!status.met) {
      return res.status(409).json({
        error: `${status.reqLabel}未至圆满（${status.current}/${status.required}），尚不能突破`,
      })
    }

    const r = parseRequirement(info)

    // 雷劫掷骰：随机数落在死亡率内则身陨
    if (status.hasTribulation && Math.random() * 100 < status.deathRatePercent) {
      const affected = await applyBreakthroughDeath(
        req.user.id,
        info.realm_id,
        r.costField || 'cultivation'
      )
      if (!affected) return res.status(409).json({ error: '状态已变化，请刷新后再试' })

      const latest = await findBreakthroughInfo(req.user.id)
      const deathCount = Number(latest?.death_count) || Number(info.death_count) + 1
      await addLog(
        req.user.id,
        'death',
        `强渡${status.tribulationType}失败，身陨道消，${r.label}折损半数（第${deathCount}次陨落）`
      )
      return res.json({
        success: false,
        died: true,
        tribulationType: status.tribulationType,
        deathCount,
        lossLabel: r.label,
        realmName: status.realmName,
      })
    }

    // 晋级（原子扣资源 + 境界守卫）
    const affected = await applyBreakthroughSuccess(
      req.user.id,
      info.realm_id,
      r.costField,
      r.required
    )
    if (!affected) return res.status(409).json({ error: '状态已变化，请刷新后再试' })

    await addLog(
      req.user.id,
      'breakthrough',
      status.hasTribulation
        ? `强渡${status.tribulationType}功成，晋入【${status.nextRealm}】`
        : `厚积薄发，突破至【${status.nextRealm}】`
    )
    res.json({
      success: true,
      died: false,
      tribulationType: status.tribulationType,
      previousRealm: status.realmName,
      newRealm: status.nextRealm,
    })
  } catch (err) {
    next(err)
  }
}
