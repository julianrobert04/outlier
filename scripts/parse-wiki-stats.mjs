// Reads season-by-season NFL and college stat tables from the Wikipedia pages
// fetched by fetch-wiki-stats.mjs and writes data/raw/wiki/stats.json:
//   { pfrId: { title, nfl: [row…], college: [row…] } }
// Only regular-season tables are read. Values come straight from the tables.

import { readFile, writeFile } from 'node:fs/promises'

const clean = s => s
  .replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  .replace(/\{\{(?:efn|refn|sfn|ref label|cn|citation needed)[^}]*\}\}/gi, '')
  .replace(/\{\{abbr\|([^|}]*)\|[^}]*\}\}/gi, '$1')
  .replace(/\{\{(?:nowrap|small|sort)\|(?:[^|}]*\|)?([^}]*)\}\}/gi, '$1')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\{\{[^}]*\}\}/g, '').trim()

// Split a table row into cells: "a || b || c" or one cell per line.
function cells(row) {
  const out = []
  for (const line of row.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('|-') || t.startsWith('|+') || t.startsWith('{|') || t.startsWith('|}')) continue
    if (!(t.startsWith('|') || t.startsWith('!'))) { if (out.length) out[out.length - 1].text += ' ' + t; continue }
    const header = t.startsWith('!')
    for (let part of t.slice(1).split(header ? /!!|\|\|/ : /\|\|/)) {
      // Strip cell attributes: 'style="…" | value' (but not inside links/templates).
      let attrs = ''
      const bar = part.indexOf('|')
      if (bar > 0 && !/[[{]/.test(part.slice(0, bar)) && part.slice(0, bar).includes('=')) { attrs = part.slice(0, bar); part = part.slice(bar + 1) }
      const span = (k) => Number((attrs.match(new RegExp(`${k}\\s*=\\s*"?(\\d+)`)) ?? [])[1] ?? 1)
      out.push({ header, raw: part.trim(), text: clean(part), colspan: span('colspan'), rowspan: span('rowspan') })
    }
  }
  return out
}

// Column names "Group Sub" from up to two header rows with col/rowspans.
function columns(headerRows) {
  const width = Math.max(...headerRows.map(r => r.reduce((s, c) => s + c.colspan, 0)))
  const grid = headerRows.map(() => Array(width).fill(null))
  headerRows.forEach((row, ri) => {
    let ci = 0
    for (const c of row) {
      while (ci < width && grid[ri][ci] !== null) ci++
      if (ci >= width) break
      for (let dr = 0; dr < c.rowspan && ri + dr < grid.length; dr++)
        for (let dc = 0; dc < c.colspan && ci + dc < width; dc++) grid[ri + dr][ci + dc] = c.text
      ci += c.colspan
    }
  })
  return Array.from({ length: width }, (_, i) => {
    const parts = [...new Set(grid.map(r => r[i]).filter(Boolean))]
    return parts.join(' ').trim()
  })
}

const num = s => {
  const t = String(s ?? '').replace(/[−–]/g, '-').replace(/,/g, '').replace(/[^0-9.\-]/g, '')
  return t === '' || t === '-' ? null : Number(t)
}

// Map a "Group Sub" column name to an Outlier stat key.
function key(name, kind) {
  const n = name.toLowerCase()
  const has = w => n.includes(w)
  const sub = n.split(' ').pop()
  if (/^(year|season)/.test(n)) return 'season'
  if (/^team|^school/.test(n)) return 'team'
  if (has('game') || n === 'gp' || n === 'g' || n === 'gs') return sub === 'gs' ? 'gs' : (sub === 'gp' || sub === 'g' ? 'g' : null)
  if (has('pass') && !has('defend')) return { cmp: 'cmp', att: 'att', yds: 'pyd', td: 'ptd', int: 'int' }[sub] ?? null
  if (has('rush')) return { att: 'car', car: 'car', yds: 'ryd', td: 'rtd' }[sub] ?? null
  if (has('receiv')) return { rec: 'rec', yds: 'recyd', td: 'rectd', tgt: 'tgt' }[sub] ?? null
  if (has('sacked')) return sub === 'sck' || sub === 'sacks' ? 'skd' : null
  if (has('tackl')) return { cmb: 'tot', comb: 'tot', total: 'tot', tot: 'tot', solo: 'solo', ast: 'ast', sck: 'sk', sacks: 'sk', tfl: 'tfl', sfty: 'sfty' }[sub] ?? null
  if (has('interception') || has('pass def')) return { int: 'dint', pd: 'pd', pdef: 'pd', td: kind === 'nfl' ? null : null }[sub] ?? null
  if (has('fumble')) return { ff: 'ff', fr: 'fr', lost: 'fuml', lst: 'fuml' }[sub] ?? null
  if (has('kick') || has('field goal')) return { fgm: 'fgm', fga: 'fga' }[sub] ?? null
  if (sub === 'sck' || sub === 'sacks') return 'sk'
  if (sub === 'tfl') return 'tfl'
  if (sub === 'pd') return 'pd'
  return null
}

// Top-level wikitables in one linear pass (nested tables are skipped).
function tables(text) {
  const out = []
  let depth = 0, start = -1
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '|' && (i === 0 || text[i - 1] === '\n')) {
      if (depth++ === 0) start = i
      i++
    } else if (text[i] === '|' && text[i + 1] === '}' && i > 0 && text[i - 1] === '\n' && depth > 0) {
      if (--depth === 0) out.push({ index: start, 0: text.slice(start, i + 2) })
      i++
    }
  }
  return out
}

