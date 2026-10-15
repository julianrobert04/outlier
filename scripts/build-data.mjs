// Builds the Outlier dataset from real, public nflverse data.
//
//   node scripts/build-data.mjs            # download fresh sources, then build
//   node scripts/build-data.mjs --offline  # reuse files already in data/raw
//
// Sources (all nflverse, github.com/nflverse/nflverse-data):
//   draft_picks   — every pick, with Pro Football Reference career value (AV) and honors
//   players       — the player registry, including undrafted players
//   stats_player  — regular-season stats per player per season
//   depth_charts  — weekly starters, 2001–2024 (used where snap counts are missing)
//   snap_counts   — snaps per game, 2013 onward (the published 2012 file is empty)
//   nfldata games — the schedule, so depth-chart bye weeks don't count as starts
//   pfr_advstats  — pressures, missed tackles, coverage, drops… (2018+)
//   pbp_def.json  — stuffs and run stops derived from play-by-play (scripts/build-pbp.mjs)
//
// Every number on the site is derived here. Nothing is hand-entered.

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const BASE = 'https://github.com/nflverse/nflverse-data/releases/download'
const RAW = 'data/raw'
const OUT = 'public/data'

const FIRST_CLASS = 2000 // the era: everyone who played from 2000 on; also when recruiting ratings begin
const SCOPE_FROM = 1995 // the site covers every draft class from here on
const HISTORY_FROM = 1992 // earlier classes load too, so 1995–97 picks get full comparison windows
const STATS_FROM = 1999 // first season of nflverse season stats
const LAST_CLASS = 2025 // most recent class with NFL games played
const YOUNG_FROM = 2022 // 2022+ classes: early-career track
const LAST_SEASON = Number(process.env.OUTLIER_LAST_SEASON ?? new Date().getFullYear())
const BANDWIDTHS = [0.22, 0.3, 0.4, 0.55, 0.75, 1] // kernel widths on ln(pick)
const MIN_PEERS = 12 // minimum effective comparison-group size (Kish)
const UDFA_PICK = 300 // where an undrafted player sits on the pick scale (for DNA)
const SHARDS = 64

const GROUP = {
  QB: 'QB', RB: 'RB', HB: 'RB', FB: 'RB', WR: 'WR', KR: 'WR', TE: 'TE',
  T: 'OL', OT: 'OL', G: 'OL', OG: 'OL', C: 'OL', OL: 'OL',
  DE: 'DL', DT: 'DL', NT: 'DL', DL: 'DL',
  LB: 'LB', OLB: 'LB', ILB: 'LB', MLB: 'LB',
  DB: 'DB', CB: 'DB', S: 'DB', SS: 'DB', SAF: 'DB', FS: 'DB',
  K: 'ST', P: 'ST', LS: 'ST',
}

// ── IO ─────────────────────────────────────────────────────────────────────

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

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

function sources() {
  return [
    ['draft_picks/draft_picks.csv', 'draft_picks.csv'],
    ['players/players.csv', 'players.csv'],
    ...range(STATS_FROM, LAST_SEASON).map(y => [`stats_player/stats_player_reg_${y}.csv`, `stats/${y}.csv`]),
    ...range(2001, 2024).map(y => [`depth_charts/depth_charts_${y}.csv`, `depth/${y}.csv`]),
    ...range(2012, LAST_SEASON).map(y => [`snap_counts/snap_counts_${y}.csv`, `snaps/${y}.csv`]),
    ...['def', 'rush', 'rec', 'pass'].map(t => [`pfr_advstats/advstats_season_${t}.csv`, `adv/${t}.csv`]),
  ]
}

const SCHEDULE_URL = 'https://github.com/nflverse/nfldata/raw/master/data/games.csv'

async function download() {
  for (const d of ['stats', 'depth', 'snaps', 'adv']) await mkdir(`${RAW}/${d}`, { recursive: true })
  const sched = await fetch(SCHEDULE_URL)
  if (!sched.ok) throw new Error(`schedule: HTTP ${sched.status}`)
  await writeFile(`${RAW}/games.csv`, await sched.text())
  const queue = sources()
  await Promise.all(range(1, 8).map(async () => {
    for (let s; (s = queue.shift());) {
      const res = await fetch(`${BASE}/${s[0]}`)
      if (res.status === 404) continue // a season not published yet
      if (!res.ok) throw new Error(`${s[0]}: HTTP ${res.status}`)
      await writeFile(`${RAW}/${s[1]}`, await res.text())
    }
  }))
}

const load = async f => (existsSync(`${RAW}/${f}`) ? parseCSV(await readFile(`${RAW}/${f}`, 'utf8')) : [])
const num = v => (v === '' || v == null || v === 'NA' ? 0 : Number(v) || 0)
const fmt = n => Math.round(n).toLocaleString('en-US')

// ── Season-by-season careers ───────────────────────────────────────────────

// Columns of a season row, shared with the frontend.
const SEASON_COLS = ['season', 'team', 'g', 'gs', 'cmp', 'att', 'pyd', 'ptd', 'int', 'car', 'ryd', 'rtd',
  'rec', 'tgt', 'recyd', 'rectd', 'solo', 'ast', 'tfl', 'sk', 'qbh', 'dint', 'pd', 'ff', 'fgm', 'fga',
  // more box-score stats
  'pfd', 'rfd', 'recfd', 'yac', 'fuml', 'skd', 'sfty', 'fr', 'dtd', 'pry', 'kry', 'sttd', 'pen',
  // derived from play-by-play (2000+)
  'stuff', 'rstop', 'rtkl',
  // Pro Football Reference advanced stats (2018+)
  'prss', 'hrry', 'qbkd', 'mtkl', 'bltz', 'tgta', 'cmpa', 'ydsa', 'tda', 'ybc', 'brk', 'drop', 'prsd', 'badt']
