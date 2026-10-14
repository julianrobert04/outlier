import { useEffect, useMemo, useState } from 'react'
import { loadData, shortPick, type Dataset } from './data'
import { go, playerHref, useRoute } from './ui'
import Home from './pages/Home'
import PlayerPage from './pages/Player'
import GapPage from './pages/Gap'
import PathsPage from './pages/Paths'
import LabPage from './pages/Lab'
import DebatePage from './pages/Debate'
import MethodPage from './pages/Method'
import PlayersPage from './pages/Players'

const NAV = [
  ['/players', '00', 'Players'],
  ['/gap', '01', 'Expectation Gap'],
  ['/paths', '02', 'Career DNA'],
  ['/lab', '03', 'Development Lab'],
  ['/debate', '04', 'Debate Lab'],
  ['/method', '05', 'Method'],
] as const

export default function App() {
  const route = useRoute()
  const [data, setData] = useState<Dataset | null>(null)
  const [searching, setSearching] = useState(false)
  const [theme, setTheme] = useState<string | null>(() => {
    try { return localStorage.getItem('theme') } catch { return null }
  })

  useEffect(() => { loadData().then(setData) }, [])
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    else delete document.documentElement.dataset.theme
    try { if (theme) localStorage.setItem('theme', theme); else localStorage.removeItem('theme') } catch { /* private mode */ }
  }, [theme])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea')
      if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault(); setSearching(true)
      }
      if (e.key === 'Escape') setSearching(false)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  const toggleTheme = () => {
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(dark ? 'light' : 'dark')
  }

  const [, section, arg] = route.split('/')
  let page = <div className="loading">loading careers…</div>
  if (data) {
    page =
      section === 'players' ? <PlayersPage data={data} />
      : section === 'p' ? <PlayerPage data={data} id={decodeURIComponent(arg ?? '')} />
      : section === 'gap' ? <GapPage data={data} />
      : section === 'paths' ? <PathsPage data={data} archetype={arg ? decodeURIComponent(arg) : undefined} />
      : section === 'lab' ? <LabPage data={data} college={arg ? decodeURIComponent(arg) : undefined} />
      : section === 'debate' ? <DebatePage data={data} />
      : section === 'method' ? <MethodPage data={data} />
      : <Home data={data} onSearch={() => setSearching(true)} />
  }

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a href="#/" className="mark" aria-label="Outlier home">OUTLIER<i /></a>
          <nav className="nav">
            {NAV.map(([href, n, label]) => (
              <a key={href} href={`#${href}`} className={`/${section}` === href ? 'on' : ''}>
                <span>{n}</span>{label}
              </a>
            ))}
          </nav>
          <button className="search-btn" onClick={() => setSearching(true)} aria-label="Search players">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="m11 11 3.5 3.5" /></svg>
            <span className="lbl">Search any player</span>
            <kbd>/</kbd>
          </button>
          <button className="theme" onClick={toggleTheme} aria-label="Toggle dark mode">
            <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" /></svg>
          </button>
        </div>
      </header>
      <nav className="mobile-nav">
        {NAV.map(([href, , label]) => (
          <a key={href} href={`#${href}`} className={`/${section}` === href ? 'on' : ''}>{label}</a>
        ))}
      </nav>

      <main key={route} className="fade-in">{page}</main>

      <footer className="foot">
        <div className="wrap">
          <span>OUTLIER — football, seen differently.</span>
          <span>
            Data: nflverse / Pro Football Reference
            {data && <> · updated {new Date(data.generated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>}
          </span>
          <a href="#/method">How the numbers work →</a>
        </div>
      </footer>

      {searching && data && <Search data={data} close={() => setSearching(false)} />}
    </>
  )
}

function Search({ data, close }: { data: Dataset; close: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const starts = data.players.filter(p => p.name.toLowerCase().startsWith(s))
    const has = data.players.filter(p => !p.name.toLowerCase().startsWith(s) &&
      (p.name.toLowerCase().includes(s) || p.college.toLowerCase().startsWith(s)))
    return [...starts, ...has].sort((a, b) => b.av - a.av).slice(0, 12)
  }, [q, data])

  const open = (i: number) => { const p = results[i]; if (p) { go(playerHref(p).slice(1)); close() } }

  return (
    <div className="overlay" onClick={close}>
      <div className="palette" onClick={e => e.stopPropagation()} role="dialog" aria-label="Search players">
        <input
          autoFocus placeholder="Type a player or college…" value={q}
          onChange={e => { setQ(e.target.value); setSel(0) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
            if (e.key === 'Enter') {
              if (results.length) open(sel)
              else { go(`/players?q=${encodeURIComponent(q)}`); close() }
            }
          }}
        />
        {q.trim().length >= 2 && (
          results.length ? (
            <ul>
              {results.map((p, i) => (
                <li key={p.id} className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)}>
                  <a href={playerHref(p)} onClick={close}>
                    <span><strong>{p.name}</strong> <span className="faint">{p.pos} · {p.college}</span></span>
                    <span className="mono faint">{p.year} · {shortPick(p)}</span>
                  </a>
                </li>
              ))}
              <li className="all"><a href={`#/players?q=${encodeURIComponent(q)}`} onClick={close}><span>See every match in the directory →</span></a></li>
            </ul>
          ) : <div className="empty">No player matches “{q}”.</div>
        )}
      </div>
    </div>
  )
}
