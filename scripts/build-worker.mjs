import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' }
const assets = {}
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name), relative = `${prefix}/${entry.name}`
    if (entry.isDirectory()) { await collect(path, relative); continue }
    // Repository originals and provenance stay in source; the site serves the optimized screenshots.
    if (/\/images\/(windforge|scada-norm)\.png$/.test(relative)) continue
    const bytes = await readFile(path)
    const ext = entry.name.slice(entry.name.lastIndexOf('.'))
    assets[relative] = { type: types[ext] || 'application/octet-stream', data: bytes.toString('base64'), etag: `"${createHash('sha256').update(bytes).digest('hex')}"` }
  }
}
await collect('dist/client')
let worker = await readFile('worker/index.js', 'utf8')
worker = worker.replace('const staticAssets = {};', `const staticAssets = ${JSON.stringify(assets)};`)
await mkdir('dist/server', { recursive: true })
await mkdir('dist/.openai', { recursive: true })
await writeFile('dist/server/index.js', worker)

const module = await import(`../dist/server/index.js?check=${Date.now()}`)
if (typeof module.default?.fetch !== 'function') throw new Error('Missing Worker fetch entrypoint')
console.log(`Built writing Worker with ${Object.keys(assets).length} portfolio assets.`)