const ADV_FROM = 2018
const STAT_MAP = {
  cmp: 'completions', att: 'attempts', pyd: 'passing_yards', ptd: 'passing_tds', int: 'passing_interceptions',
  car: 'carries', ryd: 'rushing_yards', rtd: 'rushing_tds', rec: 'receptions', tgt: 'targets',
  recyd: 'receiving_yards', rectd: 'receiving_tds', solo: 'def_tackles_solo', ast: 'def_tackle_assists',
  tfl: 'def_tackles_for_loss', sk: 'def_sacks', qbh: 'def_qb_hits', dint: 'def_interceptions',
  pd: 'def_pass_defended', ff: 'def_fumbles_forced', fgm: 'fg_made', fga: 'fg_att',
  pfd: 'passing_first_downs', rfd: 'rushing_first_downs', recfd: 'receiving_first_downs',
  yac: 'receiving_yards_after_catch', fuml: 'fumbles_lost_total', skd: 'sacks_suffered',
  sfty: 'def_safeties', fr: 'fumble_recovery_opp', dtd: 'def_tds', pry: 'punt_return_yards',
  kry: 'kickoff_return_yards', sttd: 'special_teams_tds', pen: 'penalties',
}
const EXTRA = ['stuff', 'rstop', 'rtkl', 'prss', 'hrry', 'qbkd', 'mtkl', 'bltz', 'tgta', 'cmpa', 'ydsa', 'tda', 'ybc', 'brk', 'drop', 'prsd', 'badt']
// Advanced-stat source columns, per file. brk is broken tackles as a runner or receiver.
const ADV_MAP = {
  def: { prss: 'prss', hrry: 'hrry', qbkd: 'qbkd', mtkl: 'm_tkl', bltz: 'bltz', tgta: 'tgt', cmpa: 'cmp', ydsa: 'yds', tda: 'td' },
  rush: { ybc: 'ybc', brk: 'brk_tkl' },
  rec: { brk: 'brk_tkl', drop: 'drop' },
  pass: { prsd: 'times_pressured', badt: 'bad_throws' },
}

async function buildSeasons(pfrToGsis) {
  const seasons = new Map() // gsis → Map(season → row)
  const row = (id, y) => {
    if (!seasons.has(id)) seasons.set(id, new Map())
    const m = seasons.get(id)
    if (!m.has(y)) m.set(y, { season: y, team: '', g: 0, gs: 0, snapG: 0, snapGS: 0, depthGS: new Set(), ...Object.fromEntries([...Object.keys(STAT_MAP), ...EXTRA].map(k => [k, 0])) })
    return m.get(y)
  }
  for (const y of range(STATS_FROM, LAST_SEASON)) {
    for (const r of await load(`stats/${y}.csv`)) {
      if (!r.player_id) continue
      const s = row(r.player_id, y)
      s.g = Math.max(s.g, num(r.games))
      s.team = r.recent_team || s.team
      for (const [k, col] of Object.entries(STAT_MAP)) s[k] += num(r[col])
    }
  }
  // Starters from depth charts: first string on the weekly offensive/defensive
  // chart. Used for any season that has no snap counts. Charts are published
  // for bye weeks too, so only weeks the team actually played count.
  const played = new Set((await load('games.csv'))
    .filter(g => g.game_type === 'REG')
    .flatMap(g => [`${g.season}|${g.week}|${g.home_team}`, `${g.season}|${g.week}|${g.away_team}`]))
  for (const y of range(2001, 2024)) {
    for (const r of await load(`depth/${y}.csv`)) {
      if (r.game_type !== 'REG' || r.depth_team !== '1' || !r.gsis_id) continue
      if (!played.has(`${y}|${Number(r.week)}|${r.club_code}`)) continue
      if (r.formation !== 'Offense' && r.formation !== 'Defense') continue
      row(r.gsis_id, y).depthGS.add(r.week)
    }
  }
  // Games and starts from snap counts: any snap = a game played; ≥50% of
  // snaps = a start. Only seasons whose file actually has rows count.
  const snapSeasons = new Set()
  for (const y of range(2012, LAST_SEASON)) {
    for (const r of await load(`snaps/${y}.csv`)) {
      snapSeasons.add(y)
      if (r.game_type !== 'REG') continue
      const id = pfrToGsis.get(r.pfr_player_id)
      if (!id) continue
      const s = row(id, y)
      if (num(r.offense_snaps) + num(r.defense_snaps) + num(r.st_snaps) > 0) s.snapG++
      if (num(r.offense_pct) >= 0.5 || num(r.defense_pct) >= 0.5) s.snapGS++
      if (!s.team) s.team = r.team
    }
  }
  // Stuffs and run stops from play-by-play (scripts/build-pbp.mjs).
  if (existsSync(`${RAW}/pbp_def.json`)) {
    for (const [key, [stuff, rstop, rtkl]] of Object.entries(JSON.parse(await readFile(`${RAW}/pbp_def.json`, 'utf8')))) {
      const [id, y] = key.split('|')
      if (!seasons.get(id)?.has(Number(y))) continue // only seasons the player actually appears in
      Object.assign(seasons.get(id).get(Number(y)), { stuff, rstop, rtkl })
    }
  }
  // Advanced stats, 2018+, keyed by PFR id. A traded player has a combined
  // "2TM"/"3TM" row plus one row per team: use the combined row alone.
  for (const [file, cols] of Object.entries(ADV_MAP)) {
    const rows = await load(`adv/${file}.csv`)
    const team = r => r.tm ?? r.team ?? ''
    const combined = new Set(rows.filter(r => /^\dTM$/.test(team(r))).map(r => `${r.pfr_id}|${r.season}`))
    for (const r of rows) {
      if (combined.has(`${r.pfr_id}|${r.season}`) && !/^\dTM$/.test(team(r))) continue
      const id = pfrToGsis.get(r.pfr_id), y = num(r.season)
      if (!id || y < ADV_FROM || !seasons.get(id)?.has(y)) continue
      const s = seasons.get(id).get(y)
      for (const [k, col] of Object.entries(cols)) s[k] += num(r[col])
    }
  }
  for (const m of seasons.values()) {
    for (const s of m.values()) {
      s.gs = snapSeasons.has(s.season) ? s.snapGS : Math.min(s.depthGS.size, 17)
      // A start is a game played; box-score games miss linemen without stats.
      s.g = Math.max(s.g, s.snapG, s.gs)
    }
  }
  return { seasons, snapSeasons }
}

function careerTotals(rows) {
  const t = Object.fromEntries(SEASON_COLS.slice(2).map(k => [k, 0]))
  for (const s of rows) for (const k in t) t[k] += s[k]
  t.played = rows.filter(s => s.g > 0).length
  t.starterSeasons = rows.filter(s => s.gs >= 8).length
  return t
}

