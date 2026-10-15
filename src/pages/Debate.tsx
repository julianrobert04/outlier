import { useMemo, useState } from 'react'
import { GROUPS, GROUP_NAME, type Dataset, type Group, type Player } from '../data'
import { Chips, useTip } from '../ui'

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Spearman rank correlation, average ranks for ties.
function spearman(a: number[], b: number[]) {
  const rank = (xs: number[]) => {
    const idx = xs.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0])
    const r = new Array(xs.length)
    for (let i = 0; i < idx.length;) {
      let j = i
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2
      i = j + 1
    }
    return r as number[]
  }
  const ra = rank(a), rb = rank(b), n = a.length
  const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2 }
  return num / Math.sqrt(da * db)
}

export default function DebatePage({ data }: { data: Dataset }) {
  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <h1 className="h1">Football’s<br />uncomfortable questions.</h1>
      <p className="lede" style={{ marginTop: 20 }}>
        Every argument becomes something you can test. Change the filters and build your own answer.
        Every number links back to the players behind it.
      </p>
      <RoundsQuestion data={data} />
      <RiskQuestion data={data} />
      <SmarterQuestion data={data} />
      <CollegeQuestion data={data} />
    </div>
  )
}

function Question({ n, q, answer, children }: { n: string; q: string; answer: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="section" style={{ marginTop: 48 }}>
      <div className="section-head">
        <div>
          <h2 className="h2" id={`q${n}`}>{q}</h2>
        </div>
        <div className="h3" style={{ fontWeight: 400, fontSize: 20, maxWidth: '44ch' }}>{answer}</div>
      </div>
      {children}
    </section>
  )
}

const FULL_CAREER_CUTOFF = 2016 // classes with careers essentially complete

function RoundsQuestion({ data }: { data: Dataset }) {
  const [grp, setGrp] = useState<Group | 'ALL'>('ALL')
  const pool = useMemo(() => data.players.filter(p => p.year <= FULL_CAREER_CUTOFF && p.round >= 1 && p.round <= 7 && (grp === 'ALL' || p.grp === grp)), [data, grp])
  const r1 = pool.filter(p => p.round === 1), r2 = pool.filter(p => p.round === 2)
  const m1 = median(r1.map(p => p.av))
  const share = r2.filter(p => p.av > m1).length / Math.max(r2.length, 1)
  const bars = [1, 2, 3, 4, 5, 6, 7].map(r => {
    const xs = pool.filter(p => p.round === r).map(p => p.av)
    return { label: `Rd ${r}`, value: median(xs), n: xs.length }
  })
  return (
    <Question n="01" q="Are first-round picks really better than second-rounders?"
      answer={<>Usually. But <span className="num over">{Math.round(share * 100)}%</span> of second-rounders out-produced the typical first-rounder ({m1} career AV){grp !== 'ALL' && <> among {GROUP_NAME[grp].toLowerCase()}</>}.</>}>
      <div className="controls"><Chips value={grp} onChange={setGrp} label="Position" options={['ALL', ...GROUPS] as (Group | 'ALL')[]} /></div>
      <Bars bars={bars} unit="median career AV" />
      <p className="mono faint" style={{ fontSize: 12, marginTop: 12 }}>Draft classes {data.model.firstClass}–{FULL_CAREER_CUTOFF} ({pool.length.toLocaleString()} players), so careers are essentially complete.</p>
    </Question>
  )
}

function RiskQuestion({ data }: { data: Dataset }) {
  const [since, setSince] = useState(1985)
  const first = data.players.filter(p => p.round === 1 && p.year >= since && p.year <= data.model.lastJudgedClass && p.grp !== 'ST')
  const bars = GROUPS.filter(g => g !== 'ST').map(g => {
    const xs = first.filter(p => p.grp === g)
    return { label: g, value: Math.round((100 * xs.filter(p => p.pct < 15).length) / Math.max(xs.length, 1)), n: xs.length }
  }).sort((a, b) => b.value - a.value)
  const worst = bars[0], best = bars[bars.length - 1]
  return (
    <Question n="02" q="Which position is the riskiest first-round pick?"
      answer={<><span className="num under">{worst.value}%</span> of first-round {GROUP_NAME[worst.label as Group].toLowerCase()} became busts, against <span className="num">{best.value}%</span> of {GROUP_NAME[best.label as Group].toLowerCase()}.</>}>
      <div className="controls"><Chips value={since} onChange={setSince} label="Drafted since" options={[1985, 1995, 2005, 2015]} /></div>
      <Bars bars={bars} unit="% of 1st-rounders who finished below 85% of comparable picks" suffix="%" tone="under" />
      <p className="mono faint" style={{ fontSize: 12, marginTop: 12 }}>A bust here is a first-round pick who finished below 85% of comparable picks at the same position and era.</p>
    </Question>
  )
}

