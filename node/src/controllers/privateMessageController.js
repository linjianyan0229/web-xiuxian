import {
  addMessage,
  listConversation,
  listConversations,
  markConversationRead,
  countUnread,
} from '../models/privateMessageModel.js'
import { eitherBlocked } from '../models/userBlockModel.js'
import { findRawById, findPublicById } from '../models/userModel.js'
import { containsSensitive } from '../utils/sensitiveWords.js'

// 单条私信最大字数（按字符计，与 DB VARCHAR(255) 留余量）
const MAX_CONTENT_LEN = 200

// 控制字符（含 DEL）一律转空格，防换行刷屏/乱码
const CONTROL_CHARS = new RegExp('[\u0000-\u001f\u007f]', 'g')

// GET /api/user/messages — 会话列表 + 未读总数
export async function getConversations(req, res, next) {
  try {
    const [conversations, unread] = await Promise.all([
      listConversations(req.user.id),
      countUnread(req.user.id),
    ])
    res.json({ conversations, unread })
  } catch (err) {
    next(err)
  }
}

// GET /api/user/messages/unread — 未读私信总数（伙伴角标轮询用，轻量）
export async function getUnreadCount(req, res, next) {
  try {
    res.json({ unread: await countUnread(req.user.id) })
  } catch (err) {
    next(err)
  }
}

// GET /api/user/messages/:userId — 与某道友的往来消息（并标记其发来的消息为已读）
export async function getConversation(req, res, next) {
  try {
    const otherId = Number(req.params.userId)
    if (!Number.isInteger(otherId) || otherId <= 0) {
      return res.status(400).json({ error: '目标道友无效' })
    }
    const other = await findPublicById(otherId)
    if (!other || other.role !== 0) {
      return res.status(404).json({ error: '未寻得此道友' })
    }
    const list = await listConversation(req.user.id, otherId)
    await markConversationRead(req.user.id, otherId)
    res.json({
      list,
      peer: {
        id: other.id,
        dao_name: other.dao_name,
        avatar: other.avatar,
        gender: other.gender,
        realm_name: other.realm_name,
        sect_name: other.sect_name,
      },
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/user/messages — { targetId, content } 发送私信
export async function sendMessage(req, res, next) {
  try {
    const targetId = Number(req.body?.targetId)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: '目标道友无效' })
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ error: '不可给自己传音' })
    }
    const target = await findRawById(targetId)
    if (!target || target.role !== 0) {
      return res.status(404).json({ error: '未寻得此道友' })
    }
    if (await eitherBlocked(req.user.id, targetId)) {
      return res.status(403).json({ error: '因拉黑关系，无法向此道友传音' })
    }

    const content = String(req.body?.content ?? '').replace(CONTROL_CHARS, ' ').trim()
    if (!content) {
      return res.status(400).json({ error: '传音内容不能为空' })
    }
    if ([...content].length > MAX_CONTENT_LEN) {
      return res.status(400).json({ error: `传音最多 ${MAX_CONTENT_LEN} 字` })
    }
    if (containsSensitive(content)) {
      return res.status(400).json({ error: '言辞含违禁之语，此界天道不容，请斟酌后再传音' })
    }

    const id = await addMessage(req.user.id, targetId, content)
    res.status(201).json({
      message: {
        id,
        sender_id: req.user.id,
        receiver_id: targetId,
        content,
        created_time: new Date().toISOString(),
      },
    })
  } catch (err) {
    next(err)
  }
}
