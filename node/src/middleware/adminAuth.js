import { verifyToken } from '../utils/jwt.js'
import { findPublicById, findAccessTokenById } from '../models/userModel.js'

// 管理员鉴权中间件：令牌 role 必须为 admin，且对应 users 记录 role=1
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

    const user = await findPublicById(payload.id)
    if (!user) {
      return res.status(401).json({ error: '管理员不存在' })
    }
    if (user.role !== 1) {
      return res.status(403).json({ error: '无管理员权限' })
    }
    if (user.status !== 1) {
      return res.status(403).json({ error: '账号已被禁用' })
    }
    // Token 吊销校验：请求携带的 token 必须等于库中最新签发的一枚
    const stored = await findAccessTokenById(payload.id)
    if (!stored || stored !== token) {
      return res.status(401).json({ error: '登录状态已失效，请重新登录' })
    }

    req.admin = user
    next()
  } catch (err) {
    next(err)
  }
}