function statLine(t, g) {
  switch (g) {
    case 'QB': return `${fmt(t.pyd)} pass yds · ${t.ptd} TD · ${t.int} INT`
    case 'RB': return `${fmt(t.ryd)} rush yds · ${t.rtd} TD · ${fmt(t.recyd)} rec yds`
    case 'WR':
    case 'TE': return `${fmt(t.rec)} rec · ${fmt(t.recyd)} yds · ${t.rectd} TD`
    case 'DL':
    case 'LB': return `${t.sk} sacks · ${fmt(t.solo)} solo tackles`
    case 'DB': return `${t.dint} INT · ${t.pd} passes defended · ${fmt(t.solo)} solo tackles`
    case 'ST': return `${t.fgm}/${t.fga} field goals`
    default: return `${t.g} games · ${t.gs} starts`
  }
}

function draftStatLine(r, g) {
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

// ── Estimated AV for undrafted players ─────────────────────────────────────
// PFR's Approximate Value only ships with draft data. For undrafted players we
// estimate it from the same season data: a ridge regression per position group,
// trained on drafted players whose real AV we know. Accuracy (R²) is published.

const FEATURES = {
  base: t => [t.g / 16, t.gs / 16, t.played, t.starterSeasons],
  QB: t => [t.pyd / 1000, t.ptd / 10, t.int / 10, t.ryd / 100],
  RB: t => [t.ryd / 100, t.rtd / 10, t.recyd / 100, t.rec / 10],
  WR: t => [t.rec / 10, t.recyd / 100, t.rectd / 10],
  TE: t => [t.rec / 10, t.recyd / 100, t.rectd / 10],
  OL: () => [],
  DL: t => [t.sk, t.solo / 10, t.tfl / 10, t.qbh / 10],
  LB: t => [t.sk, t.solo / 10, t.tfl / 10, t.dint, t.pd / 10],
  DB: t => [t.dint, t.pd / 10, t.solo / 10, t.ff],
  ST: t => [t.fgm / 10, t.fga / 10],
}
const featurize = (t, g) => [1, ...FEATURES.base(t), ...FEATURES[g](t)]

function solve(A, b) {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c || !M[c][c]) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((r, i) => (r[i] ? r[n] / r[i] : 0))
}

function fitAV(training) {
  const models = {}
  for (const g of Object.keys(FEATURES).filter(k => k !== 'base')) {
    const rows = training.filter(p => p.grp === g)
    if (rows.length < 30) continue
    const X = rows.map(p => featurize(p.totals, g)), y = rows.map(p => p.av)
    const k = X[0].length
    const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) =>
      X.reduce((s, x) => s + x[i] * x[j], 0) + (i === j && i > 0 ? 1 : 0)))
    const b = Array.from({ length: k }, (_, i) => X.reduce((s, x, n) => s + x[i] * y[n], 0))
    const w = solve(A, b)
    const pred = X.map(x => Math.max(0, x.reduce((s, v, i) => s + v * w[i], 0)))
    const mean = y.reduce((s, v) => s + v, 0) / y.length
    const ssr = y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0)
    const sst = y.reduce((s, v) => s + (v - mean) ** 2, 0)
    models[g] = { w, r2: Math.round((1 - ssr / sst) * 100) / 100, n: rows.length }
  }
  return models
}
const predictAV = (m, t, g) => Math.max(0, Math.round(featurize(t, g).reduce((s, v, i) => s + v * m.w[i], 0)))

// ── Expectations ───────────────────────────────────────────────────────────

// Peers come from nearby classes so careers being compared are the same
// length. Early-career classes are compared only within their own class.
const yearWindow = y => (y >= YOUNG_FROM ? 0 : Math.max(0, Math.min(3, Math.floor((YOUNG_FROM - 1 - y) / 2))))

// Years in the league so far. The current season counts as a fraction.
const SEASON_FRACTION = Number(process.env.OUTLIER_SEASON_FRACTION ?? 0.35)
const yearsIn = p => Math.max(LAST_SEASON - p.year + SEASON_FRACTION, 0.5)

// Early-career players are compared on pace (value per season so far)
// against every 2022+ class, so a QB isn't measured against two others.
// Everyone else is compared on career value with nearby classes.
function expectation(p, group) {
  const w0 = yearWindow(p.year)
  const windows = p.young ? [Infinity] : [...new Set([w0, w0 === 3 ? 5 : w0])]
  const drafted = p.pick > 0
  const val = q => (p.young ? q.av / yearsIn(q) : q.av)
  const mine = val(p)
  let out
  for (const bw of drafted ? BANDWIDTHS : [Infinity]) {
    for (const w of windows) {
      let sw = 0, sw2 = 0, swa = 0, below = 0, core = 0, above = 0
      for (const q of group) {
        if (q === p || (q.pick > 0) !== drafted || p.young !== q.young || Math.abs(q.year - p.year) > w) continue
        let k = 1
        if (drafted) {
          const d = (Math.log(q.pick) - Math.log(p.pick)) / bw
          k = Math.exp(-0.5 * d * d)
          if (k < 1e-3) continue
        }
        const v = val(q)
        // Core peers (close in slot) define the plain-language rank: "No. 1 of 412".
        if (k >= 0.5) { core++; if (v > mine) above++ }
        sw += k; sw2 += k * k; swa += k * v
        below += v < mine ? k : v === mine ? k / 2 : 0
      }
      const e = sw ? swa / sw : 0
      out = {
        exp: p.young ? e * yearsIn(p) : e, // expected value to date
        pct: sw ? Math.round((100 * below) / sw) : 50,
        peers: sw ? Math.round((sw * sw) / sw2) : 0,
        rank: above + 1, of: core + 1,
      }
      if (out.peers >= MIN_PEERS) return out
    }
  }
  return out
}

