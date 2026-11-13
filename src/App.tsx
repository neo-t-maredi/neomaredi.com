import { useEffect, useState } from 'react'
import { initSite } from './site'
import Turbine from './Turbine'
import Writing from './Writing'
import Work from './Work'

const coursework = [
  { title: 'Petroleum Engineering with AI Applications', provider: 'L&T EduTech' },
  { title: 'Oil & Gas Industry Operations and Markets', provider: 'Duke University' },
  { title: 'Electric Industry Operations and Markets', provider: 'Duke University' },
  { title: 'Energy Production, Distribution & Safety', provider: 'State University of New York (SUNY)' },
  { title: 'Google Cybersecurity Professional Certificate', provider: 'Google' },
  { title: 'Information Assurance Analysis', provider: 'Johns Hopkins University' },
]

export default function App() {
  useEffect(() => initSite(), [])
  const [menuOpen, setMenuOpen] = useState(false)
  const studio = window.location.pathname === '/studio'

  return (
    <>
      <div className="pivot-gate" id="pivotGate" aria-label="Pipeline to Turbine transition">
        <div className="gate-inner">
          <p className="gate-name">Neo T. Maredi</p>
          <p className="gate-title">Pipeline <span>→</span> Turbine.</p>
          <div className="shift" id="shift">
            <div className="shift-head">
              <span className="shift-from"><b>PIPELINE</b> [ SCADA / ICS / DCS ]</span>
              <span className="shift-pct" aria-hidden="true"><span id="shiftPct">0%</span></span>
              <span className="shift-to"><b>TURBINE</b> [ WIND ASSET PERFORMANCE ]</span>
            </div>
            <div className="shift-track" id="shiftProgress" role="progressbar" aria-label="Pipeline to Turbine pivot" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
              <div className="shift-fill" id="shiftFill"></div>
            </div>
            <ol className="shift-stages" id="shiftStages">
              <li><b>01</b>HISTORIAN TELEMETRY</li>
              <li><b>02</b>ALARM RATIONALISATION</li>
              <li><b>03</b>POWER CURVE COMPARISON</li>
              <li><b>04</b>ASSET DEGRADATION</li>
            </ol>
          </div>
          <p className="gate-status" id="gateStatus" role="status">Completing the pivot.</p>
        </div>
      </div>
      <div id="siteContent" inert aria-busy="true">
      <a className="skip-link" href="#top">Skip to content</a>
      <div className="wrap">
        <header className="masthead">
          <a className="mark" href="#top"><Turbine size={20} /><span className="brand-name">NEO T. MAREDI</span><span className="brand-journey"> / PIPELINE → TURBINE</span></a>
          <button className="menu-toggle" type="button" aria-controls="mainNav" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close ×' : 'Menu +'}</button>
          <nav id="mainNav" className={menuOpen ? 'is-open' : ''} aria-label="Main navigation" onClick={e => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false) }}>
            <a href="#transfer">The transfer</a>
            <a href="#work">Work</a>
            <a href="#credentials">Credentials</a>
            <a href="#writing">Writing</a>
            <a href="#contact">Contact</a>
            <button className="toggle" id="themeToggle" aria-label="Switch to dark theme">Dark</button>
          </nav>
        </header>
      </div>

      <main id="top">
        <div className="wrap">
          <section className="hero" style={{ paddingTop: 0 }}>
            <div className="hero-grid">
              <div className="hero-copy">
                <p className="hero-intro">ICS software engineering / Wind / OT security</p>
                <h1 className="stagger" id="h1" tabIndex={-1}>Same discipline.<br /><span>New prime mover.</span></h1>
                <p className="lede stagger" id="lede">I'm Neo Maredi, a software engineer in the ICS space. I use what I learned in the field to study wind performance, check telemetry and build controls.</p>
                <div className="actions stagger" id="actions"><a className="btn" href="#work">Explore the work <span aria-hidden="true">↘</span></a><a className="text-link" href="#contact">Let's talk ↗</a></div>
              </div>
              <div className="hero-lab">
                <div className="lab-header"><span>01 / POWER-CURVE LAB</span><span className="lab-model">SYNTHETIC MODEL</span></div>
                <div className="plot"><canvas id="hero" role="img" aria-label="Synthetic two-turbine comparison inspired by Kelmarsh SCADA work. T01 follows the reference curve. T07 underperforms above 8 metres per second." aria-describedby="hero-explanation"></canvas><div className="plot-note" id="plotNote">Same wind. Two outcomes.</div></div>
                <div className="turbine-readouts"><div><Turbine size={29} /><span>T01 / REFERENCE<strong id="powerRef">1,202 kW</strong></span></div><div><Turbine size={29} /><span>T07 / DEGRADED<strong id="powerDeg">1,055 kW</strong></span></div></div>
                <label className="wind-control" htmlFor="windSpeed"><span>Inspect at <output id="windValue">11.0 m/s</output></span><input id="windSpeed" type="range" min="3" max="25" step="0.5" defaultValue="11" /><span>3 to 25 m/s</span></label>
                <div className="lab-bottom"><span>Output gap <b id="powerGap">147 kW</b></span><button id="replayHero" type="button">Replay sequence ↻</button></div>
                <p className="plot-explanation" id="hero-explanation">The data work below uses Kelmarsh records. This chart uses synthetic curves to illustrate an output loss of up to 380 kW.</p>
              </div>
            </div>
            <div className="hero-strip"><span>FIELD EXPERIENCE → ENGINEERING SOFTWARE</span><span>Saudi Arabia · South Africa</span><a href="#transfer" aria-label="Explore the engineering transfer">Scroll to explore ↓</a></div>
          </section>

          <section id="transfer">
            <div className="split">
              <h2>From the plant floor.<br />Into the signal.</h2>
              <div className="prose">
                <p>Gas and wind turbines produce many of the same signals. Tags are recorded at regular intervals, alarms need reviewing, and vibration can indicate wear before output drops.</p>
                <p>In oil and gas, I worked with SCADA historians, DCS logic and alarms, and monitored the condition of rotating equipment. I now work with <strong>T&Uuml;V Rheinland</strong> in Saudi Arabia.</p>
                <p>Checking historian data, reviewing alarms, planning condition-based maintenance and tracing availability figures back to source records are skills I can carry into wind operations.</p>
                <p>I’m now working on <strong>OT anomaly detection</strong>. Before I call a signal unusual, I want to know what the equipment was doing at the time. The projects below show how I check readings and trace them back to their source. My GWO safety and technical training keeps me close to the fieldwork.</p>
              </div>
            </div>
          </section>

          <Work />

          <section id="credentials">
            <div className="section-heading"><h2>Field ready.<br /><span>Still learning.</span></h2><p>Practical training alongside energy and security coursework. Held credentials and planned study are listed separately.</p></div>
            <div className="creds">
              <div className="cred">
                <h3>GWO Basic Safety Training</h3>
                <p>Global Wind Academy, Ho Chi Minh City &middot; July to August 2026</p>
                <span className="flag held">Held</span>
              </div>
              <div className="cred">
                <h3>GWO Basic Technical Training</h3>
                <p>Global Wind Academy, Ho Chi Minh City &middot; July to August 2026</p>
                <span className="flag held">Held</span>
              </div>
              <div className="cred">
                <h3>NEBOSH IGC</h3>
                <p>International General Certificate</p>
                <span className="flag">In progress</span>
              </div>
              <div className="cred">
                <h3>Ignition Core Certification</h3>
                <p>Inductive Automation</p>
                <span className="flag">In progress</span>
              </div>
              <div className="cred">
                <h3>IRATA Level 1</h3>
                <p>Rope access</p>
                <span className="flag">Planned Feb 2027</span>
              </div>
            </div>
            <div className="coursework" aria-labelledby="coursework-title">
              <div className="coursework-header">
                <h3 id="coursework-title">Energy &amp; security</h3>
                <p>Online coursework &amp; professional certificates</p>
              </div>
              <ul className="course-list">
                {coursework.map(({ title, provider }) => (
                  <li className="course-entry" key={title}>
                    <img className="institution-logo" src={provider === 'L&T EduTech' ? '/images/institutions/lnt-edutech.png' : provider === 'Duke University' ? '/images/institutions/duke.png' : provider.includes('SUNY') ? '/images/institutions/suny.png' : provider === 'Google' ? '/images/institutions/google.svg' : '/images/institutions/johns-hopkins.png'} alt="" width={42} height={42} loading="lazy" /><div className="course-detail">
                      <h4>{title}</h4>
                      <p>{provider} &middot; Coursera</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <Writing studio={studio} />

          <section id="contact">
            <p className="contact-kicker">GOOD ENGINEERING STARTS WITH A CONVERSATION.</p><h2>Let's connect<br /><span>the dots.</span></h2>
            <div className="contact-links">
              <a href="#" id="mail">Email</a>
              <a href="https://github.com/neo-t-maredi">GitHub</a>
            </div>
            <p className="availability">Based in Saudi Arabia. Interested in ICS software engineering, wind performance and OT security opportunities.</p>
          </section>
        </div>

        <div className="wrap">
          <footer>
            <span className="footer-id"><Turbine />Neo T. Maredi, ICS software, wind and OT security</span>
            <span>© 2026 · neomaredi.com · Built on evidence.</span>
          </footer>
        </div>
      </main>
      <button className="back-to-top" id="backToTop" type="button" aria-label="Back to top" hidden>
        <span className="top-icon" aria-hidden="true">↑</span><span>Top</span>
      </button>
      </div>
    </>
  )
}
