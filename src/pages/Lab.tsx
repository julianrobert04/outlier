import { useEffect, useMemo } from 'react'
import { gap, GROUPS, oiLabel, pickScore, signed, type Dataset, type Group, type Player } from '../data'
import { Chips, currentQuery, GapNum, OI, playerHref, useQueryState, useTip } from '../ui'

const SHRINK = 15 // pseudo-players at the overall average: small samples are pulled toward it

export default function LabPage({ data, college }: { data: Dataset; college?: string }) {
  const [grp, setGrp] = useQueryState<Group | 'ALL'>('grp', 'ALL')
  const [since, setSince] = useQueryState<number>('since', 1995)
  const [minN, setMinN] = useQueryState<number>('min', 25)
  const { tip, setTip } = useTip()
  useEffect(() => { if (college) document.getElementById('college')?.scrollIntoView() }, [college])

  const rows = useMemo(() => {
    const by = new Map<string, Player[]>()
    for (const p of data.players) {
      if (p.young || !p.college || p.year < since || (grp !== 'ALL' && p.grp !== grp)) continue
      by.set(p.college, [...(by.get(p.college) ?? []), p])
    }
    const pool = [...by.values()].flat()
    const avg = pool.reduce((s, p) => s + pickScore(p), 0) / Math.max(pool.length, 1)
    return [...by.entries()]
      .filter(([, ps]) => ps.length >= minN)
      .map(([name, ps]) => {
        // Each player's vs. pick score, centered on the overall average.
        const g = ps.map(p => pickScore(p) - avg)
        // Name the player carrying the score when one career is most of it.
        const top = ps.reduce((a, b) => (gap(b) > gap(a) ? b : a))
        const total = g.reduce((s, x) => s + x, 0)
        // One player lifts the school's average by .02 or more on his own.
        const driver = total > 0 && (pickScore(top) - avg) / ps.length >= 0.02 && pickScore(top) - avg > total * 0.5 ? `${top.name} (${oiLabel(pickScore(top))})` : ''
        const n = g.length
        const mean = g.reduce((s, x) => s + x, 0) / n
        const sd = Math.sqrt(g.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(n - 1, 1))
        const se = sd / Math.sqrt(n)
        return { name, driver, n, mean, lo: mean - 1.96 * se, hi: mean + 1.96 * se, avg: avg + mean, score: (mean * n) / (n + SHRINK), beat: ps.filter(p => pickScore(p) >= 0.5).length / n }
      })
      .sort((a, b) => b.score - a.score)
  }, [data, grp, since, minN])

  const scale = Math.max(...rows.map(r => Math.max(Math.abs(r.lo), Math.abs(r.hi))), 0.01)
  const X = (v: number) => `${50 + (v / scale) * 50}%`
  const focus = college ? data.players.filter(p => !p.young && p.college === college && p.year >= since && (grp === 'ALL' || p.grp === grp)).sort((a, b) => pickScore(b) - pickScore(a) || gap(b) - gap(a)) : []

  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <h1 className="h1">Whose players<br />beat their pick?</h1>
      <p className="lede" style={{ marginTop: 20 }}>
        Big schools send the most players to the NFL because they recruit the best players. So we ask a fairer question:
        do a school’s players go well past where they were drafted? Only real gains count: a player who just matched a low pick doesn’t lift his school.
      </p>

      <div className="section" style={{ marginTop: 48 }}>
        <div className="controls">
          <Chips value={grp} onChange={setGrp} label="Position" options={['ALL', ...GROUPS] as (Group | 'ALL')[]} />
          <Chips value={since} onChange={setSince} label="Drafted since" options={[1995, 2000, 2005, 2010]} />
          <Chips value={minN} onChange={setMinN} label="Min. players" options={[10, 25, 50]} />
        </div>
        <dl className="lab-key">
          <div><dt>Vs. pick score</dt><dd>Each player gets .01–.99 for how far his career, judged by his stats, went past what his draft pick usually produces. Matching the usual is .30; a bust is near .01. The school’s number is its players’ average.</dd></div>
          <div><dt>Clearly beat their pick</dt><dd>Share of the school’s players who scored .50 or more. 20% means 1 in 5.</dd></div>
          <div><dt>The line</dt><dd>
            <span className="key-dot" style={{ background: 'var(--over)' }} /> clearly above the average school ·{' '}
            <span className="key-dot" style={{ background: 'var(--under)' }} /> clearly worse ·{' '}
            <span className="key-dot" style={{ background: 'var(--ink-2)' }} /> about average, or not enough data. A longer line means less certain.
          </dd></div>
        </dl>

        <table className="rows">
          <thead><tr><th>#</th><th>College</th><th className="r">Players</th><th className="r hide-s">Clearly beat their pick</th><th style={{ width: '38%' }} className="hide-s">Better or worse than their pick</th><th className="r">Vs. pick score</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className="link" onClick={() => (location.hash = `/lab/${encodeURIComponent(r.name)}${currentQuery()}`)}
                style={r.name === college ? { background: 'var(--paper-2)' } : undefined}>
                <td className="rank">{i + 1}</td>
                <td className="name"><a href={`#/lab/${encodeURIComponent(r.name)}${currentQuery()}`} onClick={e => e.stopPropagation()}>{r.name}</a>{r.driver && <div className="note">led by {r.driver}</div>}</td>
                <td className="r num">{r.n}</td>
                <td className="r num hide-s">{Math.round(r.beat * 100)}%</td>
                <td className="hide-s"
                  onMouseMove={e => setTip({ x: e.clientX, y: e.clientY, body: <><b>{r.name}</b><span className="mono">avg {oiLabel(r.avg)} · {signed(r.mean * 100, 0)} vs. the average school (pts)</span></> })}
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
                <td className={`r num ${r.lo > 0 ? 'over' : r.hi < 0 ? 'under' : ''}`}>{oiLabel(r.avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tip}
      </div>

      {college && (
        <div className="section" id="college">
          <h2 className="h1">{college}</h2>
          <p className="muted" style={{ marginTop: 8 }}>{focus.length} players drafted since {since}. Every one of them counts toward the number above.</p>
          <table className="rows" style={{ marginTop: 24 }}>
            <thead><tr><th>Player</th><th className="hide-s">Drafted</th><th className="r hide-s">Usual</th><th className="r hide-s">His</th><th className="r hide-s">Diff.</th><th className="r">Vs. pick</th><th className="r">OI</th></tr></thead>
            <tbody>
              {focus.map(p => (
                <tr key={p.id} className="link" onClick={() => (location.hash = playerHref(p).slice(1))}>
                  <td><div className="name"><a href={playerHref(p)} onClick={e => e.stopPropagation()}>{p.name}</a></div><div className="sub mono">{p.pos}</div></td>
                  <td className="mono hide-s">{p.year} · {p.pick ? `#${p.pick}` : 'UDFA'}</td>
                  <td className="r num hide-s faint">{p.exp.toFixed(1)}</td>
                  <td className="r num hide-s">{p.av}{p.est ? '*' : ''}</td>
                  <td className="r hide-s"><GapNum p={p} /></td>
                  <td className="r num">{oiLabel(pickScore(p))}</td>
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
