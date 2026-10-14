export type Player = {
  id: string
  name: string
  year: number
  round: number
  pick: number
  team: string
  pos: string
  grp: Group
  college: string
  av: number
  exp: number
  pct: number
  peers: number
  est: number // 1 = career value estimated (undrafted)
  honors: number // 1 = Pro Bowl / All-Pro / HOF data available
  loyal: number // share of career value (or games) with first team
  pb: number
  ap: number
  hof: number
  starts: number
  games: number
  gs1: number // starts as a rookie
  played: number
  seasons: number
  to: number
  active: number
  young: number // 1 = early-career track (2022+ classes)
  classRank: number
  posRank: number
  dna: string
  line: string
  oi: number // Outlier Index, .01–.99
  gpct: number // stage 2: gap vs expectation, percentile within position (all eras)
  rank: number // place among core comparable players (1 = best)
  of: number
  from: 'recruit' | 'draft' | 'udfa' // the stage the index is measured from
  stars: number
  rating: number
  spct: number | null // stars → draft percentile
  cpct: number | null // college production percentile within position group
  cseasons: number
}

export type Group = 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'DB' | 'ST'
export const GROUPS: Group[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'ST']
export const GROUP_NAME: Record<Group, string> = {
  QB: 'Quarterbacks', RB: 'Running backs', WR: 'Receivers', TE: 'Tight ends',
  OL: 'Offensive line', DL: 'Defensive line', LB: 'Linebackers', DB: 'Defensive backs',
  ST: 'Specialists',
}

export type Dataset = {
  generated: string
  source: string
  lastSeason: number
  recruitingLinked: number
  model: {
    bandwidths: number[]; minPeers: number; lastJudgedClass: number; firstClass: number; lastClass: number
    youngFrom: number; journeyWeights: { draft: number; career: number }; earlyCap: number; seasonFraction: number; shards: number; avModel: Record<string, { r2: number; n: number }>
  }
  seasonCols: string[]
  collegeCols: string[]
  collegeLinked: number
  coverage: { startsFrom: { depthCharts: number[]; snapCounts: number[] }; noStarts: number[]; noTargets: number[]; advancedFrom: number; runStatsFrom: number; college: { offenseFrom: number; defenseFrom: number } }
  players: Player[]
  byId: Map<string, Player>
}

let cache: Promise<Dataset> | null = null

export function loadData(): Promise<Dataset> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/players.json`)
    .then(r => r.json())
    .then(raw => {
      const players: Player[] = raw.rows.map((r: unknown[]) =>
        Object.fromEntries(raw.fields.map((f: string, i: number) => [f, r[i]])))
      return { ...raw, players, byId: new Map(players.map(p => [p.id, p])) }
    })
  return cache
}

export const gap = (p: Player) => p.av - p.exp
export const lowConfidence = (p: Player, d: Dataset) => p.peers < d.model.minPeers

export const signed = (n: number, digits = 0) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export const oiLabel = (x: number) => x.toFixed(2).replace(/^0/, '')

export const pickLabel = (p: Player) => (p.pick ? `Rd ${p.round} · #${p.pick}` : 'Undrafted')
// Plain-language rank that separates careers sharing the .99 / .01 ceiling.
export const rankLabel = (p: Player) =>
  p.rank === 1 ? `No. 1 of ${p.of}` : p.rank === p.of ? `Last of ${p.of}` : `No. ${p.rank} of ${p.of}`
export const isExtreme = (p: Player) => p.oi >= 0.95 || p.oi <= 0.05

export const shortPick = (p: Player) => (p.pick ? `#${p.pick}` : 'UDFA')
export const yearsIn = (p: Player, d: Dataset) => Math.max(d.lastSeason - p.year + d.model.seasonFraction, 0.5)

