# Fresnel — Website Accessibility & Performance Checker

[![Live Demo](https://img.shields.io/badge/Live_Demo-website--performance--checker.netlify.app-0052FF?style=for-the-badge&logo=netlify&logoColor=white)](https://website-performance-checker.netlify.app/)
[![Angular 19](https://img.shields.io/badge/Angular-19.2-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> *"Instead of a single heavy dome of glass, concentric stepped prism rings capture scattered light from every angle and refract it into one extraordinary, miles-long beam."* — **Augustin-Jean Fresnel (1788–1827)**

**Fresnel** is a full-stack **Website Accessibility & Performance Checker** built with **Angular 19** (Standalone Components + Signals) and **Node.js**. It performs static source-code audits across all four **Lighthouse** pillars (**Performance**, **Accessibility**, **Best Practices**, and **SEO**) along with **Light Web Application Security Findings**, synthesizing actionable, self-contained atomic Git commits, unified diffs, downloadable `git format-patch` bundles, and 1-click terminal Pull Request commands.

- **Live Demo:** [https://website-performance-checker.netlify.app/](https://website-performance-checker.netlify.app/)
- **Repository:** [https://github.com/bapanghosh0812/Website-Accessibility-Performance-Checker](https://github.com/bapanghosh0812/Website-Accessibility-Performance-Checker)

---

## Core Features

### 1. Run 1 — Static Repository Code Audit
Inspect any GitHub repository URL (`https://github.com/owner/repo`) across 5 categories without executing untrusted runtime code:
- **Performance:** LCP hero resource prioritization (`fetchpriority="high"`), render-blocking stylesheet elimination, CLS explicit image dimension reservation, and `preconnect` / `font-display:swap` optimizations.
- **Accessibility (WCAG 2.1 AA/AAA):** Keyboard-accessible skip-to-main-content links, route-specific document titles, `44×44px` minimum touch targets, `aria-label` coverage for icon controls, and high-contrast `:focus-visible` outlines.
- **Best Practices:** Strict `Content-Security-Policy` headers/meta directives, `rel="noopener noreferrer"` external link hardening, and passive scroll/touch listeners (`{ passive: true }`).
- **SEO:** Responsive viewport metadata, canonical URLs, OpenGraph tags, crawlable semantic anchors, and `schema.org` JSON-LD structured data.
- **Web Application Security Findings (Light):** Static detection of common unsafe patterns including unescaped DOM XSS sinks (`[innerHTML]` / `bypassSecurityTrustHtml`), exposed client secrets or `localStorage` bearer tokens, and unvalidated open-redirect parameters.

### 2. Run 2 — Lighthouse Report (LHR) `.json` Deep Analysis
Upload or paste a Lighthouse Result (`.json`) report (or load the built-in sample LHR report) to correlate failing `audits`, `metricSavings` (LCP, FCP, CLS), and DOM selectors directly against repository templates and stylesheets.

### 3. Interactive Diff Inspector, `.patch` Export & 1-Click Terminal PR
- Expand or collapse syntax-highlighted unified Git diffs for every generated commit.
- Filter commits by category and select/deselect individual fixes.
- Download a standards-compliant multi-commit `git format-patch` file (`.patch`) or copy a self-contained `git am --3way` + `gh pr create` terminal command.

### 4. Interactive Sandbox Demo Mode & Theme Support
- **Demo Mode:** Try the complete multi-step workflow immediately using the built-in `fresnel-sandbox/lumina-web-app` target.
- **Light & Dark Themes:** Instant theme switching persisted via `localStorage`.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Angular 19 (Standalone Components, `signal()`, `computed()`, `linkedSignal()`), TypeScript 5.7, SCSS |
| **Backend API** | Node.js HTTP REST API (`server/index.js`, `server/agent-client.js`) |
| **Serverless & Hosting** | Netlify Functions (`netlify/functions/api.mjs`), `@netlify/angular-runtime` (`netlify.toml`) |

---

## Project Structure

```text
Website-Accessibility-Performance-Checker/
├── angular.json                         # Angular CLI build & serve configuration
├── netlify.toml                         # Netlify build, @netlify/angular-runtime plugin & redirects
├── package.json                         # Scripts and dependencies
├── proxy.conf.json                      # Local Angular dev-server proxy (/api -> :3000)
├── server.ts                            # Node.js full-stack server entrypoint
├── netlify/
│   └── functions/
│       └── api.mjs                      # Serverless Netlify Function handler for /api/* routes
├── scripts/
│   └── build.mjs                        # Cross-platform Angular production build runner
├── server/
│   ├── index.js                         # REST API routes & static asset server
│   ├── agent-client.js                  # Static audit engine, LHR JSON analyzer & Git patch builder
│   └── github-client.js                 # GitHub helper utilities
└── src/
    ├── index.html                       # Root HTML shell
    ├── main.ts                          # Angular bootstrapApplication entrypoint
    ├── styles.scss                      # Design system, responsive layout & light/dark theme tokens
    └── app/
        ├── app.config.ts                # Angular ApplicationConfig (HttpClient provider)
        ├── app.component.ts             # Multi-step audit workflow controller
        ├── app.component.html           # Step 1–7 accessible templates
        ├── app.component.scss           # Component styles
        ├── components/
        │   └── fresnel-logo/            # Fresnel SVG emblem & historical lens tooltip
        ├── models/
        │   └── audit.model.ts           # TypeScript interfaces for sessions, commits & patches
        └── services/
            └── audit.service.ts         # Reactive signal state & REST API integration
```

---

## Getting Started Locally

### Prerequisites
- **Node.js** `>= 20.0.0`
- **npm** `>= 10.0.0`

### 1. Clone the repository & install dependencies
```bash
git clone https://github.com/bapanghosh0812/Website-Accessibility-Performance-Checker.git
cd Website-Accessibility-Performance-Checker
npm install
```

### 2. Build the production bundle
```bash
npm run build
```
This compiles the Angular application into `dist/fresnel/browser`.

### 3. Start the full-stack server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Deployment on Netlify

This repository is pre-configured for zero-config continuous deployment on Netlify via `netlify.toml`:

- **Build command:** `npm run build`
- **Publish directory:** `dist/fresnel/browser`
- **Functions directory:** `netlify/functions`
- **Plugin:** `@netlify/angular-runtime`
- **Live URL:** [https://website-performance-checker.netlify.app/](https://website-performance-checker.netlify.app/)

Every `git push` to the `main` branch on GitHub automatically triggers a production build and deploy on Netlify.
