import {
  getWarehouseLevel,
  countWarehouseSlots,
  listWarehouseItems,
  findWarehouseItem,
  depositPill,
  withdrawPill,
  upgradeWarehouse,
} from '../models/sectWarehouseModel.js'
import { findMemberByUserId, findSectById } from '../models/sectModel.js'
import { findUserPillItem, isValidGrade } from '../models/userPillModel.js'
import { findPublicById } from '../models/userModel.js'
import { addLog } from '../models/playerLogModel.js'
import { positionInfo } from '../utils/sectPositions.js'
import {
  WAREHOUSE_MAX_LEVEL,
  warehouseCapacity,
  warehouseUpgradeCost,
  canManageWarehouse,
} from '../utils/sectFacilities.js'

// 宗门仓库（设计文档：docs/设计文档/宗门设施与仓库机制.md）
// 查看/存入=本宗全体成员；取出/升级=仓库管理权（太上/宗主/神子 或 仓库管理长老）。
// 注意：本文件的前置校验在事务外，只为友好报错；**作准的复核在模型事务内**
// （lockAndVerify 按 sects → sect_members 加锁重查，防并发逐出/降职/解散间隙放行）。

// 校验操作者为本宗成员，返回 { member, sect, canManage } 或已回错误响应的 null
async function loadWarehouseContext(req, res, { manage = false } = {}) {
  const sectId = Number(req.params.id)
  const sect = await findSectById(sectId)
  if (!sect) {
    res.status(404).json({ error: '此宗门已不在仙门名录之上' })
    return null
  }
  const member = await findMemberByUserId(req.user.id)
  if (!member || Number(member.sect_id) !== sectId) {
    res.status(403).json({ error: '宗门仓库乃本宗重地，外人不得擅入' })
    return null
  }
  const rank = positionInfo(member.position)?.rank ?? 9
  const canManage = canManageWarehouse(member.position, rank)
  if (manage && !canManage) {
    res.status(403).json({ error: '仓库取用/修缮须仓库管理长老或太上长老、宗主、神子/神女' })
    return null
  }
  return { member, sect, sectId, canManage }
}

// 丹药入参校验（存入/取出共用）：返回 { pillId, grade, quantity } 或已回错误响应的 null
function parsePillPayload(req, res) {
  const pillId = String(req.body?.pillId ?? '').trim()
  const grade = String(req.body?.grade ?? '').trim()
  const quantity = Number(req.body?.quantity)
  if (!pillId || !isValidGrade(grade)) {
    res.status(400).json({ error: '未指明丹药或品质不合法' })
    return null
  }
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999999) {
    res.status(400).json({ error: '数量须为正整数' })
    return null
  }
  return { pillId, grade, quantity }
}

