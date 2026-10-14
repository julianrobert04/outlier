import { useCallback, useMemo, useState } from 'react'
import { ALL_ARCHETYPES, gap, shortPick, type Dataset } from '../data'
import Scatter from '../Scatter'
import { GapNum, OI, playerHref } from '../ui'

export default function PathsPage({ data, archetype }: { data: Dataset; archetype?: string }) {
  const sel = ALL_ARCHETYPES.find(a => a.name === archetype) ?? ALL_ARCHETYPES[1]
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
  const pool = useMemo(() => data.players.filter(p => (sel.track === 'young' ? p.young : !p.young) && (p.games > 0 || p.pick > 0)), [data, sel])
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
          {([['drafted', 'Drafted · completed or long careers'], ['udfa', 'Undrafted'], ['young', 'Early careers · 2022+']] as const).map(([track, title]) => (
            <div key={track}>
              <div className="kicker" style={{ padding: '18px 0 6px' }}>{title}</div>
              {ALL_ARCHETYPES.filter(a => a.track === track).map(a => (
                <a key={a.name} href={`#/paths/${encodeURIComponent(a.name)}`} className={a === sel ? 'on' : ''}>
                  <span>{a.name}</span>
                  <span className="mono faint">{(counts.get(a.name) ?? 0).toLocaleString()}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div>
          <h2 className="h1">{sel.name}</h2>
          <p className="h3 muted" style={{ marginTop: 12, fontWeight: 400 }}>{sel.blurb}</p>
          <p className="mono faint" style={{ fontSize: 11, marginTop: 8 }}>Rule: {sel.rule}. Rules are checked in order and the first match wins.</p>
          <div style={{ marginTop: 32 }}>
            <Scatter players={pool} tone={tone} labels={labels} height={360} />
          </div>
          <table className="rows" style={{ marginTop: 32 }}>
            <thead><tr><th>Player</th><th className="hide-s">Drafted</th><th className="r hide-s">AV</th><th className="r">Gap</th><th className="r">OI</th></tr></thead>
            <tbody>
              {members.slice(0, n).map(p => (
                <tr key={p.id} className="link" onClick={() => (location.hash = playerHref(p).slice(1))}>
                  <td><div className="name">{p.name}</div><div className="sub mono">{p.pos} · {p.college}</div></td>
                  <td className="mono hide-s">{p.year} · {shortPick(p)}</td>
                  <td className="r num hide-s">{p.av}{p.est ? '*' : ''}</td>
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
