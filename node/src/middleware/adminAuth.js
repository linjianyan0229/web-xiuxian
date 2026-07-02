import { verifyToken } from '../utils/jwt.js'
import { findAdminPublicById } from '../models/adminModel.js'

// 管理员鉴权中间件：校验令牌且 role 必须为 admin
export async function adminAuthRequired(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: '未提供鉴权令牌' })
    }

    let payload
    try {
      payload = verifyToken(token)
    } catch {
      return res.status(401).json({ error: '令牌无效或已过期' })
    }

    if (payload.role !== 'admin') {
      return res.status(403).json({ error: '无管理员权限' })
    }

    const admin = await findAdminPublicById(payload.id)
    if (!admin) {
      return res.status(401).json({ error: '管理员不存在' })
    }
    if (admin.status !== 1) {
      return res.status(403).json({ error: '账号已被禁用' })
    }

    req.admin = admin
    next()
  } catch (err) {
    next(err)
  }
}
