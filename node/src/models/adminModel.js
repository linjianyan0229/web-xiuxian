import { query } from '../config/db.js'

export async function findAdminByUsername(username) {
  const rows = await query('SELECT * FROM admins WHERE username = ? LIMIT 1', [username])
  return rows[0] || null
}

export async function findAdminPublicById(id) {
  const rows = await query(
    'SELECT id, username, nickname, status, register_time, login_time FROM admins WHERE id = ? LIMIT 1',
    [id]
  )
  return rows[0] || null
}

export async function updateAdminLoginState(id, accessToken) {
  await query(
    'UPDATE admins SET access_token = ?, login_time = NOW() WHERE id = ?',
    [accessToken, id]
  )
}

export async function countAdmins() {
  const rows = await query('SELECT COUNT(*) AS c FROM admins')
  return rows[0].c
}
