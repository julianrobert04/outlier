import { useEffect, useMemo, useState } from 'react'
import {
  accolades, ALL_ARCHETYPES, honorsList, gap, gradeWord, isExtreme, loadCollege, rankLabel, GROUP_NAME, loadSeasons, lowConfidence, oiLabel, ordinal, peersOf, samePath,
  shortPick, signed, yearsIn, type Dataset, type Group, type Player, type Season,
} from '../data'
import { Chips, GapNum, OI, playerHref, useTip } from '../ui'
import { Equation, StageSentences } from '../Formula'

export default function PlayerPage({ data, id }: { data: Dataset; id: string }) {
  const p = data.byId.get(id)
  const [scope, setScope] = useState<'pos' | 'any'>('pos')
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const similar = useMemo(() => (p ? samePath(p, data.players, 8, scope === 'pos') : []), [p, data, scope])
  const peers = useMemo(() => (p ? peersOf(p, data) : []), [p, data])
  const [college, setCollege] = useState<Season[] | null>(null)
  useEffect(() => { if (p) { loadSeasons(p, data).then(setSeasons); loadCollege(p, data).then(setCollege) } }, [p, data])

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
  const badges = p.young ? accolades(p).filter(b => !/Pro Bowl|All-Pro/.test(b)) : []
  const honors = honorsList(p, data)
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

      {honors.length > 0 && (
        <p className="honors" aria-label="Honors">{honors.join(' · ')}</p>
      )}
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
            <strong style={{ color: 'var(--ink)' }}>{gradeWord(p.oi)}</strong> · Outlier Index{p.young ? ', early read' : p.active ? ', career in progress' : ''}
            {isExtreme(p) && <> · career {rankLabel(p).toLowerCase().replace('no.', 'No.')} comparable players</>}
          </div>
          <Equation p={p} data={data} />
          <p className="muted" style={{ marginTop: 20, maxWidth: '34ch' }}>{verdict(p)}</p>
          <div className="mono faint" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
            {p.young ? <>after {yrs.toFixed(1)} seasons · compared on pace with other 2022+ players</> : null}
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

      {/* How the grade was built */}
      <section className="section">
        <h2 className="h3" style={{ marginBottom: 16 }}>How {p.name.split(' ')[0]}’s grade is built</h2>
        <StageSentences p={p} data={data} />
        <p className="meta" style={{ marginTop: 16 }}>
          Each step is a multiplier: how many times the usual outcome. The draft counts half, the career fully, and a falling career twice.
          {' '}<a href="#/method" style={{ textDecoration: 'underline' }}>Full method →</a>
        </p>
      </section>

      {/* Journey */}
      <section className="section">
        <h2 className="h3" style={{ marginBottom: 24 }}>The journey</h2>
        <ol className="journey">
          <Stage n="01" title="High school"
            main={p.from === 'recruit' ? `${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}` : '—'}
            sub={p.from === 'recruit' ? `247 composite ${p.rating.toFixed(4)}` : 'Recruiting rating not linked yet'} />
          <Stage n="02" title="College" main={p.college || '—'}
            sub={p.cpct != null
              ? `College production beat ${Math.round(p.cpct * 100)}% of NFL ${GROUP_NAME[p.grp].toLowerCase()}`
              : collegeLine(p, data)} />
          <Stage n="03" title="Draft" main={p.pick ? `#${p.pick}` : 'UDFA'}
            sub={[
              p.pick ? `${ordinal(p.round)} round · ${p.team} · ${p.year}` : `Signed after the ${p.year} draft`,
              p.from === 'recruit' && p.sDraftRate != null ? `only ${Math.round(p.sDraftRate * 100)}% of ${p.stars}★ recruits get drafted` : '',
            ].filter(Boolean).join(' · ')} />
          <Stage n="04" title={p.young ? 'NFL so far' : 'NFL career'} main={`${p.av} AV${p.est ? '*' : ''}`}
            sub={[
              p.seasons ? `${p.seasons} season${p.seasons > 1 ? 's' : ''}` : 'no games',
              p.pb ? `${p.pb}× Pro Bowl` : '',
              p.ap ? `${p.ap}× All-Pro` : '',
            ].filter(Boolean).join(' · ')} />
        </ol>
        <p className="mono faint" style={{ fontSize: 12, marginTop: 20 }}>
          {p.line} · {p.games} games

        </p>
      </section>

      {/* College */}
      <section className="section">
        <h2 className="h3" style={{ marginBottom: 24 }}>College <span className="muted" style={{ fontWeight: 400 }}>· {p.college || 'season stats'}</span></h2>
        {college === null ? <p className="faint mono" style={{ fontSize: 12 }}>loading…</p>
          : college.length && COLLEGE_COLS[p.grp].length ? <CollegeTable grp={p.grp} rows={college} data={data} />
            : <p className="muted">{p.grp === 'OL'
              ? 'The source has no individual stats for offensive linemen.'
              : p.year - 1 < data.coverage.college.offenseFrom
                ? `College stats in the source start around ${data.coverage.college.offenseFrom}, after this player’s college years.`
                : 'No college stats linked for this player.'}</p>}
        <p className="mono faint" style={{ fontSize: 12, marginTop: 12 }}>
          Regular-season stats from CollegeFootballData.com. Defensive tackles, TFL, sacks and hurries start in {data.coverage.college.defenseFrom};
          earlier seasons show —. Production percentile compares career college totals with every NFL player at the same position who has college stats.
        </p>
      </section>

      {/* Season by season */}
      <section className="section">
        <h2 className="h3" style={{ marginBottom: 24 }}>Season by season <span className="muted" style={{ fontWeight: 400 }}>· NFL regular season</span></h2>
        {seasons === null ? <p className="faint mono" style={{ fontSize: 12 }}>loading…</p>
          : seasons.length ? <SeasonTable grp={p.grp} rows={seasons} data={data} />
            : <p className="faint">No regular-season games on record.</p>}
        <p className="mono faint" style={{ fontSize: 12, marginTop: 12 }}>
          GS = games started: first string on the weekly depth chart ({data.coverage.startsFrom.depthCharts[0]}–{data.coverage.startsFrom.depthCharts[data.coverage.startsFrom.depthCharts.length - 1]})
          or at least 50% of snaps ({data.coverage.startsFrom.snapCounts[0]}+). Before {data.coverage.startsFrom.snapCounts[0]}, games for players without
          box-score stats (mostly linemen) count only games they started. — means the source didn’t track it that season.
          Stuffs and run stops are computed from play-by-play; hover a column header for its definition.
          * {data.lastSeason} is in progress. Stats from nflverse and Pro Football Reference.
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

// One sentence that matches the grade (the ladder of expectations).
function verdict(p: Player) {
  const g = p.oi
  if (!p.games) return p.young ? 'Hasn’t played a regular-season game yet.' : `${p.pick ? `Drafted #${p.pick}` : 'Went undrafted'}, never played a regular-season game.`
  const soFar = p.young ? ' so far' : ''
  if (g >= 0.99) return `One of the biggest climbs of the era: far beyond every expectation${soFar}.`
  if (g >= 0.9) return `Rose well beyond what was expected${soFar}.`
  if (g >= 0.65) return `Beat expectations${soFar}.`
  if (g >= 0.35) return `Roughly what was expected${soFar}.`
  if (g >= 0.1) return `Fell short of expectations${soFar}.`
  return `One of the steepest falls from expectation${soFar}.`
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

// Season-table columns. [key, header, full name]; a trailing "?" in the key marks
// an optional column, shown only when the player has a non-zero career total.
type Col = [string, string, string]
const L: Record<string, [string, string]> = {
  g: ['G', 'Games'], gs: ['GS', 'Games started'], cmp: ['Cmp', 'Completions'], att: ['Att', 'Pass attempts'],
  pyd: ['Pass yds', 'Passing yards'], ptd: ['TD', 'Passing touchdowns'], int: ['Int', 'Interceptions thrown'],
  skd: ['Sacked', 'Times sacked'], pfd: ['1st D', 'Passing first downs'], car: ['Car', 'Carries'],
  ryd: ['Rush yds', 'Rushing yards'], rtd: ['Rush TD', 'Rushing touchdowns'], rfd: ['1st D', 'Rushing first downs'],
  rec: ['Rec', 'Receptions'], tgt: ['Tgt', 'Targets'], recyd: ['Rec yds', 'Receiving yards'],
  rectd: ['Rec TD', 'Receiving touchdowns'], yac: ['YAC', 'Yards after catch'], recfd: ['1st D', 'Receiving first downs'],
  fuml: ['Fum lost', 'Fumbles lost'], pry: ['PR yds', 'Punt return yards'], kry: ['KR yds', 'Kick return yards'],
  sttd: ['ST TD', 'Special-teams touchdowns'], pen: ['Pen', 'Penalties'],
  solo: ['Solo', 'Solo tackles'], ast: ['Ast', 'Assisted tackles'], tfl: ['TFL', 'Tackles for loss'],
  sk: ['Sacks', 'Sacks'], qbh: ['QB hits', 'Quarterback hits'], stuff: ['Stuffs', 'Tackles on runs for no gain or a loss'],
  rstop: ['Run stops', 'Tackles on runs the offense failed (under 40%/60%/100% of the needed yards on 1st/2nd/3rd–4th down)'],
  dint: ['Int', 'Interceptions'], tot: ['Tkl', 'Total tackles'], hur: ['Hurries', 'QB hurries'], pd: ['PD', 'Passes defended'], ff: ['FF', 'Forced fumbles'], fr: ['FR', 'Fumble recoveries'],
  sfty: ['Sfty', 'Safeties'], dtd: ['Def TD', 'Defensive touchdowns'], fgm: ['FGM', 'Field goals made'], fga: ['FGA', 'Field goals attempted'],
  prss: ['Pressures', 'Pressures'], hrry: ['Hurries', 'QB hurries'], qbkd: ['Knockdowns', 'QB knockdowns'],
  mtkl: ['Missed tkl', 'Missed tackles'], bltz: ['Blitzes', 'Times blitzed'], tgta: ['Tgt allowed', 'Targets allowed in coverage'],
  cmpa: ['Cmp allowed', 'Completions allowed'], ydsa: ['Yds allowed', 'Yards allowed in coverage'], tda: ['TD allowed', 'Touchdowns allowed'],
  ybc: ['Yds before contact', 'Rushing yards before contact'], brk: ['Broken tkl', 'Broken tackles'], drop: ['Drops', 'Dropped passes'],
  prsd: ['Pressured', 'Times pressured'], badt: ['Bad throws', 'Bad throws'],
}
const cols = (keys: string) => keys.split(' ').map(k => [k, ...L[k.replace('?', '')]] as Col)
const COLS: Record<Group, { main: Col[]; adv: Col[] }> = {
  QB: { main: cols('g gs cmp att pyd ptd int skd pfd ryd rtd fuml?'), adv: cols('prsd badt') },
  RB: { main: cols('g gs car ryd rtd rfd rec recyd rectd fuml? pry? kry? sttd?'), adv: cols('ybc brk') },
  WR: { main: cols('g gs tgt rec recyd rectd yac recfd ryd? fuml? pry? kry? sttd?'), adv: cols('drop brk') },
  TE: { main: cols('g gs tgt rec recyd rectd yac recfd fuml?'), adv: cols('drop brk') },
  OL: { main: cols('g gs pen?'), adv: [] },
  DL: { main: cols('g gs solo ast tfl sk qbh stuff rstop ff? fr? dint? pd? sfty? dtd?'), adv: cols('prss hrry qbkd mtkl') },
  LB: { main: cols('g gs solo ast tfl sk qbh stuff rstop dint pd ff? fr? sfty? dtd?'), adv: cols('prss hrry mtkl bltz tgta cmpa ydsa tda') },
  DB: { main: cols('g gs solo ast dint pd stuff rstop tfl? sk? ff? fr? sfty? dtd? pry? kry? sttd?'), adv: cols('tgta cmpa ydsa tda mtkl bltz') },
  ST: { main: cols('g fgm fga'), adv: [] },
}

const COLLEGE_COLS: Record<Group, Col[]> = {
  QB: cols('cmp att pyd ptd int car ryd rtd'),
  RB: cols('car ryd rtd rec recyd rectd kry? pry?'),
  WR: cols('rec recyd rectd car? ryd? kry? pry?'),
  TE: cols('rec recyd rectd'),
  OL: [],
  DL: cols('tot solo tfl sk hur pd? dint? dtd?'),
  LB: cols('tot solo tfl sk hur pd dint dtd?'),
  DB: cols('tot solo dint pd tfl? sk? dtd? kry? pry?'),
  ST: cols('fgm fga'),
}
const COLLEGE_DEFENSE = new Set(['tot', 'solo', 'tfl', 'sk', 'hur', 'pd', 'dtd'])

function CollegeTable({ grp, rows, data }: { grp: Group; rows: Season[]; data: Dataset }) {
  const total = (k: string) => rows.reduce((s, r) => s + Number(r[k] || 0), 0)
  const shown = COLLEGE_COLS[grp].filter(([k]) => !k.endsWith('?') || total(k.slice(0, -1)) > 0)
    .map(([k, a, b]) => [k.replace('?', ''), a, b] as Col)
  const untracked = (k: string, r: Season) => COLLEGE_DEFENSE.has(k) && Number(r.season) < data.coverage.college.defenseFrom
  return <StatGrid cols={shown} rows={rows} data={data} untrackedExtra={untracked} />
}

function teamCount(rows: Season[]) {
  const n = new Set(rows.map(r => r.team).filter(Boolean)).size
  return `${n} team${n === 1 ? '' : 's'}`
}

function SeasonTable({ grp, rows, data }: { grp: Group; rows: Season[]; data: Dataset }) {
  const { advancedFrom } = data.coverage
  const advRows = rows.filter(r => Number(r.season) >= advancedFrom)
  const total = (rs: Season[], k: string) => rs.reduce((s, r) => s + Number(r[k] || 0), 0)
  const pick = (cs: Col[], rs: Season[]) => cs.filter(([k]) => !k.endsWith('?') || total(rs, k.slice(0, -1)) > 0).map(([k, a, b]) => [k.replace('?', ''), a, b] as Col)
  const main = pick(COLS[grp].main, rows)
  const adv = advRows.length ? pick(COLS[grp].adv, advRows) : []
  return (
    <>
      <StatGrid cols={main} rows={rows} data={data} />
      {adv.length > 0 && (
        <>
          <h3 className="h3" style={{ margin: '40px 0 16px' }}>Advanced <span className="muted" style={{ fontWeight: 400 }}>· {advancedFrom} on</span></h3>
          <StatGrid cols={adv} rows={advRows} data={data} advanced />
        </>
      )}
    </>
  )
}

function StatGrid({ cols, rows, data, advanced, untrackedExtra }: {
  cols: Col[]; rows: Season[]; data: Dataset; advanced?: boolean; untrackedExtra?: (k: string, r: Season) => boolean
}) {
  const { noTargets, noStarts } = data.coverage
  // Advanced stats for the season in progress may not be published yet.
  const advPending = (r: Season) => advanced && Number(r.season) === data.lastSeason && cols.every(([k]) => !Number(r[k]))
  const untracked = (k: string, r: Season) =>
    (k === 'tgt' && noTargets.includes(Number(r.season))) || (k === 'gs' && noStarts.includes(Number(r.season))) || advPending(r) ||
    !!untrackedExtra?.(k, r)
  const total = (k: string) => rows.reduce((s, r) => s + Number(r[k] || 0), 0)
  const f = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="rows seasons">
        <thead>
          <tr>
            <th>Season</th><th>Team</th>
            {cols.map(([k, l, full]) => <th key={k} className="r"><abbr title={full}>{l}</abbr></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={String(r.season)}>
              <td className="num">{r.season}{Number(r.season) === data.lastSeason ? <span className="faint">*</span> : null}</td>
              <td className="mono">{r.team}</td>
              {cols.map(([k]) => <td key={k} className="r num">{untracked(k, r) ? '—' : f(Number(r[k] || 0))}</td>)}
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
