import {
  countUsers,
  countUsersByStatus,
  countUsersRegisteredToday,
  countAdmins,
  listUsers,
  updateUserStatus,
  findPublicById,
  findRawById,
  findByDaoName,
  findByEmail,
  adminCreateUser,
  updateUser,
  deleteUser,
} from '../models/userModel.js'
import { rankByRealm, rankOnlineByRealm, rankByDeath } from '../models/userModel.js'
import {
  listRealms,
  countRealms,
  findRealmById,
  updateSignInRange,
  updateRealm,
} from '../models/realmModel.js'
import { listConfigs, updateConfig } from '../models/systemConfigModel.js'
import { hashPassword } from '../utils/password.js'
import { DAO_NAME_RE, EMAIL_RE, MIN_PASSWORD_LEN } from '../utils/validators.js'
import { rollComprehension, clampComprehension } from '../utils/comprehension.js'

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

/* ---------- 系统配置 ---------- */

// 系统配置列表（键值对，如签到功能开关）
export async function getConfigs(req, res, next) {
  try {
    const list = await listConfigs()
    res.json({ list })
  } catch (err) {
    next(err)
  }
}

// 更新单个系统配置项
export async function updateConfigItem(req, res, next) {
  try {
    const key = String(req.params.key || '')
    const { value } = req.body || {}
    if (value === undefined || value === null) {
      return res.status(400).json({ error: '缺少配置值 value' })
    }
    const affected = await updateConfig(key, String(value))
    if (!affected) {
      return res.status(404).json({ error: '配置项不存在' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// 收敛百分比到 [0.1, 3] 并保留两位小数
function clampPercent(v) {
  return Math.round(Math.min(3, Math.max(0.1, v)) * 100) / 100
}

// 设置某境界的每日签到奖励百分比区间（min/max 各收敛到 0.1~3，且保证 min<=max）
export async function setRealmSignIn(req, res, next) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '境界ID无效' })
    }
    const rawMin = Number(req.body?.minPercent)
    const rawMax = Number(req.body?.maxPercent)
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
      return res.status(400).json({ error: 'minPercent / maxPercent 必须为数字' })
    }
    let min = clampPercent(rawMin)
    let max = clampPercent(rawMax)
    if (min > max) [min, max] = [max, min] // 反了则自动互换

    const affected = await updateSignInRange(id, min, max)
    if (!affected) {
      return res.status(404).json({ error: '境界不存在' })
    }
    const realm = await findRealmById(id)
    res.json({ realm })
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

/* ---------- 用户增删改（均限玩家 role=0）---------- */

// 校验境界ID存在性；不存在返回 null
async function resolveRealmId(realmId) {
  const rid = Number(realmId)
  if (!Number.isInteger(rid) || rid <= 0) return null
  const realm = await findRealmById(rid)
  return realm ? rid : null
}

// 解析非负整数（资源/属性用）
function parseUint(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return { ok: false }
  return { ok: true, value: Math.floor(n) }
}

// 新建玩家
export async function createUser(req, res, next) {
  try {
    const { daoName, email, password, status = 1, realmId = 1 } = req.body || {}
    if (!daoName || !email || !password) {
      return res.status(400).json({ error: '道号、邮箱、密码均为必填' })
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
    const rid = await resolveRealmId(realmId)
    if (rid === null) return res.status(400).json({ error: '境界不存在' })
    if (await findByDaoName(daoName)) return res.status(409).json({ error: '该道号已被占用' })
    if (await findByEmail(email)) return res.status(409).json({ error: '该邮箱已被注册' })

    const hashed = await hashPassword(password)
    // 后台建号与注册同规则随机初始悟性
    const id = await adminCreateUser({
      daoName,
      email,
      password: hashed,
      status: Number(status) === 0 ? 0 : 1,
      realmId: rid,
      comprehension: rollComprehension(),
    })
    const user = await findPublicById(id)
    res.status(201).json({ user })
  } catch (err) {
    next(err)
  }
}

// 编辑玩家（部分字段更新，均可选）
export async function editUser(req, res, next) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '用户ID无效' })
    }
    const raw = await findRawById(id)
    if (!raw || raw.role !== 0) {
      return res.status(404).json({ error: '玩家不存在' })
    }

    const body = req.body || {}
    const fields = {}

    if (body.daoName !== undefined) {
      if (!DAO_NAME_RE.test(body.daoName)) {
        return res.status(400).json({ error: '道号需为2-16位中英文、数字或下划线' })
      }
      if (body.daoName !== raw.dao_name) {
        const dup = await findByDaoName(body.daoName)
        if (dup && dup.id !== id) return res.status(409).json({ error: '该道号已被占用' })
      }
      fields.dao_name = body.daoName
    }
    if (body.email !== undefined) {
      if (!EMAIL_RE.test(body.email)) {
        return res.status(400).json({ error: '邮箱格式不正确' })
      }
      if (body.email !== raw.email) {
        const dup = await findByEmail(body.email)
        if (dup && dup.id !== id) return res.status(409).json({ error: '该邮箱已被注册' })
      }
      fields.email = body.email
    }
    if (body.status !== undefined) {
      fields.status = Number(body.status) === 0 ? 0 : 1
    }
    if (body.realmId !== undefined) {
      const rid = await resolveRealmId(body.realmId)
      if (rid === null) return res.status(400).json({ error: '境界不存在' })
      fields.realm_id = rid
    }

    // 资源 / 统计字段（非负整数）
    const numMap = {
      lingShi: 'ling_shi',
      cultivation: 'cultivation',
      daoYun: 'dao_yun',
      daoLaw: 'dao_law',
      deathCount: 'death_count',
    }
    for (const [k, col] of Object.entries(numMap)) {
      if (body[k] !== undefined) {
        const p = parseUint(body[k])
        if (!p.ok) return res.status(400).json({ error: `${col} 必须为非负整数` })
        fields[col] = p.value
      }
    }

    // 悟性（0~100 的整数百分比）
    if (body.comprehension !== undefined) {
      const c = clampComprehension(body.comprehension)
      if (c === null) return res.status(400).json({ error: '悟性必须为 0~100 的数字' })
      fields.comprehension = c
    }

    // 可选重置密码（留空则不改）
    if (body.password) {
      if (String(body.password).length < MIN_PASSWORD_LEN) {
        return res.status(400).json({ error: `密码至少${MIN_PASSWORD_LEN}位` })
      }
      fields.password = await hashPassword(body.password)
    }

    await updateUser(id, fields)
    const user = await findPublicById(id)
    res.json({ user })
  } catch (err) {
    next(err)
  }
}

