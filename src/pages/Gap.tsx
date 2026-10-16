import { useMemo } from 'react'
import { era, gap, GROUPS, type Dataset, type Group, type Player } from '../data'
import { Chips, GapBar, GapNum, OI, playerHref, useQueryState } from '../ui'

const BOARDS = {
  over: { label: 'Beat the slot', note: 'Most career value above what the draft slot predicted.', filter: (p: Player) => !p.young && p.pick > 0, dir: -1 },
  under: { label: 'Fell short', note: 'Largest shortfall against what the slot predicted.', filter: (p: Player) => !p.young && p.pick > 0, dir: 1 },
  late: { label: 'Day-3 legends', note: 'Picks 100 and later, ranked by value above expectation.', filter: (p: Player) => !p.young && p.pick >= 100, dir: -1 },
  top10: { label: 'Top-10 busts', note: 'Top-10 picks, ranked by shortfall against expectation.', filter: (p: Player) => !p.young && p.pick > 0 && p.pick <= 10, dir: 1 },
  udfa: { label: 'Undrafted', note: 'Undrafted players, ranked by estimated value above other undrafted players.', filter: (p: Player) => !p.young && !p.pick, dir: -1 },
  rising: { label: 'Rising 2022–25', note: 'Early careers, ranked by Outlier Index on pace: value per season so far against young players from a similar slot.', filter: (p: Player) => !!p.young, dir: 0 },
} as const
type Board = keyof typeof BOARDS

export default function GapPage({ data }: { data: Dataset }) {
  const [rawBoard, setBoard] = useQueryState<Board>('board', 'over')
  const board: Board = rawBoard in BOARDS ? rawBoard : 'over'
  const [grp, setGrp] = useQueryState<Group | 'ALL'>('grp', 'ALL')
  const [dec, setDec] = useQueryState<string>('era', 'ALL')
  const [doneN, setDone] = useQueryState<number>('done', 1)
  const [n, setN] = useQueryState<number>('n', 50)
  const done = doneN === 1

  const decades = useMemo(() => [...new Set(data.players.filter(p => !p.young).map(p => era(p.year)))], [data])
  const list = useMemo(() => {
    const b = BOARDS[board]
    return data.players
      .filter(p => b.filter(p) && (grp === 'ALL' || p.grp === grp) && (board === 'rising' || dec === 'ALL' || era(p.year) === dec) && (board === 'rising' || !done || !p.active))
      .sort((a, c) => (b.dir ? b.dir * (gap(a) - gap(c)) : c.oi - a.oi || a.rank / a.of - c.rank / c.of || c.av - a.av))
  }, [data, board, grp, dec, done])
  const max = Math.max(...list.slice(0, n).map(p => Math.abs(gap(p))), 1)

  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <h1 className="h1">Who became more<br />than expected?</h1>
      <p className="lede" style={{ marginTop: 20 }}>
        Every pick comes with a prediction: what players taken at that slot, at that position, in that era usually become.
        The gap is the distance between that prediction and the career that followed.
      </p>

      <div className="section" style={{ marginTop: 48 }}>
        <div className="controls">
          <Chips value={board} onChange={v => { setBoard(v); setN(50) }} label="Board"
            options={Object.entries(BOARDS).map(([k, v]) => [k as Board, v.label])} />
          <Chips value={grp} onChange={setGrp} label="Position" options={['ALL', ...GROUPS] as (Group | 'ALL')[]} />
          {board !== 'rising' && <>
            <Chips value={dec} onChange={setDec} label="Draft era" options={['ALL', ...decades]} />
            <Chips value={doneN} onChange={setDone} label="Careers" options={[[1, 'Completed'], [0, 'Include active']]} />
          </>}
        </div>
        <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>{BOARDS[board].note} {list.length.toLocaleString()} players.</p>

        <table className="rows">
          <thead>
            <tr>
              <th>#</th><th>Player</th><th className="hide-s">Drafted</th>
              <th className="r hide-s">Usual</th><th className="r hide-s">His</th>
              <th className="hide-s" style={{ width: '22%' }}>Vs. expectation</th><th className="r">Gap</th><th className="r">OI</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, n).map((p, i) => (
              <tr key={p.id} className="link" onClick={() => (location.hash = playerHref(p).slice(1))}>
                <td className="rank">{i + 1}</td>
                <td><div className="name"><a href={playerHref(p)} onClick={e => e.stopPropagation()}>{p.name}</a></div><div className="sub mono">{p.pos} · {p.college}</div></td>
                <td className="mono hide-s">{p.year} · {p.pick ? `Rd ${p.round} #${p.pick}` : 'UDFA'}</td>
                <td className="r num hide-s faint">{p.exp.toFixed(1)}</td>
                <td className="r num hide-s">{p.av}{p.est ? '*' : ''}</td>
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
