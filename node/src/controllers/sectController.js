import {
  listSects,
  findSectById,
  sectRealmOptions,
  findRealmOption,
  createSect,
  updateSect,
  disbandSect,
} from '../models/sectModel.js'
import { findPublicById } from '../models/userModel.js'
import { addLog } from '../models/playerLogModel.js'

// 立派费用（灵石）；后续可挪入 system_configs 由后台调整
export const SECT_CREATE_COST = 5000

// 外链图片 URL 校验（宗门头像/背景暂用外链，同头像外链的口径）；空值合法返回 null
function normalizeImageUrl(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { value: null }
  if (s.length > 255) return { error: '图片链接过长（最多 255 字符）' }
  let parsed
  try {
    parsed = new URL(s)
  } catch {
    return { error: '图片链接格式不正确' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: '仅支持 http/https 图片链接' }
  }
  return { value: s }
}

/* ---------- 前台（玩家） ---------- */

// GET /api/user/sects — 宗门列表（分页 + 名称搜索 + 境界要求筛选）
export async function getSects(req, res, next) {
  try {
    const { page, pageSize, keyword = '', realmReq = '' } = req.query
    const data = await listSects({ page, pageSize, keyword, realmReq })
    // 带上"我的宗门"，前端据此显示入口态（已有宗门则不可再立派）
    res.json({ ...data, mySectId: req.user.sect_id ?? null })
  } catch (err) {
    next(err)
  }
}

// GET /api/user/sects/meta — 立派/筛选元数据：境界要求可选项 + 立派费用
export async function getSectMeta(req, res, next) {
  try {
    res.json({ realms: await sectRealmOptions(), createCost: SECT_CREATE_COST })
  } catch (err) {
    next(err)
  }
}

// GET /api/user/sects/:id — 宗门详细信息
export async function getSectDetail(req, res, next) {
  try {
    const sect = await findSectById(Number(req.params.id))
    if (!sect) return res.status(404).json({ error: '此宗门已不在仙门名录之上' })
    res.json({ sect })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects — 创建宗门：扣除 5000 灵石，创建者自任宗主并入驻
export async function doCreateSect(req, res, next) {
  try {
    const name = String(req.body?.name ?? '').trim()
    const intro = String(req.body?.intro ?? '').trim()
    const realmReqRaw = String(req.body?.realmReq ?? '').trim()

    if (name.length < 2 || name.length > 16) {
      return res.status(400).json({ error: '宗门名称须为 2~16 个字符' })
    }
    if (intro.length > 500) {
      return res.status(400).json({ error: '宗门简介最多 500 字' })
    }
    const avatar = normalizeImageUrl(req.body?.avatarUrl)
    if (avatar.error) return res.status(400).json({ error: `宗门头像：${avatar.error}` })
    const background = normalizeImageUrl(req.body?.backgroundUrl)
    if (background.error) return res.status(400).json({ error: `宗门背景：${background.error}` })

    // 境界要求：空 = 无要求；否则须为合法大境界
    let realmReq = ''
    let realmReqRank = 0
    if (realmReqRaw) {
      const opt = await findRealmOption(realmReqRaw)
      if (!opt) return res.status(400).json({ error: '境界要求不在可选之列' })
      realmReq = opt.realm
      realmReqRank = Number(opt.realm_rank) || 0
    }

    // 前置校验给出明确文案（原子守卫在事务里兜底并发）
    if (req.user.sect_id) {
      return res.status(409).json({ error: '道友已有宗门在身，不可另立门户' })
    }
    if ((Number(req.user.ling_shi) || 0) < SECT_CREATE_COST) {
      return res.status(409).json({ error: `立派需耗费灵石 ${SECT_CREATE_COST}，道友囊中尚且不足` })
    }

    let result
    try {
      result = await createSect({
        leaderId: req.user.id,
        name,
        intro,
        avatar: avatar.value,
        background: background.value,
        realmReq,
        realmReqRank,
        cost: SECT_CREATE_COST,
      })
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '此宗门名号已有人立派，另取一名吧' })
      }
      throw err
    }
    if (result.error) {
      // 并发下抢先入他宗/灵石被扣等，守卫未过
      return res.status(409).json({ error: '立派未成：灵石不足或道友已有宗门' })
    }

    await addLog(
      req.user.id,
      'sect_create',
      `散尽 ${SECT_CREATE_COST} 灵石，开宗立派创下【${name}】，自任宗主`
    )
    const sect = await findSectById(result.id)
    const user = await findPublicById(req.user.id)
    res.json({ sect, user })
  } catch (err) {
    next(err)
  }
}

/* ---------- 后台（管理员） ---------- */

// GET /api/admin/sects — 宗门列表管理（分页 + 名称关键字）
export async function adminGetSects(req, res, next) {
  try {
    const { page, pageSize, keyword = '' } = req.query
    res.json(await listSects({ page, pageSize, keyword }))
  } catch (err) {
    next(err)
  }
}

// PUT /api/admin/sects/:id — 编辑宗门（名称/简介/活跃度）
export async function adminEditSect(req, res, next) {
  try {
    const id = Number(req.params.id)
    const sect = await findSectById(id)
    if (!sect) return res.status(404).json({ error: '宗门不存在' })

    const fields = {}
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim()
      if (name.length < 2 || name.length > 16) {
        return res.status(400).json({ error: '宗门名称须为 2~16 个字符' })
      }
      fields.name = name
    }
    if (req.body?.intro !== undefined) {
      const intro = String(req.body.intro).trim()
      if (intro.length > 500) return res.status(400).json({ error: '宗门简介最多 500 字' })
      fields.intro = intro
    }
    if (req.body?.activity !== undefined) {
      const activity = Number(req.body.activity)
      if (!Number.isInteger(activity) || activity < 0) {
        return res.status(400).json({ error: '活跃度须为非负整数' })
      }
      fields.activity = activity
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: '没有可更新的字段' })
    }

    try {
      await updateSect(id, fields)
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '宗门名称已被占用' })
      }
      throw err
    }
    res.json({ sect: await findSectById(id) })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/admin/sects/:id — 解散宗门（清空全体成员归属）
export async function adminDisbandSect(req, res, next) {
  try {
    const id = Number(req.params.id)
    const affected = await disbandSect(id)
    if (!affected) return res.status(404).json({ error: '宗门不存在' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
