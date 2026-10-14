import { useCallback, useMemo, useState } from 'react'
import { ARCHETYPES, gap, type Dataset } from '../data'
import Scatter from '../Scatter'
import { GapNum, OI, playerHref } from '../ui'

export default function PathsPage({ data, archetype }: { data: Dataset; archetype?: string }) {
  const sel = ARCHETYPES.find(a => a.name === archetype) ?? ARCHETYPES[1]
  const [n, setN] = useState(30)
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const p of data.players) c.set(p.dna, (c.get(p.dna) ?? 0) + 1)
    return c
  }, [data])
  const members = useMemo(
    () => data.players.filter(p => p.dna === sel.name).sort((a, b) => b.av - a.av),
    [data, sel],
  )
  const tone = useCallback((p: { dna: string }) => (p.dna === sel.name ? 'over' as const : null), [sel])
  const labels = useMemo(() => [...members].sort((a, b) => Math.abs(gap(b)) - Math.abs(gap(a))).slice(0, 3), [members])

  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <div className="kicker"><b>02</b> Career DNA</div>
      <h1 className="h1" style={{ marginTop: 16 }}>Careers have<br />shapes.</h1>
      <p className="lede" style={{ marginTop: 20 }}>
        Grouped by how a career unfolded, not by position or ranking. Every player belongs to exactly one path.
        On any player page you can find the people who walked the same road.
      </p>

      <div className="section" style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 3fr', gap: 48 }}>
        <nav className="paths">
          {ARCHETYPES.map(a => (
            <a key={a.name} href={`#/paths/${encodeURIComponent(a.name)}`} className={a === sel ? 'on' : ''}>
              <span>{a.name}</span>
              <span className="mono faint">{(counts.get(a.name) ?? 0).toLocaleString()}</span>
            </a>
          ))}
        </nav>
        <div>
          <h2 className="h1">{sel.name}</h2>
          <p className="h3 muted" style={{ marginTop: 12, fontWeight: 400 }}>{sel.blurb}</p>
          <p className="mono faint" style={{ fontSize: 11, marginTop: 8 }}>Rule: {sel.rule}. Rules are checked in order and the first match wins.</p>
          <div style={{ marginTop: 32 }}>
            <Scatter players={data.players} tone={tone} labels={labels} height={360} />
          </div>
          <table className="rows" style={{ marginTop: 32 }}>
            <thead><tr><th>Player</th><th className="hide-s">Drafted</th><th className="r hide-s">AV</th><th className="r">Gap</th><th className="r">OI</th></tr></thead>
            <tbody>
              {members.slice(0, n).map(p => (
                <tr key={p.id} className="link" onClick={() => (location.hash = playerHref(p).slice(1))}>
                  <td><div className="name">{p.name}</div><div className="sub mono">{p.pos} · {p.college}</div></td>
                  <td className="mono hide-s">{p.year} · #{p.pick}</td>
                  <td className="r num hide-s">{p.av}</td>
                  <td className="r"><GapNum p={p} /></td>
                  <td className="r"><OI value={p.oi} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {n < members.length && <button className="more" onClick={() => setN(n + 30)}>Show more</button>}
        </div>
      </div>
    </div>
  )
}
