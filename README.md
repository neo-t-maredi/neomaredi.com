# Neo T. Maredi — Pipeline to Turbine

React / TypeScript / Vite portfolio for software engineering in the ICS space and wind asset performance.

## Run

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

The local Vite commands preview the portfolio frontend. The deployed Worker provides the writing API. The Cloudflare configuration uses static writing mode; the automated writing tests also exercise the optional database-backed editor using an isolated SQLite database.

## Design and behaviour

- `src/index.css` contains light/dark design tokens, Barlow Condensed display typography, the orange/sienna/ochre hover gradient, and the page's orange-to-brown-to-tan envelope.
- The Pipeline → Turbine gate advances to 100%, briefly holds completion, and fades out. Content stays hidden and inert until completion. The existing seven-second hero sequence starts after the page begins to fade in.
- Reduced motion completes the gate immediately and renders the final power comparison. A fallback prevents a suspended animation callback from leaving the site locked.
- Back-to-top appears when the whole hero has scrolled past the viewport. It returns smoothly to the top, or immediately with reduced motion, and places keyboard focus at the headline.
- The synthetic hero dataset, two turbine populations, reference/degraded curves, shaded gap and AEP calculation are preserved from GitHub commit `351aa5d`.
- Curves and the shaded band share the same animation progress and stop at the 25 m/s cut-out boundary. The caption explains the synthetic model's maximum 380 kW output gap; the annotation sits beside the actual degraded plateau.
- Screenshot provenance is recorded in `public/images/sources.json`. All seven builds have real screenshots: five repository captures, the author-supplied Bernie emulator capture and the author-supplied Dumat deployment terminal crop. The delivered images are WebP; terminal and emulator pixels are preserved losslessly.
- Barlow Condensed is bundled locally with its OFL license. Archivo remains the clean body typeface.
- Theme choice persists locally. The public Cloudflare edition links to the bundled essay; the optional Sites edition supports an owner-only editor and a persistent database. No analytics are added.
- Energy & security is explicitly labelled online coursework/professional certificates, with provider names and Coursera attribution in two columns. Authentic bundled provider logos accompany the courses.

## Project evidence

The hero illustrates synthetic data; SCADA-Norm processes real Kelmarsh exports. WindForge is a screening model with an assumed resource distribution and synthetic turbine curve. SharqNet is a telemetry lab with simulated meters. Repository screenshots and recorded validation results do not imply production deployment or engineering certification.

The original Sites deployment and the public Cloudflare Worker are separate hosting environments. The Cloudflare deployment serves the repository-backed portfolio and essay.

## Cloudflare deployment

`wrangler.jsonc` targets the `neomaredi-com` Worker and explicitly sets `WRITING_MODE` to `static`. In this mode, the public writing API returns an empty dynamic feed, the bundled essay remains available at `/writing/energy-shock-2026.html`, and the studio cannot read drafts, write posts or access uploaded media. No `DB`, `MEDIA` or owner secret is needed. This is a deliberate deployment mode, not a fallback for database errors.

Build with `npm run build`. The existing Cloudflare Git integration deploys the `portfolio-recovery-2026-11-13` branch using the generated Worker at `dist/server/index.js` and assets in `dist/client`. The configuration declares `neomaredi.com` as the production custom domain and explicitly keeps the existing `workers.dev` address enabled. Keep any future domain changes in the configuration as well as the dashboard. Cloudflare manages the custom domain's DNS record and certificate; inspect any existing DNS conflict before replacing it.

Verify `/api/writing/posts` returns `{ "posts": [], "mode": "static" }`, `/api/writing/session` returns `canEdit: false`, and the essay opens. The static mode does not migrate database posts or uploaded media from Sites. To enable online authoring on a direct Cloudflare deployment later, first configure storage, apply the migrations and add verified owner authentication. The original Sites identity headers are only trusted behind the Sites authentication proxy; an owner email alone is not authentication on a public Worker.

## Writing on the portfolio

The editor instructions below apply to the database-backed Sites edition. They are disabled in the public Cloudflare static edition.

Open **/studio#writing** while signed in as the site owner. The normal portfolio reader never requests drafts or renders authoring controls, including for its owner. Add a title, an optional short summary, and your text. Use the toolbar for bold text, headings, lists, links, images and charts, or write Markdown directly. Separate paragraphs with a blank line. **Preview** shows the reading layout; **Save draft** stores your work privately; **Publish post** adds it to the portfolio. Posts open inline and have a bookmarkable `?post=…#writing` URL.

