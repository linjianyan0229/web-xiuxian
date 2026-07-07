import {
  findMeditationInfo,
  applyMeditationStart,
  applyMeditationSettle,
} from '../models/userModel.js'
import { getNumberConfig } from '../models/systemConfigModel.js'
import {
  MEDITATION_DURATIONS,
  MEDITATION_GAIN_PERCENT_PER_HOUR,
  isValidMeditationMinutes,
  meditationDurationLabel,
  meditationGainForDuration,
} from '../utils/meditation.js'
import { addLog } from '../models/playerLogModel.js'
import { bumpDailyStat } from '../models/userDailyStatModel.js'

// 每小时收益百分比来自系统配置，收敛到 [0, 1000]，默认 30
async function getPerHourPercent() {
  const raw = await getNumberConfig(
    'meditation_gain_percent_per_hour',
    MEDITATION_GAIN_PERCENT_PER_HOUR
  )
  return Math.min(1000, Math.max(0, raw))
}

// 场次时长（分钟）：从起止时间反推（写入的都是白名单整分钟，反推无损）
function sessionMinutes(info) {
  if (!info.meditation_start_time || !info.meditation_end_time) return 0
  const ms =
    new Date(info.meditation_end_time).getTime() -
    new Date(info.meditation_start_time).getTime()
  return Math.max(0, Math.round(ms / 60000))
}

// 结算到期的打坐（惰性结算：登录回来/打坐、修炼、突破相关请求都会先经过这里）。
// 无场次或尚未到期返回 null；结算成功返回 { gained, minutes, label, realmName }。
// 收益封顶到圆满——打坐期间签到等来源可能已把修为推满，不再把修为推过 advance_exp。
export async function settleDueMeditation(userId) {
  const info = await findMeditationInfo(userId)
  if (!info || Number(info.is_due) !== 1) return null

  const minutes = sessionMinutes(info)
  const perHour = await getPerHourPercent()
  const raw = meditationGainForDuration(info.advance_exp, minutes, perHour)
  const room = Math.max(0, (Number(info.advance_exp) || 0) - (Number(info.cultivation) || 0))
  const gained = Math.min(raw, room)

  const affected = await applyMeditationSettle(userId, gained)
  if (!affected) return null // 并发下他处已抢先结算

  // 今日统计：打坐时长与收益按结算日入账（跨零点场次整段计入出定当天）
  await bumpDailyStat(userId, { meditationSeconds: minutes * 60, cultivationGained: gained })
  const label = meditationDurationLabel(minutes)
  const realmName = info.realm_name || '凡人'
  const total = Number(info.advance_exp) || 0
  const fullAfter = total > 0 && (Number(info.cultivation) || 0) + gained >= total
  await addLog(
    userId,
    'meditate',
    gained > 0
      ? fullAfter
        ? `打坐${label}功成，修为 +${gained}，已臻【${realmName}】圆满`
        : `打坐${label}功成，静极生慧，修为 +${gained}`
      : `打坐${label}期满，然修为早已圆满，此番入定未得寸进`
  )
  return { gained, minutes, label, realmName }
}

// 组装打坐状态响应（status 与 start 共用）；settled 为本次请求顺带结算的到期场次（无则 null）
async function buildStatus(userId, settled = null) {
  const info = await findMeditationInfo(userId)
  if (!info) return null
  const perHour = await getPerHourPercent()

  const meditating = Number(info.is_meditating) === 1
  const cultivation = Number(info.cultivation) || 0
  const advanceExp = Number(info.advance_exp) || 0
  const room = Math.max(0, advanceExp - cultivation)
  const minutes = meditating ? sessionMinutes(info) : 0

  // 不可打坐的原因（打坐中不算「不可」，单独用 meditating 表达）
  let reason = null
  if (!meditating) {
    if (advanceExp <= 0) reason = '此境已非打坐修为可进，需另觅道法机缘'
    else if (room <= 0) reason = '修为已圆满，当前需突破境界'
  }

  return {
    meditating,
    startTime: info.meditation_start_time,
    endTime: info.meditation_end_time,
    remainSeconds: meditating ? Math.max(0, Number(info.remain_seconds) || 0) : 0,
    durationMinutes: minutes,
    durationLabel: meditating ? meditationDurationLabel(minutes) : '',
    canMeditate: !meditating && !reason,
    reason,
    gainPerHourPercent: perHour,
    // 各时长的预估收益（已按剩余空间封顶，即实际可入账的数值）
    options: MEDITATION_DURATIONS.map((d) => ({
      minutes: d.minutes,
      label: d.label,
      gain: Math.min(meditationGainForDuration(advanceExp, d.minutes, perHour), room),
    })),
    cultivation,
    advanceExp,
    realmName: info.realm_name || '凡人',
    settled,
  }
}

// 打坐状态：打坐中的剩余时间 / 可选时长与预估收益（到期场次先行结算，结果放 settled 字段）
export async function getMeditationStatus(req, res, next) {
  try {
    const settled = await settleDueMeditation(req.user.id)
    const status = await buildStatus(req.user.id, settled)
    if (!status) return res.status(404).json({ error: '用户不存在' })
    res.json(status)
  } catch (err) {
    next(err)
  }
}

// 开始打坐：校验时长白名单与当前状态后原子写入起止时间；一旦入定不可中断（不提供取消接口）
export async function startMeditation(req, res, next) {
  try {
    const minutes = Number(req.body?.minutes)
    if (!isValidMeditationMinutes(minutes)) {
      return res.status(400).json({ error: '打坐时长不在可选之列' })
    }

    const settled = await settleDueMeditation(req.user.id)
    const info = await findMeditationInfo(req.user.id)
    if (!info) return res.status(404).json({ error: '用户不存在' })

    if (Number(info.is_meditating) === 1) {
      return res.status(409).json({ error: '道友已在入定之中，心无二用' })
    }
    const advanceExp = Number(info.advance_exp) || 0
    if (advanceExp <= 0) {
      return res.status(400).json({ error: '此境已非打坐修为可进，需另觅道法机缘' })
    }
    if ((Number(info.cultivation) || 0) >= advanceExp) {
      return res.status(409).json({ error: '修为已圆满，当前需突破境界' })
    }

    const affected = await applyMeditationStart(req.user.id, minutes)
    if (!affected) {
      // 并发下他处已抢先入定
      return res.status(409).json({ error: '道友已在入定之中，心无二用' })
    }

    await addLog(
      req.user.id,
      'meditate_start',
      `收摄心神，盘膝入定（${meditationDurationLabel(minutes)}），期满之前不可中断`
    )
    const status = await buildStatus(req.user.id, settled)
    res.json(status)
  } catch (err) {
    next(err)
  }
}
