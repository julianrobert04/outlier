import { useEffect, useState, type ReactNode } from 'react'
import { gap, oiLabel, signed, type Player } from './data'

export function useRoute() {
  const read = () => (location.hash.slice(1) || '/').split('?')[0]
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (path: string) => { location.hash = path }

// Filter state lives in the hash query (#/players?grp=QB&sort=oi), so Back
// restores it and a filtered view can be shared. replaceState doesn't add
// history entries or remount the page.
const readQuery = () => new URLSearchParams(location.hash.split('?')[1] ?? '')
export function useQueryState<T extends string | number>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = readQuery().get(key)
    if (raw == null) return initial
    return (typeof initial === 'number' ? Number(raw) : raw) as T
  })
  const set = (v: T) => {
    setValue(v)
    const q = readQuery()
    if (v === initial) q.delete(key); else q.set(key, String(v))
    const path = location.hash.slice(1).split('?')[0] || '/'
    const qs = q.toString()
    history.replaceState(null, '', `#${path}${qs ? `?${qs}` : ''}`)
  }
  return [value, set]
}
export const currentQuery = () => { const q = location.hash.split('?')[1]; return q ? `?${q}` : '' }
export const playerHref = (p: Player) => `#/p/${p.id}`

export function Chips<T extends string | number>({ value, options, onChange, label }: {
  value: T
  options: (T | [T, string])[]
  onChange: (v: T) => void
  label?: string
}) {
  const chips = (
    <div className="chips" role="group" aria-label={label}>
      {options.map(o => {
        const [v, l]: [T, string] = Array.isArray(o) ? o : [o, String(o)]
        return (
          <button key={String(v)} className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
            {l}
          </button>
        )
      })}
    </div>
  )
  return label ? <div className="ctl"><label>{label}</label>{chips}</div> : chips
}

// Diverging bar centred on zero: vermilion = beat expectation, blue = fell short.
export function GapBar({ value, max }: { value: number; max: number }) {
  const w = Math.min(Math.abs(value) / max, 1) * 50
  return (
    <div className="bar" aria-label={`${signed(value, 1)} AV vs expected`}>
      <i className={value >= 0 ? 'pos' : 'neg'} style={{ width: `${w}%` }} />
    </div>
  )
}

// Gap values stay in ink; only the sign carries the over/under color.
export function GapNum({ p, digits = 1 }: { p: Player; digits?: number }) {
  const s = signed(gap(p), digits)
  return (
    <span className="num">
      <span className={gap(p) >= 0 ? 'over' : 'under'}>{s[0]}</span>{s.slice(1)}
    </span>
  )
}

export function OI({ value, size = 15 }: { value: number; size?: number }) {
  const cls = value >= 0.95 ? 'over' : value <= 0.05 ? 'under' : ''
  return (
    <span className={`oi ${cls}`} style={{ fontSize: size }} title="Outlier Index: share of comparable players with a worse career">
      <span className="v">{oiLabel(value)}</span>
    </span>
  )
}

export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; body: ReactNode } | null>(null)
  const node = tip && (
    <div
      className="tip"
      style={{
        left: Math.min(tip.x + 14, window.innerWidth - 250),
        top: tip.y + 14 > window.innerHeight - 90 ? tip.y - 80 : tip.y + 14,
      }}
    >
      {tip.body}
    </div>
  )
  return { tip: node, setTip }
}

export function PlayerTip({ p }: { p: Player }) {
  return (
    <>
      <b>{p.name}</b>
      <div className="mono">{p.pos} · {p.year} · Rd {p.round} #{p.pick} · {p.college}</div>
      <div className="mono">AV {p.av} vs {p.exp.toFixed(1)} expected · OI {oiLabel(p.oi)}</div>
    </>
  )
}
