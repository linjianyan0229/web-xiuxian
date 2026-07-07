import { query } from '../config/db.js'

// 邮箱验证码数据访问（注册/重置密码共用）。一次一码：新码直接插新行，
// 校验时只认「最新一条未用未过期」，旧码自然作废，无需清理任务。

// 距上次给该邮箱签发同用途验证码的秒数（限频用）；从未签发返回 null
export async function secondsSinceLastCode(email, purpose) {
  const rows = await query(
    `SELECT TIMESTAMPDIFF(SECOND, created_time, NOW()) AS since
     FROM email_codes WHERE email = ? AND purpose = ?
     ORDER BY id DESC LIMIT 1`,
    [email, purpose]
  )
  return rows.length ? Number(rows[0].since) : null
}

// 签发验证码（过期时间以 DB 时钟计）
export async function createCode(email, purpose, code, ttlMinutes) {
  const ttl = Math.max(1, Math.floor(Number(ttlMinutes) || 10))
  await query(
    `INSERT INTO email_codes (email, code, purpose, expires_at)
     VALUES (?, ?, ?, NOW() + INTERVAL ? MINUTE)`,
    [email, code, purpose, ttl]
  )
}

// 校验并核销：原子置 used=1，只认最新一条未用未过期的匹配码（防重放/防并发重复使用）。
// 返回受影响行数（0=验证码有误、已用或已过期）
export async function verifyAndConsume(email, purpose, code) {
  const result = await query(
    `UPDATE email_codes SET used = 1
     WHERE email = ? AND purpose = ? AND code = ? AND used = 0 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [email, purpose, code]
  )
  return result.affectedRows
}
