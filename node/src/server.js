import app from './app.js'
import { config, assertProductionConfig } from './config/env.js'
import { initDatabase } from './config/db.js'
import { ensureUploadDirs } from './config/uploads.js'
import { initSensitiveWords } from './utils/sensitiveWords.js'

async function bootstrap() {
  try {
    // 生产环境强制校验密钥/口令/库密码，默认值直接拒绝启动
    assertProductionConfig()
    await initDatabase()
    await ensureUploadDirs()
    await initSensitiveWords()
    app.listen(config.port, () => {
      console.log(`修仙服务器已启动: http://localhost:${config.port}`)
    })
  } catch (err) {
    console.error('服务启动失败:', err.message)
    process.exit(1)
  }
}

bootstrap()