function archetype(p) {
  if (p.young) {
    if (p.ap || p.pb) return 'Early star'
    if (p.games < 4) return 'Still waiting'
    if (p.pct >= 80) return 'Ahead of schedule'
    if (p.pct < 30) return 'Slow start'
    return 'On schedule'
  }
  if (!p.pick) {
    if (p.hof || p.av >= 60) return 'Undrafted legend'
    if (p.pct >= 90 && p.av >= 15) return 'Undrafted gem'
    if (p.played >= 3 && p.games >= 32) return 'Made the league'
    if (p.games >= 1) return 'Cup of coffee'
    return 'Never broke through'
  }
  const loyalty = p.loyal
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

// ── Outlier Index ──────────────────────────────────────────────────────────
// One number, .01 to .99: a ladder of expectations. Each step is a multiplier.
//   draft multiplier  = draft value of the slot ÷ what recruits with the same
//                       stars and position usually get (stars → draft)
//   career multiplier = NFL career value ÷ what that draft slot usually
//                       produces (draft → career)
// M = √(draft multiplier) × career multiplier, and a falling career counts
// double (squared below 1): the draft counts half, the career fully, a
// collapse twice. Without a star rating the draft multiplier is 1. The grade
// is M^GRADE_CURVE / (M^GRADE_CURVE + 1): .50 means exactly as expected, and
// .99 takes about a 21× climb. The career-quality ceiling and elite tier (below)
// anchor the top to real careers; active careers are capped at ACTIVE_CAP.

const RECRUIT_GROUP = {
  PRO: 'QB', DUAL: 'QB', QB: 'QB', RB: 'RB', APB: 'RB', FB: 'RB', WR: 'WR', TE: 'TE',
  OT: 'OL', OG: 'OL', OC: 'OL', IOL: 'OL', OL: 'OL',
  SDE: 'DL', WDE: 'DL', DT: 'DL', DL: 'DL', EDGE: 'DL', DE: 'DL',
  ILB: 'LB', OLB: 'LB', LB: 'LB', CB: 'DB', S: 'DB', DB: 'DB', K: 'ST', P: 'ST', LS: 'ST',
}
// An early read can't reach the top of the scale until the career has run.
const EARLY_CAP = 0.95
const GRADE_CURVE = 1.5
const careerMultiplier = p => (Math.max(p.av, 0) + 1) / (p.exp + 1)
// Career quality: what the player actually produced. Total career value
// (built from his stats) as a percentile among everyone at the position who
// played. It is half of the grade:
//   grade = √(ladder grade × quality grade), quality grade = quality^QUALITY_POWER
// so a big climb with a modest career lands in the middle (better than 75% of
// QBs → .19 quality grade). Elite careers (top ELITE_FROM of a position) also
// grade high on their own even when expected, and the top ELITE_TOP is .99.
// Careers still in progress are capped at ACTIVE_CAP: they can still go down.
const ELITE_TOP = 0.995
const ELITE_FROM = 0.98
const QUALITY_POWER = 6
const ACTIVE_CAP = 0.97
function careerQuality(players) {
  const pools = new Map()
  const score = p => Math.max(p.av, 0) + (p.honorPoints ?? 0)
  for (const p of players) if (!p.young && p.games > 0) pools.set(p.grp, [...(pools.get(p.grp) ?? []), score(p)])
  for (const v of pools.values()) v.sort((a, b) => a - b)
  for (const p of players) {
    const pool = pools.get(p.grp)
    p.q = pool && p.games > 0 ? midRankSorted(pool, score(p)) : 0
  }
}
function midRankSorted(sorted, x) {
  let lo = 0, hi = sorted.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m }
  let eq = lo
  while (eq < sorted.length && sorted[eq] === x) eq++
  return (lo + (eq - lo) / 2) / sorted.length
}
const eliteGrade = q => (q >= ELITE_TOP ? 0.99 : q >= ELITE_FROM ? 0.95 + ((q - ELITE_FROM) / (ELITE_TOP - ELITE_FROM)) * 0.039 : 0)
const qualityGrade = q => (q >= ELITE_TOP ? 0.995 : Math.pow(q, QUALITY_POWER))
function finalGrade(p) {
  const career = careerMultiplier(p)
  const m = Math.sqrt(p.m1 ?? 1) * (career < 1 ? career * career : career)
  const x = Math.pow(m, GRADE_CURVE)
  p.m2 = career
  p.mult = m
  p.ladder = gradeOI(x / (x + 1))
  p.qgrade = p.games ? qualityGrade(p.q) : 0.0001
  const blended = gradeOI(Math.sqrt(Math.max(x / (x + 1), 0.0001) * p.qgrade))
  // Elite route: only when the ladder didn't collapse (a #1 pick who was merely long-lived isn't elite).
  const elite = p.ladder >= 0.5 && eliteGrade(p.q) ? gradeOI(eliteGrade(p.q)) : 0
  let oi = Math.max(blended, elite)
  if (p.active) oi = Math.min(oi, ACTIVE_CAP)
  if (p.young) oi = Math.min(oi, EARLY_CAP)
  return oi
}
// The final grade rounds down, never up to the next step.
const gradeOI = x => Math.min(0.99, Math.max(0.01, Math.floor(x * 100 + 1e-9) / 100))
const clampOI = x => Math.min(0.99, Math.max(0.01, Math.round(x * 100) / 100))
const normName = s => s.toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z]/g, '')
const normSchool = s => s.toLowerCase().replace(/\bst\.?$/, 'state').replace(/[^a-z]/g, '')

function midRank(value, values) {
  let below = 0, equal = 0
  for (const v of values) { if (v < value) below++; else if (v === value) equal++ }
  return (below + equal / 2) / values.length
}

// Draft capital: the average full career (AV) produced by a pick at each slot,
// smoothed on ln(pick), from every completed career (drafted classes up to
// YOUNG_FROM - 1). Undrafted signings get the average undrafted career.
function draftCapital(players) {
  const judged = players.filter(p => !p.young)
  const drafted = judged.filter(p => p.pick > 0)
  const udfa = judged.filter(p => !p.pick)
  const udfaValue = udfa.reduce((s, p) => s + p.av, 0) / Math.max(udfa.length, 1)
  const cache = new Map()
  return pick => {
    if (!pick) return udfaValue
    if (cache.has(pick)) return cache.get(pick)
    const lp = Math.log(pick)
    let sw = 0, sa = 0
    for (const q of drafted) {
      const d = (Math.log(q.pick) - lp) / 0.2
      const k = Math.exp(-0.5 * d * d)
      sw += k; sa += k * q.av
    }
    const v = sw ? sa / sw : 0
    cache.set(pick, v)
    return v
  }
}

