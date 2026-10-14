import { GRADE_BANDS, GROUP_NAME, gradeWord, oiLabel, shortPick, times, type Dataset, type Player } from './data'
import { playerHref } from './ui'

// The Outlier Index as a ladder of expectations, explained with a player's own
// numbers. Every value shown is read from the data.

const grade = (m: number, curve: number) => {
  const x = Math.pow(m, curve)
  return Math.min(0.99, Math.max(0.01, Math.floor((x / (x + 1)) * 100 + 1e-9) / 100))
}

function draftSentence(p: Player) {
  const usual = p.sDraftRate != null
    ? `Only ${Math.round(p.sDraftRate * 100)}% of ${p.stars}★ ${p.grp} recruits get drafted${p.sMedianPick ? `, usually around pick ${p.sMedianPick}` : ''}.`
    : ''
  const went = p.pick ? `He went #${p.pick}` : 'He went undrafted'
  return `${usual} ${went}: ${times(p.m1!)} the draft value a ${p.stars}★ usually gets.`
}

export function StageSentences({ p, data }: { p: Player; data: Dataset }) {
  const falling = p.m2 < 1
  return (
    <ol className="stages">
      <li>
        <span className="stage-label">1 · Getting drafted</span>
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
        <span className="stage-label">2 · Beating the slot{p.young ? ' so far' : ''}</span>
        <span className={`stage-value num ${falling ? 'under' : ''}`}>{times(p.m2)}</span>
        <span className="stage-text">
          {p.av} career value{p.est ? ' (estimated)' : ''} against {p.exp.toFixed(0)} expected
          {' '}{p.pick ? `from pick #${p.pick}` : 'for an undrafted player'}{p.young ? ` by year ${Math.round(data.lastSeason - p.year + 1)}` : ''}
          {' '}for {p.grp === 'ST' ? 'a specialist' : `a ${p.grp}`}.
          {falling ? ' A falling career counts double.' : ''}
        </span>
      </li>
      <li>
        <span className="stage-label">3 · How good it was</span>
        <span className="stage-value num">{p.games ? qLabel(p.qgrade) : '—'}</span>
        <span className="stage-text">
          {p.games
            ? <>{p.av} career value{p.honorPoints ? ` + ${p.honorPoints} honor points` : ''}: better than {Math.min(99.9, Math.round(p.q * 1000) / 10)}% of {GROUP_NAME[p.grp].toLowerCase()} who played since {data.model.firstClass}{p.active ? ', and still counting' : ''}. {qualityNote(p, data)}</>
            : 'Never played a regular-season game.'}
        </span>
      </li>
    </ol>
  )
}


function qualityNote(p: Player, data: Dataset) {
  if (p.q >= data.model.eliteFrom && p.ladder >= 0.5) return 'An elite career grades high even when it was expected.'
  return ''
}

export function Equation({ p, data }: { p: Player; data: Dataset }) {
  const falling = p.m2 < 1
  const tone = p.oi >= 0.95 ? 'over' : p.oi <= 0.05 ? 'under' : ''
  return (
    <div aria-label={`Outlier Index ${oiLabel(p.oi)}`}>
      <div className="equation num">
        <span className="meta" style={{ alignSelf: 'center', minWidth: 64 }}>ladder</span>
        {p.m1 != null && <><span>√{times(p.m1).slice(1)}</span><span className="op">×</span></>}
        {p.m1 == null && !falling
          ? <span>{times(p.mult)}</span>
          : <>
            <span>{times(p.m2).slice(1)}{falling && <sup>2</sup>}</span>
            <span className="op">=</span>
            <span>{times(p.mult)}</span>
          </>}
        <span className="op">→</span>
        <span>{oiLabel(p.ladder)}</span>
      </div>
      <div className="equation num" style={{ marginTop: 4 }}>
        <span className="meta" style={{ alignSelf: 'center', minWidth: 64 }}>grade</span>
        <span>√({oiLabel(p.ladder)} × {qLabel(p.qgrade)})</span>
        <span className="op">=</span>
        <strong className={tone}>{oiLabel(p.oi)}</strong>
        <span className="meta" style={{ alignSelf: 'center', color: 'var(--ink)' }}>{gradeWord(p.oi)}</span>
        {adjustment(p, data) && <span className="meta" style={{ alignSelf: 'center' }}>{adjustment(p, data)}</span>}
      </div>
    </div>
  )
}

