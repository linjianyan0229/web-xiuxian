import nodemailer from 'nodemailer'
import { config, isProduction } from '../config/env.js'

// 发信服务（nodemailer）。SMTP 配置全部来自 .env（见 .env.example 的 SMTP_* 段）。
// SMTP_HOST 为空视为未配置：开发环境把验证码打印到控制台（本地联调无需真实邮箱），
// 生产环境直接抛错（调用方译为 503），避免"看似发送成功实则石沉大海"。

let transport = null

export function mailConfigured() {
  return !!config.mail.host
}

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    })
  }
  return transport
}

const PURPOSE_LABELS = {
  register: '结缘仙门（注册账号）',
  reset: '重铸道基（重置密码）',
}

// 发信格式：验证码邮件模板（内联样式的水墨仙侠风；text 为纯文本降级）
export function buildCodeMail(code, purpose, ttlMinutes) {
  const label = PURPOSE_LABELS[purpose] || '身份验证'
  const subject = `【文字修仙】${label}验证码：${code}`
  const text = [
    `道友安好，`,
    ``,
    `此为「文字修仙」${label}的验证码：${code}`,
    `${ttlMinutes} 分钟内有效，验证即失效，请勿泄露于外人。`,
    ``,
    `若非道友本人所为，忽略此信即可，勿念。`,
    `—— 文字修仙 · 仙门执事`,
  ].join('\n')

  const html = `
  <div style="margin:0 auto;max-width:480px;padding:32px 28px;background:#faf8f1;border:1px solid #e0dbcc;border-radius:14px;font-family:'Songti SC','SimSun',Georgia,serif;color:#4a4740;">
    <div style="text-align:center;margin-bottom:22px;">
      <div style="display:inline-block;width:52px;height:52px;line-height:52px;font-size:24px;font-weight:700;color:#fff9ec;background:#b8933f;border-radius:50%;">仙</div>
      <h1 style="margin:12px 0 2px;font-size:22px;letter-spacing:6px;color:#26282c;">文字修仙</h1>
      <p style="margin:0;font-size:12px;letter-spacing:3px;color:#96702a;">道法自然 · 逆天而行</p>
    </div>
    <p style="margin:0 0 8px;font-size:14px;">道友安好，</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.8;">此为 <b style="color:#96702a;">${label}</b> 的验证码，${ttlMinutes} 分钟内有效，验证即失效：</p>
    <div style="text-align:center;margin:0 0 18px;padding:16px 0;background:#fffefb;border:1px dashed #cbb87e;border-radius:10px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:10px;color:#b8933f;font-family:Consolas,Menlo,monospace;">${code}</span>
    </div>
    <p style="margin:0 0 6px;font-size:12px;color:#8a857a;line-height:1.8;">验证码切勿泄露于外人——仙门执事绝不会向道友索要验证码。</p>
    <p style="margin:0;font-size:12px;color:#8a857a;line-height:1.8;">若非道友本人所为，忽略此信即可，勿念。</p>
    <hr style="margin:20px 0 12px;border:none;border-top:1px solid #e0dbcc;" />
    <p style="margin:0;text-align:center;font-size:11px;letter-spacing:2px;color:#a8a294;">仙路漫漫 · 唯心不改</p>
  </div>`

  return { subject, text, html }
}

// 发送验证码邮件；开发环境未配置 SMTP 时降级为控制台输出（返回 { dev: true }）
export async function sendVerificationCode(email, code, purpose, ttlMinutes) {
  if (!mailConfigured()) {
    if (isProduction) {
      throw new Error('SMTP 未配置，无法发送验证码邮件')
    }
    console.warn(`[mail·dev] SMTP 未配置，验证码改为控制台输出 -> ${email} [${purpose}] 验证码: ${code}`)
    return { dev: true }
  }
  const { subject, text, html } = buildCodeMail(code, purpose, ttlMinutes)
  await getTransport().sendMail({
    from: config.mail.from,
    to: email,
    subject,
    text,
    html,
  })
  return { dev: false }
}