async function outlierIndex(players) {
  for (const p of players) {
    p.from = p.pick ? 'draft' : 'udfa'; p.stars = 0; p.rating = 0; p.m1 = null
  }
  if (!existsSync(`${RAW}/recruits.json`)) return 0
  const recruits = JSON.parse(await readFile(`${RAW}/recruits.json`, 'utf8'))

  // Link players to their recruiting profile: same name, recruited 3–6 years
  // before entering the NFL, preferring the same school.
  const byName = new Map()
  for (const p of players) byName.set(normName(p.name), [...(byName.get(normName(p.name)) ?? []), p])
  let linked = 0
  for (const r of recruits) {
    r.grp = RECRUIT_GROUP[r.position] ?? null
    const cands = (byName.get(normName(r.name)) ?? []).filter(p => p.year - r.year >= 3 && p.year - r.year <= 6 && !p.recruit)
    const p = cands.find(c => normSchool(c.college) === normSchool(r.school)) ?? (cands.length === 1 ? cands[0] : null)
    if (p) { p.recruit = r; r.player = p; linked++ }
  }
  // Position rank within each recruiting class (247 Composite rating order).
  const byClassPos = new Map()
  for (const r of recruits) {
    if (!r.rating) continue
    const k = `${r.year}|${r.position}`
    byClassPos.set(k, [...(byClassPos.get(k) ?? []), r])
  }
  for (const list of byClassPos.values()) {
    list.sort((a, b) => b.rating - a.rating).forEach((r, i) => { r.posRank = i + 1 })
  }
  // Recruiting profile shown under the name, for every linked player with a rating.
  for (const p of players) {
    const r = p.recruit
    if (!r || !r.stars) continue
    p.stars = r.stars; p.rating = Math.round(r.rating * 10000) / 10000
    p.recRank = r.ranking ?? null; p.recPosRank = r.posRank ?? null; p.recPos = r.position ?? ''
    p.recYear = r.year; p.recSchool = r.school ?? ''
  }

  // Stage 1, stars → draft: how much draft value the recruit got versus what
  // recruits with the same stars and position usually get. Draft value is one
  // fixed scale: the average career a pick at that slot produces (from every
  // completed career since FIRST_CLASS), a small amount for signing undrafted,
  // zero for never reaching the NFL. A 2-star taken in round 2 is a big
  // surprise; a 5-star taken in round 1 is what was expected, so only a small
  // gain; a 5-star who goes undrafted is a big fall. Surprise is a ratio,
  // ln((value + 1) / (expected + 1)), so it reads as "how many times more
  // than expected", and it is ranked against every NFL player at the position
  // with a star rating, all star levels together.
  const capital = draftCapital(players)
  const value = r => (r.player ? capital(r.player.pick) : 0)
  const lastJudged = YOUNG_FROM - 4 // recruiting classes whose careers are judged in full
  const key = (stars, grp, year) => `${stars}|${grp ?? 'ANY'}|${year}`
  const agg = new Map()
  for (const r of recruits) {
    if (!r.stars) continue
    const v = value(r)
    for (const k of [key(r.stars, r.grp, r.year), key(r.stars, null, r.year)]) {
      const a = agg.get(k) ?? { sum: 0, n: 0, drafted: 0, picks: [] }
      a.sum += v; a.n++
      if (r.player?.pick) { a.drafted++; a.picks.push(r.player.pick) }
      agg.set(k, a)
    }
  }
  // Expected draft value for a star level at a position. Rare levels (5-stars
  // are ~6 per position per year) widen the year window until at least
  // MIN_RECRUITS recruits are pooled, then fall back to all positions.
  const MIN_RECRUITS = 30
  const expectation = r => {
    const young = r.year > lastJudged
    const gather = (grp, w) => {
      let sum = 0, n = 0, drafted = 0, picks = []
      for (let y = r.year - w; y <= r.year + w; y++) {
        if (young ? y <= lastJudged : y > lastJudged) continue // never mix career lengths
        const a = agg.get(key(r.stars, grp, y))
        if (a) { sum += a.sum; n += a.n; drafted += a.drafted; picks = picks.concat(a.picks) }
      }
      return { sum, n, drafted, picks }
    }
    let g = null
    for (const grp of [r.grp, null]) {
      for (let w = young ? 0 : yearWindow(r.year + 4); w <= 8; w++) {
        g = gather(grp, w)
        if (g.n >= MIN_RECRUITS) break
      }
      if (g.n >= MIN_RECRUITS) break
    }
    g.picks.sort((a, b) => a - b)
    return { mean: g.n ? g.sum / g.n : 0, n: g.n, draftRate: g.n ? g.drafted / g.n : 0, medianPick: g.picks.length ? g.picks[g.picks.length >> 1] : null }
  }
  for (const p of players) {
    const r = p.recruit
    if (!r || !r.stars) continue
    const e = expectation(r)
    if (e.n < MIN_RECRUITS) continue
    p.m1 = (value(r) + 1) / (e.mean + 1)
    p.from = 'recruit'; p.stars = r.stars; p.rating = Math.round(r.rating * 10000) / 10000
    p.sDraftRate = Math.round(e.draftRate * 1000) / 1000
    p.sMedianPick = e.medianPick
    p.sValue = Math.round(value(r) * 10) / 10
    p.sExpected = Math.round(e.mean * 10) / 10
  }
  return linked
}

// ── Honors ─────────────────────────────────────────────────────────────────
// Pro Bowls, All-Pro teams and the major awards, from Wikipedia (scripts/
// fetch-honors.mjs). Drafted players keep Pro Football Reference's Pro Bowl
// and first-team All-Pro counts; everything else (and undrafted players'
// counts) comes from the season pages. Each honor adds career-value points on
// a scale of prestige: All-Pro weighs far more than a Pro Bowl.
const HONOR_POINTS = { mvp: 30, opoy: 20, dpoy: 20, sbmvp: 12, ap1: 10, oroy: 6, droy: 6, ap2: 4, comeback: 3, pb: 2, hof: 25 }
const AWARD_LABEL = { mvp: 'MVP', opoy: 'Offensive Player of the Year', dpoy: 'Defensive Player of the Year', sbmvp: 'Super Bowl MVP',
  oroy: 'Offensive Rookie of the Year', droy: 'Defensive Rookie of the Year', comeback: 'Comeback Player of the Year' }

const wikiName = s => normName(s.replace(/\(.*?\)/g, ''))
function rowNames(row) {
  const names = []
  for (const m of row.matchAll(/\{\{sortname\|([^|}]*)\|([^|}]*)(?:\|([^|}]*))?/g)) names.push(m[3]?.trim() || `${m[1]} ${m[2]}`)
  for (const m of row.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)) names.push(m[1])
  return names
}

