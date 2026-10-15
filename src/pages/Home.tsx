import { useMemo, useState } from 'react'
import { accolades, gap, GROUPS, oiLabel, rankLabel, shortPick, type Dataset, type Group, type Player } from '../data'
import Scatter from '../Scatter'
import { FormulaExplainer } from '../Formula'
import Glossary from '../Glossary'
import { Chips, GapNum, OI, playerHref } from '../ui'

const touch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches

export default function Home({ data, onSearch }: { data: Dataset; onSearch: () => void }) {
  const [grp, setGrp] = useState<Group | 'ALL'>('ALL')
  const players = useMemo(
    () => data.players.filter(p => !p.young && (p.games > 0 || p.pick > 0) && (grp === 'ALL' || p.grp === grp)),
    [data, grp],
  )
  const byGap = useMemo(() => [...players].sort((a, b) => gap(b) - gap(a)), [players])
  const labels = useMemo(() => byGap.slice(0, 3), [byGap])
  const finished = players.filter(p => !p.active)
  const over = byGap.filter(p => !p.active).slice(0, 5)
  const under = [...byGap].reverse().filter(p => !p.active).slice(0, 5)
  const gems = finished.filter(p => !p.pick).sort((a, b) => b.av - a.av).slice(0, 5)
  const rising = useMemo(() => data.players.filter(p => p.young && (grp === 'ALL' || p.grp === grp))
    .sort((a, b) => b.oi - a.oi || b.av - a.av).slice(0, 6), [data, grp])
  // The over-performer exemplar: the most valuable undrafted career (Brady already
  // anchors the chart and the Beat-the-slot list).
  const top = [...finished].filter(p => !p.pick).sort((a, b) => b.oi - a.oi || b.av - a.av)[0] ?? byGap[0]
  const bottom = under[0]

  return (
    <>
      <section className="wrap" style={{ padding: '72px var(--gutter) 40px' }}>
        <h1 className="display">Football,<br />seen differently.</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'end', justifyContent: 'space-between', marginTop: 32 }}>
          <p className="lede">
            Every career, measured against what was expected of it. Not who was best,
            but who became <em>more</em>, or less, than anyone predicted.
          </p>
          <button className="search-btn" style={{ minWidth: 280, padding: '12px 14px', margin: 0, color: 'var(--ink-2)' }} onClick={onSearch}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="7" cy="7" r="5" /><path d="m11 11 3.5 3.5" /></svg>
            <span>Find any of {data.players.length.toLocaleString()} players</span><kbd>/</kbd>
          </button>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 40 }}>
        <Glossary data={data} exampleId="KelcTr00" />
      </div>

      <section className="wrap" style={{ paddingBottom: 56 }}>
        <div className="controls" style={{ justifyContent: 'space-between' }}>
          <Chips value={grp} onChange={setGrp} options={['ALL', ...GROUPS] as (Group | 'ALL')[]} label="Position" />
          <div className="mono faint" style={{ fontSize: 12, display: 'flex', gap: 16 }}>
            <span><i className="legend-dot" style={{ background: 'var(--over)' }} />beat 97% of comparable players</span>
            <span><i className="legend-dot" style={{ background: 'var(--under)' }} />1st-rounder outplayed by 97% of comparable picks</span>
          </div>
        </div>
        <Scatter players={players} labels={labels} height={Math.min(560, Math.max(380, window.innerHeight * 0.6))} />
        <p className="mono faint" style={{ fontSize: 12, marginTop: 12 }}>
          Each dot is one player who entered the league {data.model.firstClass}–{data.model.lastJudgedClass} (undrafted players from 1999 on); undrafted players sit in the right-hand column (value estimated). The line is what a pick at that slot usually becomes. {touch ? 'Tap a dot to read it; tap again to open.' : 'Hover to read, click to open.'}
        </p>
      </section>

      <section className="wrap">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="h1">Outlier<br />Index</h2>
            </div>
            <div className="prose">
              <p>
                One number from <strong>.01</strong> to <strong>.99</strong> for the whole road: high-school stars, the draft, the NFL career.
                Each stage is scored against everyone who started in the same place. Start at the bottom and finish at the top, and the
                number rises toward .99. Arrive as a sure thing and disappear, and it falls toward .01. How a career ends weighs most.
              </p>
              <p>
                {data.recruitingLinked
                  ? <>{data.recruitingLinked.toLocaleString()} players are linked to their 247Sports Composite rating. For the rest, the index starts at the draft.</>
                  : <>Right now the starting point is the draft slot. Once high-school star ratings are connected, the index starts from the recruiting rating, covering the whole road from high school to the NFL.</>}
              </p>
            </div>
          </div>
          <FormulaExplainer data={data} ids={['KelcTr00', 'RussJa00', 'BradTo00']} />
          <div className="grid-2" style={{ marginTop: 56 }}>
            <Extreme p={top} kind="over" />
            <Extreme p={bottom} kind="under" />
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="section">
          <div className="grid-3" style={{ gap: 40 }}>
            <MiniList title="Beat the slot" sub="Biggest career value above expectation" list={over} />
            <MiniList title="Fell through the floor" sub="Biggest shortfall vs. expectation" list={under} />
            <MiniList title="Nobody drafted them" sub="Undrafted players, most career value" list={gems} />
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="h1">Rising</h2>
            </div>
            <p className="prose">
              Early reads on the {data.model.youngFrom}–{data.model.lastClass} classes. Young careers can’t be judged against finished ones, so players from the {data.model.youngFrom}–{String(data.model.lastClass).slice(2)} classes
              are ranked on <strong>pace</strong>: career value per season so far, compared only with other young players drafted at a similar slot.
              Each comes with the accolades a short career can already hold.
            </p>
          </div>
          <div className="rising">
            {rising.map(p => (
              <a key={p.id} href={playerHref(p)} className="rise">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <OI value={p.oi} size={40} />
                  <span className="meta">{rankLabel(p)}</span>
                </div>
                <div className="h3" style={{ marginTop: 10 }}>{p.name}</div>
                <div className="meta">{p.pos} · {p.year} · {shortPick(p)} · {p.av} AV</div>
                <div className="badges" style={{ marginTop: 12 }}>{accolades(p).slice(0, 2).map(a => <span key={a}>{a}</span>)}</div>
              </a>
            ))}
          </div>
          <a href="#/gap?board=rising" className="more" style={{ display: 'inline-block' }}>All rising players →</a>
        </div>
      </section>

      <section className="wrap">
        <div className="section" style={{ paddingBottom: 0 }}>
          <h2 className="h3" style={{ marginBottom: 24 }}>Keep exploring</h2>
          {[
            ['#/players', 'Players', 'Search every career, drafted and undrafted, with season-by-season stats.'],
            ['#/gap', 'Expectation Gap', 'Rank careers by how far they drifted from the draft’s prediction.'],
            ['#/paths', 'Career DNA', 'Find players who walked the same road, across any era.'],
            ['#/lab', 'Development Lab', 'Which colleges send players who outplay their draft slot?'],
            ['#/debate', 'Debate Lab', 'Test football’s favorite arguments against every draft since 2000.'],
          ].map(([href, t, d]) => (
            <a key={href} href={href} className="entry">
              <span className="h2">{t}</span>
              <span className="muted">{d}</span>
              <span className="arrow" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}

function Extreme({ p, kind }: { p: Player; kind: 'over' | 'under' }) {
  return (
    <a href={playerHref(p)} className="extreme" style={{ display: 'block' }}>
      <div className={`num ${kind}`} style={{ fontSize: 'clamp(88px, 14vw, 180px)', fontWeight: 700, lineHeight: 0.85, letterSpacing: '-0.04em' }}>
        {oiLabel(p.oi)}
      </div>
      <div className="h3" style={{ marginTop: 16 }}>{p.name}</div>
      <div className="meta">
        {p.pos} · {p.pick ? `${p.year} · ${shortPick(p)}` : `undrafted, ${p.year}`} · {p.av}{p.est ? '*' : ''} AV vs {p.exp.toFixed(0)} expected
      </div>
      <div className="oi-rank">{rankLabel(p)} comparable {p.pick ? 'picks' : 'undrafted players'}</div>
    </a>
  )
}

function MiniList({ title, sub, list }: { title: string; sub: string; list: Player[] }) {
  return (
    <div>
      <div className="h3">{title}</div>
      <div className="faint" style={{ fontSize: 12, marginBottom: 12 }}>{sub}</div>
      <table className="rows">
        <tbody>
          {list.map((p, i) => (
            <tr key={p.id} className="link" onClick={() => (location.hash = playerHref(p).slice(1))}>
              <td className="rank">{i + 1}</td>
              <td>
                <div className="name"><a href={playerHref(p)} onClick={e => e.stopPropagation()}>{p.name}</a></div>
                <div className="sub mono">{p.pos} · {shortPick(p)} · {p.year}</div>
              </td>
              <td className="r"><GapNum p={p} digits={0} /></td>
              <td className="r" style={{ paddingRight: 0 }}><OI value={p.oi} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
