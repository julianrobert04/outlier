import { useMemo, useState } from 'react'
import { ARCHETYPES, gap, GROUP_NAME, lowConfidence, oiLabel, ordinal, peersOf, samePath, signed, type Dataset, type Player } from '../data'
import { Chips, GapNum, OI, playerHref, useTip } from '../ui'

export default function PlayerPage({ data, id }: { data: Dataset; id: string }) {
  const p = data.byId.get(id)
  const [scope, setScope] = useState<'pos' | 'any'>('pos')
  const similar = useMemo(() => (p ? samePath(p, data.players, 8, scope === 'pos') : []), [p, data, scope])
  const peers = useMemo(() => (p ? peersOf(p, data.players) : []), [p, data])

  if (!p) return <div className="wrap loading">No player with id “{id}”.</div>

  const g = gap(p)
  const arche = ARCHETYPES.find(a => a.name === p.dna)
  const span = p.seasons ? `${p.year}–${p.active ? 'now' : p.to}` : 'never played'

  return (
    <article className="wrap" style={{ paddingTop: 56 }}>
      <div className="kicker">
        <a href="#/gap">Players</a> / {GROUP_NAME[p.grp]} / {p.college}
      </div>
      <h1 className="h1" style={{ marginTop: 16, maxWidth: '12ch' }}>{p.name}</h1>
      <div className="mono muted" style={{ fontSize: 13, marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
        <span>{p.pos}</span>
        <span>{p.year} draft · Rd {p.round}, #{p.pick} · {p.team}</span>
        <span>{span}</span>
        {p.hof ? <span className="over">Hall of Fame</span> : null}
        {p.active ? <span>active — still writing this story</span> : null}
      </div>

      {/* Verdict */}
      <section className="section" style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: 48 }} >
        <div>
          <div className="kicker">Outlier Index</div>
          <div className={`num ${p.oi >= 0.9 ? 'over' : p.oi <= 0.1 ? 'under' : ''}`}
            style={{ fontSize: 'clamp(110px, 16vw, 220px)', fontWeight: 700, lineHeight: 0.8, letterSpacing: '-0.06em', marginTop: 16 }}>
            {oiLabel(p.oi)}
          </div>
          <p className="muted" style={{ marginTop: 20, maxWidth: '34ch' }}>
            {verdict(p)}
          </p>
          <div className="mono faint" style={{ fontSize: 11, marginTop: 8 }}>
            measured from: {p.from === 'recruit' ? `${p.stars}-star recruit` : 'draft slot'}
            {lowConfidence(p, data) && <> · <span className="under">thin comparison group ({p.peers} peers)</span></>}
          </div>
        </div>
        <div>
          <div className="kicker">Expectation vs. reality</div>
          <div style={{ display: 'flex', gap: 40, marginTop: 16, flexWrap: 'wrap' }}>
            <Stat label="Expected career AV" value={p.exp.toFixed(1)} />
            <Stat label="Actual career AV" value={String(p.av)} />
            <Stat label="Gap" value={signed(g, 1)} tone={g >= 0 ? 'over' : 'under'} />
          </div>
          <Strip p={p} peers={peers} />
          <p className="mono faint" style={{ fontSize: 11 }}>
            Dots: {peers.length} {GROUP_NAME[p.grp].toLowerCase()} drafted near #{p.pick} in nearby classes.
            Outplayed {p.pct}% of comparable picks.
          </p>
        </div>
      </section>

      {/* Journey */}
      <section className="section">
        <div className="kicker" style={{ marginBottom: 24 }}>The journey</div>
        <ol className="journey">
          <Stage n="01" title="High school"
            main={p.from === 'recruit' ? `${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}` : '—'}
            sub={p.from === 'recruit' ? `247 composite ${p.rating.toFixed(4)}` : 'Recruiting rating not linked yet'} />
          <Stage n="02" title="College" main={p.college}
            sub={p.spct != null ? `Draft outcome beat ${Math.round(p.spct * 100)}% of same-star recruits` : 'Development measured by draft slot'} />
          <Stage n="03" title="Draft" main={`#${p.pick}`} sub={`${ordinal(p.round)} round · ${p.team} · ${p.year}`} />
          <Stage n="04" title="NFL career" main={`${p.av} AV`}
            sub={[
              p.seasons ? `${p.seasons} season${p.seasons > 1 ? 's' : ''}` : 'no games',
              p.pb ? `${p.pb}× Pro Bowl` : '',
              p.ap ? `${p.ap}× All-Pro` : '',
            ].filter(Boolean).join(' · ')} />
        </ol>
        <p className="mono faint" style={{ fontSize: 12, marginTop: 20 }}>{p.line} · {p.games} games · {p.starts} seasons as primary starter · {p.drav} AV with drafting team</p>
      </section>

      {/* DNA */}
      <section className="section">
        <div className="section-head">
          <div>
            <div className="kicker">Career DNA</div>
            <h2 className="h2" style={{ marginTop: 12 }}>
              <a href={`#/paths/${encodeURIComponent(p.dna)}`}>{p.dna} →</a>
            </h2>
            {arche && <p className="muted" style={{ marginTop: 8 }}>{arche.blurb}</p>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
            <p className="prose">Players whose careers had the same shape: drafted at a similar point, finishing at a similar distance from expectation, lasting about as long and peaking about as high. Only completed careers are shown, from any era.</p>
            <Chips value={scope} onChange={setScope} options={[['pos', `${p.grp} only`], ['any', 'Any position']]} />
          </div>
        </div>
        <table className="rows">
          <thead>
            <tr><th>Same path</th><th className="hide-s">Drafted</th><th className="hide-s">Path</th><th className="r">Gap</th><th className="r">OI</th></tr>
          </thead>
          <tbody>
            {similar.map(({ p: q }) => (
              <tr key={q.id} className="link" onClick={() => (location.hash = playerHref(q).slice(1))}>
                <td><div className="name">{q.name}</div><div className="sub mono">{q.pos} · {q.college}</div></td>
                <td className="mono hide-s">{q.year} · #{q.pick}</td>
                <td className="hide-s muted">{q.dna}</td>
                <td className="r"><GapNum p={q} /></td>
                <td className="r"><OI value={q.oi} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  )
}

function verdict(p: Player) {
  const pct = p.pct
  if (!p.games) return `Drafted #${p.pick}, never played an NFL game.`
  if (pct >= 99) return `One of the most improbable careers at this slot. Outplayed virtually every comparable pick.`
  if (pct >= 85) return `Became far more than a #${p.pick} pick usually becomes.`
  if (pct >= 60) return `Beat the draft’s prediction.`
  if (pct >= 40) return `Roughly what a #${p.pick} pick is expected to become.`
  if (pct >= 15) return `Fell short of what this slot usually produces.`
  return `Among the furthest falls from expectation at this slot.`
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'over' | 'under' }) {
  return (
    <div>
      <div className={`num ${tone ?? ''}`} style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</div>
      <div className="mono faint" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>{label}</div>
    </div>
  )
}

function Stage({ n, title, main, sub }: { n: string; title: string; main: string; sub: string }) {
  return (
    <li>
      <span className="mono faint" style={{ fontSize: 11 }}>{n} · {title}</span>
      <span className="journey-main">{main}</span>
      <span className="faint" style={{ fontSize: 12 }}>{sub}</span>
    </li>
  )
}

// A one-dimensional strip: every comparable pick's career value as a dot,
// with the expectation marked and this player ringed.
function Strip({ p, peers }: { p: Player; peers: Player[] }) {
  const { tip, setTip } = useTip()
  const max = Math.max(p.av, p.exp, ...peers.map(q => q.av), 10) * 1.05
  const X = (v: number) => `${(v / max) * 100}%`
  return (
    <div style={{ position: 'relative', height: 96, margin: '32px 0 12px' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 48, borderTop: '1px solid var(--rule)' }} />
      {peers.map((q, i) => (
        <a key={q.id} href={playerHref(q)}
          onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, body: <><b>{q.name}</b><span className="mono">{q.year} · #{q.pick} · {q.av} AV</span></> })}
          onMouseLeave={() => setTip(null)}
          style={{
            position: 'absolute', left: X(q.av), top: 48 + ((i * 37) % 30) - 15, width: 8, height: 8, marginLeft: -4, marginTop: -4,
            borderRadius: '50%', background: 'var(--dot)', outline: '6px solid transparent',
          }} />
      ))}
      <div style={{ position: 'absolute', left: X(p.exp), top: 14, bottom: 14, borderLeft: '2px dashed var(--ink-2)' }} />
      <div className="mono faint" style={{ position: 'absolute', left: X(p.exp), top: -6, fontSize: 10, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>expected</div>
      <div style={{
        position: 'absolute', left: X(p.av), top: 48, width: 18, height: 18, marginLeft: -9, marginTop: -9, borderRadius: '50%',
        background: gap(p) >= 0 ? 'var(--over)' : 'var(--under)', boxShadow: '0 0 0 3px var(--paper)',
      }} />
      <div className="mono" style={{ position: 'absolute', left: X(p.av), bottom: -8, fontSize: 10, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontWeight: 700 }}>{p.name.split(' ').slice(-1)[0]}</div>
      <div className="mono faint" style={{ position: 'absolute', left: 0, bottom: -8, fontSize: 10 }}>0 AV</div>
      {tip}
    </div>
  )
}
