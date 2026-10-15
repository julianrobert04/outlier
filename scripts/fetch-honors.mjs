// Downloads each season's Pro Bowl roster and All-Pro team from Wikipedia
// (official API, CC BY-SA) into data/raw/honors/. Used to give undrafted
// players the Pro Bowl / All-Pro counts the draft data only has for drafted ones.
//
//   node scripts/fetch-honors.mjs

import { mkdir, writeFile } from 'node:fs/promises'

const FIRST = 1995
const LAST = new Date().getFullYear() - 1
const API = 'https://en.wikipedia.org/w/api.php'
const UA = 'OutlierFootball/1.0 (https://github.com/julianrobert04/outlier)'

async function wikitext(title) {
  const res = await fetch(`${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`,
    { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${title}: HTTP ${res.status}`)
  const j = await res.json()
  return j.parse?.wikitext ?? null
}

// Award winner lists and the Hall of Fame roster (one page each).
const AWARD_PAGES = {
  mvp: 'AP NFL Most Valuable Player',
  opoy: 'AP NFL Offensive Player of the Year',
  dpoy: 'AP NFL Defensive Player of the Year',
  sbmvp: 'Super Bowl Most Valuable Player Award',
  oroy: 'AP NFL Offensive Rookie of the Year',
  droy: 'AP NFL Defensive Rookie of the Year',
  comeback: 'AP NFL Comeback Player of the Year',
  hof: 'List of Pro Football Hall of Fame inductees',
}

await mkdir('data/raw/honors', { recursive: true })
const awards = {}
for (const [key, title] of Object.entries(AWARD_PAGES)) {
  awards[key] = await wikitext(title)
  console.log(`${key}: ${awards[key] ? awards[key].length : 'missing'}`)
}
await writeFile('data/raw/honors/awards.json', JSON.stringify(awards))
for (let season = FIRST; season <= LAST; season++) {
  // The Pro Bowl for a season is played the next year; since the 2023 season it's the "Pro Bowl Games".
  const pbTitles = [`${season + 1} Pro Bowl`, `${season + 1} Pro Bowl Games`]
  let pb = null
  for (const t of pbTitles) { pb = await wikitext(t); if (pb) break }
  const ap = await wikitext(`${season} All-Pro Team`)
  await writeFile(`data/raw/honors/${season}.json`, JSON.stringify({ season, proBowl: pb ?? '', allPro: ap ?? '' }))
  console.log(`${season}: Pro Bowl ${pb ? pb.length : 'missing'} · All-Pro ${ap ? ap.length : 'missing'}`)
}
