// Downloads Wikipedia pages (CC BY-SA) for players whose early seasons predate
// the open stat sources: NFL seasons before 1999 and college seasons before
// CollegeFootballData's coverage. Pages are found through Wikidata's link from
// Pro Football Reference IDs (property P3561) to English Wikipedia articles.
//
//   node scripts/fetch-wiki-stats.mjs     (run after build-data, which picks the players)

import { mkdir, readFile, writeFile } from 'node:fs/promises'

const UA = 'OutlierFootball/1.0 (https://github.com/julianrobert04/outlier)'
const OUT = 'data/raw/wiki'
const UNTIL_CLASS = 2008 // entrants whose college years predate solid college stats

await mkdir(OUT, { recursive: true })

// 1. PFR id → Wikipedia article, from Wikidata.
const q = 'SELECT ?pfr ?article WHERE { ?p wdt:P3561 ?pfr . ?article schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> . }'
const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(q)}`, { headers: { Accept: 'text/csv', 'User-Agent': UA } })
if (!res.ok) throw new Error(`Wikidata: HTTP ${res.status}`)
const csv = await res.text()
await writeFile(`${OUT}/pfr_enwiki.csv`, csv)
const titleOf = new Map(csv.split('\n').slice(1).filter(Boolean).map(l => {
  const [pfr, url] = l.split(',')
  return [pfr.split('/').pop(), decodeURIComponent(url.trim().split('/wiki/')[1]).replace(/_/g, ' ')]
}))

// 2. Which players need it: entered up to UNTIL_CLASS and played.
const data = JSON.parse(await readFile('public/data/players.json', 'utf8'))
const idx = Object.fromEntries(data.fields.map((f, i) => [f, i]))
const wanted = data.rows.filter(r => r[idx.year] <= UNTIL_CLASS && r[idx.games] > 0 && titleOf.has(r[idx.id]))
  .map(r => [r[idx.id], titleOf.get(r[idx.id])])
console.log(`${wanted.length} player pages to fetch`)

// 3. Fetch wikitext, 50 titles per request.
const pages = {}
for (let i = 0; i < wanted.length; i += 50) {
  const batch = wanted.slice(i, i + 50)
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(batch.map(b => b[1]).join('|'))}`
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`batch ${i}: HTTP ${r.status}`)
  const j = await r.json()
  const norm = new Map([...(j.query.normalized ?? []), ...(j.query.redirects ?? [])].map(x => [x.from, x.to]))
  const text = new Map((j.query.pages ?? []).map(p => [p.title, p.revisions?.[0]?.slots?.main?.content ?? '']))
  for (const [id, title] of batch) {
    let t = title
    for (let k = 0; k < 3 && norm.has(t); k++) t = norm.get(t)
    const w = text.get(t)
    if (w) pages[id] = { title: t, wikitext: w }
  }
  if (i % 1000 === 0) console.log(`  ${i + batch.length}/${wanted.length}`)
}
await writeFile(`${OUT}/pages.json`, JSON.stringify(pages))
console.log(`${Object.keys(pages).length} pages saved → ${OUT}/pages.json`)
