import {
  addMessage,
  findMessageById,
  listRecentMessages,
  listMessagesAfter,
  secondsSinceLastMessage,
} from '../models/worldMessageModel.js'
import { getNumberConfig } from '../models/systemConfigModel.js'

// 单条消息最大字数（按字符计，与 DB VARCHAR(255) 留余量）
const MAX_CONTENT_LEN = 200

// 发言间隔来自系统配置，收敛到 [0, 3600]，默认 5 秒；0 为不限制
async function getCooldownSeconds() {
  const raw = await getNumberConfig('world_chat_cooldown_seconds', 5)
  return Math.min(3600, Math.max(0, Math.floor(raw) || 0))
}

// 拉取消息：无 afterId 取最新 N 条（时间正序返回）；带 afterId 做增量轮询（只回新消息）
export async function getWorldMessages(req, res, next) {
  try {
    const afterId = Math.max(0, parseInt(req.query.afterId, 10) || 0)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30))
    const list =
      afterId > 0
        ? await listMessagesAfter(afterId, limit)
        : (await listRecentMessages(limit)).reverse()
    res.json({ list, lastId: list.length ? list[list.length - 1].id : afterId })
  } catch (err) {
    next(err)
  }
}

// 发言：清洗内容（去控制字符、收敛长度）+ 冷却校验，成功返回带发送者信息的完整消息行
export async function postWorldMessage(req, res, next) {
  try {
    const content = String(req.body?.content ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ') // 控制字符一律转空格（防换行刷屏/乱码）
      .trim()
    if (!content) {
      return res.status(400).json({ error: '传音内容不能为空' })
    }
    if ([...content].length > MAX_CONTENT_LEN) {
      return res.status(400).json({ error: `传音最多 ${MAX_CONTENT_LEN} 字` })
    }

    const cooldown = await getCooldownSeconds()
    if (cooldown > 0) {
      const since = await secondsSinceLastMessage(req.user.id)
      if (since !== null && since < cooldown) {
        return res.status(409).json({ error: `传音过于频繁，稍候 ${cooldown - since} 息再试` })
      }
    }

    const id = await addMessage(req.user.id, content)
    const message = await findMessageById(id)
    res.status(201).json({ message })
  } catch (err) {
    next(err)
  }
}
