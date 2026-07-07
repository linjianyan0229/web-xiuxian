import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 上传文件落盘根目录（node/uploads，已 gitignore），由 app.js 经 /api/uploads 静态托管
export const UPLOADS_DIR = join(__dirname, '../../uploads')
export const AVATARS_DIR = join(UPLOADS_DIR, 'avatars')
// 头像对外访问路径前缀；入库存完整访问路径，前端经 /api 代理直接可用
export const AVATAR_URL_PREFIX = '/api/uploads/avatars'

// 启动时确保目录存在（幂等）
export async function ensureUploadDirs() {
  await mkdir(AVATARS_DIR, { recursive: true })
}
