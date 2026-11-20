import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleWritingRequest, isOwner } from '../worker/index.js'

const origin = 'https://portfolio.test'
const id = 'd0c12ec2-5386-4337-a7c6-104113859b85'
const owner = { 'oai-authenticated-user-id': 'owner-test', 'oai-authenticated-user-email': 'writer@example.test' }
const migration = readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort().map(f => readFileSync(new URL(`../drizzle/${f}`, import.meta.url), 'utf8')).join('\n')
function adapter(sqlite) {
  return { prepare(sql) { let values = []; return {
    bind(...args) { values = args; return this },
    async first() { return sqlite.prepare(sql).get(...values) || null },
    async all() { return { results: sqlite.prepare(sql).all(...values) } },
  } } }
}
function fixture(path = ':memory:') {
  const sqlite = new DatabaseSync(path); sqlite.exec(migration)
  return { sqlite, env: { DB: adapter(sqlite), BLOG_OWNER_EMAIL: 'writer@example.test', BLOG_ORIGIN: origin } }
}
async function request(env, path, method = 'GET', body, headers = {}) {
  const r = await handleWritingRequest(new Request(origin + '/api/writing/' + path, {
    method, headers: { ...(body ? { 'content-type': 'application/json', origin } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), env)
  return { status: r.status, ...(await r.json()) }
}
const initial = { id, title: 'From field data to software', excerpt: '', body: 'First paragraph.\n\nSecond paragraph.', version: 0, action: 'draft' }

test('owner-only editor and draft reads; cross-site writes rejected', async () => {
  const { sqlite, env } = fixture()
  try {
    assert.equal((await request(env, 'session')).canEdit, false)
    assert.equal((await request(env, 'session', 'GET', null, owner)).canEdit, true)
    assert.equal((await request(env, 'drafts')).status, 403)
    assert.equal((await request(env, 'posts', 'POST', initial)).status, 403)
    assert.equal((await request(env, 'posts', 'POST', initial, { ...owner, 'oai-authenticated-user-email': 'visitor@example.test' })).status, 403)
    assert.equal((await request(env, 'posts', 'POST', initial, { ...owner, origin: 'https://another.test' })).status, 403)
    assert.equal((await request(env, 'posts', 'POST', initial, { ...owner, 'sec-fetch-site': 'cross-site' })).status, 403)
    assert.equal((await request({ ...env, BLOG_OWNER_EMAIL: undefined }, 'session', 'GET', null, owner)).canEdit, false)
  } finally { sqlite.close() }
})

test('static writing serves the public feed and denies authoring without touching storage', async () => {
  const storageAccesses = []
  const env = {
    WRITING_MODE: 'static', BLOG_OWNER_EMAIL: 'writer@example.test', BLOG_ORIGIN: origin,
    get DB() { storageAccesses.push('DB'); throw new Error('Static writing must not access DB') },
    get MEDIA() { storageAccesses.push('MEDIA'); throw new Error('Static writing must not access MEDIA') },
  }
  assert.equal(isOwner(new Request(origin, { headers: owner }), env), false)
  assert.deepEqual(await request(env, 'session', 'GET', null, owner), { status: 200, canEdit: false, mode: 'static' })
  assert.deepEqual(await request(env, 'posts'), { status: 200, posts: [], mode: 'static' })
  for (const [path, method, body] of [
    ['drafts', 'GET'], ['posts', 'POST', initial], [`posts/${id}`, 'PUT', initial],
    [`media/${id}`, 'POST', {}], ['posts', 'DELETE'], ['posts', 'OPTIONS'], ['posts', 'HEAD'],
  ]) {
    assert.equal((await request(env, path, method, body, owner)).status, 403, `${method} ${path} must remain read-only`)
  }
  for (const path of [`posts/${id}`, `media/${id}/${id}`]) {
    assert.equal((await request(env, path, 'GET', null, owner)).status, 404)
  }
  assert.deepEqual(storageAccesses, [], 'Static mode must not read even configured storage bindings')
})

test('database-backed feed failures remain errors with reader wording; write failures preserve edits', async t => {
  t.mock.method(console, 'error', () => {})
  const sqlite = new DatabaseSync(':memory:')
  const unavailable = { prepare() { return { async all() { throw new Error('Simulated database outage') } } } }
  try {
    for (const [name, env] of [
      ['missing binding', {}], ['missing schema', { DB: adapter(sqlite) }], ['database outage', { DB: unavailable }],
    ]) {
      assert.deepEqual(await request(env, 'posts'), {
        status: 503, error: 'Writing is temporarily unavailable. Please try again.',
      }, name)
    }
    const failedWrite = await request({ BLOG_OWNER_EMAIL: 'writer@example.test', BLOG_ORIGIN: origin }, 'posts', 'POST', initial, owner)
    assert.deepEqual(failedWrite, {
      status: 503, error: 'Writing is temporarily unavailable. Your edits have not been cleared. Please try again.',
    })
  } finally { sqlite.close() }
})

test('draft → publish → revise draft → publish changes → unpublish; stale writes cannot overwrite', async () => {
  const { sqlite, env } = fixture()
  try {
    let saved = await request(env, 'posts', 'POST', initial, owner)
    assert.equal(saved.status, 201); assert.equal(saved.post.version, 1)
    assert.equal((await request(env, 'posts')).posts.length, 0)
    assert.equal((await request(env, `posts/${id}`)).status, 404)
    assert.equal((await request(env, 'drafts', 'GET', null, owner)).posts[0].body, initial.body)
    assert.equal((await request(env, 'posts', 'POST', initial, owner)).status, 409)
    saved = await request(env, `posts/${id}`, 'PUT', { ...initial, version: 1, action: 'publish' }, owner)
    assert.equal(saved.post.version, 2)
    const firstDate = saved.post.publishedAt
    assert.equal((await request(env, 'posts')).posts.length, 1)
    assert.equal((await request(env, `posts/${id}`)).post.excerpt, '')
    saved = await request(env, `posts/${id}`, 'PUT', { ...initial, version: 2, body: '<script>literal text</script>\n\nRevised draft.', action: 'draft' }, owner)
    assert.equal(saved.post.version, 3); assert.equal(saved.post.hasDraftChanges, true)
    assert.equal((await request(env, `posts/${id}`)).post.body, initial.body)
    assert.equal((await request(env, `posts/${id}`, 'PUT', { ...initial, version: 2, action: 'publish' }, owner)).status, 409)
    const revised = saved.post.body
    saved = await request(env, `posts/${id}`, 'PUT', { ...initial, body: revised, version: 3, action: 'publish' }, owner)
    assert.equal(saved.post.hasDraftChanges, false); assert.equal(saved.post.publishedAt, firstDate)
    assert.equal((await request(env, `posts/${id}`)).post.body, revised)
    saved = await request(env, `posts/${id}`, 'PUT', { version: 4, action: 'unpublish' }, owner)
    assert.equal(saved.post.status, 'draft'); assert.equal(saved.post.body, revised)
    assert.equal((await request(env, 'posts')).posts.length, 0)
    assert.equal((await request(env, `posts/${id}`)).status, 404)
  } finally { sqlite.close() }
})

test('saved draft survives closing and reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'portfolio-writing-'))
  const path = join(directory, 'posts.sqlite')
  const { sqlite, env } = fixture(path)
  try {
    await request(env, 'posts', 'POST', initial, owner); sqlite.close()
    const reopened = new DatabaseSync(path)
    try {
      const result = await request({ ...env, DB: adapter(reopened) }, 'drafts', 'GET', null, owner)
      assert.equal(result.posts[0].body, initial.body)
    } finally { reopened.close() }
  } finally { rmSync(directory, { recursive: true }) }
})

test('invalid content is rejected without creating a post', async () => {
  const { sqlite, env } = fixture()
  try {
    assert.equal((await request(env, 'posts', 'POST', { ...initial, title: '' }, owner)).status, 422)
    assert.equal((await request(env, 'posts', 'POST', { ...initial, action: 'publish', body: ' ' }, owner)).status, 422)
    assert.equal((await request(env, 'posts', 'POST', { ...initial, body: 'x'.repeat(50001) }, owner)).status, 422)
    assert.equal((await request(env, 'drafts', 'GET', null, owner)).posts.length, 0)
  } finally { sqlite.close() }
})

test('uploaded media follows the published snapshot, validates content and rejects cross-post references', async () => {
  const { sqlite, env } = fixture()
  const objects = new Map()
  env.MEDIA = {
    async put(key, bytes) { objects.set(key, new Uint8Array(bytes)) },
    async get(key) { return objects.has(key) ? { body: objects.get(key) } : null },
  }
  const upload = (bytes, type, headers = owner) => handleWritingRequest(new Request(`${origin}/api/writing/media/${id}`, {
    method: 'POST', headers: { ...headers, origin, 'content-type': type }, body: bytes,
  }), env)
  const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVfoAAAAASUVORK5CYII=', 'base64')
  const readMedia = (url, headers = {}) => handleWritingRequest(new Request(origin + url, { headers }), env)
  try {
    assert.equal((await upload(imageBytes, 'image/png', {})).status, 403)
    assert.equal((await upload('not a png', 'image/png')).status, 422)
    assert.equal((await upload('<svg></svg>', 'image/svg+xml')).status, 415)
    assert.equal((await upload(new Uint8Array(5242881), 'image/png')).status, 413)
    const image = (await (await upload(imageBytes, 'image/png')).json()).media
    assert.equal((await readMedia(image.url)).status, 404)
    const privateImage = await readMedia(image.url, owner)
    assert.equal(privateImage.headers.get('content-type'), 'image/png')
    assert.deepEqual(new Uint8Array(await privateImage.arrayBuffer()), new Uint8Array(imageBytes))
    const chartData = { title: 'Test measurements', xLabel: 'Point', unit: 'kW', sourceLabel: '', sourceUrl: '', labels: ['One', 'Two', 'Three'], series: [{ name: 'Power', values: [2, null, 4] }] }
    assert.equal((await upload(JSON.stringify({ ...chartData, series: [{ name: 'Bad', values: ['2', 3, 4] }] }), 'application/json')).status, 422)
    const chart = (await (await upload(JSON.stringify(chartData), 'application/json')).json()).media
    const body = `Measurements.\n\n![Test image](${image.url} "An image caption")\n\n\`\`\`chart\n${chart.id}\n\`\`\``
    let saved = await request(env, 'posts', 'POST', { ...initial, body }, owner)
    assert.equal(saved.status, 201)
    assert.equal((await readMedia(chart.url)).status, 404)
    saved = await request(env, `posts/${id}`, 'PUT', { ...initial, body, version: 1, action: 'publish' }, owner)
    assert.equal(saved.status, 200)
    assert.deepEqual(await (await readMedia(chart.url)).json(), chartData)
    const later = (await (await upload(imageBytes, 'image/png')).json()).media
    const nextBody = `New draft.\n\n![Next image](${later.url})`
    saved = await request(env, `posts/${id}`, 'PUT', { ...initial, body: nextBody, version: 2 }, owner)
    assert.equal(saved.status, 200)
    assert.equal((await readMedia(later.url)).status, 404)
    assert.equal((await readMedia(image.url)).status, 200)
    const other = 'ac002233-5386-4337-a7c6-104113859b85'
    assert.equal((await request(env, 'posts', 'POST', { ...initial, id: other, body }, owner)).status, 422)
    saved = await request(env, `posts/${id}`, 'PUT', { ...initial, body: nextBody, version: 3, action: 'publish' }, owner)
    assert.equal(saved.status, 200)
    assert.equal((await readMedia(later.url)).status, 200)
    assert.equal((await readMedia(image.url)).status, 404)
    assert.equal((await readMedia(chart.url)).status, 404)
    saved = await request(env, `posts/${id}`, 'PUT', { version: 4, action: 'unpublish' }, owner)
    assert.equal(saved.status, 200)
    assert.equal((await readMedia(later.url)).status, 404)
    assert.equal((await readMedia(later.url, owner)).status, 200)
  } finally { sqlite.close() }
})
