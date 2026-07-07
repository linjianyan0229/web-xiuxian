import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// 敏感词检测（字典树匹配）。词库 node/src/data/sensitive-words.txt（合并自根目录 Vocabulary/，
// 井号行为注释，运维可直接增删词条，重启生效）。server.js 启动时 initSensitiveWords() 建树。
// 归一化口径：小写 + 全角转半角——「ＦａＬunGong」与「falungong」同判；
// 变体识别：匹配途中允许跳过填充符（空格/星号/标点等），可识别「习*近*平」「法 轮 功」式写法。

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORDS_FILE = join(__dirname, '../data/sensitive-words.txt')
// 白名单：剔除词库中误伤游戏正常交流的独立词条（修炼/弟子等，见文件内注释）
const ALLOW_FILE = join(__dirname, '../data/sensitive-words-allow.txt')

// 匹配途中可跳过的填充符（词条自身含有的字符不受影响：先查树边，无边才尝试跳过）
const FILLER_RE = /[\s*\-_—–~·`'"“”‘’()（）[\]【】{}<>《》.,，。;；:：!！?？+^#@&|\\/]/

let root = null
let wordCount = 0

// 归一化：小写 + 全角转半角（含全角空格）
function normalizeChar(ch) {
  const code = ch.codePointAt(0)
  if (code >= 0xff01 && code <= 0xff5e) return String.fromCodePoint(code - 0xfee0).toLowerCase()
  if (code === 0x3000) return ' '
  return ch.toLowerCase()
}

// 启动时加载词库并构建字典树（约 5 万条，毫秒级查询）；白名单词条剔除不入树
export async function initSensitiveWords() {
  const allow = new Set()
  const allowRaw = await readFile(ALLOW_FILE, 'utf8').catch(() => '')
  for (const line of allowRaw.split(/\r?\n/)) {
    const w = line.trim()
    if (!w || w.startsWith('#')) continue
    allow.add([...w].map(normalizeChar).join(''))
  }

  const raw = await readFile(WORDS_FILE, 'utf8')
  root = new Map()
  wordCount = 0
  let allowed = 0
  for (const line of raw.split(/\r?\n/)) {
    const w = line.trim()
    if (!w || w.startsWith('#')) continue
    const chars = [...w].map(normalizeChar)
    if (chars.length < 2) continue
    if (allow.has(chars.join(''))) {
      allowed++
      continue
    }
    let node = root
    for (const c of chars) {
      let next = node.get(c)
      if (!next) {
        next = new Map()
        node.set(c, next)
      }
      node = next
    }
    if (!node.end) {
      node.end = w // 词尾标记，存原词供命中回显
      wordCount++
    }
  }
  console.log(`敏感词库已加载：${wordCount} 条（白名单剔除 ${allowed} 条）`)
  return wordCount
}

export function getSensitiveWordCount() {
  return wordCount
}

// 自 start 起沿树匹配，返回最长命中 { word, end } 或 null
function matchAt(norm, start) {
  let node = root
  let best = null
  for (let i = start; i < norm.length; i++) {
    const next = node.get(norm[i])
    if (next) {
      node = next
      if (node.end) best = { word: node.end, end: i }
      continue
    }
    // 树上无此边：匹配途中遇到填充符则跳过继续（识别穿插符号的变体），否则终止
    if (i > start && FILLER_RE.test(norm[i])) continue
    break
  }
  return best
}

// 全文扫描：返回 { hit, words(去重命中词, 最多 limit 个), sanitized(命中区间打码为*) }
export function scanSensitive(text, { limit = 10 } = {}) {
  if (!root) throw new Error('敏感词库尚未初始化，请先在启动时调用 initSensitiveWords()')
  const chars = [...String(text ?? '')]
  const norm = chars.map(normalizeChar)
  const spans = []
  const words = new Set()
  let i = 0
  while (i < norm.length) {
    const m = matchAt(norm, i)
    if (m) {
      spans.push([i, m.end])
      if (words.size < limit) words.add(m.word)
      i = m.end + 1
    } else {
      i++
    }
  }
  if (spans.length === 0) return { hit: false, words: [], sanitized: chars.join('') }
  for (const [s, e] of spans) {
    for (let k = s; k <= e; k++) chars[k] = '*'
  }
  return { hit: true, words: [...words], sanitized: chars.join('') }
}

// 快速判定（只找第一处命中）
export function containsSensitive(text) {
  return scanSensitive(text, { limit: 1 }).hit
}
