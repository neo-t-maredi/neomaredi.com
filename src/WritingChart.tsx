import { useEffect, useState } from 'react'
import Papa from 'papaparse'

export type ChartData = {
  title: string; xLabel: string; unit: string; sourceLabel: string; sourceUrl: string
  labels: string[]; series: { name: string; values: (number | null)[] }[]
}

export function parseChart(text: string, filename: string): Pick<ChartData, 'labels' | 'series' | 'xLabel'> {
  let headers: string[], rows: unknown[][]
  if (/\.json$/i.test(filename)) {
    let value: unknown
    try { value = JSON.parse(text) } catch { throw new Error('The JSON file could not be read.') }
    if (!Array.isArray(value) || !value.length || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Use a JSON array of rows, with the label first and numeric columns after it.')
    headers = Object.keys(value[0]); rows = value.map(row => {
      if (Object.keys(row).length !== headers.length || headers.some(key => !Object.hasOwn(row, key))) throw new Error('Every JSON row needs the same columns.')
      return headers.map(key => row[key])
    })
  } else {
    const parsed = Papa.parse<string[]>(text, { delimiter: ',', skipEmptyLines: 'greedy' })
    if (parsed.errors.length) throw new Error(`CSV could not be read: ${parsed.errors[0].message}`)
    headers = (parsed.data[0] || []).map(x => x.trim()); rows = parsed.data.slice(1)
  }
  if (headers.length < 2 || headers.length > 5 || headers.some(x => !x || x.length > 160) || new Set(headers).size !== headers.length) throw new Error('Use a label column and one to four numeric columns, each with a different heading.')
  if (rows.length < 2 || rows.length > 2000 || rows.some(row => row.length !== headers.length)) throw new Error('Use 2 to 2,000 rows, with the same columns on every row.')
  const labels = rows.map((row, i) => {
    if (!['string', 'number'].includes(typeof row[0])) throw new Error(`Check the label in row ${i + 2}.`)
    const label = String(row[0]).trim()
    if (!label || label.length > 160) throw new Error(`Check the label in row ${i + 2}.`)
    return label
  })
  const series = headers.slice(1).map((name, col) => ({ name, values: rows.map((row, i) => {
    const value = row[col + 1]
    if (value === null || typeof value === 'string' && !value.trim()) return null
    if (!['string', 'number'].includes(typeof value) || typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) throw new Error(`“${name}” in row ${i + 2} must be a number or blank.`)
    const number = Number(value)
    if (!Number.isFinite(number) || Math.abs(number) > 1e15) throw new Error(`Check “${name}” in row ${i + 2}.`)
    return number
  }) }))
  if (series.some(s => !s.values.some(x => x !== null))) throw new Error('Every numeric column needs at least one value.')
  return { labels, series, xLabel: headers[0] }
}

const colors = ['var(--signal)', 'var(--sienna)', 'var(--ochre)', 'var(--steel)']
const number = (value: number | null) => value === null ? 'No data' : new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 8 }).format(value)

