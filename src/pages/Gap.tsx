import { useMemo, useState } from 'react'
import { era, gap, GROUPS, type Dataset, type Group, type Player } from '../data'
import { Chips, GapBar, GapNum, OI, playerHref } from '../ui'

const BOARDS = {
  over: { label: 'Beat the slot', note: 'Most career value above what the draft slot predicted.', filter: () => true, dir: -1 },
  under: { label: 'Fell short', note: 'Largest shortfall against what the slot predicted.', filter: () => true, dir: 1 },
  late: { label: 'Day-3 legends', note: 'Picks 100 and later, ranked by value above expectation.', filter: (p: Player) => p.pick >= 100, dir: -1 },
  top10: { label: 'Top-10 busts', note: 'Top-10 picks, ranked by shortfall against expectation.', filter: (p: Player) => p.pick <= 10, dir: 1 },
} as const
type Board = keyof typeof BOARDS

export default function GapPage({ data }: { data: Dataset }) {
  const [board, setBoard] = useState<Board>('over')
  const [grp, setGrp] = useState<Group | 'ALL'>('ALL')
  const [dec, setDec] = useState('ALL')
  const [done, setDone] = useState(true)
  const [n, setN] = useState(50)

  const decades = useMemo(() => [...new Set(data.players.map(p => era(p.year)))], [data])
  const list = useMemo(() => {
    const b = BOARDS[board]
    return data.players
      .filter(p => b.filter(p) && (grp === 'ALL' || p.grp === grp) && (dec === 'ALL' || era(p.year) === dec) && (!done || !p.active))
      .sort((a, c) => b.dir * (gap(a) - gap(c)))
  }, [data, board, grp, dec, done])
  const max = Math.max(...list.slice(0, n).map(p => Math.abs(gap(p))), 1)

  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <div className="kicker"><b>01</b> Expectation Gap</div>
      <h1 className="h1" style={{ marginTop: 16 }}>Who became more<br />than expected?</h1>
      <p className="lede" style={{ marginTop: 20 }}>
        Every pick comes with a prediction: what players taken at that slot, at that position, in that era usually become.
        The gap is the distance between that prediction and the career that followed.
      </p>

      <div className="section" style={{ marginTop: 48 }}>
        <div className="controls">
          <Chips value={board} onChange={v => { setBoard(v); setN(50) }} label="Board"
            options={Object.entries(BOARDS).map(([k, v]) => [k as Board, v.label])} />
          <Chips value={grp} onChange={setGrp} label="Position" options={['ALL', ...GROUPS] as (Group | 'ALL')[]} />
          <Chips value={dec} onChange={setDec} label="Draft era" options={['ALL', ...decades]} />
          <Chips value={done ? 1 : 0} onChange={v => setDone(!!v)} label="Careers" options={[[1, 'Completed'], [0, 'Include active']]} />
        </div>
        <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>{BOARDS[board].note} {list.length.toLocaleString()} players.</p>

        <table className="rows">
          <thead>
            <tr>
              <th>#</th><th>Player</th><th className="hide-s">Drafted</th>
              <th className="r hide-s">Expected</th><th className="r hide-s">Actual</th>
              <th className="hide-s" style={{ width: '22%' }}>Gap</th><th className="r">AV</th><th className="r">OI</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, n).map((p, i) => (
              <tr key={p.id} className="link" onClick={() => (location.hash = playerHref(p).slice(1))}>
                <td className="rank">{i + 1}</td>
                <td><div className="name">{p.name}</div><div className="sub mono">{p.pos} · {p.college}</div></td>
                <td className="mono hide-s">{p.year} · Rd {p.round} #{p.pick}</td>
                <td className="r num hide-s faint">{p.exp.toFixed(1)}</td>
                <td className="r num hide-s">{p.av}</td>
                <td className="hide-s"><GapBar value={gap(p)} max={max} /></td>
                <td className="r"><GapNum p={p} /></td>
                <td className="r"><OI value={p.oi} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {n < list.length && (
          <button className="more" onClick={() => setN(n + 50)}>Show 50 more</button>
        )}
      </div>
    </div>
  )
}
