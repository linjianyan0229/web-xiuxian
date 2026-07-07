import { scanSensitive } from '../utils/sensitiveWords.js'

// 待检测文本长度上限（通用预检口径，比聊天 200 字宽松，供简介等长文本复用）
const MAX_CHECK_LEN = 5000

// POST /api/user/sensitive/check — 通用敏感词检测。
// 世界频道发言已在服务端强制拦截；本接口供前端预检提示与后续玩法（道号/宗门名/简介等）复用。
export async function checkSensitive(req, res, next) {
  try {
    const text = String(req.body?.text ?? '')
    if (!text.trim()) {
      return res.status(400).json({ error: '待检测文本不能为空' })
    }
    if ([...text].length > MAX_CHECK_LEN) {
      return res.status(400).json({ error: `待检测文本最多 ${MAX_CHECK_LEN} 字` })
    }
    const { hit, words, sanitized } = scanSensitive(text)
    res.json({ hit, words, sanitized })
  } catch (err) {
    next(err)
  }
}
