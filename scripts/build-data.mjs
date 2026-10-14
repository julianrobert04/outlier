// Builds public/data/players.json from real nflverse draft data.
//
//   node scripts/build-data.mjs            # download fresh source, then build
//   node scripts/build-data.mjs --offline  # reuse data/raw/draft_picks.csv
//
// Source: nflverse draft_picks (career outcomes from Pro Football Reference).
// Every number on the site is derived here — nothing is hand-entered.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const SOURCE_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv'
const RAW = 'data/raw/draft_picks.csv'
const OUT = 'public/data/players.json'

// The latest season with completed NFL games. Draft classes after
// LAST_SEASON - 2 have too little career to judge, so they get no gap.
const LAST_SEASON = Number(process.env.OUTLIER_LAST_SEASON ?? 2025)
const LAST_JUDGED_CLASS = LAST_SEASON - 2
const FIRST_CLASS = 2000 // the modern era: also when recruiting ratings begin
// Kernel widths on ln(pick), tried narrowest first until the comparison
// group is big enough (rare slots like a #1-pick QB need a wider net).
const BANDWIDTHS = [0.22, 0.3, 0.4, 0.55, 0.75, 1]
const MIN_PEERS = 12 // minimum effective sample size (Kish)

const GROUP = {
  QB: 'QB', RB: 'RB', FB: 'RB', WR: 'WR', KR: 'WR', TE: 'TE',
  T: 'OL', OT: 'OL', G: 'OL', OG: 'OL', C: 'OL', OL: 'OL',
  DE: 'DL', DT: 'DL', NT: 'DL', DL: 'DL',
  LB: 'LB', OLB: 'LB', ILB: 'LB',
  DB: 'DB', CB: 'DB', S: 'DB', SAF: 'DB', FS: 'DB',
  K: 'ST', P: 'ST', LS: 'ST',
}