function readTables(wikitext) {
  const nfl = [], college = []
  for (const m of tables(wikitext)) {
    const before = wikitext.slice(Math.max(0, m.index - 400), m.index)
    const heading = [...before.matchAll(/^=+\s*([^=\n]+?)\s*=+\s*$/gm)].pop()?.[1] ?? ''
    if (/post|playoff/i.test(heading)) continue
    const rows = m[0].split(/\n\|-/).map(cells).filter(r => r.length)
    const headerRows = [], dataRows = []
    for (const r of rows) (r.every(c => c.header) && !dataRows.length ? headerRows : dataRows).push(r)
    if (!headerRows.length || !dataRows.length) continue
    const cols = columns(headerRows.slice(-2))
    if (!cols.some(c => /^(year|season)/i.test(c))) continue
    const collegeTable = /college/i.test(heading)
    for (const r of dataRows) {
      const first = r[0]?.raw ?? ''
      const head2 = r.slice(0, 2).map(c => c.raw).join(' ')
      const nflSeason = first.match(/\[\[(\d{4}) NFL season/)
      const colSeason = !nflSeason && (head2.match(/\[\[(\d{4}) [^\]|]*football (?:team|season)/) ??
        (collegeTable ? first.match(/^\s*(?:'''|\[\[[^\]|]*\|)?(\d{4})/) : null))
      if (!nflSeason && !colSeason) continue
      // Rows like "Redshirt" or "Did not play" span several columns and shift
      // everything after them; skip those rather than misread the numbers.
      if (r.some(c => !c.header && c.colspan > 1)) continue
      const kind = nflSeason ? 'nfl' : 'college'
      const row = { season: Number((nflSeason ?? colSeason)[1]) }
      if (kind === 'college') {
        const teamLink = head2.match(/\[\[\d{4} ([^\]|]+?) football team(?:\|([^\]]+))?\]\]/)
        if (teamLink) row.team = teamLink[2] ?? teamLink[1]
      }
      cols.forEach((c, i) => {
        const k = key(c, kind)
        if (!k || k === 'season' || i >= r.length) return
        if (k === 'team') { if (!row.team) row.team = r[i].text; return }
        const v = num(r[i].text)
        if (v != null && row[k] == null) row[k] = v
      })
      const stats = Object.keys(row).filter(k => k !== 'season' && k !== 'team')
      if (!stats.length || (row.g != null && row.g > 17)) continue
      ;(kind === 'nfl' ? nfl : college).push(row)
    }
  }
  return { nfl, college }
}

const pages = JSON.parse(await readFile('data/raw/wiki/pages.json', 'utf8'))
const out = {}
let n = 0, c = 0
for (const [id, { title, wikitext }] of Object.entries(pages)) {
  if (!/NFL season\|\d{4}|football team\|\d{4}/.test(wikitext)) continue
  const t = readTables(wikitext)
  if (t.nfl.length || t.college.length) out[id] = { title, ...t }
  if (t.nfl.length) n++
  if (t.college.length) c++
}
await writeFile('data/raw/wiki/stats.json', JSON.stringify(out))
console.log(`${n} players with NFL seasons, ${c} with college seasons → data/raw/wiki/stats.json`)