export function ChartView({ data }: { data: ChartData }) {
  const [hidden, setHidden] = useState<number[]>([])
  const [point, setPoint] = useState(0)
  const [table, setTable] = useState(false)
  const visible = data.series.map((series, i) => ({ ...series, i })).filter(s => !hidden.includes(s.i))
  const values = visible.flatMap(s => s.values.filter((v): v is number => v !== null))
  let low = Math.min(0, ...values), high = Math.max(0, ...values)
  if (low === high) { low = 0; high = 1 }
  const x = (i: number) => 64 + i / (data.labels.length - 1) * 672
  const y = (value: number) => 278 - (value - low) / (high - low) * 244
  const selected = Math.min(point, data.labels.length - 1)
  return <figure className="writing-chart">
    <figcaption><strong>{data.title}</strong>{data.unit && <span>{data.unit}</span>}</figcaption>
    <div className="writing-chart-legend" aria-label="Chart series">{data.series.map((s, i) => <button key={i} type="button" aria-pressed={!hidden.includes(i)} onClick={() => {
      if (hidden.includes(i)) setHidden(hidden.filter(n => n !== i)); else if (visible.length > 1) setHidden([...hidden, i])
    }}><i style={{ background: colors[i] }} aria-hidden="true" />{s.name}</button>)}</div>
    <div className="writing-chart-scroll"><svg viewBox="0 0 760 330" role="img" aria-label={`${data.title}. ${data.labels.length} data points. Exact values follow the chart.`}
      onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); if (rect.width) setPoint(Math.max(0, Math.min(data.labels.length - 1, Math.round(((event.clientX - rect.left) / rect.width * 760 - 64) / 672 * (data.labels.length - 1))))) }}>
      {[0, 1, 2, 3, 4].map(i => { const value = low + (high - low) * i / 4; return <g key={i}><line x1="64" x2="736" y1={y(value)} y2={y(value)} className="writing-chart-grid" /><text x="54" y={y(value) + 5} textAnchor="end">{new Intl.NumberFormat('en-GB', { notation: 'compact', maximumSignificantDigits: 3 }).format(value)}</text></g> })}
      {visible.map(s => <path key={s.i} fill="none" stroke={colors[s.i]} strokeWidth="2.5" d={s.values.map((value, i) => value === null ? '' : `${i === 0 || s.values[i - 1] === null ? 'M' : 'L'}${x(i)},${y(value)}`).join(' ')} />)}
      <line x1={x(selected)} x2={x(selected)} y1="34" y2="278" className="writing-chart-cursor" />
      {visible.map(s => s.values[selected] !== null && <circle key={s.i} cx={x(selected)} cy={y(s.values[selected] as number)} r="4.5" fill={colors[s.i]} />)}
      <text x="64" y="302">{data.labels[0].slice(0, 25)}</text><text x="736" y="302" textAnchor="end">{data.labels.at(-1)?.slice(0, 25)}</text>
    </svg></div>
    <label className="writing-chart-control">{data.xLabel || 'Data point'}<input type="range" min={0} max={data.labels.length - 1} value={selected} aria-valuetext={data.labels[selected]} onChange={event => setPoint(Number(event.target.value))} /></label>
    <div className="writing-chart-readout" aria-live="polite"><b>{data.labels[selected]}</b>{visible.map(s => <span key={s.i}>{s.name}: {number(s.values[selected])}{data.unit && s.values[selected] !== null ? ` ${data.unit}` : ''}</span>)}</div>
    {(data.sourceLabel || data.sourceUrl) && <p className="writing-chart-source">Source: {data.sourceUrl ? <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">{data.sourceLabel || data.sourceUrl}</a> : data.sourceLabel}</p>}
    <details onToggle={event => setTable(event.currentTarget.open)}><summary>View data · {data.labels.length} rows</summary>{table && <div className="writing-data-table"><table><thead><tr><th scope="col">{data.xLabel}</th>{data.series.map((s, i) => <th key={i} scope="col">{s.name}{data.unit ? ` (${data.unit})` : ''}</th>)}</tr></thead><tbody>{data.labels.map((label, row) => <tr key={row}><th scope="row">{label}</th>{data.series.map((s, i) => <td key={i}>{s.values[row] ?? 'No data'}</td>)}</tr>)}</tbody></table></div>}</details>
  </figure>
}

export default function WritingChart({ postId, assetId }: { postId: string; assetId: string }) {
  const [data, setData] = useState<ChartData | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const abort = new AbortController(); setData(null); setError('')
    fetch(`/api/writing/media/${postId}/${assetId}`, { credentials: 'same-origin', cache: 'no-store', signal: abort.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { if (!abort.signal.aborted) setData(result) }).catch(() => { if (!abort.signal.aborted) setError('This chart could not load.') })
    return () => abort.abort()
  }, [postId, assetId, retry])
  return data ? <ChartView key={`${assetId}-${retry}`} data={data} /> : <div className="writing-chart-status" role="status">{error || 'Loading chart…'}{error && <button className="writing-text-button" type="button" onClick={() => setRetry(retry + 1)}>Retry</button>}</div>
}