// GET /api/user/sects/:id/warehouse — 仓库概览 + 物品分页（本宗成员）
export async function getWarehouse(req, res, next) {
  try {
    const ctx = await loadWarehouseContext(req, res)
    if (!ctx) return
    const { sectId, canManage } = ctx

    const level = await getWarehouseLevel(sectId)
    const { page, pageSize, keyword = '' } = req.query
    const [used, items] = await Promise.all([
      countWarehouseSlots(sectId),
      listWarehouseItems(sectId, { page, pageSize, keyword }),
    ])
    res.json({
      level,
      capacity: warehouseCapacity(level),
      used,
      maxLevel: WAREHOUSE_MAX_LEVEL,
      upgradeCost: warehouseUpgradeCost(level),
      canManage,
      items,
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects/:id/warehouse/deposit — { pillId, grade, quantity } 存入（本宗成员）
export async function doDeposit(req, res, next) {
  try {
    const ctx = await loadWarehouseContext(req, res)
    if (!ctx) return
    const payload = parsePillPayload(req, res)
    if (!payload) return
    const { sectId, sect } = ctx
    const { pillId, grade, quantity } = payload

    const item = await findUserPillItem(req.user.id, pillId, grade)
    if (!item || Number(item.quantity) < quantity) {
      return res.status(409).json({ error: '囊中此药不足，无从捐献' })
    }

    const result = await depositPill({
      sectId,
      userId: req.user.id,
      pillId,
      grade,
      quantity,
      capacityOf: warehouseCapacity,
    })
    if (result.error === 'warehouse_full') {
      return res.status(409).json({ error: '宗门仓库已满，须先腾挪或修缮扩容' })
    }
    if (result.error === 'sect_gone') {
      return res.status(409).json({ error: '此宗门已散，仓库不复存在' })
    }
    if (result.error === 'not_member') {
      return res.status(403).json({ error: '道友已不在此宗门下，无从捐献' })
    }
    if (result.error) {
      return res.status(409).json({ error: '囊中此药不足，无从捐献' })
    }

    await addLog(
      req.user.id,
      'sect_wh_deposit',
      `向【${sect.name}】仓库捐献「${item.item_name}」×${quantity}`
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects/:id/warehouse/withdraw — { pillId, grade, quantity } 取出（仓库管理权）
export async function doWithdraw(req, res, next) {
  try {
    const ctx = await loadWarehouseContext(req, res, { manage: true })
    if (!ctx) return
    const payload = parsePillPayload(req, res)
    if (!payload) return
    const { sectId, sect } = ctx
    const { pillId, grade, quantity } = payload

    const item = await findWarehouseItem(sectId, pillId, grade)
    if (!item || Number(item.quantity) < quantity) {
      return res.status(409).json({ error: '仓库中此药不足' })
    }

    const result = await withdrawPill({ sectId, userId: req.user.id, pillId, grade, quantity })
    if (result.error === 'sect_gone') {
      return res.status(409).json({ error: '此宗门已散，仓库不复存在' })
    }
    if (result.error === 'not_member' || result.error === 'no_permission') {
      return res.status(403).json({ error: '道友已无仓库取用之权（职位或归属已变动）' })
    }
    if (result.error) {
      return res.status(409).json({ error: '仓库中此药不足' })
    }

    await addLog(
      req.user.id,
      'sect_wh_withdraw',
      `自【${sect.name}】仓库取用「${item.item_name}」×${quantity}`
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects/:id/warehouse/upgrade — 修缮扩容（仓库管理权，扣操作者个人灵石）
export async function doUpgrade(req, res, next) {
  try {
    const ctx = await loadWarehouseContext(req, res, { manage: true })
    if (!ctx) return
    const { sectId, sect } = ctx

    const level = await getWarehouseLevel(sectId)
    const cost = warehouseUpgradeCost(level)
    if (cost === null) {
      return res.status(400).json({ error: `仓库已臻至满级（${WAREHOUSE_MAX_LEVEL} 级）` })
    }
    if ((Number(req.user.ling_shi) || 0) < cost) {
      return res.status(409).json({ error: `修缮至 ${level + 1} 级需灵石 ${cost}，道友囊中尚且不足` })
    }

    const result = await upgradeWarehouse({ sectId, userId: req.user.id, fromLevel: level, cost })
    if (result.error === 'no_funds') {
      return res.status(409).json({ error: `修缮至 ${level + 1} 级需灵石 ${cost}，道友囊中尚且不足` })
    }
    if (result.error === 'sect_gone') {
      return res.status(409).json({ error: '此宗门已散，仓库不复存在' })
    }
    if (result.error === 'not_member' || result.error === 'no_permission') {
      return res.status(403).json({ error: '道友已无仓库修缮之权（职位或归属已变动）' })
    }
    if (result.error) {
      return res.status(409).json({ error: '仓库等级已有变动，请刷新后再试' })
    }

    const newLevel = level + 1
    await addLog(
      req.user.id,
      'sect_wh_upgrade',
      `耗费 ${cost} 灵石将【${sect.name}】仓库修缮至 ${newLevel} 级（容量 ${warehouseCapacity(newLevel)} 格）`
    )
    const user = await findPublicById(req.user.id)
    res.json({ ok: true, level: newLevel, capacity: warehouseCapacity(newLevel), user })
  } catch (err) {
    next(err)
  }
}
