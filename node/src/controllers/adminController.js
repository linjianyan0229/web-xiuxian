import {
  countUsers,
  countUsersByStatus,
  countUsersRegisteredToday,
  listUsers,
  updateUserStatus,
  findPublicById,
} from '../models/userModel.js'
import { countAdmins } from '../models/adminModel.js'

// 仪表盘统计
export async function dashboard(req, res, next) {
  try {
    const [totalUsers, activeUsers, disabledUsers, newUsersToday, totalAdmins] =
      await Promise.all([
        countUsers(),
        countUsersByStatus(1),
        countUsersByStatus(0),
        countUsersRegisteredToday(),
        countAdmins(),
      ])

    res.json({ totalUsers, activeUsers, disabledUsers, newUsersToday, totalAdmins })
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
