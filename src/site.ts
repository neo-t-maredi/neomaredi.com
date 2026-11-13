// Page behaviour ported from reference/index.html.
// initSite() wires up the DOM rendered by App and returns a cleanup
// function, so React StrictMode's double mount does not start two loops.

type Point = { t: number; ws: number; p1: number; p2: number }

/* ---------- data (deterministic, computed once) ---------- */

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20260903)

function gauss(): number {
  let u = 0
  let v = 0
  while (u === 0) u = rnd()
  while (v === 0) v = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

const N = 1000
const K = 2.05
const C = 8.4
const RATED = 2000
const CUTIN = 3
const RATEDWS = 13
const CUTOUT = 25
const MAXWS = 28
const MAXP = 2250
const CURVE_STEPS = 200

// Reference curve for the synthetic machine.
function refCurve(ws: number): number {
  if (ws < CUTIN || ws > CUTOUT) return 0
  if (ws >= RATEDWS) return RATED
  const a = Math.pow(ws, 3) - Math.pow(CUTIN, 3)
  const b = Math.pow(RATEDWS, 3) - Math.pow(CUTIN, 3)
  return RATED * (a / b)
}

// T07: tracks reference until ~8 m/s, then falls away to a lower plateau.
// Illustrates the kind of underperformance a power-curve comparison can reveal.
function degCurve(ws: number): number {
  const base = refCurve(ws)
  if (base <= 0) return 0
  if (ws <= 8) return base
  const span = Math.min(1, (ws - 8) / 6)
  const loss = 0.055 + 0.135 * span
  return Math.min(base * (1 - loss), 1858)
}

const pts: Point[] = []
{
  let latent = 0
  for (let i = 0; i < N; i++) {
    latent = 0.94 * latent + Math.sqrt(1 - 0.94 * 0.94) * gauss()
    const u = Math.min(0.9995, Math.max(0.0005, normCdf(latent)))
    const ws = C * Math.pow(-Math.log(1 - u), 1 / K)
    const p1 = Math.max(0, refCurve(ws) + gauss() * 52)
    const p2 = Math.max(0, degCurve(ws) + gauss() * 52)
    pts.push({ t: i, ws, p1, p2 })
  }
}

// AEP gap, weighted by the Weibull resource.
const GAPTXT = (() => {
  let e1 = 0
  let e2 = 0
  for (let w = 0.1; w <= CUTOUT; w += 0.1) {
    const pdf = (K / C) * Math.pow(w / C, K - 1) * Math.exp(-Math.pow(w / C, K))
    e1 += refCurve(w) * pdf * 0.1
    e2 += degCurve(w) * pdf * 0.1
  }
  return '\u2212' + (((e1 - e2) / e1) * 100).toFixed(1) + '% AEP'
})()

/* ---------- DOM ---------- */

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} not found`)
  return el as T
}

export function initSite(): () => void {
  const root = document.documentElement
  const timers: number[] = []
  let rafHero = 0
  let rafShift = 0

  /* ---------- theme ---------- */
  const tog = byId<HTMLButtonElement>('themeToggle')
  let stored: string | null = null
  try {
    stored = localStorage.getItem('theme')
  } catch {
    stored = null
  }
  const initial = (stored === 'light' || stored === 'dark' ? stored : null) ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

  const applyTheme = (t: string) => {
    root.setAttribute('data-theme', t)
    tog.textContent = t === 'dark' ? 'Light' : 'Dark'
    tog.setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' theme')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#181a1a' : '#e6e6e2')
  }
  applyTheme(initial)

  /* ---------- mail ---------- */
  const mail = byId<HTMLAnchorElement>('mail')
  const user = 'neo.maredi.dev'
  const dom = 'gmail.com'
  mail.href = 'mailto:' + user + '@' + dom
  mail.textContent = user + '@' + dom

  /* ---------- pivot gate and page controls ---------- */
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const content = byId('siteContent')
  const gate = byId('pivotGate')
  const progress = byId('shiftProgress')
  const fillEl = byId('shiftFill')
  const pctEl = byId('shiftPct')
  const stageEls = Array.from(document.querySelectorAll<HTMLLIElement>('#shiftStages li'))
  const note = byId('plotNote')
  const topButton = byId<HTMLButtonElement>('backToTop')
  const heroSection = document.querySelector<HTMLElement>('.hero')!
  const revealEls = [byId('h1'), byId('lede'), byId('actions')]
  let completed = false
  let disposed = false
  let redrawHero = () => {}
  let finishHero = () => {}

  const setShift = (f: number) => {
    fillEl.style.width = (f * 100).toFixed(2) + '%'
    const percent = f >= 1 ? 100 : Math.floor(f * 100)
    pctEl.textContent = percent + '%'
    progress.setAttribute('aria-valuenow', String(percent))
    stageEls.forEach((el, i) => el.classList.toggle('on', f >= (i + 1) / stageEls.length))
  }

  const updateTopButton = () => {
    topButton.hidden = !completed || heroSection.getBoundingClientRect().bottom > 0
  }
  const onTop = () => {
    byId('h1').focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' })
  }
  const onToggle = () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    try { localStorage.setItem('theme', next) } catch { /* storage unavailable */ }
    redrawHero()
  }
  const onSystemTheme = () => {
    let preferred: string | null = null
    try { preferred = localStorage.getItem('theme') } catch { /* storage unavailable */ }
    if (preferred !== 'light' && preferred !== 'dark') {
      applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      redrawHero()
    }
  }
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
  tog.addEventListener('click', onToggle)
  topButton.addEventListener('click', onTop)
  window.addEventListener('scroll', updateTopButton, { passive: true })
  systemTheme.addEventListener('change', onSystemTheme)

  const secs = Array.from(document.querySelectorAll('section'))
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('seen')
        io?.unobserve(e.target)
      }
    })
  }, { rootMargin: '0px 0px -12% 0px' }) : null
  if (io) secs.forEach((section) => io.observe(section))
  else secs.forEach((section) => section.classList.add('seen'))

  const runShift = (startHero: () => void) => {
    root.dataset.pivot = 'loading'
    content.inert = true
    content.setAttribute('aria-busy', 'true')
    setShift(0)
    const finish = () => {
      if (completed || disposed) return
      completed = true
      cancelAnimationFrame(rafShift)
      setShift(1)
      byId('gateStatus').textContent = 'Pivot complete.'
      root.dataset.pivot = 'complete'
      content.inert = false
      content.setAttribute('aria-busy', 'false')
      gate.setAttribute('aria-hidden', 'true')
      revealEls.forEach((el) => el.classList.add('in'))
      updateTopButton()
      timers.push(window.setTimeout(() => { if (!disposed) startHero() }, motion.matches ? 0 : 220))
    }
    finishHero = () => { finish(); cancelAnimationFrame(rafHero); redrawHero() }
    if (motion.matches) { finish(); return }
    let start: number | null = null
    const step = (ts: number) => {
      if (disposed || completed) return
      if (root.dataset.pivot === 'complete') { finish(); return }
      if (start === null) start = ts
      const p = Math.min(1, (ts - start) / 2200)
      setShift(p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
      if (p < 1) rafShift = requestAnimationFrame(step)
      else timers.push(window.setTimeout(finish, 160))
    }
    rafShift = requestAnimationFrame(step)
    // Background tabs may suspend RAF; a missed callback must never lock the site.
    timers.push(window.setTimeout(finish, 5000))
  }
  const onMotion = () => { if (motion.matches) finishHero() }
  motion.addEventListener('change', onMotion)
  const cleanupCommon = () => {
    disposed = true
    cancelAnimationFrame(rafHero)
    cancelAnimationFrame(rafShift)
    timers.forEach((id) => clearTimeout(id))
    io?.disconnect()
    tog.removeEventListener('click', onToggle)
    topButton.removeEventListener('click', onTop)
    window.removeEventListener('scroll', updateTopButton)
    systemTheme.removeEventListener('change', onSystemTheme)
    motion.removeEventListener('change', onMotion)
  }

  /* ---------- canvas ---------- */
  const windControl = document.getElementById('windSpeed') as HTMLInputElement | null
  const replayControl = document.getElementById('replayHero')
  let selectedWind: number | null = null
  const updateReadouts = () => {
    const wind = Number(windControl?.value || 11)
    const reference = refCurve(wind), degraded = degCurve(wind)
    const values: Record<string, string> = { windValue: wind.toFixed(1) + ' m/s', powerRef: Math.round(reference).toLocaleString('en-GB') + ' kW', powerDeg: Math.round(degraded).toLocaleString('en-GB') + ' kW', powerGap: Math.round(reference - degraded).toLocaleString('en-GB') + ' kW' }
    for (const [id, value] of Object.entries(values)) { const el = document.getElementById(id); if (el) el.textContent = value }
    windControl?.setAttribute('aria-valuetext', `${wind.toFixed(1)} metres per second; reference ${Math.round(reference)} kilowatts; degraded ${Math.round(degraded)} kilowatts; gap ${Math.round(reference - degraded)} kilowatts`)
  }
  updateReadouts()
  const cv = byId<HTMLCanvasElement>('hero')
  const ctxMaybe = cv.getContext('2d')
  if (!ctxMaybe) {
    cv.hidden = true
    note.textContent = 'Synthetic comparison: T07 underperforms T01 above about 8 m/s.'
    note.classList.add('canvas-fallback')
    runShift(() => {})
    return cleanupCommon
  }
  const ctx: CanvasRenderingContext2D = ctxMaybe

  let W = 0
  let H = 0
  const PAD = { l: 54, r: 16, t: 18, b: 36 }

  const size = () => {
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const r = cv.getBoundingClientRect()
    W = r.width
    H = r.height
    cv.width = Math.round(W * DPR)
    cv.height = Math.round(H * DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  }
  const css = (v: string) => getComputedStyle(root).getPropertyValue(v).trim()
  const pw = () => W - PAD.l - PAD.r
  const ph = () => H - PAD.t - PAD.b
  const ax = (ws: number) => PAD.l + (ws / MAXWS) * pw()
  const ay = (p: number) => PAD.t + ph() - (p / MAXP) * ph()
  const posA = (d: Point) => ({ x: PAD.l + (d.t / (N - 1)) * pw(), y: PAD.t + ph() - (d.ws / MAXWS) * ph() })
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const small = () => W < 560

  const axes = (morph: number) => {
    const steel = css('--steel')
    const line = css('--steel-line')
    ctx.strokeStyle = line
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD.l, PAD.t)
    ctx.lineTo(PAD.l, PAD.t + ph())
    ctx.lineTo(PAD.l + pw(), PAD.t + ph())
    ctx.stroke()
    ctx.fillStyle = steel
    ctx.font = '11px Archivo, system-ui, sans-serif'

    ctx.save()
    ctx.globalAlpha = 1 - morph
    ctx.textAlign = 'right'
    for (let s = 0; s <= 25; s += 5) ctx.fillText(String(s), PAD.l - 9, PAD.t + ph() - (s / MAXWS) * ph() + 4)
    ctx.fillText('m/s', PAD.l - 9, PAD.t - 4)
    ctx.restore()

    ctx.save()
    ctx.globalAlpha = morph
    ctx.textAlign = 'right'
    for (let p = 0; p <= 2000; p += 500) ctx.fillText(String(p), PAD.l - 9, ay(p) + 4)
    ctx.fillText('kW', PAD.l - 9, PAD.t - 4)
    ctx.restore()

    ctx.textAlign = 'left'
    ctx.save()
    ctx.globalAlpha = 1 - morph
    ctx.fillText('Time (10-minute intervals)', PAD.l, H - 8)
    ctx.restore()
    ctx.save()
    ctx.globalAlpha = morph
    ctx.fillText('Wind speed (m/s)', PAD.l, H - 8)
    for (let w2 = 5; w2 <= 25; w2 += 5) ctx.fillText(String(w2), ax(w2) - 4, PAD.t + ph() + 16)
    ctx.restore()
  }

  const curveLine = (fn: (ws: number) => number, alpha: number, colour: string, width: number, prog: number) => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const drawn = Math.floor(prog * CURVE_STEPS)
    for (let k = 0; k <= drawn; k++) {
      const ws = (k / CURVE_STEPS) * CUTOUT
      if (k) ctx.lineTo(ax(ws), ay(fn(ws)))
      else ctx.moveTo(ax(ws), ay(fn(ws)))
    }
    ctx.stroke()
    ctx.restore()
  }

  let lastT = 0
  const draw = (t: number) => {
    lastT = t
    ctx.clearRect(0, 0, W, H)
    const ink = css('--anthracite')
    const sig = css('--signal')
    const steel = css('--steel')

    const drawEnd = 2.2
    const morphStart = 2.7
    const morphEnd = 5.2
    const curveStart = 4.5
    const curveEnd = 6.0
    const annStart = 6.0
    const annEnd = 6.8
    const reveal = Math.min(1, t / drawEnd)
    const morph = t <= morphStart ? 0 : Math.min(1, (t - morphStart) / (morphEnd - morphStart))
    const mE = ease(morph)
    const cShow = t <= curveStart ? 0 : Math.min(1, (t - curveStart) / (curveEnd - curveStart))
    const aShow = t <= annStart ? 0 : Math.min(1, (t - annStart) / (annEnd - annStart))

    axes(mE)
    const upTo = Math.floor(reveal * (N - 1))

    // shaded energy gap between the two curves
    if (cShow > 0.55) {
      ctx.save()
      ctx.globalAlpha = ((cShow - 0.55) / 0.45) * 0.13
      ctx.fillStyle = sig
      ctx.beginPath()
      const drawn = Math.floor(cShow * CURVE_STEPS)
      for (let g = 0; g <= drawn; g++) {
        const ws = (g / CURVE_STEPS) * CUTOUT
        if (g) ctx.lineTo(ax(ws), ay(refCurve(ws)))
        else ctx.moveTo(ax(ws), ay(refCurve(ws)))
      }
      for (let g2 = drawn; g2 >= 0; g2--) {
        const ws2 = (g2 / CURVE_STEPS) * CUTOUT
        ctx.lineTo(ax(ws2), ay(degCurve(ws2)))
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // phase 1 strip chart, dissolving into the morph
    if (mE < 1) {
      ctx.save()
      ctx.globalAlpha = (1 - mE) * 0.85
      ctx.strokeStyle = ink
      ctx.lineWidth = 1
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i <= upTo; i++) {
        const d = pts[i]
        const a = posA(d)
        const x = a.x + (ax(d.ws) - a.x) * mE
        const y = a.y + (ay(d.p1) - a.y) * mE
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.stroke()
      ctx.restore()
    }

    // one signal splits into two populations
    if (mE > 0) {
      for (let j = 0; j <= upTo; j++) {
        const dd = pts[j]
        const aa = posA(dd)
        const x = aa.x + (ax(dd.ws) - aa.x) * mE
        ctx.globalAlpha = mE * 0.34
        ctx.fillStyle = ink
        ctx.beginPath()
        ctx.arc(x, aa.y + (ay(dd.p1) - aa.y) * mE, 1.5, 0, 6.2832)
        ctx.fill()
        ctx.fillStyle = sig
        ctx.beginPath()
        ctx.arc(x, aa.y + (ay(dd.p2) - aa.y) * mE, 1.5, 0, 6.2832)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    if (cShow > 0) {
      curveLine(refCurve, 1, ink, 1.6, cShow)
      curveLine(degCurve, 1, sig, 2, cShow)
    }

    if (aShow > 0) {
      ctx.save()
      ctx.globalAlpha = aShow
      ctx.font = '12px Archivo, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = ink
      ctx.font = (small() ? '10px' : '12px') + ' Archivo, system-ui, sans-serif'
      ctx.fillText('T01 reference', ax(small() ? 14.4 : 15.4), ay(RATED) - 14)
      ctx.fillStyle = sig
      ctx.fillText(small() ? 'T07 degraded' : 'T07 underperforming', ax(small() ? 14.4 : 15.4), ay(degCurve(15.4)) + 20)
      if (!small()) {
        const gx = ax(11)
        const gTop = ay(refCurve(11))
        const gBot = ay(degCurve(11))
        ctx.strokeStyle = sig
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(gx, gTop)
        ctx.lineTo(gx, gBot)
        ctx.moveTo(gx - 4, gTop)
        ctx.lineTo(gx + 4, gTop)
        ctx.moveTo(gx - 4, gBot)
        ctx.lineTo(gx + 4, gBot)
        ctx.stroke()
        ctx.fillStyle = sig
        ctx.textAlign = 'right'
        ctx.font = '600 13px Archivo, system-ui, sans-serif'
        ctx.fillText(GAPTXT, gx - 10, (gTop + gBot) / 2 + 4)
        ctx.font = '11px Archivo, system-ui, sans-serif'
        ctx.fillStyle = steel
        ctx.fillText('deviation begins ~8 m/s', gx - 10, (gTop + gBot) / 2 + 20)
      }
      ctx.restore()
    }
    if (selectedWind !== null) {
      const x = ax(selectedWind)
      ctx.strokeStyle = css('--steel-line'); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, H - PAD.b); ctx.stroke()
      for (const [p, colour] of [[refCurve(selectedWind), ink], [degCurve(selectedWind), sig]] as [number, string][]) {
        ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, ay(p), 4, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  /* ---------- listeners and preserved hero animation ---------- */
  redrawHero = () => draw(motion.matches ? 7.2 : lastT)
  const onResize = () => { size(); redrawHero(); updateTopButton() }
  window.addEventListener('resize', onResize, { passive: true })
  size()
  const animate = () => {
    cancelAnimationFrame(rafHero)
    selectedWind = null
    size()
    if (motion.matches) { draw(7.2); note.textContent = 'Same wind, two turbines · synthetic model · motion reduced'; return }
    note.textContent = 'Telemetry → power curves → degradation gap'
    let start: number | null = null
    const step = (ts: number) => {
      if (disposed) return
      if (motion.matches) { draw(7.2); return }
      if (start === null) start = ts
      const t = (ts - start) / 1000
      draw(Math.min(t, 7.2))
      if (t < 7.2) rafHero = requestAnimationFrame(step)
      else note.textContent = 'Synthetic resource-weighted gap: ' + GAPTXT
    }
    rafHero = requestAnimationFrame(step)
  }
  const onWind = () => {
    cancelAnimationFrame(rafHero)
    selectedWind = Number(windControl?.value || 11)
    updateReadouts(); draw(7.2)
    note.textContent = 'Inspecting the model at ' + selectedWind.toFixed(1) + ' m/s · ' + GAPTXT
  }
  windControl?.addEventListener('input', onWind)
  replayControl?.addEventListener('click', animate)
  runShift(animate)
  return () => {
    cleanupCommon()
    window.removeEventListener('resize', onResize)
    windControl?.removeEventListener('input', onWind)
    replayControl?.removeEventListener('click', animate)
  }
}