// 删除玩家
export async function removeUser(req, res, next) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '用户ID无效' })
    }
    const affected = await deleteUser(id)
    if (!affected) {
      return res.status(404).json({ error: '玩家不存在' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// 编辑境界名称与属性（body 用 snake_case，与境界字段一致；均可选）
export async function editRealm(req, res, next) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '境界ID无效' })
    }
    const realm = await findRealmById(id)
    if (!realm) {
      return res.status(404).json({ error: '境界不存在' })
    }

    const body = req.body || {}
    const fields = {}

    // 字符串字段 { 列: 最大长度 }
    const strCols = {
      realm: 32,
      stage: 16,
      name: 48,
      next_realm: 48,
      requirement_type: 32,
      tribulation_type: 32,
      note: 255,
    }
    for (const [col, max] of Object.entries(strCols)) {
      if (body[col] !== undefined) fields[col] = String(body[col]).trim().slice(0, max)
    }
    if (fields.name !== undefined && fields.name === '') {
      return res.status(400).json({ error: '境界名不能为空' })
    }

    // 非负整数字段
    const uintCols = [
      'advance_exp', 'dao_yun_required', 'dao_law_required',
      'hp', 'ling_qi', 'attack', 'defense', 'spirit',
    ]
    for (const col of uintCols) {
      if (body[col] !== undefined) {
        const p = parseUint(body[col])
        if (!p.ok) return res.status(400).json({ error: `${col} 必须为非负整数` })
        fields[col] = p.value
      }
    }

    // 雷劫死亡率 0~100，保留一位小数
    if (body.tribulation_death_rate !== undefined) {
      const n = Number(body.tribulation_death_rate)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({ error: '雷劫死亡率需在 0~100 之间' })
      }
      fields.tribulation_death_rate = Math.round(n * 10) / 10
    }

    await updateRealm(id, fields)
    const updated = await findRealmById(id)
    res.json({ realm: updated })
  } catch (err) {
    next(err)
  }
}
