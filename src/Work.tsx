import { useEffect, useRef, useState } from 'react'

type Category = 'All work' | 'Wind & data' | 'OT & cyber' | 'Blockchain'
type Project = { name: string; category: Category[]; status: string; description: string; stack: string; url: string; image: string; alt: string; caption: string; imageWidth?: number; imageHeight?: number; captureKind?: 'portrait' | 'terminal'; metrics?: [string, string][]; evidence?: [string, string][] }
const base = 'https://github.com/neo-t-maredi/'
const projects: Project[] = [
  { name: 'SCADA-Norm', category: ['Wind & data', 'OT & cyber'], status: 'Verified CLI', url: base + 'scada-norm',
    description: 'A reliable data contract comes before an anomaly detector. This Rust CLI converts Kelmarsh turbine exports from 299 CSV columns into eleven explicit Parquet fields. It rejects invalid files and preserves missing values.',
    stack: 'Rust · Arrow · Parquet · independent PyArrow readback', image: '/images/scada-norm.webp', alt: 'SCADA-Norm validation report: 316,224 records independently compared with zero mismatches', caption: 'Actual full-year Kelmarsh readback · recorded 28 September 2026',
    metrics: [['316,224', 'records compared'], ['11', 'canonical fields'], ['0', 'readback mismatches']], evidence: [['Read the validation', base + 'scada-norm/blob/main/TESTING.md']] },
  { name: 'WindForge', category: ['Wind & data'], status: 'Working demo', url: base + 'windforge',
    description: 'From wind resource to annual generation and cost. Global Wind Atlas rasters, a synthetic turbine curve and an assumed Weibull distribution connect energy yield to explicit losses, CAPEX and CRF-based LCOE. Built for screening, with assumptions you can inspect.',
    stack: 'Python · FastAPI · React · Rasterio · Docker', image: '/images/windforge.webp', alt: 'WindForge site assessment workspace with turbine illustration and resource inputs', caption: 'Actual repository capture · screening demonstrator', metrics: [['115', 'recorded backend tests'], ['97%', 'recorded branch-inclusive coverage']], evidence: [['Model & test notes', base + 'windforge/blob/main/backend/TESTING.md']] },
  { name: 'SharqNet', category: ['OT & cyber'], status: 'Engineering lab', url: base + 'SharqNet.v1',
    description: 'Ten simulated meters, one observable telemetry path. Demand, solar and battery readings flow through MQTT and TimescaleDB to an operator console. Stale or disconnected readings stay visible and leave summary metrics. This local lab tests telemetry integrity. Security hardening is still planned.',
    stack: 'Rust · MQTT · TimescaleDB · FastAPI · React', image: '/images/sharqnet.webp', alt: 'SharqNet operator console showing demand, solar and battery readings from ten simulated meters', caption: 'Actual operator console · simulated meter data', metrics: [['10', 'simulated meters'], ['21', 'recorded automated tests']], evidence: [['Wire contract & limits', base + 'SharqNet.v1#wire-contract']] },
  { name: 'Dumat Al Jandal', category: ['Blockchain', 'Wind & data'], status: 'Testnet milestone', url: base + 'RWA-stablecoins',
    description: 'Wind-generation reporting enforced on-chain. Separate Solidity and native Rust implementations check the verifier, completed reporting periods, duplicates and physical generation bounds. The reporting code is deployed on Sepolia and Solana devnet. Funding and settlement are still planned.',
    stack: 'Solidity · Foundry · native Rust · Solana', image: '/images/dumat-deployment.webp', alt: 'Original Sepolia deployment terminal showing the WindReceivablesFacility contract address and broadcast transaction hash', caption: 'Original Sepolia deployment terminal · 5 October 2026 · cropped capture', imageWidth: 1238, imageHeight: 215, captureKind: 'terminal', metrics: [['2', 'independent test networks'], ['24', 'recorded EVM tests']],
    evidence: [['Verified Sepolia contract', 'https://sepolia.etherscan.io/address/0xeCd3B8ce9fd94D6e1c686b00CBEB617aEf4c2829'], ['Solana devnet program', 'https://explorer.solana.com/address/78MNhhhzKUbSndBtrmsrgz5axrgZjfe7epZTV3x8HSwE?cluster=devnet'], ['Synthetic report receipt', base + 'RWA-stablecoins/blob/main/dumat-al-jandal/solana/DEVNET_SMOKE_TEST.json']] },
  { name: 'Stratum', category: ['Blockchain'], status: 'Prototype', url: base + 'Stratum-protocal-ETH',
    description: 'A collateral stress workbench and commodity-credit contracts. Local scenarios make borrowing and liquidation thresholds inspectable. The demo uses OIL tokens and a mock price feed. The interface is read-only.',
    stack: 'Solidity · Foundry · React · Vite', image: '/images/stratum.webp', alt: 'Stratum collateral workbench showing the base demonstration scenario at 187.5 percent collateralization, with local price controls and a ratio chart', caption: 'Actual collateral workbench · illustrative local scenario · writes disabled', metrics: [['10', 'recorded contract tests']], evidence: [['Implementation & boundaries', base + 'Stratum-protocal-ETH#model-boundaries-and-remaining-work']] },
  { name: 'HomeInv', category: ['Blockchain'], status: 'Accounting prototype', url: base + 'HomeInv-Protocol',
    description: 'Following rent through investor entitlement, treasury allocations and separately tracked tenant reserves. Cumulative accounting prevents repeat claims. The local ledger illustrates the accounting only. It conveys no property ownership and makes no live offering.',
    stack: 'Solidity · Foundry · JavaScript', image: '/images/homeinv.webp', alt: 'HomeInv rent ledger showing a 1,000 unit demo payment allocated to investors, treasury and tenant reserves', caption: 'Actual rent ledger interface · illustrative local accounting model', metrics: [['18 + 5', 'recorded contract & ledger tests']], evidence: [['Accounting rules', base + 'HomeInv-Protocol#accounting-rules']] },
  { name: 'Bernie', category: ['OT & cyber'], status: 'MVP in development', url: base + 'bernie',
    description: 'An Android anomaly-detection MVP for South African bank alerts. An isolated Kotlin core parses SMS and scores transactions against a personal baseline with human-readable reasons. Detection is designed to run on the device. Pilot and distribution work remain ahead.',
    stack: 'Kotlin · Jetpack Compose · Room · on-device detection', image: '/images/bernie.webp', alt: 'Bernie running in the Android emulator, showing synthetic suspicious, unusual and user-confirmed bank SMS transactions', caption: 'Actual Android emulator capture · synthetic SMS fixtures · 7 October 2026', imageWidth: 388, imageHeight: 895, captureKind: 'portrait', evidence: [['Scope & current status', base + 'bernie#status']] },
]
const categories: Category[] = ['All work', 'Wind & data', 'OT & cyber', 'Blockchain']

