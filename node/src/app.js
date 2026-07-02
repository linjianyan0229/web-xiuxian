import express from 'express'
import cors from 'cors'
import apiRouter from './routes/index.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', apiRouter)

// 统一错误处理
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || '服务器内部错误' })
})

export default app
