import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'web_xiuxian',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'xiuxian-dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  admin: {
    // 管理员并入 users 表：defaultUsername 即其道号，用道号或邮箱登录
    defaultUsername: process.env.ADMIN_USERNAME || 'admin',
    defaultPassword: process.env.ADMIN_PASSWORD || 'admin123456',
    defaultEmail: process.env.ADMIN_EMAIL || 'admin@xiuxian.local',
  },
}
