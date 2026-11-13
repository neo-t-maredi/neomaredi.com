import Markdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import WritingChart from './WritingChart'

export default function WritingBody({ text, postId }: { text: string; postId: string }) {
  return <div className="writing-body"><Markdown remarkPlugins={[remarkGfm]} urlTransform={(url, key) => {
    if (key === 'src') return new RegExp(`^/api/writing/media/${postId}/[a-f0-9-]{36}$`).test(url) ? url : ''
    return defaultUrlTransform(url)
  }} components={{
    h1: ({ children }) => <h4>{children}</h4>, h2: ({ children }) => <h4>{children}</h4>, h3: ({ children }) => <h4>{children}</h4>,
    a: ({ href, children }) => <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{children}</a>,
    p: ({ node, children }) => node?.children.some(child => child.type === 'element' && child.tagName === 'img') ? <div className="writing-media-paragraph">{children}</div> : <p>{children}</p>,
    img: ({ src, alt, title }) => src ? <figure className="writing-image"><img src={src} alt={alt || ''} loading="lazy" onError={event => { event.currentTarget.alt = 'Image unavailable. Please try reopening this post.' }} />{title && <figcaption>{title}</figcaption>}</figure> : <span className="writing-chart-status">Upload this image using the editor’s Image button.</span>,
    pre: ({ node, children }) => {
      const code = node?.children[0]
      if (code?.type === 'element' && Array.isArray(code.properties.className) && code.properties.className.includes('language-chart')) {
        const id = code.children.filter(c => c.type === 'text').map(c => 'value' in c ? c.value : '').join('').trim()
        return /^[a-f0-9-]{36}$/.test(id) ? <WritingChart postId={postId} assetId={id} /> : <p className="writing-chart-status">Insert chart data using the editor’s Chart button.</p>
      }
      return <pre>{children}</pre>
    },
  }}>{text}</Markdown></div>
}
