// Derives defensive run stats from nflverse play-by-play into
// data/raw/pbp_def.json, which build-data.mjs merges into season rows.
//
//   node scripts/build-pbp.mjs            # download play-by-play, then derive
//   node scripts/build-pbp.mjs --offline  # reuse data/raw/pbp/*.csv.gz
//
// Per defender per regular season:
//   stuffs      tackles on running plays that gained 0 yards or lost yardage
//   runStops    tackles on running plays the offense "failed": under 40% of the
//               needed yards on 1st down, under 60% on 2nd, short of the line
//               to gain on 3rd/4th (the standard success-rate definition)
//   runTackles  all tackles on running plays (solo or assisted)

import { createReadStream, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'

const RAW = 'data/raw'
const BASE = 'https://github.com/nflverse/nflverse-data/releases/download/pbp'
const FIRST = 2000
const LAST = Number(process.env.OUTLIER_LAST_SEASON ?? new Date().getFullYear())
const TACKLERS = ['solo_tackle_1_player_id', 'solo_tackle_2_player_id', 'assist_tackle_1_player_id',
  'assist_tackle_2_player_id', 'assist_tackle_3_player_id', 'assist_tackle_4_player_id',
  'tackle_with_assist_1_player_id', 'tackle_with_assist_2_player_id']

function splitCSVLine(line) {
  const out = []
  let field = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { out.push(field); field = '' }
    else field += c
  }
  out.push(field)
  return out
}

function failed(down, togo, gained) {
  if (down === 1) return gained < 0.4 * togo
  if (down === 2) return gained < 0.6 * togo
  return gained < togo
}

async function season(y, out) {
  const file = `${RAW}/pbp/${y}.csv.gz`
  if (!existsSync(file)) return 0
  const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity })
  let idx = null, plays = 0
  for await (const line of rl) {
    const f = splitCSVLine(line)
    if (!idx) { idx = Object.fromEntries(f.map((h, i) => [h, i])); continue }
    if (f[idx.season_type] !== 'REG' || f[idx.play_type] !== 'run' || f[idx.rush_attempt] !== '1') continue
    if (f[idx.qb_kneel] === '1') continue
    plays++
    const gained = Number(f[idx.yards_gained]) || 0
    const down = Number(f[idx.down]) || 0
    const togo = Number(f[idx.ydstogo]) || 10
    const stuff = gained <= 0
    const stop = down > 0 && failed(down, togo, gained)
    const seen = new Set()
    for (const col of TACKLERS) {
      const id = f[idx[col]]
      if (!id || id === 'NA' || seen.has(id)) continue
      seen.add(id)
      const key = `${id}|${y}`
      const s = (out[key] ??= [0, 0, 0])
      if (stuff) s[0]++
      if (stop) s[1]++
      s[2]++
    }
  }
  return plays
}

async function main() {
  await mkdir(`${RAW}/pbp`, { recursive: true })
  if (!process.argv.includes('--offline')) {
    for (let y = FIRST; y <= LAST; y++) {
      const res = await fetch(`${BASE}/play_by_play_${y}.csv.gz`)
      if (res.status === 404) continue
      if (!res.ok) throw new Error(`${y}: HTTP ${res.status}`)
      await writeFile(`${RAW}/pbp/${y}.csv.gz`, Buffer.from(await res.arrayBuffer()))
    }
  }
  const out = {}
  for (let y = FIRST; y <= LAST; y++) {
    const n = await season(y, out)
    console.log(`${y}: ${n} runs`)
  }
  await writeFile(`${RAW}/pbp_def.json`, JSON.stringify(out))
  console.log(`${Object.keys(out).length} defender-seasons → ${RAW}/pbp_def.json`)
}

main()
