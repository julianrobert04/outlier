import { dealLabel, rankGroup, GRADE_BANDS, GROUP_NAME, gradeWord, oiLabel, shortPick, times, type Dataset, type Player } from './data'
import { playerHref } from './ui'

// The Outlier Index explained with a player's own numbers: career first,
// expectations second. Every value shown is read from the data.

const pct = (q: number) => `${Math.min(99.9, Math.round(q * 1000) / 10)}%`

function draftSentence(p: Player) {
  const usual = p.sDraftRate != null
    ? `Only ${Math.round(p.sDraftRate * 100)}% of ${p.stars}★ ${p.grp} recruits get drafted${p.sMedianPick ? `, usually around pick ${p.sMedianPick}` : ''}. `
    : ''
  return `${usual}He went ${p.pick ? `#${p.pick}` : 'undrafted'}: ${times(p.m1!)} the draft value a ${p.stars}★ usually gets.`
}

export function StageSentences({ p, data }: { p: Player; data: Dataset }) {
  const pos = p.grp === 'DB' && p.sub && p.sub !== 'DB' ? rankGroup(p) : GROUP_NAME[p.grp].toLowerCase()
  const fell = p.m2 < 1
  return (
    <ol className="stages">
      <li>
        <span className="stage-label">1 · How good the career was</span>
        <span className="stage-value num">{p.games ? oiLabel(p.base) : '—'}</span>
        <span className="stage-text">
          {p.games
            ? <>
                {p.grp === 'OL'
                  ? <><strong>{p.starterSeasons}</strong> seasons as a starter. {p.bestDeal ? <>Best second contract: {dealLabel(p)}. </> : null}</>
                  : p.bestRank != null
                    ? <>Best season ranked <strong>No. {p.bestRank}</strong> among {rankGroup(p)}; <strong>{p.top10}</strong> top-10 and <strong>{p.top20}</strong> top-20 seasons. </>
                    : null}
                {p.av} career value{p.est ? ' (estimated)' : ''}{p.honorPoints ? ` + ${p.honorPoints} honor points` : ''}.
                {' '}Overall, better than {pct(p.q)} of {pos} who played since {data.model.firstClass}{p.active ? ', and still counting' : ''}. This sets the base grade.
              </>
            : 'Never played a regular-season game.'}
        </span>
      </li>
      <li>
        <span className="stage-label">2 · Getting drafted</span>
        {p.m1 != null ? (
          <>
            <span className={`stage-value num ${p.m1 >= 1 ? '' : 'under'}`}>{times(p.m1)}</span>
            <span className="stage-text">{draftSentence(p)}</span>
          </>
        ) : (
          <>
            <span className="stage-value num faint">—</span>
            <span className="stage-text">No high-school rating on record, so this step counts as ×1.</span>
          </>
        )}
      </li>
      <li>
        <span className="stage-label">3 · Against his slot{p.young ? ' so far' : ''}</span>
        <span className={`stage-value num ${fell ? 'under' : ''}`}>{times(p.m2)}</span>
        <span className="stage-text">
          {p.av} career value; players picked {p.pick ? `around #${p.pick}` : 'undrafted'} at {p.grp} usually reach {p.exp.toFixed(0)}.
          {fell
            ? ` Falling short costs more the higher the expectation: ×${p.fallFactor.toFixed(2)} on the grade.`
            : p.climbAdd > 0.004 ? ` Beating the usual adds +${p.climbAdd.toFixed(2)}.` : ''}
        </span>
      </li>
    </ol>
  )
}

const raw = (p: Player) => p.raw

function adjustment(p: Player, data: Dataset) {
  if (p.hof && p.oi === data.model.hofFloor) return 'Hall of Fame floor'
  if (p.young && p.oi === data.model.earlyCap) return `early read, capped at ${oiLabel(data.model.earlyCap)}`
  if (p.active && p.oi === data.model.activeCap) return `career in progress, capped at ${oiLabel(data.model.activeCap)}`
  if (p.active) return 'career in progress'
  return ''
}

export function Equation({ p, data }: { p: Player; data: Dataset }) {
  const tone = p.oi >= 0.95 ? 'over' : p.oi <= 0.05 ? 'under' : ''
  const fell = p.m2 < 1
  return (
    <div className="equation num" aria-label={`Outlier Index ${oiLabel(p.oi)}`}>
      <span>{p.games ? oiLabel(p.base) : '.30'}</span>
      {fell
        ? <><span className="op">×</span><span>{p.fallFactor.toFixed(2)}</span></>
        : p.climbAdd > 0.004 ? <><span className="op">+</span><span>{p.climbAdd.toFixed(2)}</span></> : null}
      <span className="op">=</span>
      {raw(p) !== p.oi && <><span>{oiLabel(raw(p))}</span><span className="op">→</span></>}
      <strong className={tone}>{oiLabel(p.oi)}</strong>
      <span className="meta" style={{ alignSelf: 'center', color: 'var(--ink)' }}>{gradeWord(p.oi)}</span>
      {adjustment(p, data) && <span className="meta" style={{ alignSelf: 'center' }}>{adjustment(p, data)}</span>}
    </div>
  )
}

export function FormulaExplainer({ data, ids }: { data: Dataset; ids: string[] }) {
  const examples = ids.map(id => data.byId.get(id)).filter((p): p is Player => !!p)
  return (
    <div className="explainer">
      <div className="rule-box">
        <p className="h3">Career first, expectations second</p>
        <ul className="plain">
          <li><strong>1. How good the career was sets the base</strong>, balanced three ways: his peak (how his best seasons ranked at his position), how often he was top 10 or top 20 at his position, and his total career value plus honors. Lasting a long time isn’t enough on its own. Hall-of-Fame level is .99, a perennial top-10 player the high .80s, a solid starter the .70s, a role player around .50–.60.</li>
          <li><strong>2. Beating expectations lifts it</strong>, in proportion to how good the career was. The star rating sets the bar for the draft, and the draft slot sets the bar for the career. A 2★ who becomes a star climbs toward .99; an undrafted role player gains little.</li>
          <li><strong>3. Falling short of the slot drops it</strong>, harder the higher the expectation. A #1 pick who flames out falls to .01; a 7th-rounder who barely played loses little.</li>
          <li><strong>Careers in progress</strong> are capped at {oiLabel(data.model.activeCap)} until they end ({oiLabel(data.model.earlyCap)} for the {data.model.youngFrom}+ classes): they can still go down. Grades round down. {data.players.filter(p => p.oi >= 0.99).length} careers since {data.model.firstClass} reach .99.</li>
        </ul>
        <table className="rows scale" style={{ marginTop: 16 }}>
          <thead><tr><th>Grade</th><th>Means</th></tr></thead>
          <tbody>
            {GRADE_BANDS.map(([t, w], i) => (
              <tr key={w}><td className="num">{i === 0 ? '.99' : `${oiLabel(Math.max(t, 0.01))}–${oiLabel(GRADE_BANDS[i - 1][0] - 0.01)}`}</td><td>{w}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="examples">
        {examples.map(p => (
          <article key={p.id} className="example">
            <a href={playerHref(p)} className="h3">{p.name}</a>
            <div className="meta">{p.pos} · {p.from === 'recruit' ? `${p.stars}★ recruit · ` : ''}{p.pick ? `${p.year} draft ${shortPick(p)}` : `undrafted, ${p.year}`}</div>
            <StageSentences p={p} data={data} />
            <Equation p={p} data={data} />
          </article>
        ))}
      </div>
    </div>
  )
}
