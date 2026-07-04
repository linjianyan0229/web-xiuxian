import { query } from '../config/db.js'

// 全部系统配置（后台「系统配置列表」用）
export async function listConfigs() {
  return query(
    `SELECT config_key, config_value, label, description, value_type, updated_time
     FROM system_configs ORDER BY config_key ASC`
  )
}

export async function getConfig(key) {
  const rows = await query(
    `SELECT config_key, config_value, label, description, value_type
     FROM system_configs WHERE config_key = ? LIMIT 1`,
    [key]
  )
  return rows[0] || null
}

// 更新配置值；返回受影响行数（键不存在则为 0）
export async function updateConfig(key, value) {
  const result = await query(
    'UPDATE system_configs SET config_value = ? WHERE config_key = ?',
    [value, key]
  )
  return result.affectedRows
}

// 便捷：读取布尔型配置（缺失时用 fallback）
export async function getBoolConfig(key, fallback = false) {
  const row = await getConfig(key)
  if (!row) return fallback
  return row.config_value === '1' || row.config_value === 'true'
}

// 便捷：读取数值型配置（缺失或非法时用 fallback）
export async function getNumberConfig(key, fallback = 0) {
  const row = await getConfig(key)
  if (!row) return fallback
  const n = Number(row.config_value)
  return Number.isFinite(n) ? n : fallback
}
