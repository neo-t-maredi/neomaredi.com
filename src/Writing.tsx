import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import Body from './WritingBody'
import WritingTools from './WritingTools'

type Post = { id: string; title: string; excerpt: string; publishedAt: string; readingMinutes: number; body?: string }
type Draft = { id: string; title: string; excerpt: string; body: string; version: number; status: 'draft' | 'published'; publishedAt: string | null; updatedAt: string; hasDraftChanges: boolean }
type Action = 'draft' | 'publish' | 'unpublish'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/writing/${path}`, { credentials: 'same-origin', cache: 'no-store', ...options,
    headers: { 'content-type': 'application/json', ...options?.headers } })
  let result
  try { result = await response.json() } catch { throw new Error('Writing is temporarily unavailable. Please try again.') }
  if (!response.ok) throw new Error(result.error || 'Could not save your writing. Your edits are still here.')
  return result
}

function signature(post: Draft) { return JSON.stringify([post.title, post.excerpt, post.body]) }
function date(value: string) { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
export default function Writing({ studio = false }: { studio?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reading, setReading] = useState<Post | null>(null)
  const [readingBusy, setReadingBusy] = useState(false)
  const [editor, setEditor] = useState<Draft | null>(null)
  const [baseline, setBaseline] = useState('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const readerHeading = useRef<HTMLHeadingElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const bodyInput = useRef<HTMLTextAreaElement>(null)
  const readRequest = useRef(0)
  const feedRequest = useRef(0)
  const mounted = useRef(false)
  const dirty = Boolean(editor && signature(editor) !== baseline)

  const refresh = useCallback(async () => {
    const request = ++feedRequest.current
    const [feed, session] = await Promise.all([api<{ posts: Post[] }>('posts'), studio ? api<{ canEdit: boolean }>('session') : Promise.resolve({ canEdit: false })])
    if (!mounted.current || request !== feedRequest.current) return
    setPosts(feed.posts); setCanEdit(session.canEdit)
    if (session.canEdit) {
      const result = await api<{ posts: Draft[] }>('drafts')
      if (mounted.current && request === feedRequest.current) setDrafts(result.posts)
    }
  }, [studio])

  const readPost = useCallback(async (id: string | null) => {
    const request = ++readRequest.current
    setReading(null); setError(''); setReadingBusy(Boolean(id))
    if (!id) return
    try {
      const result = await api<{ post: Post }>(`posts/${encodeURIComponent(id)}`)
      if (mounted.current && request === readRequest.current) setReading(result.post)
    } catch (e) {
      if (mounted.current && request === readRequest.current) setError(e instanceof Error ? e.message : 'Could not open this post.')
    } finally { if (mounted.current && request === readRequest.current) setReadingBusy(false) }
  }, [])

  useEffect(() => {
    mounted.current = true
    refresh().catch(e => { if (mounted.current) setError(e.message) }).finally(() => { if (mounted.current) setLoading(false) })
    const navigate = () => { void readPost(new URL(window.location.href).searchParams.get('post')) }
    navigate()
    window.addEventListener('popstate', navigate)
    return () => { mounted.current = false; ++readRequest.current; window.removeEventListener('popstate', navigate) }
  }, [refresh, readPost])

  useEffect(() => {
    if (!reading) return
    readerHeading.current?.focus({ preventScroll: true })
    readerHeading.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [reading])
  useEffect(() => {
    if (!editor || preview) return
    titleInput.current?.focus({ preventScroll: true })
    titleInput.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [editor?.id, preview])
  useEffect(() => {
    if (!dirty && !uploading) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, uploading])

  function insert(text: string, after?: string, fallback = '') {
    if (!editor || !bodyInput.current) return
    const start = bodyInput.current.selectionStart, end = bodyInput.current.selectionEnd
    const chosen = editor.body.slice(start, end)
    const value = after === undefined ? text : text + (chosen || fallback) + after
    if (editor.body.length - (end - start) + value.length > 50000) { setError('This post is at its length limit. Shorten it before inserting more content.'); return }
    setEditor(current => current ? { ...current, body: current.body.slice(0, start) + value + current.body.slice(end) } : current)
    requestAnimationFrame(() => { bodyInput.current?.focus(); bodyInput.current?.setSelectionRange(start + value.length, start + value.length) })
  }

  function navigatePost(id: string | null, event?: MouseEvent<HTMLAnchorElement>) {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return
    event?.preventDefault()
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('post', id); else url.searchParams.delete('post')
    url.hash = 'writing'
    window.history.pushState(null, '', url)
    void readPost(id)
    if (!id) {
      const heading = document.getElementById('writing-title')
      heading?.focus({ preventScroll: true })
      heading?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }
  }

  function openEditor(post?: Draft) {
    if (saving || uploading || (dirty && !window.confirm('Discard the unsaved edits in this editor?'))) return
    const next: Draft = post || { id: crypto.randomUUID(), title: '', excerpt: '', body: '', version: 0,
      status: 'draft', publishedAt: null, updatedAt: '', hasDraftChanges: false }
    setEditor(next); setBaseline(signature(next)); setPreview(false); setError(''); setNotice('')
  }

  function closeEditor() {
    if (saving || uploading || (dirty && !window.confirm('Discard your unsaved edits? Saved drafts will remain.'))) return
    setEditor(null); setError(''); setNotice('')
    void refresh().catch(e => setError(e.message))
  }

  async function save(action: Action) {
    if (!editor || saving || uploading) return
    const current = editor
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await api<{ post: Draft }>(current.version ? `posts/${current.id}` : 'posts', {
        method: current.version ? 'PUT' : 'POST', body: JSON.stringify({ ...current, action }),
      })
      const keepText = action === 'unpublish' && dirty
      setEditor(keepText ? { ...result.post, title: current.title, excerpt: current.excerpt, body: current.body } : result.post)
      setBaseline(signature(result.post))
      setNotice(action === 'draft' ? current.status === 'published' ? 'Draft saved. The published version is unchanged.' : 'Draft saved. Only you can see it.' : action === 'publish' ? 'Published on your portfolio.' : 'Unpublished. Your saved draft is still here.')
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your edits are still here.') }
    finally { setSaving(false) }
  }

  return (
    <section id="writing" aria-labelledby="writing-title">
      <div className="writing-heading">
        <div><h2 id="writing-title" tabIndex={-1}>Writing</h2><p>Energy, engineering and the work behind the code.</p></div>
        {canEdit && !editor && <button className="btn ghost" type="button" onClick={() => openEditor()}>Write a post</button>}
      </div>
      {error && <p className="writing-error" role="alert">{error}{!editor && <button className="writing-text-button" onClick={() => { setError(''); void refresh().catch(e => setError(e.message)) }}>Retry</button>}</p>}
      <p className="writing-notice" role="status" aria-live="polite">{notice}</p>

      {editor ? (
        <div className="writing-editor">
          <div className="writing-editor-bar">
            <h3>{editor.version ? 'Edit your post' : 'New post'}</h3>
            <button className="writing-text-button" type="button" disabled={saving || uploading} onClick={closeEditor}>Close editor</button>
          </div>
          <div className="writing-mode" aria-label="Editor view">
            <button type="button" disabled={uploading} aria-pressed={!preview} onClick={() => setPreview(false)}>Write</button>
            <button type="button" disabled={uploading} aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button>
            <span>{dirty ? 'Unsaved edits' : editor.version ? 'Saved' : 'Draft'}</span>
          </div>
          {preview ? (
            <article className="writing-article writing-preview"><h3>{editor.title || 'Untitled draft'}</h3>{editor.excerpt && <p className="writing-intro">{editor.excerpt}</p>}<Body postId={editor.id} text={editor.body || 'Your writing will appear here.'} /></article>
          ) : (
            <fieldset disabled={saving} className="writing-fields">
              <label htmlFor="post-title">Title</label>
              <input ref={titleInput} id="post-title" value={editor.title} maxLength={160} onChange={e => setEditor({ ...editor, title: e.target.value })} />
              <label htmlFor="post-summary">Short summary <span>(optional)</span></label>
              <textarea id="post-summary" rows={2} value={editor.excerpt} maxLength={400} onChange={e => setEditor({ ...editor, excerpt: e.target.value })} />
              <label htmlFor="post-body">Your writing</label>
              <WritingTools postId={editor.id} selection={() => editor.body.slice(bodyInput.current?.selectionStart ?? 0, bodyInput.current?.selectionEnd ?? 0)} insert={insert} onBusy={setUploading} />
              <textarea ref={bodyInput} id="post-body" disabled={uploading} className="writing-content-input" rows={14} value={editor.body} maxLength={50000} aria-describedby="post-help" onChange={e => setEditor({ ...editor, body: e.target.value })} />
              <p id="post-help">Use the tools above or write Markdown. Separate paragraphs with a blank line. Preview before publishing.</p>
            </fieldset>
          )}
          <div className="writing-editor-actions">
            <button className="btn ghost" type="button" disabled={saving || uploading} onClick={() => void save('draft')}>{saving ? 'Saving…' : 'Save draft'}</button>
            <button className="btn" type="button" disabled={saving || uploading || !editor.body.trim()} onClick={() => void save('publish')}>{editor.status === 'published' ? 'Publish changes' : 'Publish post'}</button>
            {editor.status === 'published' && <button className="writing-text-button" type="button" disabled={saving || uploading} onClick={() => void save('unpublish')}>Unpublish</button>}
          </div>
        </div>
      ) : reading || readingBusy ? (
        <div className="writing-reader">
          <button className="writing-text-button" type="button" onClick={() => navigatePost(null)}>Back to all writing</button>
          {readingBusy ? <p role="status">Opening post…</p> : reading && (
            <article className="writing-article">
              <p className="writing-meta"><time dateTime={reading.publishedAt}>{date(reading.publishedAt)}</time><span>{reading.readingMinutes} min read</span></p>
              <h3 ref={readerHeading} tabIndex={-1}>{reading.title}</h3>
              {reading.excerpt && <p className="writing-intro">{reading.excerpt}</p>}
              <Body postId={reading.id} text={reading.body || ''} />
            </article>
          )}
        </div>
      ) : (
        <div className="writing-feed">
          <a className="writing-feature" href="/writing/energy-shock-2026.html">
            <span className="writing-date"><time dateTime="2026-11-09">9 Nov 2026</time><span>Energy / Essay</span></span>
            <span className="writing-summary"><h3>Structural Inelasticity, Capacity Firming, and Systemic Resilience: Analyzing the 2026 Energy Shock</h3><p>What wind, solar and batteries can replace during a fuel shock, and what an operator must prove before retiring a gas turbine.</p></span>
            <span className="writing-read">Read essay ↗</span>
          </a>
          {loading ? <p role="status">Loading writing…</p> : posts.length ? (
            <ol className="writing-posts">{posts.map(post => (
              <li key={post.id}><a className="writing-row" href={`/?post=${post.id}#writing`} onClick={e => navigatePost(post.id, e)}>
                <span className="writing-date"><time dateTime={post.publishedAt}>{date(post.publishedAt)}</time><span>{post.readingMinutes} min read</span></span>
                <span className="writing-summary"><h3>{post.title}</h3><p>{post.excerpt}</p></span>
                <span className="writing-read">Read post</span>
              </a></li>
            ))}</ol>
          ) : canEdit && !error && <p className="writing-empty">Your saved drafts remain private.</p>}
          {canEdit && drafts.length > 0 && <details className="writing-drafts"><summary>Manage your posts <span>({drafts.length})</span></summary>
            <ul>{drafts.map(post => <li key={post.id}><span><b>{post.title}</b><small>{post.status === 'draft' ? 'Draft' : post.hasDraftChanges ? 'Published · draft changes' : 'Published'}</small></span><button className="writing-text-button" type="button" onClick={() => openEditor(post)}>Edit</button></li>)}</ul>
          </details>}
        </div>
      )}
    </section>
  )
}
