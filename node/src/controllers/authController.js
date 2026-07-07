import {
  findByAccount,
  findByEmail,
  findByDaoName,
  createUser,
  findPublicById,
  updateLoginState,
  clearLoginState,
  resetPasswordById,
} from '../models/userModel.js'
import {
  secondsSinceLastCode,
  createCode,
  verifyAndConsume,
} from '../models/emailCodeModel.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'
import { DAO_NAME_RE, EMAIL_RE, MIN_PASSWORD_LEN } from '../utils/validators.js'
import { rollComprehension } from '../utils/comprehension.js'
import { sendVerificationCode } from '../utils/mailer.js'
import { getBoolConfig } from '../models/systemConfigModel.js'
import { addLog } from '../models/playerLogModel.js'

// 邮箱验证码：有效期与重发间隔
const CODE_TTL_MINUTES = 10
const CODE_RESEND_SECONDS = 60
const CODE_PURPOSES = ['register', 'reset']

// 发送邮箱验证码（公开接口，注册/重置密码共用）
export async function sendEmailCode(req, res, next) {
  try {
    const email = String(req.body?.email ?? '').trim()
    const purpose = String(req.body?.purpose ?? '')
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }
    if (!CODE_PURPOSES.includes(purpose)) {
      return res.status(400).json({ error: '验证码用途不合法' })
    }

    // 注册要求邮箱未被占用；重置密码要求邮箱已立籍
    const existing = await findByEmail(email)
    if (purpose === 'register' && existing) {
      return res.status(409).json({ error: '该邮箱已被注册' })
    }
    if (purpose === 'reset' && !existing) {
      return res.status(404).json({ error: '此邮箱尚未在仙门立籍' })
    }

    // 重发限频（同邮箱同用途 60 秒一封）
    const since = await secondsSinceLastCode(email, purpose)
    if (since !== null && since < CODE_RESEND_SECONDS) {
      return res
        .status(409)
        .json({ error: `发送过于频繁，稍候 ${CODE_RESEND_SECONDS - since} 息再试` })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await createCode(email, purpose, code, CODE_TTL_MINUTES)
    try {
      await sendVerificationCode(email, code, purpose, CODE_TTL_MINUTES)
    } catch (err) {
      console.error('发送验证码邮件失败:', err.message)
      return res.status(503).json({ error: '发信服务暂不可用，请稍后再试' })
    }
    res.json({ ok: true, resendSeconds: CODE_RESEND_SECONDS, ttlMinutes: CODE_TTL_MINUTES })
  } catch (err) {
    next(err)
  }
}

// 重置密码：邮箱 + 验证码 + 新密码；成功后吊销该账号现有登录（access_token 清空）
export async function resetPassword(req, res, next) {
  try {
    const email = String(req.body?.email ?? '').trim()
    const emailCode = String(req.body?.emailCode ?? '').trim()
    const newPassword = String(req.body?.newPassword ?? '')
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }
    if (!emailCode) {
      return res.status(400).json({ error: '请填写邮箱验证码' })
    }
    if (newPassword.length < MIN_PASSWORD_LEN) {
      return res.status(400).json({ error: `新密码至少${MIN_PASSWORD_LEN}位` })
    }

    const record = await findByEmail(email)
    if (!record) {
      return res.status(404).json({ error: '此邮箱尚未在仙门立籍' })
    }
    if (record.status !== 1) {
      return res.status(403).json({ error: '账号已被禁用' })
    }

    const ok = await verifyAndConsume(email, 'reset', emailCode)
    if (!ok) {
      return res.status(400).json({ error: '验证码有误或已过期' })
    }

    const hashed = await hashPassword(newPassword)
    await resetPasswordById(record.id, hashed)
    if (record.role !== 1) {
      await addLog(record.id, 'reset_password', '重铸道基，密令已换，旧符尽废')
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// 注册
export async function register(req, res, next) {
  try {
    const { daoName, email, password, gender } = req.body || {}

    if (!daoName || !email || !password) {
      return res.status(400).json({ error: '道号、邮箱、密码均为必填' })
    }
    // 性别可选：1=男(默认)、2=女
    const genderVal = gender === undefined ? 1 : Number(gender)
    if (genderVal !== 1 && genderVal !== 2) {
      return res.status(400).json({ error: '性别只能为 1(男) 或 2(女)' })
    }
    if (!DAO_NAME_RE.test(daoName)) {
      return res.status(400).json({ error: '道号需为2-16位中英文、数字或下划线' })
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }
    if (String(password).length < MIN_PASSWORD_LEN) {
      return res.status(400).json({ error: `密码至少${MIN_PASSWORD_LEN}位` })
    }

    if (await findByDaoName(daoName)) {
      return res.status(409).json({ error: '该道号已被占用' })
    }
    if (await findByEmail(email)) {
      return res.status(409).json({ error: '该邮箱已被注册' })
    }

    // 邮箱验证码（系统配置可关，供未配 SMTP 的环境临时放行）
    if (await getBoolConfig('register_email_code_enabled', true)) {
      const emailCode = String(req.body?.emailCode ?? '').trim()
      if (!emailCode) {
        return res.status(400).json({ error: '请填写邮箱验证码' })
      }
      const codeOk = await verifyAndConsume(email, 'register', emailCode)
      if (!codeOk) {
        return res.status(400).json({ error: '验证码有误或已过期' })
      }
    }

    const hashed = await hashPassword(password)
    // 初始悟性：99.5% 落在 1~10，0.5% 天纵奇才直接 15
    const id = await createUser({
      daoName,
      email,
      password: hashed,
      comprehension: rollComprehension(),
      gender: genderVal,
    })

    // 注册成功即签发令牌，前端可直接进入（新用户恒为玩家）
    const token = signToken({ id, daoName, role: 'user' })
    await updateLoginState(id, token)
    const user = await findPublicById(id)

    await addLog(id, 'register', `于凡尘立下道号「${daoName}」，踏上仙途`)
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

    // 令牌带 role：管理员(role=1)签发 'admin'，玩家签发 'user'；后台接口据此鉴权
    const token = signToken({
      id: record.id,
      daoName: record.dao_name,
      role: record.role === 1 ? 'admin' : 'user',
    })
    await updateLoginState(record.id, token)
    const user = await findPublicById(record.id)

    // 管理员登录不写修行日志（日志属玩家叙事）
    if (record.role !== 1) {
      await addLog(record.id, 'login', `登临此界，境界【${user?.realm_name || '凡人'}】`)
    }
    res.json({ token, user })
  } catch (err) {
    next(err)
  }
}

// 登出：清空令牌（吊销旧 token）并置离线（需鉴权）
export async function logout(req, res, next) {
  try {
    await clearLoginState(req.user.id)
    if (req.user.role !== 1) {
      await addLog(req.user.id, 'logout', '暂离此界，闭关去了')
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
