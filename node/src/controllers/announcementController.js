import {
  listPublished,
  listAll,
  findById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../models/announcementModel.js'
import { listLogsByTypes } from '../models/playerLogModel.js'

// 「通知请求」纳入的系统通知类型（玩家被动收到、需知悉的事件）。
// 含丹药赠礼、好友结交请求/应允、宗门任免/逐出；后续宗门邀请等实装后在此追加即可。
const NOTICE_TYPES = ['pill_receive', 'friend_request', 'friend_accepted', 'sect_appoint', 'sect_kick']

// 公告标题/正文长度上限（与 DB VARCHAR 留余量）
const MAX_TITLE_LEN = 60
const MAX_CONTENT_LEN = 2000

/* ---------- 前台（玩家） ---------- */

// GET /api/user/announcements — 通知弹窗数据：已发布公告 + 本人系统通知
export async function getAnnouncements(req, res, next) {
  try {
    const [announcements, notices] = await Promise.all([
      listPublished(30),
      listLogsByTypes(req.user.id, NOTICE_TYPES, 30),
    ])
    res.json({ announcements, notices })
  } catch (err) {
    next(err)
  }
}

/* ---------- 后台（管理员） ---------- */

// 校验并规整公告字段；返回 { error } 或 { title, content, pinned, status }
function normalizeAnnouncement(body, { partial = false } = {}) {
  const fields = {}

  if (body?.title !== undefined || !partial) {
    const title = String(body?.title ?? '').trim()
    if (title.length < 1 || title.length > MAX_TITLE_LEN) {
      return { error: `公告标题须为 1~${MAX_TITLE_LEN} 个字符` }
    }
    fields.title = title
  }
  if (body?.content !== undefined || !partial) {
    const content = String(body?.content ?? '').trim()
    if ([...content].length > MAX_CONTENT_LEN) {
      return { error: `公告正文最多 ${MAX_CONTENT_LEN} 字` }
    }
    fields.content = content
  }
  if (body?.pinned !== undefined) {
    fields.pinned = Number(body.pinned) ? 1 : 0
  } else if (!partial) {
    fields.pinned = 0
  }
  if (body?.status !== undefined) {
    fields.status = Number(body.status) === 0 ? 0 : 1
  } else if (!partial) {
    fields.status = 1
  }

  return fields
}

// GET /api/admin/announcements — 公告列表（分页 + 标题关键字，含下架）
export async function adminGetAnnouncements(req, res, next) {
  try {
    const { page, pageSize, keyword = '' } = req.query
    res.json(await listAll({ page, pageSize, keyword }))
  } catch (err) {
    next(err)
  }
}

// POST /api/admin/announcements — 发布公告
export async function adminCreateAnnouncement(req, res, next) {
  try {
    const fields = normalizeAnnouncement(req.body, { partial: false })
    if (fields.error) return res.status(400).json({ error: fields.error })
    const id = await createAnnouncement(fields)
    res.status(201).json({ announcement: await findById(id) })
  } catch (err) {
    next(err)
  }
}

// PUT /api/admin/announcements/:id — 编辑公告（部分字段更新）
export async function adminEditAnnouncement(req, res, next) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '公告ID无效' })
    }
    if (!(await findById(id))) {
      return res.status(404).json({ error: '公告不存在' })
    }
    const fields = normalizeAnnouncement(req.body, { partial: true })
    if (fields.error) return res.status(400).json({ error: fields.error })
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: '没有可更新的字段' })
    }
    await updateAnnouncement(id, fields)
    res.json({ announcement: await findById(id) })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/admin/announcements/:id — 删除公告
export async function adminDeleteAnnouncement(req, res, next) {
  try {
    const id = Number(req.params.id)
    const affected = await deleteAnnouncement(id)
    if (!affected) return res.status(404).json({ error: '公告不存在' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
