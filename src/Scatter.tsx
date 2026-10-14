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

// Highlight the true outliers. Among undrafted players nearly any real career
// beats 97% of the group, so they also need a substantial career (40+ AV).
const defaultTone = (p: Player) =>
  p.pct >= 97 && (p.pick > 0 || p.av >= 40) ? 'over' : p.pct <= 3 && p.round === 1 ? 'under' : null

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
  const hasUdfa = useMemo(() => players.some(p => !p.pick), [players])
  const plotR = w - PAD.r - (hasUdfa ? Math.max(48, w * 0.07) : 0) // drafted area ends here
  const x = (pick: number) => PAD.l + (Math.log(pick) / Math.log(262)) * (plotR - PAD.l)
  const udfaX = (id: string) => plotR + 18 + (jitter(id) + 0.5) * (w - PAD.r - plotR - 22)
  const y = (av: number) => PAD.t + (1 - av / ymax) * (height - PAD.t - PAD.b)

  const pts = useMemo(
    () => players.map(p => ({ p, x: p.pick ? x(Math.max(1, p.pick + jitter(p.id) * 0.8)) : udfaX(p.id), y: y(p.av), t: tone(p) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, w, height, ymax, tone],
  )

  // The expectation line: mean expected AV at each pick.
  const curve = useMemo(() => {
    const sums = new Map<number, [number, number]>()
    for (const p of players) {
      if (!p.pick) continue
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
    let lastTick = -Infinity
    for (const t of PICK_TICKS) {
      if (x(t) > plotR || x(t) - lastTick < 30) continue
      lastTick = x(t)
      g.fillText(t === 1 ? '#1' : String(t), x(t), height - PAD.b + 16)
    }
    if (hasUdfa) {
      g.fillText('UDFA', (plotR + 18 + w - PAD.r) / 2, height - PAD.b + 16)
      g.strokeStyle = col('--rule'); g.setLineDash([2, 3])
      g.beginPath(); g.moveTo(plotR + 9.5, PAD.t); g.lineTo(plotR + 9.5, height - PAD.b); g.stroke(); g.setLineDash([])
    }
    g.textAlign = 'left'
    g.fillText('CAREER AV ↑', PAD.l, PAD.t - 4)
    g.textAlign = 'right'
    g.fillText('DRAFT PICK (LOG) →', plotR, height - 6)

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
    const last = curve[Math.floor(curve.length * 0.4)]
    if (last) {
      g.textAlign = 'left'; g.font = '500 11px "JetBrains Mono", monospace'
      const label = 'what the slot predicts'
      const lx = Math.min(x(last[0]) + 6, plotR - g.measureText(label).width - 4)
      halo(g, label, lx, y(last[1]) - 14, col('--paper'), col('--ink'))
    }

    // labels: try right, then left; skip a label that would collide
    const placed: [number, number, number, number][] = []
    const drawLabel = (p: Player, strong: boolean) => {
      const d = pts.find(q => q.p === p)
      if (!d) return
      g.font = `${strong ? 700 : 600} 12px Archivo, sans-serif`
      const tw = g.measureText(p.name).width
      const sides = d.x > w - 140 ? [-1, 1] : [1, -1]
      const side = sides.find(sd => {
        const x0 = sd > 0 ? d.x + 10 : d.x - 10 - tw
        return x0 >= 0 && x0 + tw <= w && !placed.some(([a, b, c, e]) => x0 < c && x0 + tw > a && d.y - 8 < e && d.y + 8 > b)
      })
      if (side === undefined && !strong) return
      const sd = side ?? 1
      const x0 = sd > 0 ? d.x + 10 : d.x - 10 - tw
      placed.push([x0, d.y - 8, x0 + tw, d.y + 8])
      g.strokeStyle = col('--ink'); g.lineWidth = 1.5
      g.beginPath(); g.arc(d.x, d.y, strong ? 6 : 4.5, 0, Math.PI * 2); g.stroke()
      g.textAlign = 'left'
      halo(g, p.name, x0, d.y + 4, col('--paper'), col('--ink'))
    }
    if (focus) drawLabel(focus, true)
    labels.forEach(p => drawLabel(p, false))
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
