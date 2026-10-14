import { useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from './data'
import { go, playerHref, PlayerTip, useTip } from './ui'

type Props = {
  players: Player[]
  height?: number
  labels?: Player[] // direct labels, used sparingly
  focus?: Player // a single player to ring and label
  tone?: (p: Player) => 'over' | 'under' | null
}

const PICK_TICKS = [1, 5, 10, 32, 64, 100, 150, 250]
const PAD = { l: 44, r: 16, t: 16, b: 36 }

const defaultTone = (p: Player) => (p.oi >= 0.97 ? 'over' : p.oi <= 0.03 && p.round === 1 ? 'under' : null)

function jitter(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h >>> 0) % 1000) / 1000 - 0.5
}

function halo(g: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string) {
  g.lineJoin = 'round'; g.strokeStyle = bg; g.lineWidth = 4; g.strokeText(text, x, y)
  g.fillStyle = fg; g.fillText(text, x, y)
}

export default function Scatter({ players, height = 460, labels = [], focus, tone = defaultTone }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(800)
  const [themeTick, setThemeTick] = useState(0)
  const [hover, setHover] = useState<Player | null>(null)
  const { tip, setTip } = useTip()

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    if (box.current) ro.observe(box.current)
    const mo = new MutationObserver(() => setThemeTick(t => t + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onMq = () => setThemeTick(t => t + 1)
    mq.addEventListener('change', onMq)
    return () => { ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', onMq) }
  }, [])

  const maxAv = useMemo(() => Math.max(60, ...players.map(p => p.av)), [players])
  const ymax = Math.ceil(maxAv / 50) * 50
  const x = (pick: number) => PAD.l + (Math.log(pick) / Math.log(262)) * (w - PAD.l - PAD.r)
  const y = (av: number) => PAD.t + (1 - av / ymax) * (height - PAD.t - PAD.b)

  const pts = useMemo(
    () => players.map(p => ({ p, x: x(Math.max(1, p.pick + jitter(p.id) * 0.8)), y: y(p.av), t: tone(p) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, w, height, ymax, tone],
  )

  // The expectation line: mean expected AV at each pick.
  const curve = useMemo(() => {
    const sums = new Map<number, [number, number]>()
    for (const p of players) {
      const b = Math.round(Math.log(p.pick) * 8)
      const s = sums.get(b) ?? [0, 0]
      sums.set(b, [s[0] + p.exp, s[1] + 1])
    }
    return [...sums.entries()].sort((a, b) => a[0] - b[0])
      .filter(([, [, n]]) => n >= 5)
      .map(([b, [s, n]]) => [Math.exp(b / 8), s / n] as const)
  }, [players])

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const css = getComputedStyle(document.documentElement)
    const col = (v: string) => css.getPropertyValue(v).trim()
    const dpr = window.devicePixelRatio || 1
    c.width = w * dpr; c.height = height * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.clearRect(0, 0, w, height)

    // grid + axes
    g.font = '10px "JetBrains Mono", monospace'
    g.fillStyle = col('--ink-3')
    g.strokeStyle = col('--rule')
    g.lineWidth = 1
    for (let v = 0; v <= ymax; v += 50) {
      g.beginPath(); g.moveTo(PAD.l, y(v) + 0.5); g.lineTo(w - PAD.r, y(v) + 0.5); g.stroke()
      g.textAlign = 'right'; g.fillText(String(v), PAD.l - 8, y(v) + 3)
    }
    g.textAlign = 'center'
    for (const t of PICK_TICKS) {
      if (x(t) > w - PAD.r) continue
      g.fillText(t === 1 ? '#1' : String(t), x(t), height - PAD.b + 16)
    }
    g.textAlign = 'left'
    g.fillText('CAREER AV ↑', PAD.l, PAD.t - 4)
    g.textAlign = 'right'
    g.fillText('DRAFT PICK (LOG) →', w - PAD.r, height - 6)

    // dots: neutral first, then toned on top
    const r = w < 600 ? 1.6 : 2.2
    g.fillStyle = col('--dot')
    for (const d of pts) if (!d.t) { g.beginPath(); g.arc(d.x, d.y, r, 0, Math.PI * 2); g.fill() }
    for (const d of pts) if (d.t) {
      g.fillStyle = col(d.t === 'over' ? '--over' : '--under')
      g.beginPath(); g.arc(d.x, d.y, r + 1.3, 0, Math.PI * 2); g.fill()
    }

    // expectation line
    g.beginPath()
    curve.forEach(([pk, v], i) => (i ? g.lineTo(x(pk), y(v)) : g.moveTo(x(pk), y(v))))
    g.lineJoin = 'round'
    g.strokeStyle = col('--paper'); g.lineWidth = 5; g.stroke()
    g.strokeStyle = col('--ink'); g.lineWidth = 2; g.stroke()
    const last = curve[Math.floor(curve.length * 0.55)]
    if (last) {
      g.textAlign = 'left'; g.font = '500 11px "JetBrains Mono", monospace'
      halo(g, 'what the slot predicts', x(last[0]) + 6, y(last[1]) - 12, col('--paper'), col('--ink'))
    }

    // labels
    const drawLabel = (p: Player, strong: boolean) => {
      const d = pts.find(q => q.p === p)
      if (!d) return
      g.strokeStyle = col('--ink'); g.lineWidth = 1.5
      g.beginPath(); g.arc(d.x, d.y, strong ? 6 : 4.5, 0, Math.PI * 2); g.stroke()
      g.font = `${strong ? 700 : 600} 12px Archivo, sans-serif`
      const right = d.x > w - 140
      g.textAlign = right ? 'right' : 'left'
      halo(g, p.name, d.x + (right ? -10 : 10), d.y + 4, col('--paper'), col('--ink'))
    }
    labels.forEach(p => drawLabel(p, false))
    if (focus) drawLabel(focus, true)
    if (hover) {
      const d = pts.find(q => q.p === hover)
      if (d) { g.strokeStyle = col('--ink'); g.lineWidth = 2; g.beginPath(); g.arc(d.x, d.y, 6, 0, Math.PI * 2); g.stroke() }
    }
  }, [pts, curve, w, height, ymax, labels, focus, hover, themeTick])

  const nearest = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    let best: (typeof pts)[number] | null = null, bd = 100
    for (const d of pts) {
      const dd = (d.x - mx) ** 2 + (d.y - my) ** 2
      if (dd < bd) { bd = dd; best = d }
    }
    return best?.p ?? null
  }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <canvas
        ref={ref}
        style={{ width: '100%', height, display: 'block', cursor: hover ? 'pointer' : 'crosshair' }}
        onMouseMove={e => {
          const p = nearest(e)
          setHover(p)
          setTip(p ? { x: e.clientX, y: e.clientY, body: <PlayerTip p={p} /> } : null)
        }}
        onMouseLeave={() => { setHover(null); setTip(null) }}
        onClick={e => { const p = nearest(e); if (p) go(playerHref(p).slice(1)) }}
        role="img"
        aria-label={`Scatter of ${players.length} drafted players: draft pick against career value`}
      />
      {tip}
    </div>
  )
}
