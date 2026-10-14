import { useEffect, useMemo, useState } from 'react'
import {
  accolades, ALL_ARCHETYPES, gap, isExtreme, rankLabel, GROUP_NAME, loadSeasons, lowConfidence, oiLabel, ordinal, peersOf, samePath,
  shortPick, signed, yearsIn, type Dataset, type Group, type Player, type Season,
} from '../data'
import { Chips, GapNum, OI, playerHref, useTip } from '../ui'

export default function PlayerPage({ data, id }: { data: Dataset; id: string }) {
  const p = data.byId.get(id)
  const [scope, setScope] = useState<'pos' | 'any'>('pos')
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const similar = useMemo(() => (p ? samePath(p, data.players, 8, scope === 'pos') : []), [p, data, scope])
  const peers = useMemo(() => (p ? peersOf(p, data) : []), [p, data])
  useEffect(() => { if (p) loadSeasons(p, data).then(setSeasons) }, [p, data])

  if (!p) {
    return (
      <div className="wrap loading">
        <span>No player with the id “{id}”. The link may be out of date.</span>
        <a href="#/players" style={{ textDecoration: 'underline' }}>Search all players →</a>
      </div>
    )
  }

  const g = gap(p)
  const arche = ALL_ARCHETYPES.find(a => a.name === p.dna)
  const span = p.seasons ? `${p.year}–${p.active ? 'now' : p.to}` : 'never played a regular-season game'
  const yrs = yearsIn(p, data)
  const badges = p.young ? accolades(p) : []
  const comparedTo = p.young
    ? `young ${GROUP_NAME[p.grp].toLowerCase()}${p.pick ? ` drafted near ${shortPick(p)}` : ' who went undrafted'}, 2022–${data.model.lastClass}`
    : p.pick ? `${GROUP_NAME[p.grp].toLowerCase()} drafted near #${p.pick} in nearby classes`
      : `undrafted ${GROUP_NAME[p.grp].toLowerCase()} from nearby classes`

  return (
    <article className="wrap" style={{ paddingTop: 56 }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/players">Players</a><span aria-hidden="true">/</span>
        <a href={`#/players?grp=${p.grp}`}>{GROUP_NAME[p.grp]}</a>
        {p.college && <><span aria-hidden="true">/</span><a href={`#/lab/${encodeURIComponent(p.college)}`}>{p.college}</a></>}
      </nav>
      <h1 className="h1" style={{ marginTop: 16, maxWidth: '12ch' }}>{p.name}</h1>
      <div className="mono muted" style={{ fontSize: 13, marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
        <span>{p.pos}</span>
        {p.young ? <span>Early career</span> : null}
        <span>{p.pick ? `${p.year} draft · Rd ${p.round}, #${p.pick} · ${p.team}` : `Undrafted · entered ${p.year}${p.team ? ` · ${p.team}` : ''}`}</span>
        <span>{span}</span>
        {p.hof ? <span className="over">Hall of Fame</span> : null}
        {p.active && !p.young ? <span>active, career still in progress</span> : null}
      </div>

      {badges.length > 0 && (
        <div className="badges">
          {badges.map(b => <span key={b}>{b}</span>)}
        </div>
      )}

      {/* Verdict */}
      <section className="section verdict" style={{ marginTop: 40 }}>
        <div>
          <h2 className="sr-only">Outlier Index</h2>
          <div className={`num ${p.oi >= 0.95 ? 'over' : p.oi <= 0.05 ? 'under' : ''}`}
            style={{ fontSize: 'clamp(110px, 16vw, 200px)', fontWeight: 700, lineHeight: 0.8, letterSpacing: '-0.04em' }}>
            {oiLabel(p.oi)}
          </div>
          <div className="oi-rank">
            <strong style={{ color: 'var(--ink)' }}>Outlier Index{p.young ? ', early read' : ''}</strong>
            {isExtreme(p) && <> · {rankLabel(p)} comparable players</>}
          </div>
          <p className="muted" style={{ marginTop: 20, maxWidth: '34ch' }}>{verdict(p)}</p>
          <div className="mono faint" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
            measured from: {p.from === 'recruit' ? `${p.stars}-star recruit` : p.from === 'udfa' ? 'going undrafted' : 'draft slot'}
            {p.young ? <><br />after {yrs.toFixed(1)} seasons · compared on pace with other 2022+ players</> : null}
            {lowConfidence(p, data) && <><br /><span className="under">thin comparison group ({p.peers} peers)</span></>}
          </div>
        </div>
        <div>
          <h2 className="h3">Expectation vs. reality{p.young ? ', so far' : ''}</h2>
          <div style={{ display: 'flex', gap: 40, marginTop: 16, flexWrap: 'wrap' }}>
            <Stat label={p.young ? 'Expected AV by now' : 'Expected career AV'} value={p.exp.toFixed(1)} />
            <Stat label={`Actual${p.est ? ' (est.)' : ''} AV`} value={String(p.av)} />
            <Stat label="Gap" value={signed(g, 1)} tone={isExtreme(p) ? (g >= 0 ? "over" : "under") : undefined} />
          </div>
          <Strip p={p} peers={peers} />
          <p className="mono faint" style={{ fontSize: 12 }}>
            Dots: {peers.length} {comparedTo}{p.young ? ', scaled to the same time in the league' : ''}.
            {' '}Outplayed {p.pct}% of them.
            {p.est ? ' Career value estimated from games, starts and stats (see Method).' : ''}
          </p>
        </div>
      </section>

      {/* Journey */}
      <section className="section">
        <h2 className="h3" style={{ marginBottom: 24 }}>The journey</h2>
        <ol className="journey">
          <Stage n="01" title="High school"
            main={p.from === 'recruit' ? `${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}` : '—'}
            sub={p.from === 'recruit' ? `247 composite ${p.rating.toFixed(4)}` : 'Recruiting rating not linked yet'} />
          <Stage n="02" title="College" main={p.college || '—'}
            sub={p.from === 'recruit' && p.spct != null
              ? `Draft outcome beat ${Math.round(p.spct * 100)}% of same-star recruits`
              : collegeLine(p, data)} />
          <Stage n="03" title="Draft" main={p.pick ? `#${p.pick}` : 'UDFA'}
            sub={p.pick ? `${ordinal(p.round)} round · ${p.team} · ${p.year}` : `Signed after the ${p.year} draft`} />
          <Stage n="04" title={p.young ? 'NFL so far' : 'NFL career'} main={`${p.av} AV${p.est ? '*' : ''}`}
            sub={[
              p.seasons ? `${p.seasons} season${p.seasons > 1 ? 's' : ''}` : 'no games',
              p.pb ? `${p.pb}× Pro Bowl` : '',
              p.ap ? `${p.ap}× All-Pro` : '',
            ].filter(Boolean).join(' · ')} />
        </ol>
        <p className="mono faint" style={{ fontSize: 12, marginTop: 20 }}>
          {p.line} · {p.games} games
          {!p.honors && ' · Pro Bowl and All-Pro honors aren’t in the source data for undrafted players yet'}
        </p>
      </section>

      {/* Season by season */}
      <section className="section">
        <h2 className="h3" style={{ marginBottom: 24 }}>Season by season <span className="muted" style={{ fontWeight: 400 }}>· NFL regular season</span></h2>
        {seasons === null ? <p className="faint mono" style={{ fontSize: 12 }}>loading…</p>
          : seasons.length ? <SeasonTable grp={p.grp} rows={seasons} />
            : <p className="faint">No regular-season games on record.</p>}
        <p className="mono faint" style={{ fontSize: 12, marginTop: 12 }}>
          GS = games started: first string on the depth chart (2001–11) or ≥50% of snaps (2012+). Stats from nflverse.
        </p>
      </section>

      {/* DNA */}
      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="h2">
              Career DNA: <a href={`#/paths/${encodeURIComponent(p.dna)}`} style={{ textDecoration: 'underline', textDecorationThickness: 2, textUnderlineOffset: 6 }}>{p.dna}</a>
            </h2>
            {arche && <p className="muted" style={{ marginTop: 8 }}>{arche.blurb}</p>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
            <p className="prose">
              {p.young
                ? 'Other early careers with the same shape so far: a similar slot, a similar pace against expectation, a similar role.'
                : 'Players whose careers had the same shape: a similar starting point, a similar distance from expectation, about as long, peaking about as high. Completed careers only, from any era.'}
            </p>
            <Chips value={scope} onChange={setScope} options={[['pos', `${p.grp} only`], ['any', 'Any position']]} />
          </div>
        </div>
        <table className="rows">
          <thead>
            <tr><th>Same path</th><th className="hide-s">Entered</th><th className="hide-s">Path</th><th className="r">Gap</th><th className="r">OI</th></tr>
          </thead>
          <tbody>
            {similar.map(({ p: q }) => (
              <tr key={q.id} className="link" onClick={() => (location.hash = playerHref(q).slice(1))}>
                <td><div className="name"><a href={playerHref(q)} onClick={e => e.stopPropagation()}>{q.name}</a></div><div className="sub mono">{q.pos} · {q.college}</div></td>
                <td className="mono hide-s">{q.year} · {shortPick(q)}</td>
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

function collegeLine(p: Player, d: Dataset) {
  if (!p.college) return 'College not on record'
  const n = d.players.filter(q => q.college === p.college && !q.young).length
  return `One of ${n.toLocaleString()} ${p.college} players in the NFL since ${d.model.firstClass}`
}

function verdict(p: Player) {
  const pct = p.pct
  const slot = p.pick ? `a #${p.pick} pick` : 'an undrafted player'
  if (!p.games) return p.young ? 'Hasn’t played a regular-season game yet.' : `${p.pick ? `Drafted #${p.pick}` : 'Went undrafted'}, never played a regular-season game.`
  if (p.young) {
    if (pct >= 90) return `Producing far faster than ${slot} usually does. Early, but rare.`
    if (pct >= 60) return `Ahead of the usual pace for ${slot}.`
    if (pct >= 30) return `On roughly the usual pace for ${slot}. Still early.`
    return `Behind the usual pace for ${slot}, for now.`
  }
  if (pct >= 99) return `One of the most improbable careers from this starting point. Outplayed virtually every comparable player.`
  if (pct >= 85) return `Became far more than ${slot} usually becomes.`
  if (pct >= 60) return `Beat the prediction.`
  if (pct >= 40) return `Roughly what ${slot} is expected to become.`
  if (pct >= 15) return `Fell short of what ${slot} usually becomes.`
  return `Among the furthest falls from expectation at this starting point.`
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'over' | 'under' }) {
  return (
    <div>
      <div className={`num ${tone ?? ''}`} style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</div>
      <div className="mono faint" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>{label}</div>
    </div>
  )
}

function Stage({ n, title, main, sub }: { n: string; title: string; main: string; sub: string }) {
  return (
    <li>
      <span className="mono faint" style={{ fontSize: 12 }}>{n} · {title}</span>
      <span className="journey-main">{main}</span>
      <span className="faint" style={{ fontSize: 12 }}>{sub}</span>
    </li>
  )
}

const COLS: Record<Group, [string, string][]> = {
  QB: [['g', 'G'], ['gs', 'GS'], ['cmp', 'Cmp'], ['att', 'Att'], ['pyd', 'Pass yds'], ['ptd', 'TD'], ['int', 'Int'], ['ryd', 'Rush yds'], ['rtd', 'Rush TD']],
  RB: [['g', 'G'], ['gs', 'GS'], ['car', 'Car'], ['ryd', 'Rush yds'], ['rtd', 'TD'], ['rec', 'Rec'], ['recyd', 'Rec yds'], ['rectd', 'Rec TD']],
  WR: [['g', 'G'], ['gs', 'GS'], ['tgt', 'Tgt'], ['rec', 'Rec'], ['recyd', 'Yds'], ['rectd', 'TD'], ['ryd', 'Rush yds']],
  TE: [['g', 'G'], ['gs', 'GS'], ['tgt', 'Tgt'], ['rec', 'Rec'], ['recyd', 'Yds'], ['rectd', 'TD']],
  OL: [['g', 'G'], ['gs', 'GS']],
  DL: [['g', 'G'], ['gs', 'GS'], ['solo', 'Solo'], ['ast', 'Ast'], ['tfl', 'TFL'], ['sk', 'Sacks'], ['qbh', 'QB hits'], ['ff', 'FF']],
  LB: [['g', 'G'], ['gs', 'GS'], ['solo', 'Solo'], ['ast', 'Ast'], ['tfl', 'TFL'], ['sk', 'Sacks'], ['dint', 'Int'], ['pd', 'PD']],
  DB: [['g', 'G'], ['gs', 'GS'], ['solo', 'Solo'], ['ast', 'Ast'], ['dint', 'Int'], ['pd', 'PD'], ['ff', 'FF']],
  ST: [['g', 'G'], ['fgm', 'FGM'], ['fga', 'FGA']],
}

function teamCount(rows: Season[]) {
  const n = new Set(rows.map(r => r.team).filter(Boolean)).size
  return `${n} team${n === 1 ? '' : 's'}`
}

function SeasonTable({ grp, rows }: { grp: Group; rows: Season[] }) {
  const cols = COLS[grp]
  const total = (k: string) => rows.reduce((s, r) => s + Number(r[k] || 0), 0)
  const f = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="rows seasons">
        <thead><tr><th>Season</th><th>Team</th>{cols.map(([k, l]) => <th key={k} className="r">{l}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={String(r.season)}>
              <td className="num">{r.season}</td>
              <td className="mono">{r.team}</td>
              {cols.map(([k]) => <td key={k} className="r num">{k === 'tgt' && Number(r.season) < 2006 ? '—' : f(Number(r[k] || 0))}</td>)}
            </tr>
          ))}
          <tr className="total">
            <td className="mono">Career</td><td className="mono faint">{teamCount(rows)}</td>
            {cols.map(([k]) => <td key={k} className="r num">{f(total(k))}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// A one-dimensional strip: every comparable player's value as a dot,
// with the expectation marked and this player ringed.
function Strip({ p, peers }: { p: Player; peers: { p: Player; v: number }[] }) {
  const { tip, setTip } = useTip()
  const max = Math.max(p.av, p.exp, ...peers.map(q => q.v), 10) * 1.05
  const X = (v: number) => `${(v / max) * 100}%`
  return (
    <div style={{ position: 'relative', height: 96, margin: '32px 0 16px' }}>
      <p className="sr-only">
        {p.name} has {p.av} career AV against {p.exp.toFixed(1)} expected, more than {p.pct}% of {peers.length} comparable players.
      </p>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 48, borderTop: '1px solid var(--rule)' }} aria-hidden="true" />
      {peers.slice(0, 400).map(({ p: q, v }, i) => (
        <a key={q.id} href={playerHref(q)} tabIndex={-1} aria-hidden="true"
          onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, body: <><b>{q.name}</b><span className="mono">{q.year} · {shortPick(q)} · {q.av} AV{q.est ? ' est.' : ''}</span></> })}
          onMouseLeave={() => setTip(null)}
          style={{
            position: 'absolute', left: X(v), top: 48 + ((i * 37) % 30) - 15, width: 8, height: 8, marginLeft: -4, marginTop: -4,
            borderRadius: '50%', background: 'var(--dot)', outline: '6px solid transparent',
          }} />
      ))}
      <div style={{ position: 'absolute', left: X(p.exp), top: 14, bottom: 14, borderLeft: '2px dashed var(--ink-2)' }} />
      <div className="mono faint" style={{ position: 'absolute', left: X(p.exp), top: -6, fontSize: 12, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>expected</div>
      <div style={{
        position: 'absolute', left: X(p.av), top: 48, width: 18, height: 18, marginLeft: -9, marginTop: -9, borderRadius: '50%',
        background: gap(p) >= 0 ? 'var(--over)' : 'var(--under)', boxShadow: '0 0 0 3px var(--paper)',
      }} />
      <div className="mono" aria-hidden="true" style={{ position: 'absolute', left: X(p.av), bottom: -12, fontSize: 12, transform: `translateX(${p.av / max > 0.8 ? '-100%' : '-50%'})`, whiteSpace: 'nowrap', fontWeight: 700 }}>{p.name}</div>
      <div className="mono faint" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 58, fontSize: 12 }}>0</div>
      {tip}
    </div>
  )
}
