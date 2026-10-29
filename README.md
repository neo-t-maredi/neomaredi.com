# Engineering portfolio source

React, TypeScript and Vite source for a personal engineering portfolio focused on industrial control systems, wind asset performance and technical projects.

## Current implementation

- Responsive single-page layout with work, background, credentials and contact sections.
- Light and dark themes.
- Animated power-curve illustration with a deterministic, **synthetic** wind-speed sample.
- Project summaries linking to supporting repositories.

The turbine curves and annual-energy gap are illustrative model outputs, not Kelmarsh measurements, evidence of an actual turbine fault or a validated operational diagnosis. Project status and credential claims must be checked against the linked evidence before publication.

## Run locally

```bash
npm ci
npm run dev
```

## Check

```bash
npm run lint
npm run build
```

No new build or browser acceptance result is claimed by this documentation edit.

## Scope

This repository contains portfolio source code. It is not an OT monitoring or anomaly-detection service. The website's descriptions should distinguish completed work, simulations, planned credentials and work in progress.
