// 获取当前登录用户信息（鉴权中间件已挂载 req.user）
export async function getProfile(req, res) {
  res.json({ user: req.user })
}
