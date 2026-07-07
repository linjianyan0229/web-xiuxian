import { open, unlink } from 'node:fs/promises'
import { join, basename } from 'node:path'
import multer from 'multer'
import { AVATARS_DIR, AVATAR_URL_PREFIX } from '../config/uploads.js'
import { updateAvatar, findPublicById } from '../models/userModel.js'
import { addLog } from '../models/playerLogModel.js'

// 允许的头像图片类型（mimetype -> 落盘扩展名，不信任客户端原始文件名）
const IMAGE_EXTS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}
const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2MB

const upload = multer({
  storage: multer.diskStorage({
    destination: AVATARS_DIR,
    filename(req, file, cb) {
      // 文件名带用户ID与时间戳：不同用户不冲突，换头像不复用旧 URL（避免浏览器缓存串图）
      cb(null, `u${req.user.id}_${Date.now()}${IMAGE_EXTS[file.mimetype]}`)
    },
  }),
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter(req, file, cb) {
    if (!IMAGE_EXTS[file.mimetype]) {
      return cb(Object.assign(new Error('头像仅支持 JPG/PNG/WebP/GIF 图片'), { status: 400 }))
    }
    cb(null, true)
  },
}).single('avatar')

// 删除头像文件（仅限头像目录内的路径，外链 URL 不处理）；换头像/删号清理用，失败静默不影响主流程
export function removeAvatarFile(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith(`${AVATAR_URL_PREFIX}/`)) return
  unlink(join(AVATARS_DIR, basename(avatarUrl))).catch(() => {})
}

// 文件头魔数嗅探：返回真实图片类型（白名单四种之一），无法识别返回 null。
// mimetype 可被客户端伪造，落盘后以文件内容为准复核（审查项 P2）。
function sniffImageMime(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buf.length >= 12 &&
    buf.toString('latin1', 0, 4) === 'RIFF' &&
    buf.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  const head6 = buf.toString('latin1', 0, 6)
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif'
  return null
}

// 读取文件前 N 字节（魔数校验用）
async function readFileHead(path, bytes = 12) {
  const fh = await open(path, 'r')
  try {
    const buf = Buffer.alloc(bytes)
    const { bytesRead } = await fh.read(buf, 0, bytes, 0)
    return buf.subarray(0, bytesRead)
  } finally {
    await fh.close()
  }
}

// 接收 multipart/form-data 的 avatar 文件字段；multer 错误（超限/类型不符）统一转 400
export function avatarUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next()
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '头像图片不能超过 2MB' })
    }
    next(err.status ? err : Object.assign(err, { status: 400 }))
  })
}

// 上传头像：落盘 -> 魔数复核 -> 更新 users.avatar -> 清理旧头像文件 -> 返回最新用户视图
export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请在 avatar 字段上传头像图片' })
    }
    // 内容真实性校验：文件头魔数须与声明的 mimetype 一致（防伪造 MIME 上传非图片内容）
    const realMime = sniffImageMime(await readFileHead(req.file.path))
    if (!realMime || realMime !== req.file.mimetype) {
      await unlink(req.file.path).catch(() => {})
      return res.status(400).json({ error: '图片内容与声明格式不符，请上传真实的 JPG/PNG/WebP/GIF 图片' })
    }
    const url = `${AVATAR_URL_PREFIX}/${req.file.filename}`
    const oldAvatar = req.user.avatar
    await updateAvatar(req.user.id, url)

    // 替换成功后清理旧头像文件
    removeAvatarFile(oldAvatar)

    await addLog(req.user.id, 'avatar', '于洞府静室重塑法相，道容焕然一新。')
    const user = await findPublicById(req.user.id)
    res.json({ user })
  } catch (err) {
    // 入库失败时回收已落盘的新文件，避免孤儿文件堆积
    if (req.file) unlink(req.file.path).catch(() => {})
    next(err)
  }
}

// 以外链 URL 设置头像（url 传空字符串则清除，恢复道号首字占位）。
// 仅存 URL 不代理拉取，图片加载失败由前端 UserAvatar 回退占位。
export async function setAvatarUrl(req, res, next) {
  try {
    const raw = String(req.body?.url ?? '').trim()
    let url = null
    if (raw) {
      if (raw.length > 255) {
        return res.status(400).json({ error: '图片链接过长（最多 255 字符）' })
      }
      let parsed
      try {
        parsed = new URL(raw)
      } catch {
        return res.status(400).json({ error: '图片链接格式不正确' })
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).json({ error: '仅支持 http/https 图片链接' })
      }
      url = raw
    }

    const oldAvatar = req.user.avatar
    await updateAvatar(req.user.id, url)
    // 旧头像若为本站上传文件则清理；旧头像为外链时无需处理
    removeAvatarFile(oldAvatar)

    await addLog(
      req.user.id,
      'avatar',
      url ? '于洞府静室重塑法相，道容焕然一新。' : '收起法相，返璞归真。'
    )
    const user = await findPublicById(req.user.id)
    res.json({ user })
  } catch (err) {
    next(err)
  }
}
