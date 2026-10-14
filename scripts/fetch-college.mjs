// Downloads college player season stats from CollegeFootballData.com into
// data/raw/college/<year>.json (regular season, every category).
//
//   CFBD_API_KEY=xxxx node scripts/fetch-college.mjs
//
// Coverage in the source: offense from ~2007 (solid from 2009), interceptions
// from 2004, defensive tackles/TFL/sacks/hurries from 2016. No line stats.

import { mkdir, writeFile } from 'node:fs/promises'

const KEY = process.env.CFBD_API_KEY
if (!KEY) {
  console.error('Set CFBD_API_KEY (free at https://collegefootballdata.com/key)')
  process.exit(1)
}

const FIRST = 2004
const LAST = new Date().getFullYear() - 1
const DEFENSE_FROM = 2016

async function get(params) {
  const res = await fetch(`https://api.collegefootballdata.com/stats/player/season?${params}`,
    { headers: { Authorization: `Bearer ${KEY}` } })
  if (!res.ok) throw new Error(`${params}: HTTP ${res.status}`)
  return res.json()
}

await mkdir('data/raw/college', { recursive: true })
for (let year = FIRST; year <= LAST; year++) {
  let rows = await get(`year=${year}`)
  // The all-category call can omit defense; fetch it explicitly where it exists.
  if (year >= DEFENSE_FROM && !rows.some(r => r.category === 'defensive')) {
    rows = rows.concat(await get(`year=${year}&category=defensive`))
  }
  const slim = rows.map(r => [r.playerId, r.player, r.position, r.team, r.category, r.statType, r.stat])
  await writeFile(`data/raw/college/${year}.json`, JSON.stringify(slim))
  console.log(`${year}: ${new Set(rows.map(r => r.playerId)).size} players, ${rows.length} stats`)
}
