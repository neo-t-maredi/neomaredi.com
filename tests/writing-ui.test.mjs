import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import { handleWritingRequest } from '../worker/index.js'

test('owner editor lifecycle works; anonymous and signed-in visitors never see admin controls or private drafts', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://portfolio.test/' })
  globalThis.window = dom.window; globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: true })
  window.confirm = () => false
  HTMLElement.prototype.scrollIntoView = () => {}
  globalThis.requestAnimationFrame = callback => { callback(); return 0 }
  const sqlite = new DatabaseSync(':memory:')
  for (const migration of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(`../drizzle/${migration}`, import.meta.url), 'utf8'))
  const objects = new Map()
  const env = { BLOG_OWNER_EMAIL: 'writer@example.test', BLOG_ORIGIN: 'https://portfolio.test', DB: {
    prepare(sql) { let values = []; return {
      bind(...args) { values = args; return this },
      async first() { return sqlite.prepare(sql).get(...values) || null },
      async all() { return { results: sqlite.prepare(sql).all(...values) } },
    } },
  }, MEDIA: {
    async put(key, bytes) { objects.set(key, new Uint8Array(bytes)) },
    async get(key) { return objects.has(key) ? { body: objects.get(key) } : null },
  } }
  const originalFetch = globalThis.fetch
  let failSave = false
  let viewer = 'owner', draftReads = 0
  globalThis.fetch = async (path, options = {}) => {
    if (failSave && ['POST', 'PUT'].includes(options.method)) {
      failSave = false
      return Response.json({ error: 'Save unavailable. Your edits are still here.' }, { status: 503 })
    }
    const headers = new Headers(options.headers)
    if (viewer !== 'anonymous') {
      headers.set('oai-authenticated-user-id', viewer === 'owner' ? 'owner-test' : 'visitor-test')
      headers.set('oai-authenticated-user-email', viewer === 'owner' ? 'writer@example.test' : 'visitor@example.test')
    }
    if (path.endsWith('/drafts')) ++draftReads
    if (['POST', 'PUT'].includes(options.method)) headers.set('origin', env.BLOG_ORIGIN)
    return handleWritingRequest(new Request(new URL(path, env.BLOG_ORIGIN), { ...options, headers }), env)
  }
  mkdirSync(new URL('../node_modules/.tmp/', import.meta.url), { recursive: true })
  const compiled = new URL('../node_modules/.tmp/writing-ui.mjs', import.meta.url)
  buildSync({ entryPoints: [new URL('../src/Writing.tsx', import.meta.url).pathname], outfile: compiled.pathname, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] })
  const { default: Writing } = await import(compiled.href)
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const tick = () => new Promise(resolve => setImmediate(resolve))
  let root = createRoot(document.getElementById('root'))
  const mount = async () => { await act(async () => { root.render(createElement(Writing, { studio: true })); await tick() }) }
  const button = text => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === text)
  async function click(el) { assert.ok(el, 'Expected control'); await act(async () => { el.click(); await tick() }) }
  async function type(id, value) {
    const el = document.getElementById(id)
    assert.ok(el, `Expected ${id}`)
    const prototype = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value)
      el.dispatchEvent(new window.Event('input', { bubbles: true })); await tick()
    })
    assert.equal(el.value, value)
  }
  async function edit() {
    const details = document.querySelector('details'); details.open = true
    await click(button('Edit'))
  }
  async function file(id, value) {
    const el = document.getElementById(id)
    Object.defineProperty(el, 'files', { value: [value], configurable: true })
    await act(async () => { el.dispatchEvent(new window.Event('change', { bubbles: true })); await tick() })
  }
  const body = 'A field note.\n\n<script>window.bad = true</script> is literal writing.\n\n'
  try {
    await act(async () => { root.render(createElement(Writing)); await tick() })
    assert.equal(button('Write a post'), undefined, 'The default reading surface hides author controls even for the owner')
    assert.equal(draftReads, 0, 'The default reading surface never requests private drafts')
    await mount(); await click(button('Write a post'))
    await type('post-title', 'A practical field note'); await type('post-body', body)
    await click(button('Link')); await type('writing-link-label', 'Project source'); await type('writing-link-url', 'https://example.test/project')
    await click(button('Insert link'))
    await click(button('Image'))
    await file('writing-image-file', new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVfoAAAAASUVORK5CYII=', 'base64')], 'test.png', { type: 'image/png' }))
    await type('writing-image-alt', 'A test image'); await type('writing-image-caption', 'Measurement evidence')
    await click(button('Upload and insert image'))
    await click(button('Chart'))
    await file('writing-chart-file', new File(['Point,Reference,Measured\nA,120,100\nB,140,\nC,160,150'], 'measurements.csv', { type: 'text/csv' }))
    await type('writing-chart-title', 'Measured power'); await type('writing-chart-unit', 'kW')
    await click(button('Insert chart'))
    const savedBody = document.getElementById('post-body').value
    await click(button('Save draft')); assert.match(document.body.textContent, /Draft saved/)
    await act(async () => root.unmount())
    for (const identity of ['anonymous', 'visitor']) {
      viewer = identity
      const before = draftReads
      root = createRoot(document.getElementById('root')); await mount()
      assert.equal(button('Write a post'), undefined)
      assert.equal(document.querySelector('.writing-drafts'), null)
      assert.equal(document.querySelector('.writing-empty'), null)
      assert.equal(document.querySelector('.writing-feature').getAttribute('href'), '/writing/energy-shock-2026.html')
      assert.doesNotMatch(document.body.textContent, /Your first draft|A practical field note|A field note/)
      assert.equal(draftReads, before, 'Visitor view must not request private drafts')
      await act(async () => root.unmount())
    }
    viewer = 'owner'
    root = createRoot(document.getElementById('root')); await mount(); await edit()
    assert.equal(document.getElementById('post-body').value, savedBody)
    await click(button('Preview')); assert.equal(document.querySelectorAll('script').length, 0)
    assert.match(document.querySelector('.writing-preview').textContent, /<script>/)
    assert.equal(document.querySelector('.writing-body a').href, 'https://example.test/project')
    assert.equal(document.querySelector('.writing-body img').alt, 'A test image')
    assert.match(document.querySelector('.writing-body figcaption').textContent, /Measurement evidence/)
    assert.match(document.querySelector('.writing-chart').textContent, /Measured power/)
    const slider = document.querySelector('.writing-body input[type="range"]')
    await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(slider, '1'); slider.dispatchEvent(new window.Event('input', { bubbles: true })); await tick() })
    assert.match(document.querySelector('.writing-chart-readout').textContent, /Measured: No data/)
    await click(button('Write')); await click(button('Publish post')); await click(button('Close editor'))
    await click(document.querySelector('.writing-row'))
    assert.match(document.querySelector('.writing-body').textContent, /A field note/)
    assert.match(document.querySelector('.writing-body').textContent, /Measured power/)
    assert.equal(window.bad, undefined)
    await click(button('Back to all writing')); await edit()
    await type('post-body', 'A revised draft that is not published yet.')
    failSave = true; await click(button('Save draft'))
    assert.match(document.querySelector('[role="alert"]').textContent, /edits are still here/)
    assert.equal(document.getElementById('post-body').value, 'A revised draft that is not published yet.')
    await click(button('Save draft')); await click(button('Close editor')); await click(document.querySelector('.writing-row'))
    assert.match(document.querySelector('.writing-body').textContent, /A field note/)
    await click(button('Back to all writing')); await edit(); await click(button('Publish changes')); await click(button('Close editor'))
    await click(document.querySelector('.writing-row'))
    assert.equal(document.querySelector('.writing-body').textContent, 'A revised draft that is not published yet.')
  } finally {
    await act(async () => root.unmount())
    sqlite.close(); globalThis.fetch = originalFetch; dom.window.close()
    rmSync(compiled, { force: true })
  }
})

