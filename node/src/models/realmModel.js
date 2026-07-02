import { query } from '../config/db.js'

// 全部境界，按 id(境界序号) 升序
export async function listRealms() {
  return query('SELECT * FROM realms ORDER BY id ASC')
}

export async function countRealms() {
  const rows = await query('SELECT COUNT(*) AS c FROM realms')
  return rows[0].c
}
