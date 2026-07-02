import {
  countUsers,
  countUsersByStatus,
  countUsersRegisteredToday,
  countAdmins,
  listUsers,
  updateUserStatus,
  findPublicById,
} from '../models/userModel.js'
import { rankByRealm, rankOnlineByRealm, rankByDeath } from '../models/userModel.js'
import { listRealms, countRealms } from '../models/realmModel.js'

// 仪表盘统计
export async function dashboard(req, res, next) {
  try {
    const [totalUsers, activeUsers, disabledUsers, newUsersToday, totalAdmins, totalRealms] =
      await Promise.all([
        countUsers(),
        countUsersByStatus(1),
        countUsersByStatus(0),
        countUsersRegisteredToday(),
        countAdmins(),
        countRealms(),
      ])

    res.json({
      totalUsers,
      activeUsers,
      disabledUsers,
      newUsersToday,
      totalAdmins,
      totalRealms,
    })
  } catch (err) {
    next(err)
  }
}

// 境界列表（全部，按境界序号升序）
export async function getRealms(req, res, next) {
  try {
    const list = await listRealms()
    res.json({ list, total: list.length })
  } catch (err) {
    next(err)
  }
}

// 排行榜：境界榜 / 在线榜(按境界) / 死亡榜
export async function rankings(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const [realmTop, onlineTop, deathTop] = await Promise.all([
      rankByRealm(limit),
      rankOnlineByRealm(limit),
      rankByDeath(limit),
    ])
    res.json({ realmTop, onlineTop, deathTop })
  } catch (err) {
    next(err)
  }
}

// 用户列表（分页 + 关键字）
export async function getUsers(req, res, next) {
  try {
    const { page = 1, pageSize = 10, keyword = '' } = req.query
    const result = await listUsers({ page, pageSize, keyword: String(keyword).trim() })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// 启用 / 禁用用户
export async function setUserStatus(req, res, next) {
  try {
    const id = Number(req.params.id)
    const { status } = req.body || {}
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '用户ID无效' })
    }
    if (status !== 0 && status !== 1) {
      return res.status(400).json({ error: 'status 只能为 0(禁用) 或 1(正常)' })
    }

    const affected = await updateUserStatus(id, status)
    if (!affected) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const user = await findPublicById(id)
    res.json({ user })
  } catch (err) {
    next(err)
  }
}