// Season-by-season careers live in shards; a player page loads one.
export type Season = Record<string, number | string>
const shardCache = new Map<string, Promise<Record<string, (number | string)[][]>>>()
export function shardOf(id: string, shards: number) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return (h >>> 0) % shards
}
async function loadShard(dir: string, p: Player, d: Dataset, cols: string[]): Promise<Season[]> {
  const k = shardOf(p.id, d.model.shards)
  const key = `${dir}/${k}`
  if (!shardCache.has(key)) shardCache.set(key, fetch(`${import.meta.env.BASE_URL}data/${dir}/${k}.json`).then(r => r.json()))
  const rows = (await shardCache.get(key)!)[p.id] ?? []
  return rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])))
}
export const loadSeasons = (p: Player, d: Dataset) => loadShard('careers', p, d, d.seasonCols)
export const loadCollege = (p: Player, d: Dataset) => (p.cseasons ? loadShard('college', p, d, d.collegeCols) : Promise.resolve([]))

// Accolades for early careers: what a player has already done in a short window.
export function accolades(p: Player): string[] {
  const out: string[] = []
  if (p.ap) out.push(p.ap > 1 ? `${p.ap}× All-Pro already` : 'All-Pro already')
  if (p.pb) out.push(p.pb > 1 ? `${p.pb}× Pro Bowl already` : 'Pro Bowl already')
  if (p.classRank === 1) out.push(`No. 1 career value in the ${p.year} class`)
  else if (p.classRank <= 10) out.push(`Top 10 in the ${p.year} class`)
  if (p.posRank === 1) out.push(`Best ${p.grp} of the ${p.year} class so far`)
  else if (p.posRank <= 3) out.push(`Top 3 ${p.grp} of the ${p.year} class`)
  if (p.gs1 >= 8) out.push('Day-one starter')
  if ((p.pick >= 100 || !p.pick) && p.pct >= 90) out.push(p.pick ? 'Steal of the class' : 'Undrafted breakout')
  return out
}

export type Archetype = { name: string; rule: string; blurb: string; track?: 'drafted' | 'udfa' | 'young' }

export const ARCHETYPES: Archetype[] = [
  { name: 'Hall of Famer', rule: 'Inducted into the Pro Football Hall of Fame', blurb: 'Careers that ended in Canton.' },
  { name: 'Late-round legend', rule: 'Pick 100 or later, and 3+ Pro Bowls or a first-team All-Pro', blurb: 'Nobody saw it coming. They became stars anyway.' },
  { name: 'Blue-chip bust', rule: 'First-round pick who finished below 85% of comparable picks', blurb: 'Top of the board, bottom of the outcomes.' },
  { name: 'Hidden gem', rule: 'Pick 65 or later who beat 90%+ of comparable picks', blurb: 'Mid- and late-round picks who played like early ones.' },
  { name: 'Blue-chip star', rule: 'First-round pick with a first-team All-Pro or 4+ Pro Bowls', blurb: 'The rare case where the hype was right.' },
  { name: 'One-team cornerstone', rule: '10+ seasons and 85%+ of career value earned for the drafting team', blurb: 'Drafted, kept, built around.' },
  { name: 'Journeyman', rule: '9+ seasons with under 35% of value earned for the drafting team', blurb: 'Long careers, mostly somewhere else.' },
  { name: 'Bright flash', rule: 'A Pro Bowl inside a career of six seasons or fewer', blurb: 'Brilliant, briefly.' },
  { name: 'Never arrived', rule: 'Picked in rounds 1–3 and played fewer than 16 games', blurb: 'High picks whose careers barely started.' },
  { name: 'Outplayed the slot', rule: 'Beat 70%+ of comparable picks', blurb: 'Quietly better than the draft said.' },
  { name: 'Par for the slot', rule: 'Between the 30th and 70th percentile of comparable picks', blurb: 'Roughly what the draft predicted.' },
  { name: 'Fell short', rule: 'Below 30% of comparable picks', blurb: 'Less than the slot implied.' },
]