const qLabel = (x: number) => (x < 0.01 ? '.00' : oiLabel(Math.min(0.99, Math.floor(x * 100) / 100)))

function adjustment(p: Player, data: Dataset) {
  if (p.young && p.oi === data.model.earlyCap) return `early read, capped at ${oiLabel(data.model.earlyCap)}`
  if (p.active && p.oi === data.model.activeCap) return `career in progress, capped at ${oiLabel(data.model.activeCap)}`
  if (p.q >= data.model.eliteFrom && p.ladder >= 0.5 && p.oi > Math.floor(Math.sqrt(p.ladder * p.qgrade) * 100) / 100) return 'elite career'
  if (p.active) return 'career in progress'
  return ''
}

const SCALE = [0.1, 0.33, 1, 2, 5, 10, 25]

export function FormulaExplainer({ data, ids }: { data: Dataset; ids: string[] }) {
  const examples = ids.map(id => data.byId.get(id)).filter((p): p is Player => !!p)
  const curve = data.model.gradeCurve
  return (
    <div className="explainer">
      <div className="rule-box">
        <p className="h3">A ladder of expectations</p>
        <ul className="plain">
          <li><strong>The star rating sets the bar.</strong> The data shows what usually happens to recruits with that rating: how many get drafted, and where.</li>
          <li><strong>Step 1, getting drafted.</strong> How many times more (or less) draft value the player got than recruits with his stars usually get. A 2★ in round 2 is a big jump. A 5★ in round 1 is what was expected.</li>
          <li><strong>Step 2, the NFL career.</strong> How many times more (or less) career value than his draft slot usually produces.</li>
          <li><strong>Steps multiply.</strong> The draft counts half (square root), the career counts fully, and a falling career counts double.</li>
          <li><strong>Step 3, how good the career was.</strong> The numbers count, not only the expectations. Career value (built from his stats) plus honor points on a scale of prestige: MVP {data.honorPoints.mvp}, Player of the Year {data.honorPoints.opoy}, Super Bowl MVP {data.honorPoints.sbmvp}, first-team All-Pro {data.honorPoints.ap1}, Rookie of the Year {data.honorPoints.oroy}, second-team All-Pro {data.honorPoints.ap2}, Pro Bowl {data.honorPoints.pb}, Hall of Fame {data.honorPoints.hof}. Ranked against everyone at the position, on a steep scale: better than 90% → .53, 95% → .74, 99% → .94.</li>
          <li><strong>The grade is half climb, half career:</strong> √(ladder × career quality). A big climb with modest numbers lands in the middle. The top {Math.round((1 - data.model.eliteFrom) * 100)}% of a position grades high even when it was expected, and .99 is the top {Math.round((1 - data.model.eliteTop) * 1000) / 10}%: {data.players.filter(p => p.oi >= 0.99).length} careers since {data.model.firstClass}.</li>
          <li><strong>Careers in progress</strong> can still go down, so they’re capped at {oiLabel(data.model.activeCap)} until they end ({oiLabel(data.model.earlyCap)} for the {data.model.youngFrom}+ classes). Grades round down.</li>
        </ul>
        <table className="rows scale" style={{ marginTop: 16 }}>
          <thead><tr><th>Grade</th><th>Means</th></tr></thead>
          <tbody>
            {GRADE_BANDS.map(([t, w], i) => (
              <tr key={w}><td className="num">{i === 0 ? '.99' : `${oiLabel(Math.max(t, 0.01))}–${oiLabel(GRADE_BANDS[i - 1][0] - 0.01)}`}</td><td>{w}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="rows scale">
          <thead><tr><th>Overall</th>{SCALE.map(m => <th key={m} className="r">{times(m)}</th>)}</tr></thead>
          <tbody><tr><td className="mono">Grade</td>{SCALE.map(m => <td key={m} className="r num">{oiLabel(grade(m, curve))}</td>)}</tr></tbody>
        </table>
        </div>
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