function SmarterQuestion({ data }: { data: Dataset }) {
  const { tip, setTip } = useTip()
  const series = useMemo(() => {
    const out: { year: number; rho: number }[] = []
    for (let y = data.model.firstClass; y <= data.model.lastJudgedClass; y++) {
      const c = data.players.filter((p: Player) => p.year === y && p.pick > 0)
      if (c.length > 50) out.push({ year: y, rho: -spearman(c.map(p => p.pick), c.map(p => p.av)) })
    }
    return out
  }, [data])
  const early = series.filter(s => s.year <= 1994), late = series.filter(s => s.year >= 2008 && s.year <= 2017)
  const avg = (xs: { rho: number }[]) => xs.reduce((s, x) => s + x.rho, 0) / xs.length
  const W = 900, H = 260, P = { l: 40, r: 16, t: 16, b: 28 }
  const x = (y: number) => P.l + ((y - series[0].year) / (series[series.length - 1].year - series[0].year)) * (W - P.l - P.r)
  const yv = (v: number) => P.t + (1 - v / 0.6) * (H - P.t - P.b)
  const path = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.year)},${yv(s.rho)}`).join('')
  return (
    <Question n="03" q="Is the NFL getting better at drafting?"
      answer={<>{verdict(avg(late) - avg(early))} The link between draft order and career value went from <span className="num">{avg(early).toFixed(2)}</span> for 1985–94 to <span className="num">{avg(late).toFixed(2)}</span> for 2008–17.</>}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Rank correlation between draft order and career value, by draft class"
        onMouseLeave={() => setTip(null)}>
        {[0, 0.2, 0.4, 0.6].map(v => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={yv(v)} y2={yv(v)} stroke="var(--rule)" />
            <text x={P.l - 8} y={yv(v) + 3} textAnchor="end" fontSize="10" fill="var(--ink-3)" fontFamily="var(--mono)">{v.toFixed(1)}</text>
          </g>
        ))}
        {series.filter(s => s.year % 5 === 0).map(s => (
          <text key={s.year} x={x(s.year)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-3)" fontFamily="var(--mono)">{s.year}</text>
        ))}
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
        {series.map(s => (
          <g key={s.year}>
            <circle cx={x(s.year)} cy={yv(s.rho)} r={s.year > 2016 ? 3 : 0} fill="var(--paper)" stroke="var(--ink-3)" />
            <rect x={x(s.year) - 9} y={P.t} width={18} height={H - P.t - P.b} fill="transparent"
              onMouseMove={e => setTip({ x: e.clientX, y: e.clientY, body: <><b>{s.year} draft</b><span className="mono">rank correlation {s.rho.toFixed(2)}{s.year > 2016 ? ' · careers still young' : ''}</span></> })} />
          </g>
        ))}
      </svg>
      {tip}
      <p className="mono faint" style={{ fontSize: 12, marginTop: 12 }}>Spearman rank correlation between draft order and career AV within each class (1 = perfectly ordered). Hollow points: careers still young.</p>
    </Question>
  )
}

function CollegeQuestion({ data }: { data: Dataset }) {
  const [grp, setGrp] = useState<Group>('QB')
  const groups = GROUPS.filter(g => g !== 'OL' && g !== 'ST')
  const pool = data.players.filter(p => p.grp === grp && p.pick > 0 && !p.young && p.cpct != null)
  const tiers = [['Bottom quarter', 0, 0.25], ['Second', 0.25, 0.5], ['Third', 0.5, 0.75], ['Top quarter', 0.75, 1.01]] as const
  const bars = tiers.map(([label, lo, hi]) => {
    const xs = pool.filter(p => p.cpct! >= lo && p.cpct! < hi)
    return { label, value: Math.round((100 * xs.filter(p => p.pct >= 50).length) / Math.max(xs.length, 1)), n: xs.length }
  })
  const spread = bars[3].value - bars[0].value
  return (
    <Question n="04" q="Does college production predict an NFL career?"
      answer={<>{Math.abs(spread) < 8 ? 'Barely.' : spread > 0 ? 'Yes, even after the draft prices it in.' : 'No. If anything, the opposite.'}{' '}
        Among drafted {GROUP_NAME[grp].toLowerCase()}, <span className="num">{bars[3].value}%</span> of the most productive college players beat their draft slot,
        against <span className="num">{bars[0].value}%</span> of the least productive.</>}>
      <div className="controls"><Chips value={grp} onChange={setGrp} label="Position" options={groups} /></div>
      <Bars bars={bars} unit="% who beat their draft slot, by college production" suffix="%" />
      <p className="meta" style={{ marginTop: 12 }}>
        {pool.length.toLocaleString()} drafted players with linked college stats (classes through {data.model.lastJudgedClass}). Production is the
        player’s career college output against every NFL player at the position; defense counts only {data.coverage.college.defenseFrom}+ college seasons.
        Because the draft slot already reflects college production, this asks whether teams under- or over-value it.
      </p>
    </Question>
  )
}

function verdict(diff: number) {
  if (diff > 0.08) return 'Yes, noticeably.'
  if (diff > 0.02) return 'A little.'
  if (diff >= -0.02) return 'Not really.'
  return 'No. If anything, it got worse.'
}

function Bars({ bars, unit, suffix = '', tone }: { bars: { label: string; value: number; n: number }[]; unit: string; suffix?: string; tone?: 'under' }) {
  const { tip, setTip } = useTip()
  const max = Math.max(...bars.map(b => b.value), 1)
  return (
    <div>
      <div className="mono faint" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{unit}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bars.length}, 1fr)`, gap: 2, alignItems: 'end', height: 220, borderBottom: '1px solid var(--ink)' }}>
        {bars.map((b, i) => (
          <div key={b.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', height: '100%', cursor: 'default' }}
            onMouseMove={e => setTip({ x: e.clientX, y: e.clientY, body: <><b>{b.label}</b><span className="mono">{b.value}{suffix} · {b.n} players</span></> })}
            onMouseLeave={() => setTip(null)}>
            <span className="num" style={{ fontSize: 13, textAlign: 'center', marginBottom: 6 }}>{b.value}{suffix}</span>
            <div style={{
              height: `${(b.value / max) * 85}%`, borderRadius: '4px 4px 0 0',
              background: tone && i === 0 ? 'var(--under)' : 'var(--ink)', opacity: tone && i !== 0 ? 0.85 : 1,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bars.length}, 1fr)`, gap: 2, marginTop: 8 }}>
        {bars.map(b => <span key={b.label} className="mono faint" style={{ fontSize: 12, textAlign: 'center' }}>{b.label}</span>)}
      </div>
      {tip}
    </div>
  )
}
