import {
  findAdminByUsername,
  findAdminPublicById,
  updateAdminLoginState,
} from '../models/adminModel.js'
import { verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'

// 管理员登录
export async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ error: '账号与密码均为必填' })
    }

    const record = await findAdminByUsername(username)
    if (!record) {
      return res.status(401).json({ error: '账号或密码错误' })
    }
    if (record.status !== 1) {
      return res.status(403).json({ error: '账号已被禁用' })
    }

    const ok = await verifyPassword(password, record.password)
    if (!ok) {
      return res.status(401).json({ error: '账号或密码错误' })
    }

    // role=admin 用于区分普通用户令牌
    const token = signToken({ id: record.id, username: record.username, role: 'admin' })
    await updateAdminLoginState(record.id, token)
    const admin = await findAdminPublicById(record.id)

    res.json({ token, admin })
  } catch (err) {
    next(err)
  }
}

// 当前登录管理员信息
export async function adminProfile(req, res) {
  res.json({ admin: req.admin })
}
