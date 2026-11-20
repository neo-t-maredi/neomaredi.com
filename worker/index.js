// The build embeds the existing portfolio assets here, preserving the React app.
const staticAssets = {};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}

export function isOwner(request, env) {
  if (env.WRITING_MODE === 'static') return false;
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  return Boolean(id && email && env.BLOG_OWNER_EMAIL && email.toLowerCase() === env.BLOG_OWNER_EMAIL.toLowerCase());
}

function requireOwner(request, env) {
  if (!isOwner(request, env)) throw new HttpError(403, 'Only the site owner can edit writing.');
}

function database(env) {
  if (!env.DB) throw new Error('Writing database binding unavailable');
  return env.DB;
}

function requireSiteWrite(request, env) {
  requireOwner(request, env);
  const origin = request.headers.get('origin');
  if (!origin || ![new URL(request.url).origin, env.BLOG_ORIGIN].includes(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Open the editor on this site to save.');
}

async function readBytes(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'No content received.');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new HttpError(413, 'This file is too large. Images can be up to 5 MB; chart data up to 500 KB.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export function validateChart(value) {
  const bad = () => { throw new HttpError(422, 'Give the chart a title and include one to four numeric series with 2 to 2,000 rows.'); };
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 160) bad();
  for (const key of ['xLabel', 'unit', 'sourceLabel', 'sourceUrl']) if (typeof value[key] !== 'string' || value[key].length > (key === 'sourceUrl' ? 2000 : 160)) bad();
  if (value.sourceUrl && !/^https?:\/\//i.test(value.sourceUrl)) bad();
  if (!Array.isArray(value.labels) || value.labels.length < 2 || value.labels.length > 2000 || value.labels.some(x => typeof x !== 'string' || !x.trim() || x.length > 160)) bad();
  if (!Array.isArray(value.series) || value.series.length < 1 || value.series.length > 4) bad();
  for (const series of value.series) {
    if (!series || typeof series.name !== 'string' || !series.name.trim() || series.name.length > 160 || !Array.isArray(series.values) || series.values.length !== value.labels.length) bad();
    if (series.values.some(x => x !== null && (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 1e15)) || !series.values.some(x => typeof x === 'number')) bad();
  }
  return { title: value.title.trim(), xLabel: value.xLabel, unit: value.unit, sourceLabel: value.sourceLabel, sourceUrl: value.sourceUrl,
    labels: value.labels, series: value.series.map(s => ({ name: s.name, values: s.values })) };
}

// Collect only local uploads and our chart blocks; never fetch user-supplied URLs.
async function mediaReferences(db, body, postId) {
  const references = new Map();
  for (const match of body.matchAll(/\/api\/writing\/media\/([a-f0-9-]{36})\/([a-f0-9-]{36})/g)) {
    if (match[1] !== postId) throw new HttpError(422, 'Use images uploaded to this post.');
    references.set(match[2], null);
  }
  for (const match of body.matchAll(/(?:^|\n)```chart\s*\n([a-f0-9-]{36})\s*\n```/g)) references.set(match[1], 'chart');
  if (references.size > 30) throw new HttpError(422, 'Use up to 30 images and charts in one post.');
  const rows = references.size ? (await db.prepare('SELECT id, kind FROM writing_media WHERE post_id = ?').bind(postId).all()).results : [];
  for (const [id, kind] of references) if (!rows.some(row => row.id === id && (!kind || kind === row.kind))) throw new HttpError(422, 'An image or chart is unavailable. Upload it again before saving.');
  return [...references.keys()];
}

async function handleMedia(request, env, match) {
  const [postId, assetId] = [match[1], match[2]];
  const db = database(env);
  if (request.method === 'GET' && assetId) {
    const row = await db.prepare('SELECT * FROM writing_media WHERE id = ? AND post_id = ?').bind(assetId, postId).first();
    if (!row) throw new HttpError(404, 'This image or chart is unavailable.');
    if (!isOwner(request, env)) {
      const post = await db.prepare('SELECT published_at, published_media FROM writing_posts WHERE id = ?').bind(postId).first();
      if (!post?.published_at || !JSON.parse(post.published_media).includes(assetId)) throw new HttpError(404, 'This image or chart is not published.');
    }
    if (!env.MEDIA) throw new Error('Writing media storage unavailable');
    const object = await env.MEDIA.get(`${postId}/${assetId}`);
    if (!object) throw new HttpError(404, 'This image or chart is unavailable.');
    return new Response(object.body, { headers: { 'content-type': row.content_type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
  }
  if (request.method !== 'POST' || assetId) throw new HttpError(404, 'Not found.');
  requireSiteWrite(request, env);
  if (!env.MEDIA) throw new Error('Writing media storage unavailable');
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/json'].includes(type)) throw new HttpError(415, 'Choose a PNG, JPEG, WebP, GIF, or a CSV/JSON chart.');
  let bytes = await readBytes(request, type === 'application/json' ? 512000 : 5242880);
  const head = Array.from(bytes.slice(0, 16)); const ascii = new TextDecoder().decode(bytes.slice(0, 16));
  if (type === 'image/png' && head.slice(0, 8).join(',') !== '137,80,78,71,13,10,26,10' ||
      type === 'image/jpeg' && head.slice(0, 3).join(',') !== '255,216,255' ||
      type === 'image/webp' && (!ascii.startsWith('RIFF') || ascii.slice(8, 12) !== 'WEBP') ||
      type === 'image/gif' && !/^GIF8[79]a/.test(ascii)) throw new HttpError(422, 'The image contents do not match its file type. Choose another file.');
  if (type === 'application/json') {
    let chart;
    try { chart = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(422, 'Invalid chart data.'); }
    bytes = new TextEncoder().encode(JSON.stringify(validateChart(chart)));
  }
  const id = crypto.randomUUID(); const kind = type === 'application/json' ? 'chart' : 'image';
  await env.MEDIA.put(`${postId}/${id}`, bytes, { httpMetadata: { contentType: type } });
  await db.prepare('INSERT INTO writing_media (id, post_id, kind, content_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(id, postId, kind, type, bytes.length, new Date().toISOString()).first();
  return json({ media: { id, kind, url: `/api/writing/media/${postId}/${id}` } }, 201);
}

function draft(row) {
  return { id: row.id, title: row.title, excerpt: row.excerpt, body: row.body,
    version: row.version, updatedAt: row.updated_at, publishedAt: row.published_at,
    status: row.published_at ? 'published' : 'draft',
    hasDraftChanges: Boolean(row.published_at && (row.title !== row.published_title || row.excerpt !== row.published_excerpt || row.body !== row.published_body)) };
}

function published(row, includeBody = false) {
  const text = row.published_body || '';
  const summary = row.published_excerpt || (includeBody ? '' : text.replace(/```[\s\S]*?```|!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_>`]/g, '').trim().split(/\n\s*\n/)[0].slice(0, 200));
  return { id: row.id, title: row.published_title, excerpt: summary, publishedAt: row.published_at,
    readingMinutes: Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 220)),
    ...(includeBody ? { body: text } : {}) };
}

async function readInput(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing post.');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 262144) { await reader.cancel(); throw new HttpError(413, 'This post is too large. Please shorten it before saving.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let input;
  try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(400, 'Invalid post.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Invalid post.');
  return input;
}

function validate(input) {
  if (!['draft', 'publish', 'unpublish'].includes(input.action)) throw new HttpError(422, 'Choose save draft, publish, or unpublish.');
  if (!Number.isInteger(input.version) || input.version < 0) throw new HttpError(422, 'Missing post version.');
  if (input.action === 'unpublish') return input;
  for (const [key, max] of [['title', 160], ['excerpt', 400], ['body', 50000]]) {
    if (typeof input[key] !== 'string' || input[key].length > max) throw new HttpError(422, `Check the ${key} length.`);
  }
  if (!input.title.trim()) throw new HttpError(422, 'Give your post a title.');
  if (input.action === 'publish' && !input.body.trim()) throw new HttpError(422, 'Add some writing before publishing.');
  return { ...input, title: input.title.trim(), excerpt: input.excerpt.trim() };
}

export async function handleWritingRequest(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    // The public Cloudflare edition serves the essay bundled with the site.
    // Only this explicit mode bypasses storage; database failures remain errors.
    if (env.WRITING_MODE === 'static') {
      if (path === '/api/writing/session' && request.method === 'GET') return json({ canEdit: false, mode: 'static' });
      if (path === '/api/writing/posts' && request.method === 'GET') return json({ posts: [], mode: 'static' });
      if (path === '/api/writing/drafts' || request.method !== 'GET') throw new HttpError(403, 'Writing is read-only on this site.');
      throw new HttpError(404, 'This writing item is unavailable.');
    }
    const media = path.match(/^\/api\/writing\/media\/([a-f0-9-]{36})(?:\/([a-f0-9-]{36}))?$/);
    if (media) return await handleMedia(request, env, media);
    if (path === '/api/writing/session' && request.method === 'GET') return json({ canEdit: isOwner(request, env) });
    if (path === '/api/writing/posts' && request.method === 'GET') {
      const rows = await database(env).prepare('SELECT * FROM writing_posts WHERE published_at IS NOT NULL ORDER BY published_at DESC, id DESC').all();
      return json({ posts: rows.results.map(row => published(row)) });
    }
    if (path === '/api/writing/drafts' && request.method === 'GET') {
      requireOwner(request, env);
      const rows = await database(env).prepare('SELECT * FROM writing_posts ORDER BY updated_at DESC, id DESC').all();
      return json({ posts: rows.results.map(draft) });
    }
    const match = path.match(/^\/api\/writing\/posts\/([a-f0-9-]{36})$/);
    if (match && request.method === 'GET') {
      const row = await database(env).prepare('SELECT * FROM writing_posts WHERE id = ? AND published_at IS NOT NULL').bind(match[1]).first();
      if (!row) throw new HttpError(404, 'This post is not published.');
      return json({ post: published(row, true) });
    }
    const creating = path === '/api/writing/posts' && request.method === 'POST';
    const updating = match && request.method === 'PUT';
    if (!creating && !updating) throw new HttpError(404, 'Not found.');
    requireSiteWrite(request, env);
    const input = validate(await readInput(request));
    const now = new Date().toISOString();
    const db = database(env);
    const postId = creating ? input.id : match[1];
    const references = input.action === 'unpublish' ? [] : await mediaReferences(db, input.body, postId);
    let row;
    if (creating) {
      if (input.action === 'unpublish' || input.version !== 0 || typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id)) throw new HttpError(422, 'Invalid new post.');
      const live = input.action === 'publish';
      row = await db.prepare('INSERT INTO writing_posts (id, title, excerpt, body, published_title, published_excerpt, published_body, published_media, published_at, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(id) DO NOTHING RETURNING *')
        .bind(input.id, input.title, input.excerpt, input.body, live ? input.title : null, live ? input.excerpt : null, live ? input.body : null, live ? JSON.stringify(references) : '[]', live ? now : null, now, now).first();
    } else if (input.action === 'unpublish') {
      row = await db.prepare("UPDATE writing_posts SET published_title = NULL, published_excerpt = NULL, published_body = NULL, published_media = '[]', published_at = NULL, updated_at = ?, version = version + 1 WHERE id = ? AND version = ? RETURNING *").bind(now, match[1], input.version).first();
    } else {
      const live = input.action === 'publish';
      row = await db.prepare(`UPDATE writing_posts SET title = ?, excerpt = ?, body = ?, updated_at = ?, version = version + 1${live ? ', published_title = ?, published_excerpt = ?, published_body = ?, published_media = ?, published_at = COALESCE(published_at, ?)' : ''} WHERE id = ? AND version = ? RETURNING *`)
        .bind(input.title, input.excerpt, input.body, now, ...(live ? [input.title, input.excerpt, input.body, JSON.stringify(references), now] : []), match[1], input.version).first();
    }
    if (!row) throw new HttpError(409, 'This post changed in another tab. Your edits are still here; copy them before reopening the latest version.');
    return json({ post: draft(row) }, creating ? 201 : 200);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('Writing request failed', error);
    const message = ['GET', 'HEAD'].includes(request.method)
      ? 'Writing is temporarily unavailable. Please try again.'
      : 'Writing is temporarily unavailable. Your edits have not been cleared. Please try again.';
    return json({ error: message }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/writing/')) return handleWritingRequest(request, env);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const path = ['/', '/studio'].includes(url.pathname) ? '/index.html' : url.pathname;
    const asset = staticAssets[path];
    if (!asset) return new Response('Not found', { status: 404 });
    const headers = { 'content-type': asset.type, 'etag': asset.etag, 'x-content-type-options': 'nosniff',
      'cache-control': path === '/index.html' ? 'no-cache' : path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=86400' };
    if (request.headers.get('if-none-match') === asset.etag) return new Response(null, { status: 304, headers });
    const bytes = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.data), char => char.charCodeAt(0));
    return new Response(bytes, { headers });
  },
};
