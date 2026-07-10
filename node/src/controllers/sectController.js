import {
  listSects,
  findSectById,
  sectRealmOptions,
  findRealmOption,
  createSect,
  updateSect,
  disbandSect,
  findMemberByUserId,
  listSectMembers,
  joinSect,
  removeMember,
  appointMember,
  transferLeader,
} from '../models/sectModel.js'
import { findPublicById } from '../models/userModel.js'
import { addLog } from '../models/playerLogModel.js'
import {
  SECT_POSITIONS,
  APPOINTABLE_POSITIONS,
  positionInfo,
  positionName,
  hasPersonnelPower,
  hasInfoPower,
  isEldersOrAbove,
} from '../utils/sectPositions.js'

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

// 我的成员视图（详情/成员列表接口共用）：非本宗成员返回 null
async function myMemberView(userId, sectId, gender) {
  const m = await findMemberByUserId(userId)
  if (!m || Number(m.sect_id) !== Number(sectId)) return null
  const info = positionInfo(m.position)
  return {
    position: m.position,
    position_name: positionName(m.position, gender),
    rank: info ? info.rank : 9,
    joined_time: m.joined_time,
  }
}

// GET /api/user/sects/:id — 宗门详细信息（my=我在此宗的职位，非本宗成员为 null）
export async function getSectDetail(req, res, next) {
  try {
    const sect = await findSectById(Number(req.params.id))
    if (!sect) return res.status(404).json({ error: '此宗门已不在仙门名录之上' })
    const my = await myMemberView(req.user.id, sect.id, req.user.gender)
    res.json({ sect, my })
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

/* ---------- 前台：成员与职位（一期：加入/退出/成员列表/任免/逐出/传位/改资料/解散） ---------- */

// GET /api/user/sects/:id/members — 宗门成员列表（任何登录玩家可看；本宗成员另附管理所需元数据）
export async function getSectMembers(req, res, next) {
  try {
    const sectId = Number(req.params.id)
    const sect = await findSectById(sectId)
    if (!sect) return res.status(404).json({ error: '此宗门已不在仙门名录之上' })

    const { page, pageSize } = req.query
    const data = await listSectMembers(sectId, { page, pageSize })
    const list = data.list.map((r) => {
      const info = positionInfo(r.position)
      return {
        ...r,
        position_name: positionName(r.position, r.gender),
        rank: info ? info.rank : 9,
      }
    })
    const my = await myMemberView(req.user.id, sectId, req.user.gender)
    // 有人事权时附可任命职位表（峰主/真传弟子依赖山峰系统，一期不开放；宗主只能经转让）
    const appointable =
      my && hasPersonnelPower(my.position)
        ? APPOINTABLE_POSITIONS.map((k) => ({
            key: k,
            name: SECT_POSITIONS[k].name,
            rank: SECT_POSITIONS[k].rank,
            quota: SECT_POSITIONS[k].quota,
          }))
        : []
    res.json({ ...data, list, my, leaderId: sect.leader_id, appointable })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects/:id/join — 拜入宗门（境界门槛校验，入宗即外门弟子）
export async function doJoinSect(req, res, next) {
  try {
    const sectId = Number(req.params.id)
    const sect = await findSectById(sectId)
    if (!sect) return res.status(404).json({ error: '此宗门已不在仙门名录之上' })

    // 前置校验给明确文案（原子守卫在事务里兜底并发）
    if (req.user.sect_id) {
      return res.status(409).json({ error: '道友已有宗门在身，欲投他宗须先退出本宗' })
    }
    if (sect.realm_req_rank > 0 && Number(req.user.realm_id) < Number(sect.realm_req_rank)) {
      return res.status(409).json({ error: `此宗收徒须【${sect.realm_req}】及以上境界，道友修为尚浅` })
    }

    const result = await joinSect({ userId: req.user.id, sectId })
    if (result.error === 'sect_gone') {
      return res.status(404).json({ error: '此宗门已不在仙门名录之上' })
    }
    if (result.error) {
      return res.status(409).json({ error: '入宗未成：道友已有宗门或境界不足' })
    }

    await addLog(req.user.id, 'sect_join', `拜入【${sect.name}】门下，忝列外门弟子`)
    const user = await findPublicById(req.user.id)
    res.json({ ok: true, user })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects/quit — 退出宗门（宗主不可退，须先传位或解散）
export async function doQuitSect(req, res, next) {
  try {
    const m = await findMemberByUserId(req.user.id)
    if (!m) return res.status(409).json({ error: '道友本就是散修之身' })
    if (m.position === 'sect_master') {
      return res.status(409).json({ error: '宗主之身不可轻退：须先传位于人，或解散宗门' })
    }
    const sect = await findSectById(m.sect_id)
    const affected = await removeMember({ sectId: m.sect_id, userId: req.user.id })
    if (!affected) return res.status(409).json({ error: '退宗未成，请稍后再试' })

    await addLog(req.user.id, 'sect_quit', `辞别【${sect?.name ?? '宗门'}】，重归散修之列`)
    const user = await findPublicById(req.user.id)
    res.json({ ok: true, user })
  } catch (err) {
    next(err)
  }
}

// 任免/逐出的操作者与目标校验（共用）：返回 { operator, target, sect } 或已回错误响应的 null
async function loadPersonnelContext(req, res, sectId) {
  const sect = await findSectById(sectId)
  if (!sect) {
    res.status(404).json({ error: '此宗门已不在仙门名录之上' })
    return null
  }
  const operator = await findMemberByUserId(req.user.id)
  if (!operator || Number(operator.sect_id) !== sectId) {
    res.status(403).json({ error: '道友并非此宗门人，无从置喙' })
    return null
  }
  if (!hasPersonnelPower(operator.position)) {
    res.status(403).json({ error: '人事任免须太上长老、宗主或神子/神女方可为之' })
    return null
  }
  const targetId = Number(req.body?.targetId)
  if (!Number.isInteger(targetId) || targetId <= 0) {
    res.status(400).json({ error: '未指明目标成员' })
    return null
  }
  if (targetId === req.user.id) {
    res.status(400).json({ error: '不可对自己行使任免之权' })
    return null
  }
  const target = await findMemberByUserId(targetId)
  if (!target || Number(target.sect_id) !== sectId) {
    res.status(404).json({ error: '此人并非本宗门人' })
    return null
  }
  if (target.position === 'sect_master') {
    res.status(403).json({ error: '宗主之位不可直接任免，须经传位（或宗主审判，未实装）' })
    return null
  }
  return { operator, target, sect, targetId }
}

// POST /api/user/sects/:id/appoint — 任免职位 { targetId, position }
// 神子/神女限制（文稿 §3）：对长老级以上（rank<=5）的任免须呈罢免信——文书系统未实装，一期直接 403
export async function doAppoint(req, res, next) {
  try {
    const sectId = Number(req.params.id)
    const ctx = await loadPersonnelContext(req, res, sectId)
    if (!ctx) return
    const { operator, target, sect, targetId } = ctx

    const position = String(req.body?.position ?? '').trim()
    if (!APPOINTABLE_POSITIONS.includes(position)) {
      return res.status(400).json({ error: '此职位不可任命（宗主须经传位；峰主/真传弟子待山峰系统实装）' })
    }
    if (target.position === position) {
      return res.status(400).json({ error: '此人已居此位' })
    }
    if (
      operator.position === 'divine_child' &&
      (isEldersOrAbove(target.position) || isEldersOrAbove(position))
    ) {
      return res.status(403).json({ error: '神子/神女不可直接任免长老级以上，须呈罢免信由宗主/太上长老定夺' })
    }

    const info = positionInfo(position)
    const result = await appointMember({ sectId, targetId, position, quota: info.quota })
    if (result.error === 'quota_full') {
      return res.status(409).json({ error: `「${info.name}」编制已满（限 ${info.quota} 人）` })
    }
    if (result.error) {
      return res.status(409).json({ error: '任免未成：此人已不在本宗' })
    }

    const targetUser = await findPublicById(targetId)
    const newName = positionName(position, targetUser?.gender)
    await addLog(targetId, 'sect_appoint', `【${sect.name}】人事任免：道友现居「${newName}」之位`)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects/:id/kick — 逐出宗门 { targetId }
export async function doKick(req, res, next) {
  try {
    const sectId = Number(req.params.id)
    const ctx = await loadPersonnelContext(req, res, sectId)
    if (!ctx) return
    const { operator, target, sect, targetId } = ctx

    if (operator.position === 'divine_child' && isEldersOrAbove(target.position)) {
      return res.status(403).json({ error: '神子/神女不可直接处置长老级以上，须呈罢免信由宗主/太上长老定夺' })
    }

    const affected = await removeMember({ sectId, userId: targetId })
    if (!affected) return res.status(409).json({ error: '逐出未成：此人已不在本宗' })

    await addLog(targetId, 'sect_kick', `被【${sect.name}】逐出师门，重归散修之列`)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects/:id/transfer — 传位宗主 { targetId }（原宗主卸任改任太上长老）
export async function doTransferLeader(req, res, next) {
  try {
    const sectId = Number(req.params.id)
    const sect = await findSectById(sectId)
    if (!sect) return res.status(404).json({ error: '此宗门已不在仙门名录之上' })
    if (Number(sect.leader_id) !== req.user.id) {
      return res.status(403).json({ error: '唯有宗主本人方可传位' })
    }
    const targetId = Number(req.body?.targetId)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: '未指明继任者' })
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ error: '道友本就是宗主' })
    }
    const target = await findMemberByUserId(targetId)
    if (!target || Number(target.sect_id) !== sectId) {
      return res.status(404).json({ error: '继任者须为本宗门人' })
    }

    const taishangQuota = SECT_POSITIONS.taishang_elder.quota
    const result = await transferLeader({ sectId, fromId: req.user.id, toId: targetId, taishangQuota })
    if (result.error === 'taishang_full') {
      return res.status(409).json({
        error: `传位后道友将退居太上长老，然其编制已满（限 ${taishangQuota} 人），须先另作安排`,
      })
    }
    if (result.error) {
      return res.status(409).json({ error: '传位未成：宗主之位或继任者状态有变' })
    }

    const targetUser = await findPublicById(targetId)
    await addLog(targetId, 'sect_appoint', `接掌【${sect.name}】，荣登宗主之位`)
    await addLog(
      req.user.id,
      'sect_transfer',
      `将【${sect.name}】宗主之位传于「${targetUser?.dao_name ?? '门人'}」，退居太上长老`
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// PUT /api/user/sects/:id — 修改宗门资料（宗门信息管理权：太上长老/宗主/神子）
export async function doUpdateMySect(req, res, next) {
  try {
    const sectId = Number(req.params.id)
    const sect = await findSectById(sectId)
    if (!sect) return res.status(404).json({ error: '此宗门已不在仙门名录之上' })
    const operator = await findMemberByUserId(req.user.id)
    if (!operator || Number(operator.sect_id) !== sectId || !hasInfoPower(operator.position)) {
      return res.status(403).json({ error: '宗门资料须太上长老、宗主或神子/神女方可改动' })
    }

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
    if (req.body?.avatarUrl !== undefined) {
      const avatar = normalizeImageUrl(req.body.avatarUrl)
      if (avatar.error) return res.status(400).json({ error: `宗门头像：${avatar.error}` })
      fields.avatar = avatar.value
    }
    if (req.body?.backgroundUrl !== undefined) {
      const background = normalizeImageUrl(req.body.backgroundUrl)
      if (background.error) return res.status(400).json({ error: `宗门背景：${background.error}` })
      fields.background = background.value
    }
    if (req.body?.realmReq !== undefined) {
      const realmReqRaw = String(req.body.realmReq).trim()
      if (!realmReqRaw) {
        fields.realm_req = ''
        fields.realm_req_rank = 0
      } else {
        const opt = await findRealmOption(realmReqRaw)
        if (!opt) return res.status(400).json({ error: '境界要求不在可选之列' })
        fields.realm_req = opt.realm
        fields.realm_req_rank = Number(opt.realm_rank) || 0
      }
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: '没有可更新的字段' })
    }

    try {
      await updateSect(sectId, fields)
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '此宗门名号已有人立派，另取一名吧' })
      }
      throw err
    }
    res.json({ sect: await findSectById(sectId) })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/sects/:id/disband — 解散宗门（仅宗主本人）
export async function doDisbandMySect(req, res, next) {
  try {
    const sectId = Number(req.params.id)
    const sect = await findSectById(sectId)
    if (!sect) return res.status(404).json({ error: '此宗门已不在仙门名录之上' })
    if (Number(sect.leader_id) !== req.user.id) {
      return res.status(403).json({ error: '唯有宗主本人方可解散宗门' })
    }

    const affected = await disbandSect(sectId, { leaderId: req.user.id })
    if (!affected) {
      return res.status(409).json({ error: '宗主之位已易主或宗门已散，无法解散' })
    }
    await addLog(req.user.id, 'sect_disband', `将【${sect.name}】解散，众弟子皆散去，各奔前程`)
    const user = await findPublicById(req.user.id)
    res.json({ ok: true, user })
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