async function linkHonors(players) {
  const dir = `${RAW}/honors`
  if (!existsSync(`${dir}/awards.json`)) return 0
  const byName = new Map()
  for (const p of players) byName.set(normName(p.name), [...(byName.get(normName(p.name)) ?? []), p])
  // The player with this name active in that season; on a collision, the most accomplished one.
  const who = (raw, season) => {
    const c = (byName.get(wikiName(raw)) ?? []).filter(p => p.games > 0 && season >= p.year && season <= (p.to || p.year))
    return c.sort((a, b) => b.av - a.av)[0] ?? null
  }
  for (const p of players) { p.honorsList = []; p.ap2 = 0; if (!p.pick) { p.pb = 0; p.ap = 0 } }
  const give = (p, key, season) => {
    if (p.honorsList.some(h => h[0] === key && h[1] === season)) return
    p.honorsList.push([key, season])
  }
  let found = 0
  // Season pages: Pro Bowl rosters and All-Pro teams.
  for (let y = HISTORY_FROM; y <= LAST_SEASON; y++) {
    if (!existsSync(`${dir}/${y}.json`)) continue
    const { proBowl, allPro } = JSON.parse(await readFile(`${dir}/${y}.json`, 'utf8'))
    const pbNames = new Set([...proBowl.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)].map(m => m[1]))
    for (const n of pbNames) { const p = who(n, y); if (p) { give(p, 'pb', y); found++ } }
    for (const m of allPro.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\][^\[\n(]*?(?:\[\[[^\]]*\]\])?[^\[\n(]*?\(([^)]*)\)/g)) {
      const tags = m[2].split(/[,;\s]+/).map(t => t.trim())
      const p = who(m[1], y)
      if (!p) continue
      if (tags.includes('AP')) give(p, 'ap1', y)
      else if (tags.includes('AP-2')) give(p, 'ap2', y)
    }
  }
  // Award pages: one row per season.
  const awards = JSON.parse(await readFile(`${dir}/awards.json`, 'utf8'))
  const sections = {
    mvp: awards.mvp, opoy: awards.opoy, dpoy: awards.dpoy, sbmvp: awards.sbmvp, comeback: awards.comeback,
    oroy: (awards.oroy ?? '').split(/^=+\s*Defensive/m)[0],
    droy: (awards.droy ?? '').split(/^=+\s*Defensive/m)[1] ?? '',
  }
  for (const [key, text] of Object.entries(sections)) {
    for (const row of (text ?? '').split(/\n\|-/).slice(1)) {
      // A real table row opens with its season; prose and infoboxes don't.
      const first = row.split('\n').find(l => l.trim()) ?? ''
      const ym = first.match(/\[\[(\d{4}) NFL season/)
      if (!ym) continue
      const season = Number(ym[1])
      if (season < HISTORY_FROM || season > LAST_SEASON) continue
      for (const n of rowNames(row)) { const p = who(n, season); if (p) { give(p, key, season); break } }
    }
  }
  // Counts: drafted players keep PFR's Pro Bowl / first-team All-Pro counts.
  for (const p of players) {
    const count = k => p.honorsList.filter(h => h[0] === k).length
    if (!p.pick) { p.pb = count('pb'); p.ap = count('ap1'); p.honors = 1 }
    p.ap2 = count('ap2')
    p.awards = p.honorsList.filter(h => AWARD_LABEL[h[0]]).sort((a, b) => a[1] - b[1]).map(h => `${h[0]}:${h[1]}`).join(';')
    p.honorPoints = HONOR_POINTS.pb * p.pb + HONOR_POINTS.ap1 * p.ap + HONOR_POINTS.ap2 * p.ap2 + (p.hof ? HONOR_POINTS.hof : 0) +
      p.honorsList.filter(h => AWARD_LABEL[h[0]]).reduce((s, h) => s + HONOR_POINTS[h[0]], 0)
  }
  return found
}

// ── College stats ──────────────────────────────────────────────────────────
// Season stats from CollegeFootballData.com (scripts/fetch-college.mjs), linked
// to players by name, college and years before the NFL. Offense from ~2007,
// defense from 2016, nothing for linemen.

const COLLEGE_COLS = ['season', 'team', 'cmp', 'att', 'pyd', 'ptd', 'int', 'car', 'ryd', 'rtd', 'rec', 'recyd', 'rectd',
  'tot', 'solo', 'tfl', 'sk', 'hur', 'pd', 'dint', 'dtd', 'kry', 'pry', 'fgm', 'fga']
const COLLEGE_MAP = {
  'passing.COMPLETIONS': 'cmp', 'passing.ATT': 'att', 'passing.YDS': 'pyd', 'passing.TD': 'ptd', 'passing.INT': 'int',
  'rushing.CAR': 'car', 'rushing.YDS': 'ryd', 'rushing.TD': 'rtd', 'receiving.REC': 'rec', 'receiving.YDS': 'recyd',
  'receiving.TD': 'rectd', 'defensive.TOT': 'tot', 'defensive.SOLO': 'solo', 'defensive.TFL': 'tfl', 'defensive.SACKS': 'sk',
  'defensive.QB HUR': 'hur', 'defensive.PD': 'pd', 'defensive.TD': 'dtd', 'interceptions.INT': 'dint',
  'kickReturns.YDS': 'kry', 'puntReturns.YDS': 'pry', 'kicking.FGM': 'fgm', 'kicking.FGA': 'fga',
}
const COLLEGE_DEFENSE_FROM = 2016

// College production: one position-specific number from career college totals.
const PRODUCTION = {
  QB: t => t.pyd + 20 * t.ptd - 45 * t.int + t.ryd + 20 * t.rtd,
  RB: t => t.ryd + t.recyd + 20 * (t.rtd + t.rectd),
  WR: t => t.recyd + 20 * t.rectd + t.ryd,
  TE: t => t.recyd + 20 * t.rectd,
  DL: t => t.tot + 5 * t.tfl + 10 * t.sk + 3 * t.hur,
  LB: t => t.tot + 5 * t.tfl + 10 * t.sk + 3 * t.hur + 5 * t.pd + 20 * t.dint,
  DB: t => t.tot + 20 * t.dint + 5 * t.pd + 5 * t.tfl,
}
const DEFENSIVE = new Set(['DL', 'LB', 'DB'])

async function linkCollege(players) {
  const dir = `${RAW}/college`
  if (!existsSync(dir)) return 0
  const cf = new Map() // CFBD playerId → { name, seasons: Map(year → row) }
  for (let y = 2004; y <= LAST_CLASS; y++) {
    if (!existsSync(`${dir}/${y}.json`)) continue
    for (const [id, name, , team, cat, type, stat] of JSON.parse(await readFile(`${dir}/${y}.json`, 'utf8'))) {
      const key = COLLEGE_MAP[`${cat}.${type}`]
      if (!key) continue
      if (!cf.has(id)) cf.set(id, { name, seasons: new Map() })
      const ss = cf.get(id).seasons
      if (!ss.has(y)) ss.set(y, { season: y, team, ...Object.fromEntries(COLLEGE_COLS.slice(2).map(k => [k, 0])) })
      ss.get(y)[key] += num(stat)
    }
  }
  const byName = new Map()
  for (const c of cf.values()) byName.set(normName(c.name), [...(byName.get(normName(c.name)) ?? []), c])

  let linked = 0
  for (const p of players) {
    const window = c => [...c.seasons.keys()].some(y => y < p.year && y >= p.year - 6)
    const cands = (byName.get(normName(p.name)) ?? []).filter(window)
    const school = normSchool(p.college || '')
    const c = cands.find(c => [...c.seasons.values()].some(s => normSchool(s.team) === school)) ??
      (cands.length === 1 ? cands[0] : null)
    if (!c || c.taken) continue
    c.taken = true
    p.collegeRows = [...c.seasons.values()].filter(s => s.season < p.year).sort((a, b) => a.season - b.season)
    linked++
  }

  // College production percentile within position group, among linked players.
  // Defensive groups only count players whose college years had defensive stats.
  for (const [g, f] of Object.entries(PRODUCTION)) {
    const group = players.filter(p => p.grp === g && p.collegeRows?.length &&
      (!DEFENSIVE.has(g) || p.collegeRows.some(s => s.season >= COLLEGE_DEFENSE_FROM)))
    const vals = group.map(p => {
      const t = Object.fromEntries(COLLEGE_COLS.slice(2).map(k => [k, p.collegeRows.reduce((s, r) => s + r[k], 0)]))
      return f(t)
    })
    group.forEach((p, i) => { p.cpct = clampOI(midRank(vals[i], vals)) })
  }
  return linked
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!process.argv.includes('--offline')) await download()
  const picks = await load('draft_picks.csv')
  const registry = await load('players.csv')
  const pfrToGsis = new Map(registry.filter(r => r.pfr_id && r.gsis_id).map(r => [r.pfr_id, r.gsis_id]))
  const { seasons, snapSeasons } = await buildSeasons(pfrToGsis)
  const seasonRows = id => [...(seasons.get(id)?.values() ?? [])].filter(s => s.g > 0 || s.gs > 0).sort((a, b) => a.season - b.season)

  // Drafted players: PFR's real AV and honors.
  const draftedIds = new Set()
  let players = picks
    .filter(r => GROUP[r.position] && num(r.season) >= HISTORY_FROM && num(r.season) <= LAST_CLASS)
    .map(r => {
      const year = num(r.season), to = num(r.to)
      const gsis = r.gsis_id || pfrToGsis.get(r.pfr_player_id) || ''
      if (gsis) draftedIds.add(gsis)
      if (r.pfr_player_id) draftedIds.add(r.pfr_player_id)
      const rows = gsis ? seasonRows(gsis).filter(s => s.season >= year) : []
      const totals = careerTotals(rows)
      return {
        id: r.pfr_player_id || gsis || `${year}-${r.pick}`, gsis, rows, totals,
        name: r.pfr_player_name, year, round: num(r.round), pick: num(r.pick),
        team: r.team, pos: r.position, grp: GROUP[r.position], college: r.college,
        av: num(r.w_av), est: 0, honors: 1, loyal: num(r.w_av) > 0 ? Math.min(num(r.dr_av) / num(r.w_av), 1) : 0,
        pb: num(r.probowls), ap: num(r.allpro), hof: r.hof === 'TRUE' ? 1 : 0,
        starts: num(r.seasons_started), games: num(r.games) || totals.g,
        to, played: totals.played,
        line: draftStatLine(r, GROUP[r.position]),
      }
    })

  // Undrafted players: everyone in the registry who entered the league in
  // range without being drafted.
  for (const r of registry) {
    const year = num(r.rookie_season)
    if (r.draft_round || !GROUP[r.position] || year > LAST_CLASS) continue
    // Undrafted players from before 2000 count if they have season stats (1999+).
    if (year < FIRST_CLASS && (year < SCOPE_FROM || num(r.last_season) < STATS_FROM)) continue
    if (draftedIds.has(r.gsis_id) || draftedIds.has(r.pfr_id)) continue
    const rows = seasonRows(r.gsis_id).filter(s => s.season >= year)
    const totals = careerTotals(rows)
    const grp = GROUP[r.position]
    const first = rows[0]?.team ?? r.latest_team ?? ''
    players.push({
      id: r.pfr_id || r.gsis_id, gsis: r.gsis_id, rows, totals,
      name: r.display_name, year, round: 0, pick: 0,
      team: first, pos: r.position, grp, college: (r.college_name || '').split(';')[0].trim(),
      av: 0, est: 1, honors: 0,
      loyal: totals.g ? rows.filter(s => s.team === first).reduce((s, x) => s + x.g, 0) / totals.g : 0,
      pb: 0, ap: 0, hof: 0, starts: totals.starterSeasons, games: totals.g,
      to: rows.length ? rows[rows.length - 1].season : 0, played: totals.played,
      line: statLine(totals, grp),
    })
  }

  for (const p of players) {
    p.seasons = p.to ? p.to - p.year + 1 : 0
    p.active = p.to >= LAST_SEASON ? 1 : 0
    p.young = p.year >= YOUNG_FROM ? 1 : 0
    p.gs1 = p.rows.find(s => s.season === p.year)?.gs ?? 0
  }

  // Estimate AV for undrafted players from a model trained on drafted ones.
  // Trained on era classes only: older careers are missing pre-1999 season stats.
  const models = fitAV(players.filter(p => p.pick && !p.young && p.year >= FIRST_CLASS && p.gsis && p.rows.length))
  for (const p of players) if (p.est && models[p.grp]) p.av = predictAV(models[p.grp], p.totals, p.grp)

  // Expectations use every pick from the older classes (no survivorship bias)…
  let byGroup = new Map()
  for (const p of players) byGroup.set(p.grp, [...(byGroup.get(p.grp) ?? []), p])
  for (const p of players) Object.assign(p, expectation(p, byGroup.get(p.grp)))
  // …then the site keeps every drafted player from HISTORY_FROM on, and undrafted
  // players with season stats (their career value is estimated from them).
  players = players.filter(p => p.year >= SCOPE_FROM && (p.pick > 0 || p.year >= FIRST_CLASS || p.to >= STATS_FROM))
  for (const p of players) p.preEra = p.year < FIRST_CLASS ? 1 : 0
  byGroup = new Map()
  for (const p of players) byGroup.set(p.grp, [...(byGroup.get(p.grp) ?? []), p])
  for (const p of players) p.dna = archetype(p)

  // Early-career context: rank within the class, overall and at the position.
  for (const y of range(YOUNG_FROM, LAST_CLASS)) {
    const cls = players.filter(p => p.year === y).sort((a, b) => b.av - a.av)
    cls.forEach((p, i) => { p.classRank = i + 1 })
    for (const g of byGroup.keys()) cls.filter(p => p.grp === g).forEach((p, i) => { p.posRank = i + 1 })
  }
  const recruited = await outlierIndex(players)
  const honored = await linkHonors(players)
  careerQuality(players)
  for (const p of players) p.oi = finalGrade(p)
  const collegeLinked = await linkCollege(players)
  for (const p of players) { p.cpct ??= null; p.cseasons = p.collegeRows?.length ?? 0 }

  // Season-by-season careers, sharded so a player page loads ~1/64 of them.
  await rm(`${OUT}/careers`, { recursive: true, force: true })
  await mkdir(`${OUT}/careers`, { recursive: true })
  const shards = Array.from({ length: SHARDS }, () => ({}))
  for (const p of players) {
    if (p.rows.length) shards[shardOf(p.id)][p.id] = p.rows.map(s => SEASON_COLS.map(c => s[c]))
  }
  await Promise.all(shards.map((s, i) => writeFile(`${OUT}/careers/${i}.json`, JSON.stringify(s))))
  await rm(`${OUT}/college`, { recursive: true, force: true })
  await mkdir(`${OUT}/college`, { recursive: true })
  const cshards = Array.from({ length: SHARDS }, () => ({}))
  for (const p of players) {
    if (p.collegeRows?.length) cshards[shardOf(p.id)][p.id] = p.collegeRows.map(s => COLLEGE_COLS.map(c => s[c]))
  }
  await Promise.all(cshards.map((s, i) => writeFile(`${OUT}/college/${i}.json`, JSON.stringify(s))))

  const fields = ['id', 'name', 'year', 'round', 'pick', 'team', 'pos', 'grp', 'college',
    'av', 'est', 'honors', 'exp', 'pct', 'peers', 'loyal', 'pb', 'ap', 'hof', 'starts', 'games', 'gs1',
    'played', 'seasons', 'to', 'active', 'young', 'classRank', 'posRank', 'dna', 'line',
    'preEra', 'oi', 'm1', 'm2', 'mult', 'ladder', 'q', 'qgrade', 'ap2', 'awards', 'honorPoints', 'rank', 'of', 'from', 'stars', 'rating', 'recRank', 'recPosRank', 'recPos', 'recYear', 'sDraftRate', 'sMedianPick', 'sValue', 'sExpected', 'cpct', 'cseasons']
  // Recruiting fields stay null when there is no link: null means "unknown", never 0.
  const round = (f, v) => (f === 'exp' ? Math.round(v * 10) / 10 : f === 'loyal' ? Math.round(v * 100) / 100 : f === 'q' || f === 'qgrade' ? Math.round(v * 1000) / 1000 : ['m1', 'm2', 'mult'].includes(f) ? (v == null ? null : Number(v.toPrecision(3))) : ['cpct', 'sDraftRate', 'sMedianPick', 'sValue', 'sExpected', 'recRank', 'recPosRank', 'recYear'].includes(f) ? v ?? null : v ?? 0)
  const rows = players.map(p => fields.map(f => round(f, p[f])))

  await writeFile(`${OUT}/players.json`, JSON.stringify({
    generated: new Date().toISOString(),
    source: BASE,
    lastSeason: LAST_SEASON,
    model: {
      bandwidths: BANDWIDTHS, minPeers: MIN_PEERS, firstClass: SCOPE_FROM, recruitingFrom: FIRST_CLASS, historyFrom: HISTORY_FROM, statsFrom: STATS_FROM, lastClass: LAST_CLASS,
      youngFrom: YOUNG_FROM, gradeCurve: GRADE_CURVE, earlyCap: EARLY_CAP, activeCap: ACTIVE_CAP, eliteTop: ELITE_TOP, eliteFrom: ELITE_FROM, qualityPower: QUALITY_POWER, seasonFraction: SEASON_FRACTION, lastJudgedClass: YOUNG_FROM - 1, shards: SHARDS,
      avModel: Object.fromEntries(Object.entries(models).map(([g, m]) => [g, { r2: m.r2, n: m.n }])),
    },
    seasonCols: SEASON_COLS,
    collegeCols: COLLEGE_COLS,
    collegeLinked,
    honorPoints: HONOR_POINTS,
    awardLabels: AWARD_LABEL,
    coverage: {
      startsFrom: { depthCharts: range(2001, 2024).filter(y => !snapSeasons.has(y)), snapCounts: [...snapSeasons].sort() },
      noStarts: [2000],
      noTargets: range(2003, 2008),
      advancedFrom: ADV_FROM,
      runStatsFrom: FIRST_CLASS,
      college: { offenseFrom: 2007, defenseFrom: COLLEGE_DEFENSE_FROM },
    },
    recruitingLinked: recruited,
    fields, rows,
  }))
  const und = players.filter(p => !p.pick).length
  console.log(`${players.length} players (${und} undrafted, ${recruited} linked to recruiting, ${collegeLinked} to college stats, ${honored} Pro Bowl spots matched) → ${OUT}`)
  console.log('AV model R²:', Object.entries(models).map(([g, m]) => `${g} ${m.r2}`).join(' · '))
}

// Same hash as the frontend (src/data.ts).
function shardOf(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return (h >>> 0) % SHARDS
}

main()
