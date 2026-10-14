import { GROUP_NAME, oiLabel, shortPick, type Dataset, type Player } from './data'
import { playerHref } from './ui'

// The Outlier Index, explained with a real player's own numbers. Every value
// shown is read from the data; the product shown is the actual grade.

const clamp = (x: number) => Math.min(0.99, Math.max(0.01, x))
const two = (x: number) => oiLabel(clamp(Math.floor(x * 100 + 1e-9) / 100))
const pctText = (x: number) => `${Math.round(clamp(x) * 100)}%`

export function stages(p: Player) {
  const hasStars = p.from === 'recruit' && p.spct != null
  return { hasStars, s1: hasStars ? clamp(p.spct!) : null, s2: clamp(p.gpct) }
}

export function StageSentences({ p, data }: { p: Player; data: Dataset }) {
  const { hasStars, s1, s2 } = stages(p)
  const pos = GROUP_NAME[p.grp].toLowerCase()
  return (
    <ol className="stages">
      <li>
        <span className="stage-label">1 · Getting drafted</span>
        {hasStars ? (
          <>
            <span className="stage-value num">{two(s1!)}</span>
            <span className="stage-text">
              A {p.stars}★ {p.grp} recruit, {p.pick ? `drafted #${p.pick}` : 'undrafted'}. That’s higher than {pctText(s1!)} of
              {' '}{p.stars}★ {p.grp} recruits, most of whom never reached the NFL.
            </span>
          </>
        ) : (
          <>
            <span className="stage-value num faint">—</span>
            <span className="stage-text">No high-school rating on record, so this stage is skipped.</span>
          </>
        )}
      </li>
      <li>
        <span className="stage-label">2 · The NFL career{p.young ? ' so far' : ''}</span>
        <span className="stage-value num">{two(s2)}</span>
        <span className="stage-text">
          {p.av} career value{p.est ? ' (estimated)' : ''} against {p.exp.toFixed(0)} expected for {p.pick ? `a #${p.pick} pick` : 'an undrafted player'}.
          {' '}That beat expectation by more than {pctText(s2)} of {pos}
          {p.young ? ` from the ${data.model.youngFrom}+ classes (per season)` : ` since ${data.model.firstClass}`}.
        </span>
      </li>
    </ol>
  )
}

export function Equation({ p, data }: { p: Player; data: Dataset }) {
  const { hasStars, s1, s2 } = stages(p)
  const w = data.model.journeyWeights
  return (
    <div className="equation num" aria-label={`Outlier Index ${oiLabel(p.oi)}`}>
      {hasStars
        ? <><span>{two(s1!)}<sup>{w.draft}</sup></span><span className="op">×</span><span>{two(s2)}<sup>{w.career}</sup></span></>
        : <span>{two(s2)}</span>}
      <span className="op">=</span>
      <strong className={p.oi >= 0.95 ? 'over' : p.oi <= 0.05 ? 'under' : ''}>{oiLabel(p.oi)}</strong>
      {!!p.young && p.oi === data.model.earlyCap && <span className="meta" style={{ alignSelf: 'center' }}>early read, capped at {oiLabel(data.model.earlyCap)}</span>}
    </div>
  )
}

export function FormulaExplainer({ data, ids }: { data: Dataset; ids: string[] }) {
  const examples = ids.map(id => data.byId.get(id)).filter((p): p is Player => !!p)
  const w = data.model.journeyWeights
  return (
    <div className="explainer">
      <div className="rule-box">
        <p className="h3">The grade in one line</p>
        <p className="equation num" style={{ marginTop: 12 }}>
          <span>Getting drafted<sup>{w.draft}</sup></span><span className="op">×</span>
          <span>NFL career<sup>{w.career}</sup></span><span className="op">=</span><strong>Outlier Index</strong>
        </p>
        <ul className="plain">
          <li><strong>Each stage is a percentile</strong>, from .01 to .99: the share of comparable players this one beat. No opinions, no scouting grades. Only where they were drafted and what they produced.</li>
          <li><strong>Getting drafted</strong> compares a recruit with every recruit of the same stars and position, including the many who never reached the NFL.</li>
          <li><strong>NFL career</strong> measures how far the player beat what history expects from their draft slot, ranked against every player at the position since {data.model.firstClass}.</li>
          <li><strong>The stages multiply</strong>, and the NFL career counts more ({Math.round(w.career * 100)}%). A great climb can’t hide a collapse.</li>
          <li><strong>.99 is the top 1%</strong> of the era. Grades round down, and early careers stop at {oiLabel(data.model.earlyCap)} until they’ve run longer.</li>
        </ul>
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
