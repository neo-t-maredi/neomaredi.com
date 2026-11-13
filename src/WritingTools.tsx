import { useState } from 'react'
import { ChartView, parseChart } from './WritingChart'
import type { ChartData } from './WritingChart'

type Props = { postId: string; selection: () => string; insert: (text: string, after?: string, fallback?: string) => void; onBusy: (busy: boolean) => void }
const escape = (text: string) => text.replace(/[\\[\]_*`]/g, '\\$&')

export default function WritingTools({ postId, selection, insert, onBusy }: Props) {
  const [panel, setPanel] = useState<'link' | 'image' | 'chart' | null>(null)
  const [label, setLabel] = useState(''), [url, setUrl] = useState('')
  const [image, setImage] = useState<File | null>(null), [alt, setAlt] = useState(''), [caption, setCaption] = useState('')
  const [chart, setChart] = useState<Pick<ChartData, 'labels' | 'series' | 'xLabel'> | null>(null)
  const [title, setTitle] = useState(''), [unit, setUnit] = useState(''), [sourceLabel, setSourceLabel] = useState(''), [sourceUrl, setSourceUrl] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const data: ChartData | null = chart && { ...chart, title, unit, sourceLabel, sourceUrl }
  function open(next: 'link' | 'image' | 'chart') {
    setPanel(panel === next ? null : next); setError('')
    if (next === 'link') setLabel(selection())
  }
  async function upload(content: Blob | string, type: string) {
    const response = await fetch(`/api/writing/media/${postId}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': type }, body: content })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'The upload failed. Please try again.')
    return result.media as { id: string; url: string }
  }
  async function addMedia() {
    setError(''); setBusy(true); onBusy(true)
    try {
      if (panel === 'image') {
        if (!image || !alt.trim()) throw new Error('Choose an image and add a short description for readers who cannot see it.')
        if (image.size > 5242880) throw new Error('Choose an image smaller than 5 MB.')
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(image.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.')
        const media = await upload(image, image.type)
        insert(`\n\n![${escape(alt.trim())}](${media.url}${caption.trim() ? ` ${JSON.stringify(caption.trim())}` : ''})\n\n`)
        setImage(null); setAlt(''); setCaption('')
      } else if (data) {
        if (!title.trim()) throw new Error('Give your chart a title.')
        if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new Error('Use an https:// or http:// source link.')
        const media = await upload(JSON.stringify(data), 'application/json')
        insert(`\n\n\`\`\`chart\n${media.id}\n\`\`\`\n\n`)
        setChart(null); setTitle(''); setUnit(''); setSourceLabel(''); setSourceUrl('')
      } else throw new Error('Choose a data file first.')
      setPanel(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload unavailable. Your writing is still here.') }
    finally { setBusy(false); onBusy(false) }
  }
  return <div className="writing-tools">
    <div className="writing-toolbar" aria-label="Writing tools">
      <button type="button" disabled={busy} onClick={() => insert('**', '**', 'bold text')}>Bold</button>
      <button type="button" disabled={busy} onClick={() => insert('\n\n## ', '\n\n', 'Heading')}>Heading</button>
      <button type="button" disabled={busy} onClick={() => insert('\n\n- ', '\n\n', 'List item')}>List</button>
      {(['link', 'image', 'chart'] as const).map(kind => <button key={kind} type="button" disabled={busy} aria-expanded={panel === kind} aria-controls="writing-media-panel" onClick={() => open(kind)}>{kind[0].toUpperCase() + kind.slice(1)}</button>)}
    </div>
    {panel && <div id="writing-media-panel" className="writing-media-panel">
      <fieldset disabled={busy}>
        {panel === 'link' ? <>
          <label htmlFor="writing-link-label">Link text</label><input id="writing-link-label" value={label} maxLength={400} onChange={event => setLabel(event.target.value)} />
          <label htmlFor="writing-link-url">Link address</label><input id="writing-link-url" type="url" placeholder="https://" value={url} maxLength={2000} onChange={event => setUrl(event.target.value)} />
          <button className="writing-tool-insert" type="button" onClick={() => {
            try { const href = new URL(url); if (!['https:', 'http:', 'mailto:'].includes(href.protocol)) throw new Error(); insert(`[${escape(label.trim() || href.hostname || url)}](<${href.href}>)`); setPanel(null); setUrl('') }
            catch { setError('Enter a full https://, http:// or mailto: address.') }
          }}>Insert link</button>
        </> : panel === 'image' ? <>
          <label htmlFor="writing-image-file">Image · up to 5 MB</label><input id="writing-image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { setImage(event.target.files?.[0] || null); setError('') }} />
          <label htmlFor="writing-image-alt">Describe the image <span>(alt text)</span></label><input id="writing-image-alt" value={alt} maxLength={400} onChange={event => setAlt(event.target.value)} />
          <label htmlFor="writing-image-caption">Caption <span>(optional)</span></label><input id="writing-image-caption" value={caption} maxLength={400} onChange={event => setCaption(event.target.value)} />
          <button className="writing-tool-insert" type="button" disabled={!image || !alt.trim()} onClick={() => void addMedia()}>{busy ? 'Uploading…' : 'Upload and insert image'}</button>
        </> : <>
          <label htmlFor="writing-chart-file">Chart data · CSV or JSON, up to 500 KB</label><input id="writing-chart-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={async event => {
            const file = event.target.files?.[0]; setChart(null); setError(''); if (!file) return
            setBusy(true); onBusy(true)
            try { if (file.size > 512000) throw new Error('Choose a data file smaller than 500 KB.'); const parsed = parseChart(await file.text(), file.name); setChart(parsed); if (!title) setTitle(file.name.replace(/\.(csv|json)$/i, '')) }
            catch (e) { setError(e instanceof Error ? e.message : 'This data file could not be read.') }
            finally { setBusy(false); onBusy(false) }
          }} />
          <p>Use the first column for labels and the next one to four columns for numbers. Include 2 to 2,000 rows. Blank values stay as gaps. Rows keep their file order.</p>
          <details className="writing-format-help"><summary>See file formats</summary><pre>{'CSV\nMonth,Power\nJanuary,120\nFebruary,140\n\nJSON\n[{"Month":"January","Power":120},\n {"Month":"February","Power":140}]'}</pre><p>These examples show the format. Your post uses only the data you supply.</p></details>
          <label htmlFor="writing-chart-title">Chart title</label><input id="writing-chart-title" value={title} maxLength={160} onChange={event => setTitle(event.target.value)} />
          <label htmlFor="writing-chart-unit">Unit <span>(optional, e.g. kW)</span></label><input id="writing-chart-unit" value={unit} maxLength={160} onChange={event => setUnit(event.target.value)} />
          <label htmlFor="writing-chart-source">Data source <span>(optional)</span></label><input id="writing-chart-source" value={sourceLabel} maxLength={160} onChange={event => setSourceLabel(event.target.value)} />
          <label htmlFor="writing-chart-source-url">Source link <span>(optional)</span></label><input id="writing-chart-source-url" type="url" value={sourceUrl} maxLength={2000} onChange={event => setSourceUrl(event.target.value)} />
          {data && <ChartView key={JSON.stringify(chart)} data={{ ...data, title: title || 'Chart preview' }} />}
          <button className="writing-tool-insert" type="button" disabled={!data || !title.trim()} onClick={() => void addMedia()}>{busy ? 'Uploading…' : 'Insert chart'}</button>
        </>}
        <button className="writing-text-button writing-tool-cancel" type="button" onClick={() => { setPanel(null); setError('') }}>Cancel</button>
      </fieldset>
      {error && <p className="writing-tool-error" role="alert">{error}</p>}
    </div>}
  </div>
}
