# Fresnel — Focused Code-Only Lighthouse Autofix (Angular + Node.js)

> *"By replacing heavy, solid glass with concentric stepped rings, Augustin-Jean Fresnel captured scattered light and concentrated it into a single, razor-sharp beam visible across the horizon."*

**Fresnel** is a minimal, rounded, friendly multi-flow web application built with **Angular 19** (Standalone Components + Signals) and **Node.js** that runs **Gemini 4 Argon** (`gemini-4-argon`) as a **Google Cloud Managed Agent** (`antigravity-preview-09-2026`) on GCP project **`phantom-gdemo-1`**.

Like the stepped concentric glass rings of Augustin-Jean Fresnel's lighthouse lens, Fresnel inspects raw repository source code across all four Lighthouse pillars (**Performance**, **Accessibility**, **Best Practices**, and **SEO**) and focuses findings into small, self-contained, atomic Git commits—**strictly through static AST & template analysis without executing servers or builds**.

---

## Key Features

1. **Interactive Fresnel Lore Tooltip (`Why Fresnel?`)**
   - Hover or focus over the **Fresnel** brand mark or **"Why Fresnel?"** pill on Step 1 to view the historical quote and explanation of Augustin-Jean Fresnel's 1822 stepped lighthouse lens and how it maps to static Lighthouse code autofix.
2. **Sandbox Demo Mode (`Try Demo Mode`)**
   - Test and showcase the entire 4-step workflow (`Enter Repo` → `Managed Agent Typography Narrative` → `Audit Report & Commit Selector` → `Pull Request Dispatched`) against a self-contained synthetic workspace (`fresnel-sandbox/lumina-web-app`) without hitting any public GitHub repositories.
3. **Angular + Node.js Full-Stack Architecture**
   - **Frontend (`src/`)**: Angular 19 standalone components (`AppComponent`, `FresnelLogoComponent`), reactive Angular `signal()` and `computed()` state management (`AuditService`), and smooth view-to-view opacity + vertical movement transitions (`cubic-bezier(0.22, 1, 0.36, 1)`).
   - **Backend (`server/`)**: Zero-dependency Node.js HTTP & REST API server (`server/index.js`, `server/agent-client.js`) and Python Vertex AI Managed Agent SDK bridge (`server/argon_managed_agent.py`) targeting GCP project `phantom-gdemo-1`.
4. **PR Dispatch or Manual Git `.patch` Download**
   - Review every atomic commit with inline expandable unified diffs, filter by Lighthouse category, and either dispatch a GitHub Pull Request or download a standard `git format-patch` bundle (`fresnel-lighthouse-fixes.patch`) with step-by-step CLI instructions.

---

## Project Structure (`fresnel/`)

```text
fresnel/
├── angular.json                                  # Angular CLI workspace configuration
├── package.json                                  # Angular + Node.js scripts and dependencies
├── proxy.conf.json                               # Angular dev-server proxy to Node backend (:4173)
├── tsconfig.json                                 # TypeScript strict configuration
├── tsconfig.app.json                             # Angular application TypeScript config
├── src/                                          # Angular Frontend Source
│   ├── index.html                                # Root HTML shell with Plus Jakarta Sans & JetBrains Mono
│   ├── main.ts                                   # Angular bootstrapApplication entry point
│   ├── styles.scss                               # Minimal, rounded & friendly design system + dark mode
│   └── app/
│       ├── app.config.ts                         # Angular ApplicationConfig (HttpClient provider)
│       ├── app.component.ts                      # Multi-flow 4-step root component
│       ├── app.component.html                    # Step 1-4 templates with smooth transitions
│       ├── app.component.scss                    # Component-scoped transitions
│       ├── models/
│       │   └── audit.model.ts                    # TypeScript interfaces (AuditJob, AuditCommit, FresnelLore)
│       ├── services/
│       │   └── audit.service.ts                  # Signal-based state & Node API integration
│       └── components/
│           └── fresnel-logo/
│               └── fresnel-logo.component.ts     # Lighthouse-Fresnel SVG logo + "Why Fresnel?" tooltip
├── server/                                       # Node.js Backend & Vertex AI Managed Agent Bridge
│   ├── index.js                                  # Node HTTP server (serves Angular dist/ or public/ + REST API)
│   ├── agent-client.js                           # Gemini 4 Argon Managed Agent client (phantom-gdemo-1 + Demo Mode)
│   └── argon_managed_agent.py                    # Python Vertex AI Managed Agent SDK reference implementation
└── public/                                       # Pre-built browser bundle for instant zero-install execution
    ├── logo.svg
    ├── index.html
    ├── styles.css
    └── app.js
```

---

## Quick Start

### Run the Node.js Server Immediately
```bash
cd fresnel
PORT=4173 npm start
```
Then open `http://localhost:4173` in your browser.

### Full Angular CLI Development Workflow
```bash
cd fresnel
npm install
npm run start:fullstack
```
- `npm run build` compiles the Angular frontend (`src/`) into `dist/fresnel/browser`, which the Node.js server (`server/index.js`) automatically detects and serves.
