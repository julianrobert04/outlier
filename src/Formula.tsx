import { oiLabel, shortPick, times, type Dataset, type Player } from './data'
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
        <span className="stage-label">2 · The NFL career{p.young ? ' so far' : ''}</span>
        <span className={`stage-value num ${falling ? 'under' : ''}`}>{times(p.m2)}</span>
        <span className="stage-text">
          {p.av} career value{p.est ? ' (estimated)' : ''} against {p.exp.toFixed(0)} expected
          {' '}{p.pick ? `from pick #${p.pick}` : 'for an undrafted player'}{p.young ? ` by year ${Math.round(data.lastSeason - p.year + 1)}` : ''}
          {' '}for {p.grp === 'ST' ? 'a specialist' : `a ${p.grp}`}.
          {falling ? ' A falling career counts double.' : ''}
        </span>
      </li>
    </ol>
  )
}

export function Equation({ p, data }: { p: Player; data: Dataset }) {
  const falling = p.m2 < 1
  return (
    <div className="equation num" aria-label={`Outlier Index ${oiLabel(p.oi)}`}>
      {p.m1 != null && <><span>√{times(p.m1).slice(1)}</span><span className="op">×</span></>}
      {p.m1 == null && !falling
        ? <span>{times(p.mult)}</span>
        : <>
          <span>{times(p.m2).slice(1)}{falling && <sup>2</sup>}</span>
          <span className="op">=</span>
          <span>{times(p.mult)}</span>
        </>}
      <span className="op">→</span>
      <strong className={p.oi >= 0.95 ? 'over' : p.oi <= 0.05 ? 'under' : ''}>{oiLabel(p.oi)}</strong>
      {!!p.young && p.oi === data.model.earlyCap && grade(p.mult, data.model.gradeCurve) > p.oi &&
        <span className="meta" style={{ alignSelf: 'center' }}>early read, capped at {oiLabel(data.model.earlyCap)}</span>}
    </div>
  )
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
          <li><strong>The grade.</strong> .50 means exactly as expected. Only about {data.players.filter(p => p.oi >= 0.99).length} careers since {data.model.firstClass} reach .99. Grades round down, and early careers stop at {oiLabel(data.model.earlyCap)}.</li>
        </ul>
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
