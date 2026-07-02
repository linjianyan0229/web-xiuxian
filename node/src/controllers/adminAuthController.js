// 当前登录管理员信息（adminAuthRequired 中间件已挂载 req.admin）
// 登录已统一到 /api/auth/login（令牌带 role），此处不再单独提供后台登录接口。
export async function adminProfile(req, res) {
  res.json({ admin: req.admin })
}
