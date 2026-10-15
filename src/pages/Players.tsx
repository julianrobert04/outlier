import { useEffect, useMemo, useState } from 'react'
import { gap, GROUPS, shortPick, type Dataset, type Group, type Player } from '../data'
import { Chips, GapNum, OI, playerHref, useQueryState } from '../ui'

type Entry = 'ALL' | 'DRAFTED' | 'UDFA'
type Era = 'ALL' | '1980s' | '1990s' | '2000s' | '2010s' | 'RISING'
type Sort = 'oi' | 'av' | 'gap' | 'name' | 'year'

const SORTS: Record<Sort, (a: Player, b: Player) => number> = {
  oi: (a, b) => b.oi - a.oi || a.rank / a.of - b.rank / b.of || b.av - a.av,
  av: (a, b) => b.av - a.av,
  gap: (a, b) => gap(b) - gap(a),
  name: (a, b) => a.name.localeCompare(b.name),
  year: (a, b) => b.year - a.year || (a.pick || 999) - (b.pick || 999),
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function PlayersPage({ data }: { data: Dataset }) {
  const [q, setQ] = useQueryState<string>('q', '')
  const [grp, setGrp] = useQueryState<Group | 'ALL'>('grp', 'ALL')
  const [entry, setEntry] = useQueryState<Entry>('entry', 'ALL')
  const [era, setEra] = useQueryState<Era>('class', 'ALL')
  const [playedN, setPlayedN] = useQueryState<number>('played', 1)
  const [sort, setSort] = useQueryState<Sort>('sort', 'av')
  const [n, setN] = useQueryState<number>('n', 100)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const played = playedN === 1
  const active = [grp !== 'ALL', entry !== 'ALL', era !== 'ALL', !played].filter(Boolean).length
  const reset = () => { setGrp('ALL'); setEntry('ALL'); setEra('ALL'); setPlayedN(1) }
  useEffect(() => {
    const on = () => { const v = new URLSearchParams(location.hash.split('?')[1]).get('q'); if (v != null) setQ(v) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const list = useMemo(() => {
    const s = fold(q.trim())
    return data.players
      .filter(p =>
        (!s || fold(p.name).includes(s) || fold(p.college).includes(s) || p.team.toLowerCase() === s) &&
        (grp === 'ALL' || p.grp === grp) &&
        (entry === 'ALL' || (entry === 'UDFA' ? !p.pick : p.pick > 0)) &&
        (era === 'ALL' || (era === 'RISING' ? p.young : !p.young && `${Math.floor(p.year / 10) * 10}s` === era)) &&
        (!played || p.games > 0))
      .sort(SORTS[sort])
  }, [data, q, grp, entry, era, played, sort])

  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <h1 className="h1">Players</h1>
      <p className="lede" style={{ marginTop: 20 }}>
        {data.players.length.toLocaleString()} careers, drafted and undrafted, {data.model.firstClass}–{data.model.lastClass}. Search by name, college or team, then open
        any player for the full story: the journey, season-by-season stats, and who walked the same path.
      </p>

      <div className="section" style={{ marginTop: 32, paddingTop: 32 }}>
        <div className="bigsearch">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="5" /><path d="m11 11 3.5 3.5" /></svg>
          <input
            autoFocus value={q} placeholder="Search a player, college or team (e.g. SF)…"
            onChange={e => { setQ(e.target.value); setN(100) }}
            aria-label="Search players"
          />
          {q && <button onClick={() => setQ('')} className="mono faint" aria-label="Clear search">clear</button>}
        </div>

        <button className="filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
          Filters{active ? ` (${active})` : ''} <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
        </button>
        <div className={`controls filters-body ${filtersOpen ? 'open' : ''}`} style={{ marginTop: 24 }}>
          <Chips value={grp} onChange={setGrp} label="Position" options={['ALL', ...GROUPS] as (Group | 'ALL')[]} />
          <Chips value={entry} onChange={setEntry} label="Entry" options={[['ALL', 'All'], ['DRAFTED', 'Drafted'], ['UDFA', 'Undrafted']]} />
          <Chips value={era} onChange={setEra} label="Class" options={[['ALL', 'All'], ['1980s', '1980s'], ['1990s', '1990s'], ['2000s', '2000s'], ['2010s', '2010s'], ['RISING', `Rising ${data.model.youngFrom}–${String(data.model.lastClass).slice(2)}`]]} />
          <Chips value={playedN} onChange={setPlayedN} label="Show" options={[[1, 'Played a game'], [0, 'Everyone']]} />
          <Chips value={sort} onChange={setSort} label="Sort by" options={[['av', 'Career value'], ['oi', 'Outlier Index'], ['gap', 'Gap'], ['year', 'Newest'], ['name', 'A–Z']]} />
        </div>
        <p className="meta" style={{ marginBottom: 12, display: 'flex', gap: 16 }} aria-live="polite">
          <span>{list.length.toLocaleString()} players</span>
          {active > 0 && <button className="mono" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }} onClick={reset}>reset filters</button>}
        </p>

        <table className="rows">
          <thead>
            <tr>
              <th>Player</th><th className="hide-s">Entered</th><th className="hide-s">Path</th>
              <th className="r hide-s">Games</th><th className="r">AV</th><th className="r hide-s">Gap</th><th className="r">OI</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, n).map(p => (
              <tr key={p.id} className="link" onClick={() => (location.hash = playerHref(p).slice(1))}>
                <td>
                  <div className="name"><a href={playerHref(p)} onClick={e => e.stopPropagation()}>{p.name}</a>{p.young ? <span className="tag">rising</span> : null}</div>
                  <div className="sub mono">{p.pos} · {p.college || '—'}</div>
                </td>
                <td className="mono hide-s">{p.year} · {shortPick(p)}</td>
                <td className="hide-s muted">{p.dna}</td>
                <td className="r num hide-s">{p.games}</td>
                <td className="r num">{p.av}{p.est ? <span className="faint" title="Estimated">*</span> : null}</td>
                <td className="r hide-s"><GapNum p={p} /></td>
                <td className="r"><OI value={p.oi} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && (
          <p className="muted" style={{ padding: '24px 0' }}>
            {q.trim()
              ? <>No player, college or team matches “{q.trim()}”{active ? ' with these filters' : ''}. Check the spelling, or try a last name only.</>
              : <>No players match these filters. <button style={{ textDecoration: 'underline' }} onClick={reset}>Reset filters</button></>}
          </p>
        )}
        {n < list.length && <button className="more" onClick={() => setN(n + 100)}>Show 100 more</button>}
        <p className="mono faint" style={{ fontSize: 12, marginTop: 16 }}>* estimated career value (undrafted players; see Method).</p>
      </div>
    </div>
  )
}
