import { useMemo, useState } from 'react'
import { gap, GROUPS, signed, type Dataset, type Group } from '../data'
import { Chips, GapNum, OI, playerHref, useTip } from '../ui'

const SHRINK = 15 // pseudo-players at zero gap: small samples are pulled toward average

export default function LabPage({ data, college }: { data: Dataset; college?: string }) {
  const [grp, setGrp] = useState<Group | 'ALL'>('ALL')
  const [since, setSince] = useState(2000)
  const [minN, setMinN] = useState(25)
  const { tip, setTip } = useTip()

  const rows = useMemo(() => {
    const by = new Map<string, number[]>()
    for (const p of data.players) {
      if (p.young || !p.college || p.year < since || (grp !== 'ALL' && p.grp !== grp)) continue
      by.set(p.college, [...(by.get(p.college) ?? []), gap(p)])
    }
    return [...by.entries()]
      .filter(([, g]) => g.length >= minN)
      .map(([name, g]) => {
        const n = g.length
        const mean = g.reduce((s, x) => s + x, 0) / n
        const sd = Math.sqrt(g.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(n - 1, 1))
        const se = sd / Math.sqrt(n)
        return { name, n, mean, lo: mean - 1.96 * se, hi: mean + 1.96 * se, score: (mean * n) / (n + SHRINK), beat: g.filter(x => x > 0).length / n }
      })
      .sort((a, b) => b.score - a.score)
  }, [data, grp, since, minN])

  const scale = Math.max(...rows.map(r => Math.max(Math.abs(r.lo), Math.abs(r.hi))), 1)
  const X = (v: number) => `${50 + (v / scale) * 50}%`
  const focus = college ? data.players.filter(p => !p.young && p.college === college && p.year >= since && (grp === 'ALL' || p.grp === grp)).sort((a, b) => gap(b) - gap(a)) : []

  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <div className="kicker"><b>03</b> Development Lab</div>
      <h1 className="h1" style={{ marginTop: 16 }}>Who sends players<br />who outplay the slot?</h1>
      <p className="lede" style={{ marginTop: 20 }}>
        Counting NFL players rewards schools that sign the most talent. This asks a fairer question:
        once the draft has priced a player in (or passed on him), do that school’s alumni beat the price?
      </p>

      <div className="section" style={{ marginTop: 48 }}>
        <div className="controls">
          <Chips value={grp} onChange={setGrp} label="Position" options={['ALL', ...GROUPS] as (Group | 'ALL')[]} />
          <Chips value={since} onChange={setSince} label="Drafted since" options={[2000, 2005, 2010, 2015]} />
          <Chips value={minN} onChange={setMinN} label="Min. players" options={[10, 25, 50]} />
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16, maxWidth: '80ch' }}>
          Ranked by average gap per player, pulled toward zero for small samples. Whiskers show a 95% interval.
          When a whisker crosses the center line, the school isn’t clearly different from average.
        </p>

        <table className="rows">
          <thead><tr><th>#</th><th>College</th><th className="r">Players</th><th className="r hide-s">Beat slot</th><th style={{ width: '38%' }} className="hide-s">Avg. gap per player (95% CI)</th><th className="r">Avg.</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className="link" onClick={() => (location.hash = `/lab/${encodeURIComponent(r.name)}`)}
                style={r.name === college ? { background: 'var(--paper-2)' } : undefined}>
                <td className="rank">{i + 1}</td>
                <td className="name">{r.name}</td>
                <td className="r num">{r.n}</td>
                <td className="r num hide-s">{Math.round(r.beat * 100)}%</td>
                <td className="hide-s"
                  onMouseMove={e => setTip({ x: e.clientX, y: e.clientY, body: <><b>{r.name}</b><span className="mono">avg {signed(r.mean, 1)} AV · CI {signed(r.lo, 1)} to {signed(r.hi, 1)}</span></> })}
                  onMouseLeave={() => setTip(null)}>
                  <div style={{ position: 'relative', height: 18 }}>
                    <div style={{ position: 'absolute', left: '50%', top: -6, bottom: -6, borderLeft: '1px solid var(--ink-3)' }} />
                    <div style={{ position: 'absolute', left: X(r.lo), width: `calc(${X(r.hi)} - ${X(r.lo)})`, top: 8, borderTop: '2px solid var(--ink-3)' }} />
                    <div style={{
                      position: 'absolute', left: X(r.mean), top: 4, width: 10, height: 10, marginLeft: -5, borderRadius: '50%',
                      background: r.lo > 0 ? 'var(--over)' : r.hi < 0 ? 'var(--under)' : 'var(--ink-2)', boxShadow: '0 0 0 2px var(--paper)',
                    }} />
                  </div>
                </td>
                <td className={`r num ${r.mean >= 0 ? 'over' : 'under'}`}>{signed(r.mean, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tip}
      </div>

      {college && (
        <div className="section" id="college">
          <div className="kicker">Player-level evidence</div>
          <h2 className="h1" style={{ marginTop: 12 }}>{college}</h2>
          <p className="muted" style={{ marginTop: 8 }}>{focus.length} players drafted since {since}. Every one of them counts toward the number above.</p>
          <table className="rows" style={{ marginTop: 24 }}>
            <thead><tr><th>Player</th><th className="hide-s">Drafted</th><th className="r hide-s">Expected</th><th className="r hide-s">Actual</th><th className="r">Gap</th><th className="r">OI</th></tr></thead>
            <tbody>
              {focus.map(p => (
                <tr key={p.id} className="link" onClick={() => (location.hash = playerHref(p).slice(1))}>
                  <td><div className="name">{p.name}</div><div className="sub mono">{p.pos}</div></td>
                  <td className="mono hide-s">{p.year} · {p.pick ? `#${p.pick}` : 'UDFA'}</td>
                  <td className="r num hide-s faint">{p.exp.toFixed(1)}</td>
                  <td className="r num hide-s">{p.av}{p.est ? '*' : ''}</td>
                  <td className="r"><GapNum p={p} /></td>
                  <td className="r"><OI value={p.oi} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