test('public writing shows the static essay and keeps database failures visible without editor messaging', async t => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://portfolio.test/' })
  globalThis.window = dom.window; globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const originalFetch = globalThis.fetch
  t.mock.method(console, 'error', () => {})
  let backend = 'static'
  globalThis.fetch = async (path, options = {}) => {
    if (backend === 'empty-error') return Response.json({}, { status: 503 })
    return handleWritingRequest(new Request(new URL(path, 'https://portfolio.test'), options), backend === 'static' ? { WRITING_MODE: 'static' } : {})
  }
  mkdirSync(new URL('../node_modules/.tmp/', import.meta.url), { recursive: true })
  const compiled = new URL('../node_modules/.tmp/writing-reader-ui.mjs', import.meta.url)
  buildSync({ entryPoints: [new URL('../src/Writing.tsx', import.meta.url).pathname], outfile: compiled.pathname, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] })
  const { default: Writing } = await import(compiled.href)
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const tick = () => new Promise(resolve => setImmediate(resolve))
  let root
  async function mount() {
    await act(async () => {
      root?.unmount()
      root = createRoot(document.getElementById('root'))
      root.render(createElement(Writing))
      await tick()
    })
  }
  const essay = () => document.querySelector('.writing-feature')?.getAttribute('href')
  const retry = () => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Retry')
  try {
    await mount()
    assert.equal(essay(), '/writing/energy-shock-2026.html')
    assert.equal(document.querySelector('[role="alert"]'), null)
    assert.equal(retry(), undefined)
    assert.equal(document.querySelector('.writing-editor, .writing-drafts'), null)
    assert.doesNotMatch(document.body.textContent, /Write a post|Loading writing/)

    for (backend of ['database-error', 'empty-error']) {
      await mount()
      const alert = document.querySelector('[role="alert"]')
      assert.ok(alert, `${backend} must remain visible`)
      assert.match(alert.textContent, /Writing is temporarily unavailable\. Please try again\./)
      assert.doesNotMatch(alert.textContent, /edits|save|draft/i)
      assert.ok(retry(), 'Readers must be able to retry a failed feed request')
      assert.equal(essay(), '/writing/energy-shock-2026.html')
    }
    backend = 'static'
    await act(async () => { retry().click(); await tick() })
    assert.equal(document.querySelector('[role="alert"]'), null)
    assert.equal(essay(), '/writing/energy-shock-2026.html')
  } finally {
    await act(async () => root?.unmount())
    globalThis.fetch = originalFetch; dom.window.close()
    rmSync(compiled, { force: true })
  }
})
