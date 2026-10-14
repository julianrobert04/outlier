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
  drav: number
  pb: number
  ap: number
  hof: number
  starts: number
  games: number
  seasons: number
  to: number
  active: number
  dna: string
  line: string
  oi: number // Outlier Index, .01–.99
  from: 'recruit' | 'draft' // the stage the index is measured from
  stars: number
  rating: number
  spct: number | null // stars → draft percentile
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
  model: { bandwidths: number[]; minPeers: number; lastJudgedClass: number }
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

export const pickLabel = (p: Player) => `Rd ${p.round} · #${p.pick}`

export const ARCHETYPES: { name: string; rule: string; blurb: string }[] = [
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

// Career DNA — a small vector describing how a career unfolded, independent
// of era: where they were picked, how they did vs peers, how long, how high
// the peak, how often they started, and how much of it was for one team.
function dna(p: Player): number[] {
  const yrs = Math.max(p.seasons, 1)
  return [
    Math.log(p.pick) / Math.log(260),
    p.pct / 100 * 1.5,
    Math.min(p.seasons, 18) / 18,
    Math.min(p.pb + 2 * p.ap, 14) / 14,
    Math.min(p.starts / yrs, 1) * 0.7,
    (p.av > 0 ? Math.min(p.drav / p.av, 1) : 0) * 0.5,
  ]
}

export function samePath(target: Player, all: Player[], n = 8, samePosition = true) {
  const t = dna(target)
  return all
    .filter(p => p !== target && (!samePosition || p.grp === target.grp) && !p.active)
    .map(p => {
      const v = dna(p)
      return { p, d: Math.sqrt(v.reduce((s, x, i) => s + (x - t[i]) ** 2, 0)) }
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
}

// Approximate peer set for display: same group, same window, similar pick.
export function peersOf(target: Player, all: Player[]) {
  const w = Math.max(0, Math.min(3, Math.floor((2025 - target.year - 3) / 2)))
  const lp = Math.log(target.pick)
  return all.filter(p => p !== target && p.grp === target.grp &&
    Math.abs(p.year - target.year) <= w && Math.abs(Math.log(p.pick) - lp) < 0.35)
}

export function era(y: number) {
  return `${Math.floor(y / 10) * 10}s`
}
