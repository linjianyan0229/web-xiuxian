import {
  listUserPills,
  userPillMeta,
  findUserPillItem,
  getUserPillQuantity,
  removeUserPills,
  transferUserPills,
  isValidGrade,
} from '../models/userPillModel.js'
import { findByDaoName } from '../models/userModel.js'
import { addLog } from '../models/playerLogModel.js'

// GET /api/user/pills — 丹药背包列表（分页 + 品质/境界/类型/关键字筛选）
export async function getMyPills(req, res, next) {
  try {
    const { page, pageSize, keyword = '', category = '', realm = '', grade = '' } = req.query
    if (grade && !isValidGrade(grade)) {
      return res.status(400).json({ error: '品质不在可选之列' })
    }
    res.json(await listUserPills(req.user.id, { page, pageSize, keyword, category, realm, grade }))
  } catch (err) {
    next(err)
  }
}

// GET /api/user/pills/meta — 筛选下拉元数据（仅玩家实际持有的境界/类型）
export async function getMyPillMeta(req, res, next) {
  try {
    res.json(await userPillMeta(req.user.id))
  } catch (err) {
    next(err)
  }
}

// 赠送/丢弃共用入参校验：丹药存在于纳戒且数量足够；不通过时已写响应并返回 null
async function resolveOwnedPill(req, res) {
  const { pillId, grade } = req.body || {}
  const qty = Number(req.body?.quantity)
  if (!pillId || typeof pillId !== 'string' || !isValidGrade(grade)) {
    res.status(400).json({ error: '丹药参数有误' })
    return null
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > 9999) {
    res.status(400).json({ error: '数量须为 1~9999 的整数' })
    return null
  }
  const item = await findUserPillItem(req.user.id, pillId, grade)
  if (!item || Number(item.quantity) <= 0) {
    res.status(404).json({ error: '纳戒中没有这种丹药' })
    return null
  }
  if (Number(item.quantity) < qty) {
    res.status(409).json({ error: '丹药数量不足' })
    return null
  }
  return { qty, item }
}

// POST /api/user/pills/gift — 赠送给指定道号的玩家（事务转移，双方各记一条修行日志）
export async function giftPill(req, res, next) {
  try {
    const resolved = await resolveOwnedPill(req, res)
    if (!resolved) return
    const { qty, item } = resolved

    const targetName = String(req.body?.targetDaoName || '').trim()
    if (!targetName) return res.status(400).json({ error: '请填写受赠道友的道号' })
    const target = await findByDaoName(targetName)
    if (!target || target.role !== 0) return res.status(404).json({ error: '未寻得此道友' })
    if (target.id === req.user.id) return res.status(400).json({ error: '不可赠予自己' })
    if (target.status !== 1) return res.status(409).json({ error: '此道友已被封禁，无法受赠' })

    const affected = await transferUserPills(req.user.id, target.id, item.pill_id, item.grade, qty)
    if (!affected) return res.status(409).json({ error: '丹药数量不足' })

    const itemLabel = `${item.item_name} ×${qty}`
    await addLog(req.user.id, 'pill_gift', `以纳戒传物，将${itemLabel}赠予道友【${target.dao_name}】`)
    await addLog(target.id, 'pill_receive', `道友【${req.user.dao_name}】以纳戒传物，赠来${itemLabel}`)
    res.json({
      ok: true,
      targetDaoName: target.dao_name,
      remaining: await getUserPillQuantity(req.user.id, item.pill_id, item.grade),
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/pills/discard — 丢弃（不可寻回）
export async function discardPill(req, res, next) {
  try {
    const resolved = await resolveOwnedPill(req, res)
    if (!resolved) return
    const { qty, item } = resolved

    const affected = await removeUserPills(req.user.id, item.pill_id, item.grade, qty)
    if (!affected) return res.status(409).json({ error: '丹药数量不足' })

    await addLog(req.user.id, 'pill_discard', `将${item.item_name} ×${qty}弃于云外，任其散于天地`)
    res.json({
      ok: true,
      remaining: await getUserPillQuantity(req.user.id, item.pill_id, item.grade),
    })
  } catch (err) {
    next(err)
  }
}