function parseCSV(text) {
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

const num = v => (v === '' || v == null ? 0 : Number(v))
const fmt = n => Math.round(n).toLocaleString('en-US')

function statLine(r, g) {
  switch (g) {
    case 'QB': return `${fmt(num(r.pass_yards))} pass yds · ${num(r.pass_tds)} TD · ${num(r.pass_ints)} INT`
    case 'RB': return `${fmt(num(r.rush_yards))} rush yds · ${num(r.rush_tds)} TD · ${fmt(num(r.rec_yards))} rec yds`
    case 'WR':
    case 'TE': return `${fmt(num(r.receptions))} rec · ${fmt(num(r.rec_yards))} yds · ${num(r.rec_tds)} TD`
    case 'DL':
    case 'LB': return `${num(r.def_sacks)} sacks · ${fmt(num(r.def_solo_tackles))} solo tackles`
    case 'DB': return `${num(r.def_ints)} INT · ${fmt(num(r.def_solo_tackles))} solo tackles`
    default: return `${num(r.games)} games · ${num(r.seasons_started)} seasons as starter`
  }
}

// Peers come from nearby draft classes so that every comparison is made
// between careers of roughly the same length.
const yearWindow = y => Math.max(0, Math.min(3, Math.floor((LAST_SEASON - y - 3) / 2)))

function expectation(p, group) {
  const lp = Math.log(p.pick)
  // Old classes can borrow from a wider era; recent ones cannot, because
  // their careers are shorter and peers must have had the same time.
  const maxWindow = yearWindow(p.year) === 3 ? 5 : yearWindow(p.year)
  let out
  for (const bw of BANDWIDTHS) {
    for (const w of new Set([yearWindow(p.year), maxWindow])) {
      let sw = 0, sw2 = 0, swa = 0, below = 0
      for (const q of group) {
        if (q === p || Math.abs(q.year - p.year) > w) continue
        const d = (Math.log(q.pick) - lp) / bw
        const k = Math.exp(-0.5 * d * d)
        if (k < 1e-3) continue
        sw += k; sw2 += k * k; swa += k * q.av
        below += q.av < p.av ? k : q.av === p.av ? k / 2 : 0
      }
      out = {
        exp: sw ? swa / sw : 0,
        pct: sw ? Math.round((100 * below) / sw) : 50,
        peers: sw ? Math.round((sw * sw) / sw2) : 0,
      }
      if (out.peers >= MIN_PEERS) return out
    }
  }
  return out
}

function archetype(p) {
  const loyalty = p.av > 0 ? p.drav / p.av : 0
  if (p.hof) return 'Hall of Famer'
  if (p.pick >= 100 && (p.pb >= 3 || p.ap >= 1)) return 'Late-round legend'
  if (p.round === 1 && p.pct < 15) return 'Blue-chip bust'
  if (p.pick >= 65 && p.pct >= 90) return 'Hidden gem'
  if (p.round === 1 && (p.ap >= 1 || p.pb >= 4)) return 'Blue-chip star'
  if (p.seasons >= 10 && loyalty >= 0.85) return 'One-team cornerstone'
  if (p.seasons >= 9 && loyalty < 0.35) return 'Journeyman'
  if (p.seasons <= 6 && p.pb >= 1 && !p.active) return 'Bright flash'
  if (p.round <= 3 && p.games < 16) return 'Never arrived'
  if (p.pct >= 70) return 'Outplayed the slot'
  if (p.pct <= 30) return 'Fell short'
  return 'Par for the slot'
}

// ── Outlier Index ────────────────────────────────────────────────────────
// One number, .01 to .99: of everyone who started where this player started,
// the share whose career turned out worse. "Started" means the earliest
// stage we have — the high-school star rating when recruiting data is linked,
// otherwise the draft slot. A 2-star who reaches Canton is a .99; a 5-star
// who never plays a down sits near .01.

const RECRUIT_GROUP = {
  PRO: 'QB', DUAL: 'QB', QB: 'QB', RB: 'RB', APB: 'RB', FB: 'RB', WR: 'WR', TE: 'TE',
  OT: 'OL', OG: 'OL', OC: 'OL', IOL: 'OL', OL: 'OL',
  SDE: 'DL', WDE: 'DL', DT: 'DL', DL: 'DL', EDGE: 'DL', DE: 'DL',
  ILB: 'LB', OLB: 'LB', LB: 'LB', CB: 'DB', S: 'DB', DB: 'DB', K: 'ST', P: 'ST', LS: 'ST',
}
const clampOI = x => Math.min(0.99, Math.max(0.01, Math.round(x * 100) / 100))
const normName = s => s.toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
  .replace(/[^a-z]/g, '')
const normSchool = s => s.toLowerCase().replace(/\bst\.?$/, 'state').replace(/[^a-z]/g, '')

function midRank(value, values) {
  let below = 0, equal = 0
  for (const v of values) { if (v < value) below++; else if (v === value) equal++ }
  return (below + equal / 2) / values.length
}

async function outlierIndex(players) {
  for (const p of players) { p.oi = clampOI(p.pct / 100); p.from = 'draft'; p.stars = 0; p.rating = 0; p.spct = null }
  if (!existsSync('data/raw/recruits.json')) return 0
  const recruits = JSON.parse(await readFile('data/raw/recruits.json', 'utf8'))

  // Link draftees to their recruiting profile: same name, recruited 3–6
  // years before the draft, preferring the same school.
  const byName = new Map()
  for (const p of players) byName.set(normName(p.name), [...(byName.get(normName(p.name)) ?? []), p])
  let linked = 0
  for (const r of recruits) {
    r.grp = RECRUIT_GROUP[r.position] ?? null
    const cands = (byName.get(normName(r.name)) ?? [])
      .filter(p => p.year - r.year >= 3 && p.year - r.year <= 6 && !p.recruit)
    const p = cands.find(c => normSchool(c.college) === normSchool(r.school)) ?? (cands.length === 1 ? cands[0] : null)
    if (p) { p.recruit = r; r.player = p; linked++ }
  }

  // Career outcome for every recruit — drafted or not. Draft slot breaks ties
  // between careers of equal value, so being drafted at all counts.
  const outcome = r => r.player ? r.player.av + 0.5 - r.player.pick / 1000 : 0
  const draftValue = r => r.player ? 300 - r.player.pick : 0
  const lastClass = LAST_JUDGED_CLASS - 4
  for (const p of players) {
    const r = p.recruit
    if (!r || !r.stars || r.year > lastClass) continue
    const w = yearWindow(r.year + 4)
    const cohort = recruits.filter(q => q.stars === r.stars &&
      Math.abs(q.year - r.year) <= w && q.year <= lastClass && (!r.grp || q.grp === r.grp))
    if (cohort.length < 30) continue
    p.oi = clampOI(midRank(outcome(r), cohort.map(outcome)))
    p.spct = clampOI(midRank(draftValue(r), cohort.map(draftValue)))
    p.from = 'recruit'; p.stars = r.stars; p.rating = Math.round(r.rating * 10000) / 10000
  }
  return linked
}

async function main() {
  await mkdir('data/raw', { recursive: true })
  await mkdir('public/data', { recursive: true })
  if (!process.argv.includes('--offline') || !existsSync(RAW)) {
    const res = await fetch(SOURCE_URL)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    await writeFile(RAW, await res.text())
  }
  const raw = parseCSV(await readFile(RAW, 'utf8'))

  const players = raw
    .filter(r => GROUP[r.position] && Number(r.season) >= FIRST_CLASS && Number(r.season) <= LAST_JUDGED_CLASS)
    .map(r => {
      const year = Number(r.season)
      const to = num(r.to)
      return {
        id: r.pfr_player_id || `${year}-${r.pick}`,
        name: r.pfr_player_name,
        year, round: num(r.round), pick: num(r.pick),
        team: r.team, pos: r.position, grp: GROUP[r.position],
        college: r.college,
        av: num(r.w_av), drav: num(r.dr_av),
        pb: num(r.probowls), ap: num(r.allpro), hof: r.hof === 'TRUE',
        starts: num(r.seasons_started), games: num(r.games),
        to, seasons: to ? to - year + 1 : 0,
        active: to >= LAST_SEASON,
        line: statLine(r, GROUP[r.position]),
      }
    })

  // Expected AV: a kernel-weighted average of peers at the same position
  // group, from nearby classes, weighted by closeness in ln(draft pick).
  const byGroup = new Map()
  for (const p of players) byGroup.set(p.grp, [...(byGroup.get(p.grp) ?? []), p])
  for (const p of players) Object.assign(p, expectation(p, byGroup.get(p.grp)))
  for (const p of players) p.dna = archetype(p)
  const recruited = await outlierIndex(players)


  const fields = ['id', 'name', 'year', 'round', 'pick', 'team', 'pos', 'grp', 'college',
    'av', 'exp', 'pct', 'peers', 'drav', 'pb', 'ap', 'hof', 'starts', 'games', 'seasons', 'to',
    'active', 'dna', 'line', 'oi', 'from', 'stars', 'rating', 'spct']
  const rows = players.map(p => fields.map(f =>
    f === 'exp' ? Math.round(p.exp * 10) / 10 : typeof p[f] === 'boolean' ? +p[f] : p[f]))

  await writeFile(OUT, JSON.stringify({
    generated: new Date().toISOString(),
    source: SOURCE_URL,
    lastSeason: LAST_SEASON,
    model: { bandwidths: BANDWIDTHS, minPeers: MIN_PEERS, lastJudgedClass: LAST_JUDGED_CLASS },
    recruitingLinked: recruited,
    fields, rows,
  }))
  console.log(`${players.length} players (${recruited} linked to recruiting) → ${OUT}`)
}

main()
