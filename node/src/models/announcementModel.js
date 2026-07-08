import { query } from '../config/db.js'

// 前台可见公告：仅已发布(status=1)，置顶优先，再按 id 降序（新公告在前）
export async function listPublished(limit = 30) {
  const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 30))
  return query(
    `SELECT id, title, content, pinned, created_time, updated_time
     FROM announcements
     WHERE status = 1
     ORDER BY pinned DESC, id DESC
     LIMIT ${n}`
  )
}

// 后台列表：全部状态，分页 + 标题关键字（置顶优先，再按 id 降序）
export async function listAll({ page = 1, pageSize = 10, keyword = '' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10))
  const offset = (p - 1) * size
  const kw = String(keyword || '').trim()

  const where = kw ? 'WHERE title LIKE ?' : ''
  const params = kw ? [`%${kw}%`] : []

  const countRows = await query(`SELECT COUNT(*) AS total FROM announcements ${where}`, params)
  const total = countRows[0]?.total || 0

  // LIMIT/OFFSET 已 clamp 为整数，直接内联（mysql2 对 LIMIT 占位符有限制，同 listUsers）
  const list = await query(
    `SELECT id, title, content, pinned, status, created_time, updated_time
     FROM announcements ${where}
     ORDER BY pinned DESC, id DESC
     LIMIT ${size} OFFSET ${offset}`,
    params
  )
  return { list, total, page: p, pageSize: size }
}

export async function findById(id) {
  const rows = await query(
    `SELECT id, title, content, pinned, status, created_time, updated_time
     FROM announcements WHERE id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

export async function createAnnouncement({ title, content = '', pinned = 0, status = 1 }) {
  const result = await query(
    'INSERT INTO announcements (title, content, pinned, status) VALUES (?, ?, ?, ?)',
    [title, content, pinned ? 1 : 0, status ? 1 : 0]
  )
  return result.insertId
}

// 部分字段更新（title/content/pinned/status）；返回受影响行数
export async function updateAnnouncement(id, fields) {
  const cols = Object.keys(fields)
  if (cols.length === 0) return 0
  const set = cols.map((c) => `${c} = ?`).join(', ')
  const params = cols.map((c) => fields[c])
  params.push(id)
  const result = await query(`UPDATE announcements SET ${set} WHERE id = ?`, params)
  return result.affectedRows
}

export async function deleteAnnouncement(id) {
  const result = await query('DELETE FROM announcements WHERE id = ?', [id])
  return result.affectedRows
}
