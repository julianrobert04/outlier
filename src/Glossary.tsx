import { GROUP_NAME, oiLabel, gradeWord, times, type Dataset } from './data'
import { playerHref } from './ui'

// First thing a visitor reads: one worked example, then every term on the site.
export default function Glossary({ data, exampleId }: { data: Dataset; exampleId: string }) {
  const p = data.byId.get(exampleId)
  const terms: [string, string][] = [
    ['Outlier Index', 'The grade, from .01 to .99. How good the career was, lifted for beating expectations and lowered for falling short of them. .99 is Hall-of-Fame level.'],
    ['Career value (AV)', 'Pro Football Reference’s Approximate Value: one number for a whole career, built from the player’s stats and role, so a guard and a quarterback can be compared. A strong starter season is about 8–12.'],
    ['Expected career value', 'The average career value of players at the same position, drafted near the same pick, in nearby draft years. A #1 pick is expected to reach about 63; pick #100 about 15; an undrafted player about 4.'],
    ['Gap', 'Actual career value minus expected. +90 means 90 points more than his draft slot usually produces.'],
    ['Stars · 247 Composite', 'The high-school recruiting rating (0–5★), averaged across the major recruiting services by 247Sports. Available from the 2000 recruiting class.'],
    ['Draft multiplier', 'Draft value of the pick ÷ what recruits with the same stars usually get. ×12 means he went far higher than his rating predicted.'],
    ['Career multiplier', 'Career value ÷ what his draft slot usually produces. Below ×1 is a career that fell short: the higher the pick, the harder the grade drops.'],
    ['Career quality', 'How good the career was, balanced three ways: peak seasons, how often he ranked top 10 or top 20 at his position, and total career value plus honors. It sets the base grade.'],
    ['Season rank', 'Where a season ranked at his position that year, using published standard formulas: ANY/A weights for quarterbacks, standard scoring for runners and receivers, standard IDP scoring for defenders. Corners and safeties are ranked separately.'],
    ['Honor points', 'Awards on a scale of prestige: MVP 30, Player of the Year 20, Hall of Fame 25, Super Bowl MVP 12, first-team All-Pro 10, Rookie of the Year 6, second-team All-Pro 4, Pro Bowl 2.'],
    ['Second contract', 'A multi-year deal signed after a player’s first contract: the market’s verdict on him. Shown as a share of that year’s salary cap so different eras compare. Data from OverTheCap, deals signed through 2022.'],
    ['Offensive linemen', 'Linemen have no individual stats, so their career quality uses seasons as a starter, their best second contract compared with the same line spot, and career value plus All-Pro and Pro Bowl honors.'],
    ['UDFA', 'Undrafted free agent: signed after the draft. Their career value is estimated from their stats.'],
    ['Early read', 'Players from the 2022+ classes, judged on pace so far and capped at .95. Active careers are capped at .97: they can still go down.'],
    ['W', 'A season taken from the player’s Wikipedia page, where the open stat sources don’t reach (NFL before 1999, older college seasons).'],
  ]
  return (
    <section className="glossary" aria-labelledby="how-to-read">
      <h2 id="how-to-read" className="h3">How to read Outlier</h2>
      {p && p.m1 != null && (
        <p className="example-line">
          <a href={playerHref(p)}><strong>{p.name}</strong></a>{' '}
          was a <strong>{p.stars}★ recruit</strong> (only {Math.round((p.sDraftRate ?? 0) * 100)}% of {p.stars}★ {GROUP_NAME[p.grp].toLowerCase()} get drafted).
          He went <strong>#{p.pick}</strong>, {times(p.m1)} the draft value a {p.stars}★ usually gets.
          He then produced <strong>{p.av} career value</strong> against <strong>{p.exp.toFixed(0)} expected</strong> for pick #{p.pick} ({times(p.m2)}),
          and his career beat {Math.min(99, Math.round(p.q * 100))}% of {GROUP_NAME[p.grp].toLowerCase()}.
          Outlier Index: <strong className={p.oi >= 0.95 ? 'over' : ''}>{oiLabel(p.oi)} · {gradeWord(p.oi)}</strong>.
        </p>
      )}
      <dl className="terms">
        {terms.map(([t, d]) => (
          <div key={t}>
            <dt>{t}</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
      <p className="meta" style={{ marginTop: 12 }}>
        Grades: .99 legendary · .95+ great · .85+ very good · .70+ solid · .50+ as expected · .25+ below expectations · under .25 bust.{' '}
        <a href="#/method" style={{ textDecoration: 'underline' }}>Full method →</a>
      </p>
    </section>
  )
}
