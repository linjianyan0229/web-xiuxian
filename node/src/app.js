import express from 'express'
import cors from 'cors'
import apiRouter from './routes/index.js'
import { config } from './config/env.js'
import { UPLOADS_DIR } from './config/uploads.js'

const app = express()

// CORS：配置了 FRONTEND_ORIGIN 则仅放行这些来源（逗号分隔多个）；
// 未配置时开发环境放开所有来源，生产环境从严（不回显来源，浏览器跨域被拦）。
const allowedOrigins = config.frontendOrigin
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins, credentials: true }))
} else if (config.env !== 'production') {
  app.use(cors())
} else {
  // 生产未配置来源：不放行任何跨域来源（同源部署 / 反向代理场景无需 CORS）
  app.use(cors({ origin: false }))
}

app.use(express.json())

// 上传文件静态托管（头像等）；文件名带时间戳不复用，可放心长缓存
app.use('/api/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }))

app.use('/api', apiRouter)

// 统一错误处理
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || '服务器内部错误' })
})

export default app
