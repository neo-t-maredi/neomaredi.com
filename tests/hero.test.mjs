import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { mkdirSync, rmSync } from 'node:fs'
import { JSDOM } from 'jsdom'

test('pivot unlocks at 100%; both curves and gap stay aligned during animation and end at cut-out', async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <button id="themeToggle"></button><a id="mail"></a>
    <div id="pivotGate"><div id="shiftProgress"></div><div id="shiftFill"></div><span id="shiftPct"></span><div id="shiftStages"><li></li><li></li><li></li><li></li></div><p id="gateStatus"></p></div>
    <div id="siteContent" inert aria-busy="true"><section class="hero"><canvas id="hero"></canvas><p id="plotNote"></p><h1 id="h1"></h1><p id="lede"></p><div id="actions"></div></section></div><button id="backToTop" hidden></button><input id="windSpeed" type="range" min="3" max="25" value="11" step="0.5"><output id="windValue"></output><b id="powerRef"></b><b id="powerDeg"></b><b id="powerGap"></b><button id="replayHero"></button>
  </body></html>`, { url: 'https://portfolio.test/' })
  const original = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage, getComputedStyle: globalThis.getComputedStyle, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame }
  globalThis.window = dom.window; globalThis.document = dom.window.document
  globalThis.localStorage = window.localStorage; globalThis.getComputedStyle = window.getComputedStyle.bind(window)
  const frames = new Map(), timers = new Map(); let nextId = 1
  globalThis.requestAnimationFrame = fn => { const id = nextId++; frames.set(id, fn); return id }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  window.setTimeout = (fn, delay) => { const id = nextId++; timers.set(id, { fn, delay }); return id }
  window.clearTimeout = id => timers.delete(id)
  const frame = time => { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(time) }
  const timer = delay => { const entry = [...timers].find(([, value]) => value.delay === delay); assert.ok(entry, `Expected ${delay} ms timer`); timers.delete(entry[0]); entry[1].fn() }
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  const canvas = document.getElementById('hero')
  canvas.getBoundingClientRect = () => ({ width: 1000, height: 400 })
  let paths = [], current = [], texts = []
  const context = {
    lineWidth: 1,
    setTransform() {}, save() {}, restore() {}, arc() {}, closePath() {},
    clearRect() { paths = []; texts = [] },
    beginPath() { current = [] }, moveTo(x, y) { current.push([x, y]) }, lineTo(x, y) { current.push([x, y]) },
    stroke() { paths.push({ kind: 'stroke', width: this.lineWidth, points: [...current] }) },
    fill() { if (current.length) paths.push({ kind: 'fill', points: [...current] }) },
    fillText(text) { texts.push(text) },
  }
  canvas.getContext = () => context
  mkdirSync(new URL('../node_modules/.tmp/', import.meta.url), { recursive: true })
  const compiled = new URL('../node_modules/.tmp/hero-test.mjs', import.meta.url)
  buildSync({ entryPoints: [new URL('../src/site.ts', import.meta.url).pathname], outfile: compiled.pathname, bundle: true, platform: 'node', format: 'esm' })
  let cleanup
  try {
    const { initSite } = await import(compiled.href)
    cleanup = initSite()
    assert.equal(document.documentElement.dataset.pivot, 'loading')
    assert.equal(document.getElementById('siteContent').inert, true)
    frame(0); frame(2200)
    assert.equal(document.getElementById('shiftPct').textContent, '100%')
    assert.equal(document.getElementById('siteContent').inert, true, 'Hold completion before unlocking')
    timer(160)
    assert.equal(document.documentElement.dataset.pivot, 'complete')
    assert.equal(document.getElementById('siteContent').inert, false)
    assert.equal(document.getElementById('siteContent').getAttribute('aria-busy'), 'false')
    timer(220); frame(2500); frame(8000) // 5.5 seconds: curves still drawing, band visible.
    const aligned = () => {
      const curves = paths.filter(path => path.kind === 'stroke' && [1.6, 2].includes(path.width))
      const band = paths.find(path => path.kind === 'fill' && path.points.length > 3)
      assert.equal(curves.length, 2); assert.ok(band)
      const endpoint = curves[0].points.at(-1)[0]
      assert.equal(curves[1].points.at(-1)[0], endpoint)
      assert.equal(Math.max(...band.points.map(point => point[0])), endpoint)
      return endpoint
    }
    const cutoffX = 54 + 25 / 28 * (1000 - 54 - 16)
    assert.ok(aligned() < cutoffX)
    frame(9500)
    assert.ok(Math.abs(aligned() - cutoffX) < 1e-9)
    assert.ok(texts.includes('T01 reference')); assert.ok(texts.includes('T07 underperforming'))
    const curves = paths.filter(path => path.kind === 'stroke' && [1.6, 2].includes(path.width))
    // Convert the final plot coordinates back into power: unchanged 2,000/1,620 kW model.
    const power = y => (400 - 36 - y) / (400 - 18 - 36) * 2250
    assert.ok(Math.abs(power(curves[0].points.at(-1)[1]) - power(curves[1].points.at(-1)[1]) - 380) < 1e-9)
    const slider = document.getElementById('windSpeed')
    slider.value = '25'; slider.dispatchEvent(new window.Event('input'))
    assert.equal(document.getElementById('powerRef').textContent, '2,000 kW')
    assert.equal(document.getElementById('powerDeg').textContent, '1,620 kW')
    assert.equal(document.getElementById('powerGap').textContent, '380 kW')
    slider.value = '3'; slider.dispatchEvent(new window.Event('input'))
    assert.equal(document.getElementById('powerGap').textContent, '0 kW')
    document.getElementById('themeToggle').click()
    assert.equal(document.documentElement.dataset.theme, 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
    assert.equal(document.getElementById('themeToggle').getAttribute('aria-label'), 'Switch to light theme')
    document.getElementById('replayHero').click()
    assert.equal(frames.size, 1, 'Replay schedules one animation without duplicating loops')
    cleanup(); frames.clear(); timers.clear()
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
    cleanup = initSite()
    assert.equal(document.documentElement.dataset.pivot, 'complete', 'Reduced motion unlocks immediately')
    assert.equal(document.getElementById('shiftPct').textContent, '100%')
    assert.equal(document.getElementById('siteContent').inert, false)
    timer(0)
    assert.match(document.getElementById('plotNote').textContent, /motion reduced/)
    assert.ok(texts.includes('T01 reference'))
    assert.ok(texts.includes('T07 underperforming'))


  } finally {
    cleanup?.(); dom.window.close(); rmSync(compiled, { force: true })
    Object.assign(globalThis, original)
  }
})
