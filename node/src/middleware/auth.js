import { verifyToken } from '../utils/jwt.js'
import { findPublicById, findAccessTokenById } from '../models/userModel.js'

// 鉴权中间件：校验 Authorization: Bearer <token>，通过后挂载 req.user
export async function authRequired(req, res, next) {
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

    const user = await findPublicById(payload.id)
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }
    if (user.status !== 1) {
      return res.status(403).json({ error: '账号已被禁用' })
    }
    // Token 吊销校验：请求携带的 token 必须等于库中最新签发的一枚
    // （登出会清空、异地登录会覆盖，旧 token 随即失效）
    const stored = await findAccessTokenById(payload.id)
    if (!stored || stored !== token) {
      return res.status(401).json({ error: '登录状态已失效，请重新登录' })
    }

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}
