import app from './app.js'
import { config } from './config/env.js'
import { initDatabase } from './config/db.js'

async function bootstrap() {
  try {
    await initDatabase()
    app.listen(config.port, () => {
      console.log(`修仙服务器已启动: http://localhost:${config.port}`)
    })
  } catch (err) {
    console.error('服务启动失败:', err.message)
    process.exit(1)
  }
}

bootstrap()