export default function Work() {
  const [filter, setFilter] = useState<Category>('All work')
  const [zoom, setZoom] = useState<Project | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (zoom && !dialog.current?.open) dialog.current?.showModal() }, [zoom])
  const visible = projects.filter(p => filter === 'All work' || p.category.includes(filter))
  return <section id="work" aria-labelledby="work-title">
    <div className="section-heading"><h2 id="work-title">The work.<br /><span>Evidence attached.</span></h2><p>Operational data, inspectable models and explicit controls. Each project links to its source, validation and current limits.</p></div>
    <div className="work-filters" role="group" aria-label="Filter projects by discipline">{categories.map(category => <button key={category} type="button" aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}<span aria-hidden="true">↗</span></button>)}</div>
    <p className="filter-status" role="status">{visible.length} projects · {filter === 'All work' ? 'all disciplines' : filter}</p>
    <div className="projects">{visible.map((p, i) => <article className="project" key={p.name}>
      <div className="project-details">
        <div className="project-index">{String(projects.indexOf(p) + 1).padStart(2, '0')} / {p.category.join(' + ')}</div>
        <div className="project-head"><h3 className="project-name">{p.name}</h3><span className="status">{p.status}</span></div>
        <p className="project-desc">{p.description}</p>
        {p.metrics && <div className="metrics">{p.metrics.map(([value, label]) => <div className="metric" key={label}><b>{value}</b><span>{label}</span></div>)}</div>}
        <p className="stack">{p.stack}</p>
        <div className="project-links"><a className="repo" href={p.url} target="_blank" rel="noreferrer">Explore source <span aria-hidden="true">↗</span></a>{p.evidence?.map(([label, url]) => <a key={url} href={url} target="_blank" rel="noreferrer">{label} <span aria-hidden="true">↗</span></a>)}</div>
      </div>
      <figure className={`project-figure ${p.captureKind ? p.captureKind + '-figure' : ''}`}><button className="screenshot-button" type="button" onClick={() => setZoom(p)} aria-label={`Enlarge ${p.name} screenshot`}><img className="shot" src={p.image} alt={p.alt} width={p.imageWidth || 1920} height={p.imageHeight || 1080} loading={i === 0 ? 'eager' : 'lazy'} /><span className="enlarge" aria-hidden="true">Inspect capture ↗</span></button><figcaption>{p.caption}</figcaption></figure>
    </article>)}</div>
    <p className="evidence-note">Validation figures come from recorded repository runs. Each demo and prototype is labelled. These records do not establish asset ownership or certify a system for production.</p>
    <dialog ref={dialog} className={`screenshot-dialog ${zoom?.captureKind === 'portrait' ? 'portrait-dialog' : ''}`} onClose={() => setZoom(null)} onClick={e => { if (e.target === dialog.current) dialog.current?.close() }} aria-labelledby="capture-title">
      {zoom && <><div className="capture-heading"><h3 id="capture-title">{zoom.name} / {zoom.captureKind === 'portrait' ? 'emulator capture' : zoom.captureKind === 'terminal' ? 'deployment capture' : 'repository capture'}</h3><button type="button" onClick={() => dialog.current?.close()} autoFocus>Close <span aria-hidden="true">×</span></button></div><img src={zoom.image} alt={zoom.alt} /><p>{zoom.caption}</p><a className="capture-original" href={zoom.image} target="_blank" rel="noreferrer" aria-label={`Open full-resolution ${zoom.name} screenshot`}>Open original image ↗</a></>}
    </dialog>
  </section>
}