The Writing section links to the launch essay at `/writing/energy-shock-2026.html`, with 23 numbered references, tables, a contents navigation and light/dark themes. Its source is in `public/writing/`. The database-backed edition can also publish posts through the editor. The Write a post button, saved drafts, and editing instructions appear only on the separate owner-authorized studio route. Anonymous and signed-in non-owner rendering are verified by the writing integration check. Contact uses email and GitHub links; a CV and LinkedIn link can be added when supplied.

**Image** uploads PNG, JPEG, WebP or GIF files up to 5 MB. Add descriptive alt text and an optional caption. Files are stored in the Site's R2 bucket, with metadata in D1. Each upload belongs to one post; uploading or saving a revised draft does not expose its media to readers. Publishing atomically records which assets belong to the published snapshot. Replacing or unpublishing that snapshot removes reader access to those assets; the owner retains access for editing. Media responses are not cached. Existing plain text posts continue to render; raw HTML is displayed as text and unsafe link protocols are blocked. External images must be uploaded using the Image tool.

**Chart** accepts a CSV with a header or a JSON array of objects, up to 500 KB. The first column/key supplies labels; the next 1–4 columns supply numbers. Use 2–2,000 rows. File order is retained and points are equally spaced; blank/null numeric values remain gaps. Numbers must be finite and no larger than 10^15 in absolute value. Give the chart a title and optionally a unit, source name and source URL. Preview the chart before inserting it. The chart shows pointer/keyboard-selected exact values, series toggles, and an accessible data table. Normalized JSON is stored in R2 and governed by the same publication rules as images. These charts are uploaded snapshots; no live API/feed is connected yet.

**Manage your posts** reopens saved drafts and published posts. Saving a draft of an existing post leaves the published version intact. **Publish changes** updates that version. **Unpublish** removes the post from the reading list while preserving its draft. Unsaved edits trigger a warning before leaving; failed saves keep the editor text. Concurrent edits are rejected instead of overwriting a newer version.

Database-backed posts live in the Site's D1 database and survive new deployments. The repository contains the code and generated schema migrations, rather than the post contents. In that environment, owner access uses the trusted Sites identity headers and the `BLOG_OWNER_EMAIL` runtime secret; `BLOG_ORIGIN` constrains browser writes. Set private runtime values through Sites, never in committed files. These bindings and identity guarantees do not transfer automatically to a direct Cloudflare deployment.

The existing React/Vite frontend and Kelmarsh canvas are retained. The build emits a Worker containing the portfolio assets plus the writing API. Database-backed writing requires `DB` and `MEDIA` bindings; static writing mode does not use them. Generate schema changes with `npm run db:generate`. Validate the writing modes, writing/media lifecycle and CSV/JSON parsing with `npm run test:writing`, then build with `npm run build`. Published database migrations are immutable; add a new migration for later changes.

## Portfolio edition — 24 October 2026

The hero is now an interactive synthetic power-curve instrument: the keyboard-operable wind slider updates both turbine powers and the output gap, and Replay restarts the strip-to-curve sequence. At 25 m/s the current illustrative model produces 2,000 and 1,620 kW (380 kW gap). The resource-weighted AEP gap remains synthetic. The gate, curve model, reduced-motion path and source provenance are preserved.

Project filters cover Wind & data, OT & cyber and Blockchain. Actual screenshots open in a native modal dialog with Escape support. The portfolio includes SCADA-Norm, WindForge, SharqNet, Dumat Al Jandal, Stratum, HomeInv and Bernie. Public repository READMEs were retrieved on 24 October 2026; tests are described as recorded results, testnet activity as testnet, simulated telemetry as simulated, and incomplete work as incomplete. No articles or production claims were invented.

Mobile uses an expandable navigation control. Browser QA uses same-origin iframe viewports for phone and tablet widths because this browser API does not expose device emulation; this checks responsive layouts rather than device hardware.

Every project now has an inspectable screenshot. Portrait emulator captures retain their proportions in both the project layout and modal, while the Dumat terminal view is captioned as a historical Sepolia deployment. No mock interface has been substituted for a capture.
