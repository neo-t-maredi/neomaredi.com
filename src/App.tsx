import { useEffect } from 'react'
import { initSite } from './site'
import Turbine from './Turbine'

export default function App() {
  useEffect(() => initSite(), [])

  return (
    <>
      <div className="wrap">
        <header className="masthead">
          <a className="mark" href="#top"><Turbine size={20} />NEO T. MAREDI <span>/</span> PIPELINE <span>&#8594;</span> TURBINE</a>
          <nav>
            <a href="#transfer">The transfer</a>
            <a href="#work">Work</a>
            <a href="#credentials">Credentials</a>
            <a href="#contact">Contact</a>
            <button className="toggle" id="themeToggle" aria-label="Switch to dark theme">Dark</button>
          </nav>
        </header>
      </div>

      <main id="top">
        <div className="wrap">
          <section className="hero" style={{ paddingTop: 0 }}>
            <div className="plot">
              <canvas id="hero" role="img" aria-label="Two turbines on the same site plotted against wind speed. One tracks its reference power curve; the other falls below it above 8 metres per second, showing a measurable annual energy shortfall."></canvas>
              <div className="plot-note" id="plotNote">Same wind, two turbines &middot; synthetic sample</div>
            </div>

            <h1 className="stagger" id="h1">Same discipline.<br />New prime&nbsp;mover.</h1>
            <p className="lede stagger" id="lede">Senior industrial automation engineer &mdash; SCADA, ICS, DCS and rotating equipment inspection across oil and gas. Now building the tooling for wind O&amp;M digital operations.</p>
            <div className="actions stagger" id="actions">
              <a className="btn" href="#work">View the work</a>
              <a className="btn ghost" href="#contact">Get in touch</a>
            </div>

            <div className="shift" id="shift">
              <div className="shift-head">
                <span className="shift-from"><b>PIPELINE</b> [ SCADA / ICS / DCS ]</span>
                <span className="shift-pct">SHIFT: <span id="shiftPct">0%</span></span>
                <span className="shift-to"><b>TURBINE</b> [ WIND ASSET PERFORMANCE ]</span>
              </div>
              <div className="shift-track" role="img" aria-label="Transition from pipeline control systems to wind asset performance, via historian telemetry, alarm rationalisation, IEC 61400 power curves and asset degradation analysis.">
                <div className="shift-fill" id="shiftFill"></div>
              </div>
              <ol className="shift-stages" id="shiftStages">
                <li><b>01</b>HISTORIAN TELEMETRY</li>
                <li><b>02</b>ALARM RATIONALISATION</li>
                <li><b>03</b>IEC 61400 POWER CURVES</li>
                <li><b>04</b>ASSET DEGRADATION</li>
              </ol>
            </div>
          </section>

          <section id="transfer">
            <div className="split">
              <h2>What transfers from oil and gas to wind.</h2>
              <div className="prose">
                <p>Wind turbines and gas turbines produce the same class of operational data: tag-level telemetry at fixed intervals, alarm streams requiring rationalisation, and vibration signatures that indicate degradation ahead of any drop in output.</p>
                <p>My background is that work in oil and gas &mdash; SCADA historians, DCS logic, alarm management, and rotating equipment condition monitoring. Currently contracted to <strong>T&Uuml;V Rheinland</strong> in Saudi Arabia's Eastern Province.</p>
                <p>What carries over directly: data quality assessment on production historians, alarm rationalisation, condition-based maintenance planning, and reconciling reported availability against source records.</p>
                <p>Wind-specific work is deliberate and current. <strong>GWO certified</strong>. My published tools include wind-resource screening models and SCADA data processing. Each repository records its data sources and model limitations.</p>
              </div>
            </div>
          </section>

          <section id="work">
            <h2>Work</h2>
            <div className="projects">

              <a className="project lead" href="https://github.com/neo-t-maredi/windforge">
                <div className="project-head">
                  <span className="project-name">windforge</span>
                  <span className="status">Source available</span>
                </div>
                <p className="project-desc">Wind site feasibility tool. Pulls Global Wind Atlas GeoTIFF rasters, models wind-speed variation with an assumed Weibull distribution, and estimates annual energy production and levelised cost using a synthetic turbine curve and explicit financial assumptions.</p>
                <div className="metrics">
                  <div className="metric"><b>Modelled</b><span>AEP estimate</span></div>
                  <div className="metric"><b>Weibull</b><span>assumed distribution</span></div>
                  <div className="metric"><b>CRF</b><span>LCOE model</span></div>
                </div>
                <p className="stack">FastAPI &middot; React &middot; rasterio &middot; SciPy</p>
                <span className="repo">github.com/neo-t-maredi/windforge</span>
                
              </a>

              <a className="project" href="https://github.com/neo-t-maredi/scada-norm">
                <div className="project-head">
                  <span className="project-name">scada-norm</span>
                  <span className="status">Source available</span>
                </div>
                <p className="project-desc">Rust CLI that normalises Kelmarsh wind farm SCADA exports into a canonical 11-column Parquet schema &mdash; designed against 299 real CSV columns, so it survives contact with actual vendor exports.</p>
                <div className="metrics">
                  <div className="metric"><b>52,704</b><span>rows in a recorded batch</span></div>
                  <div className="metric"><b>78 MB &#8594; 3.9 MB</b><span>Snappy compression</span></div>
                  <div className="metric"><b>0</b><span>parse failures</span></div>
                </div>
                <p className="stack">Rust &middot; Arrow 59.1 &middot; Parquet &middot; 10 unit tests + integration &middot; verified against pyarrow</p>
                <span className="repo">Repository</span>
              </a>

              <a className="project" href="https://github.com/neo-t-maredi/SharqNet.v1">
                <div className="project-head">
                  <span className="project-name">sharqnet</span>
                  <span className="status">In progress</span>
                </div>
                <p className="project-desc">Microgrid telemetry platform for Eastern Province deployment. Rust meter agents publish to Mosquitto, land in TimescaleDB, and surface through a FastAPI service to a React front end.</p>
                <p className="stack">Rust &middot; MQTT &middot; TimescaleDB &middot; FastAPI &middot; React</p>
              </a>

            </div>
          </section>

          <section id="credentials">
            <h2>Field credentials</h2>
            <div className="creds">
              <div className="cred">
                <h3>GWO Basic Safety Training</h3>
                <p>Global Wind Academy, Ho Chi Minh City &middot; Jul&ndash;Aug 2026</p>
                <span className="flag held">Held</span>
              </div>
              <div className="cred">
                <h3>GWO Basic Technical Training</h3>
                <p>Global Wind Academy, Ho Chi Minh City &middot; Jul&ndash;Aug 2026</p>
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
                <span className="flag">Planned, not yet completed</span>
              </div>
              <div className="cred">
                <h3>IRATA Level 1</h3>
                <p>Rope access</p>
                <span className="flag">Planned Q1 2027</span>
              </div>
            </div>
            <p className="courses">Also: Petroleum Engineering with AI Applications (L&amp;T EduTech) &middot; Oil &amp; Gas and Electric Industry Operations (Duke) &middot; Energy Production, Distribution and Safety (SUNY).</p>
          </section>

          <section id="contact">
            <h2>Contact</h2>
            <div className="contact-links">
              <a href="#" id="mail">Email</a>
              <a href="https://github.com/neo-t-maredi">GitHub</a>
              
            </div>
            <p className="availability">Based in the Eastern Province, Saudi Arabia. Open to wind O&amp;M and asset performance roles across MENA and Europe.</p>
          </section>
        </div>

        <div className="wrap">
          <footer>
            <span className="footer-id"><Turbine />Neo T. Maredi &mdash; industrial automation, wind O&amp;M digital operations</span>
            <span>Hero data is a synthetic sample. This chart is modelled and does not use Kelmarsh measurements.</span>
          </footer>
        </div>
      </main>
    </>
  )
}
