import { useMemo, useState } from 'react'
import { gap, GROUPS, oiLabel, type Dataset, type Group, type Player } from '../data'
import Scatter from '../Scatter'
import { Chips, GapNum, OI, playerHref } from '../ui'

export default function Home({ data, onSearch }: { data: Dataset; onSearch: () => void }) {
  const [grp, setGrp] = useState<Group | 'ALL'>('ALL')
  const players = useMemo(
    () => (grp === 'ALL' ? data.players : data.players.filter(p => p.grp === grp)),
    [data, grp],
  )
  const byGap = useMemo(() => [...players].sort((a, b) => gap(b) - gap(a)), [players])
  const labels = useMemo(() => byGap.slice(0, 3), [byGap])
  const finished = players.filter(p => !p.active)
  const over = byGap.filter(p => !p.active).slice(0, 5)
  const under = [...byGap].reverse().filter(p => !p.active).slice(0, 5)
  const gems = finished.filter(p => p.pick >= 100).sort((a, b) => gap(b) - gap(a)).slice(0, 5)
  const top = byGap.find(p => p.pick >= 100)!
  const bottom = under[0]

  return (
    <>
      <section className="wrap" style={{ padding: '72px var(--gutter) 40px' }}>
        <div className="kicker"><b>●</b> {data.players.length.toLocaleString()} NFL careers · every draft {data.players[0] && Math.min(...data.players.map(p => p.year))}–{data.model.lastJudgedClass}</div>
        <h1 className="display" style={{ marginTop: 20 }}>Football,<br />seen differently.</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'end', justifyContent: 'space-between', marginTop: 32 }}>
          <p className="lede">
            Every career, measured against what was expected of it. Not who was best,
            but who became <em>more</em>, or less, than anyone predicted.
          </p>
          <button className="search-btn" style={{ minWidth: 280, padding: '12px 14px', margin: 0 }} onClick={onSearch}>
            <span>Find a player</span><kbd>/</kbd>
          </button>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 56 }}>
        <div className="controls" style={{ justifyContent: 'space-between' }}>
          <Chips value={grp} onChange={setGrp} options={['ALL', ...GROUPS] as (Group | 'ALL')[]} label="Position" />
          <div className="mono faint" style={{ fontSize: 11, display: 'flex', gap: 16 }}>
            <span><span className="over">●</span> beat 97% of comparable picks</span>
            <span><span className="under">●</span> 1st-rounder outplayed by 97% of comparable picks</span>
          </div>
        </div>
        <Scatter players={players} labels={labels} height={Math.min(560, Math.max(380, window.innerHeight * 0.6))} />
        <p className="mono faint" style={{ fontSize: 11, marginTop: 12 }}>
          Each dot is one drafted player. The line is what history says a pick at that slot usually becomes. Hover to read, click to open.
        </p>
      </section>

      <section className="wrap">
        <div className="section">
          <div className="section-head">
            <div>
              <div className="kicker">The signature metric</div>
              <h2 className="h1" style={{ marginTop: 12 }}>Outlier<br />Index</h2>
            </div>
            <div className="prose">
              <p>
                One number from <strong>.01</strong> to <strong>.99</strong>. Of every player who started where this one
                started, what share had a <strong>worse</strong> career? Start at the bottom and finish at the top,
                and the number rises toward .99. Arrive as a sure thing and disappear, and it falls toward .01.
              </p>
              <p>
                {data.recruitingLinked
                  ? <>The starting point is the high-school star rating when we have it, and the draft slot otherwise.</>
                  : <>Right now the starting point is the draft slot. Once high-school star ratings are connected, the index starts from the recruiting rating, covering the whole road from high school to the NFL.</>}
              </p>
            </div>
          </div>
          <div className="grid-2">
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
            <MiniList title="Day-3 legends" sub="Pick 100+, most value above expectation" list={gems} />
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="section" style={{ paddingBottom: 0 }}>
          <div className="kicker" style={{ marginBottom: 24 }}>Investigate</div>
          {[
            ['#/gap', '01', 'Expectation Gap', 'Rank careers by how far they drifted from the draft’s prediction.'],
            ['#/paths', '02', 'Career DNA', 'Find players who walked the same road, across any era.'],
            ['#/lab', '03', 'Development Lab', 'Which colleges send players who outplay their draft slot?'],
            ['#/debate', '04', 'Debate Lab', 'Test football’s favorite arguments against every draft since 2000.'],
          ].map(([href, n, t, d]) => (
            <a key={href} href={href} className="entry">
              <span className="mono faint">{n}</span>
              <span className="h2">{t}</span>
              <span className="muted">{d}</span>
              <span className="arrow">→</span>
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
      <div className={`num ${kind}`} style={{ fontSize: 'clamp(88px, 14vw, 180px)', fontWeight: 700, lineHeight: 0.85, letterSpacing: '-0.06em' }}>
        {oiLabel(p.oi)}
      </div>
      <div className="h3" style={{ marginTop: 16 }}>{p.name}</div>
      <div className="mono faint" style={{ fontSize: 12 }}>
        {p.pos} · {p.year} · Rd {p.round} #{p.pick} · {p.av} AV vs {p.exp.toFixed(0)} expected
      </div>
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
                <div className="name">{p.name}</div>
                <div className="sub mono">{p.pos} · #{p.pick} · {p.year}</div>
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