export const UNDRAFTED_ARCHETYPES: Archetype[] = [
  { name: 'Undrafted legend', rule: 'Undrafted, with 60+ career value', blurb: 'All 32 teams passed. They were wrong.', track: 'udfa' },
  { name: 'Undrafted gem', rule: 'Undrafted, beat 90%+ of undrafted peers, 15+ career value', blurb: 'Signed after the draft, stuck around, mattered.', track: 'udfa' },
  { name: 'Made the league', rule: 'Undrafted, 3+ seasons and 32+ games', blurb: 'Beat the odds just by lasting.', track: 'udfa' },
  { name: 'Cup of coffee', rule: 'Undrafted, played at least one game', blurb: 'Got on the field, briefly.', track: 'udfa' },
  { name: 'Never broke through', rule: 'Undrafted, never played a regular-season game', blurb: 'Reached a roster, never the field.', track: 'udfa' },
]

export const EARLY_ARCHETYPES: Archetype[] = [
  { name: 'Early star', rule: '2022+ class with a Pro Bowl or All-Pro already', blurb: 'Arrived and announced it.', track: 'young' },
  { name: 'Ahead of schedule', rule: '2022+ class, value pace beats 80%+ of comparable young players', blurb: 'Producing faster than their slot predicts.', track: 'young' },
  { name: 'On schedule', rule: '2022+ class, pace between the 30th and 80th percentile', blurb: 'Developing about as expected.', track: 'young' },
  { name: 'Slow start', rule: '2022+ class, pace below 30% of comparable young players', blurb: 'Behind the curve, for now.', track: 'young' },
  { name: 'Still waiting', rule: '2022+ class, fewer than 4 games played', blurb: 'The story hasn’t started yet.', track: 'young' },
]

export const ALL_ARCHETYPES: Archetype[] = [
  ...ARCHETYPES.map(a => ({ ...a, track: 'drafted' as const })), ...UNDRAFTED_ARCHETYPES, ...EARLY_ARCHETYPES,
]

// Career DNA — a small vector describing how a career unfolded, independent
// of era: where they were picked, how they did vs peers, how long, how high
// the peak, how often they started, and how much of it was for one team.
function dna(p: Player): number[] {
  const yrs = Math.max(p.seasons, 1)
  return [
    Math.log(p.pick || 300) / Math.log(260),
    p.pct / 100 * 1.5,
    Math.min(p.seasons, 18) / 18,
    Math.min(p.pb + 2 * p.ap, 14) / 14,
    Math.min(p.starts / yrs, 1) * 0.7,
    p.loyal * 0.5,
  ]
}

export function samePath(target: Player, all: Player[], n = 8, samePosition = true) {
  const t = dna(target)
  return all
    .filter(p => p !== target && (!samePosition || p.grp === target.grp) &&
      (target.young ? p.young === 1 : !p.active && !p.young))
    .map(p => {
      const v = dna(p)
      return { p, d: Math.sqrt(v.reduce((s, x, i) => s + (x - t[i]) ** 2, 0)) }
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
}

// Approximate peer set for display: same group and track, similar slot.
// Young players' values are scaled to this player's time in the league.
export function peersOf(target: Player, d: Dataset) {
  const w = target.young ? 99 : Math.max(0, Math.min(3, Math.floor((d.model.lastJudgedClass - target.year) / 2)))
  const lp = Math.log(target.pick || 1)
  return d.players
    .filter(p => p !== target && p.grp === target.grp && p.young === target.young &&
      Math.abs(p.year - target.year) <= w &&
      (target.pick ? p.pick > 0 && Math.abs(Math.log(p.pick) - lp) < 0.35 : !p.pick))
    .map(p => ({ p, v: target.young ? (p.av / yearsIn(p, d)) * yearsIn(target, d) : p.av }))
}

export function era(y: number) {
  return `${Math.floor(y / 10) * 10}s`
}
