import 'dotenv/config'

// 默认值仅供开发使用；生产环境（NODE_ENV=production）下若仍用这些默认值，
// assertProductionConfig() 会拒绝启动（见 server.js）
const DEFAULT_JWT_SECRET = 'xiuxian-dev-secret'
const DEFAULT_ADMIN_PASSWORD = 'admin123456'

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  // 允许跨域的前端来源（逗号分隔多个）；为空时开发放开、生产从严（见 app.js）
  frontendOrigin: process.env.FRONTEND_ORIGIN || '',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'web_xiuxian',
  },
  jwt: {
    secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  admin: {
    // 管理员并入 users 表：defaultUsername 即其道号，用道号或邮箱登录
    defaultUsername: process.env.ADMIN_USERNAME || 'admin',
    defaultPassword: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    defaultEmail: process.env.ADMIN_EMAIL || 'admin@xiuxian.local',
  },
  // SMTP 发信（邮箱验证码用）。host 为空视为未配置：开发环境验证码打印到控制台，生产环境发信接口报 503
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    // 465 端口为隐式 TLS（secure=true）；587/25 STARTTLS 需设 SMTP_SECURE=0
    secure: process.env.SMTP_SECURE !== '0',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from:
      process.env.MAIL_FROM ||
      (process.env.SMTP_USER ? `文字修仙 <${process.env.SMTP_USER}>` : '文字修仙 <no-reply@xiuxian.local>'),
  },
}

export const isProduction = config.env === 'production'

// 是否允许自动播种默认管理员：仅开发环境或显式配置了非默认管理员密码时
export const allowSeedDefaultAdmin =
  !isProduction || config.admin.defaultPassword !== DEFAULT_ADMIN_PASSWORD

// 生产环境启动前的强制配置校验：默认密钥/默认口令/空库密码一律拒绝启动，
// 避免把开发默认值带到线上。开发环境跳过（返回空数组）。
export function assertProductionConfig() {
  if (!isProduction) return []

  const errors = []
  if (!process.env.JWT_SECRET || config.jwt.secret === DEFAULT_JWT_SECRET) {
    errors.push('必须配置强随机的 JWT_SECRET（不得使用开发默认值）')
  }
  if (config.jwt.secret.length < 16) {
    errors.push('JWT_SECRET 长度过短，建议至少 32 位随机字符')
  }
  if (!process.env.DB_PASSWORD) {
    errors.push('生产环境必须配置 DB_PASSWORD')
  }
  if (!process.env.ADMIN_PASSWORD || config.admin.defaultPassword === DEFAULT_ADMIN_PASSWORD) {
    errors.push('必须配置 ADMIN_PASSWORD（不得使用默认口令 admin123456）')
  }

  if (errors.length > 0) {
    throw new Error(
      '生产环境配置校验未通过：\n  - ' + errors.join('\n  - ')
    )
  }
  return errors
}
