import {
  findByAccount,
  findByEmail,
  findByDaoName,
  createUser,
  findPublicById,
  updateLoginState,
} from '../models/userModel.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'

const DAO_NAME_RE = /^[一-龥A-Za-z0-9_]{2,16}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 注册
export async function register(req, res, next) {
  try {
    const { daoName, email, password } = req.body || {}

    if (!daoName || !email || !password) {
      return res.status(400).json({ error: '道号、邮箱、密码均为必填' })
    }
    if (!DAO_NAME_RE.test(daoName)) {
      return res.status(400).json({ error: '道号需为2-16位中英文、数字或下划线' })
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: '密码至少6位' })
    }

    if (await findByDaoName(daoName)) {
      return res.status(409).json({ error: '该道号已被占用' })
    }
    if (await findByEmail(email)) {
      return res.status(409).json({ error: '该邮箱已被注册' })
    }

    const hashed = await hashPassword(password)
    const id = await createUser({ daoName, email, password: hashed })

    // 注册成功即签发令牌，前端可直接进入
    const token = signToken({ id, daoName })
    await updateLoginState(id, token)
    const user = await findPublicById(id)

    res.status(201).json({ token, user })
  } catch (err) {
    next(err)
  }
}

// 登录（支持道号或邮箱）
export async function login(req, res, next) {
  try {
    const { account, password } = req.body || {}
    if (!account || !password) {
      return res.status(400).json({ error: '账号与密码均为必填' })
    }

    const record = await findByAccount(account)
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

    const token = signToken({ id: record.id, daoName: record.dao_name })
    await updateLoginState(record.id, token)
    const user = await findPublicById(record.id)

    res.json({ token, user })
  } catch (err) {
    next(err)
  }
}
