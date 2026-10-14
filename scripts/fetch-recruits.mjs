// Downloads high-school recruiting ratings (247Sports composite) from
// CollegeFootballData.com into data/raw/recruits.json.
//
//   CFBD_API_KEY=xxxx node scripts/fetch-recruits.mjs
//
// Get a free key at https://collegefootballdata.com/key

import { mkdir, writeFile } from 'node:fs/promises'

const KEY = process.env.CFBD_API_KEY
if (!KEY) {
  console.error('Set CFBD_API_KEY (free at https://collegefootballdata.com/key)')
  process.exit(1)
}

const FIRST = 2000
const LAST = new Date().getFullYear() - 1
const all = []
for (let year = FIRST; year <= LAST; year++) {
  const res = await fetch(
    `https://api.collegefootballdata.com/recruiting/players?year=${year}&classification=HighSchool`,
    { headers: { Authorization: `Bearer ${KEY}` } })
  if (!res.ok) throw new Error(`${year}: HTTP ${res.status}`)
  const rows = await res.json()
  for (const r of rows) {
    all.push({
      name: r.name, year: r.year, stars: r.stars ?? 0, rating: r.rating ?? 0,
      ranking: r.ranking ?? null, position: r.position, school: r.committedTo ?? '',
    })
  }
  console.log(`${year}: ${rows.length} recruits`)
}
await mkdir('data/raw', { recursive: true })
await writeFile('data/raw/recruits.json', JSON.stringify(all))
console.log(`${all.length} recruits → data/raw/recruits.json`)
