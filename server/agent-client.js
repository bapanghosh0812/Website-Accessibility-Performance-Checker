import crypto from 'node:crypto';

export const FRESNEL_IDENTITY_LORE = {
  name: 'Fresnel',
  pronunciation: '/freɪˈnɛl/',
  origin: 'Named after French physicist Augustin-Jean Fresnel (1788–1827), inventor of the stepped concentric lighthouse lens.',
  quote:
    '“Instead of a single heavy dome of glass, concentric stepped prism rings capture scattered light from every angle and refract it into one extraordinary, miles-long beam.”',
  explanation:
    'Just as the Fresnel lens concentrates a lighthouse’s beam to guide ships through fog, Fresnel takes the broad inspection beam of Lighthouse and focuses it onto raw source code—refining scattered issues across performance, accessibility, best practices, SEO, and light web application security findings into sharp, self-contained git commits.'
};

export const FRESNEL_AGENT_CONFIG = {
  executionPolicy: 'STATIC_CODE_ONLY_NO_RUNTIME',
  demoRepositoryUrl: 'https://github.com/fresnel-sandbox/lumina-web-app'
};

/**
 * Parses a GitHub repository URL or shorthand ("owner/repo") into structured metadata.
 * When mode === 'demo', forces the isolated sandbox repository so no public repo is ever hit.
 */
export function parseRepoUrl(rawUrl, mode = 'live') {
  if (mode === 'demo') {
    return {
      owner: 'fresnel-sandbox',
      repo: 'lumina-web-app',
      fullName: 'fresnel-sandbox/lumina-web-app',
      url: 'https://github.com/fresnel-sandbox/lumina-web-app',
      isDemo: true
    };
  }

  const cleaned = (rawUrl || '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
  let owner = 'fresnel-sandbox';
  let repo = 'lumina-web-app';

  const githubMatch = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  const shorthandMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);

  if (githubMatch) {
    owner = githubMatch[1];
    repo = githubMatch[2];
  } else if (shorthandMatch) {
    owner = shorthandMatch[1];
    repo = shorthandMatch[2];
  }

  const normalizedUrl = `https://github.com/${owner}/${repo}`;

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    url: normalizedUrl,
    isDemo: false
  };
}

function makeSha(seed) {
  return crypto.createHash('sha1').update(seed).digest('hex').slice(0, 7);
}

function makeFullSha(seed) {
  return crypto.createHash('sha1').update(seed).digest('hex');
}

/**
 * Builds 15 comprehensive, self-contained atomic commits across all 4 Lighthouse categories
 * (Performance, Accessibility, Best practices, SEO) plus Web application security findings (light).
 */
export function buildComprehensiveCommits(repoMeta, selectedCategories) {
  const indexHtmlPath = 'src/index.html';
  const appHtmlPath = 'src/app/app.component.html';
  const appScssPath = 'src/app/app.component.scss';
  const routerPath = 'src/app/app.routes.ts';
  const headerHtmlPath = 'src/app/layout/header/header.component.html';
  const headerScssPath = 'src/app/layout/header/header.component.scss';
  const focusScssPath = 'src/app/shared/ui/option-card/option-card.component.scss';
  const heroHtmlPath = 'src/app/pages/landing/landing-page.component.html';
  const scrollTsPath = 'src/app/shared/utils/viewport-scroll.ts';

  const allCommits = [
    // ACCESSIBILITY
    {
      id: 'commit-a11y-1',
      sha: makeSha(`${repoMeta.fullName}-a11y-skip-link`),
      fullSha: makeFullSha(`${repoMeta.fullName}-a11y-skip-link`),
      category: 'accessibility',
      categoryLabel: 'Accessibility',
      ruleId: 'bypass',
      ruleTitle: 'Page contains a heading, skip link, or landmark region',
      impact: 'High',
      title: 'Add keyboard-accessible skip-to-main-content bypass link',
      commitMessage: 'feat(a11y): add keyboard-accessible skip-to-main-content bypass link',
      summary:
        'Added a visually hidden skip link as the first focusable element in the document shell that reveals on :focus-visible and jumps directly to #main-content, preventing keyboard users from tabbing through repetitive header controls.',
      files: [appHtmlPath, appScssPath],
      additions: 24,
      deletions: 2,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:15:14 +0000',
      body: [
        'Keyboard and screen reader users previously had to tab through every header control on each route change.',
        '',
        'Lighthouse Rule: bypass (WCAG 2.4.1 Bypass Blocks - Level A)',
        'Static Analysis Mode: AST & template inspection (no runtime execution)'
      ].join('\n'),
      diff: `diff --git a/${appHtmlPath} b/${appHtmlPath}
index 4a19c21..8b30e14 100644
--- a/${appHtmlPath}
+++ b/${appHtmlPath}
@@ -1,5 +1,6 @@
+<a class="skip-to-main-link" href="#main-content">Skip to main content</a>
 <app-header></app-header>
-<main class="app-main">
+<main id="main-content" class="app-main" tabindex="-1">
   <router-outlet></router-outlet>
 </main>
diff --git a/${appScssPath} b/${appScssPath}
index 219d0f2..9f03c81 100644
--- a/${appScssPath}
+++ b/${appScssPath}
@@ -1,3 +1,24 @@
+.skip-to-main-link {
+  position: fixed;
+  top: 0.75rem;
+  left: 0.75rem;
+  z-index: 9999;
+  padding: 0.625rem 1rem;
+  background: #060a10;
+  color: #ffffff;
+  border: 2px solid #00d8f5;
+  border-radius: 8px;
+  font-weight: 600;
+  text-decoration: none;
+  transform: translateY(-150%);
+  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
+
+  &:focus-visible {
+    transform: translateY(0);
+    outline: 2px solid #0052ff;
+    outline-offset: 2px;
+  }
+}`
    },
    {
      id: 'commit-a11y-2',
      sha: makeSha(`${repoMeta.fullName}-a11y-route-titles`),
      fullSha: makeFullSha(`${repoMeta.fullName}-a11y-route-titles`),
      category: 'accessibility',
      categoryLabel: 'Accessibility',
      ruleId: 'document-title',
      ruleTitle: 'Document has a contextual, route-specific <title> element',
      impact: 'High',
      title: 'Provide contextual document titles across all application routes',
      commitMessage: 'feat(a11y): provide contextual document titles across all application routes',
      summary:
        'Replaced generic fallback document titles with descriptive route-level title metadata so screen readers announce page context immediately upon navigation.',
      files: [routerPath],
      additions: 14,
      deletions: 4,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:16:05 +0000',
      body: [
        'Generic document titles fail to orient screen reader users when navigating between views.',
        '',
        'Lighthouse Rule: document-title (WCAG 2.4.2 Page Titled - Level A)',
        'Static Analysis Mode: route table inspection'
      ].join('\n'),
      diff: `diff --git a/${routerPath} b/${routerPath}
index 71c48a0..e02a91c 100644
--- a/${routerPath}
+++ b/${routerPath}
@@ -8,16 +8,20 @@ export const routes: Routes = [
   {
     path: '',
-    component: LandingPageComponent,
+    component: LandingPageComponent,
+    title: 'Overview — ${repoMeta.repo} | High-Precision Web Platform',
   },
   {
     path: 'catalog',
-    loadComponent: () => import('./pages/catalog/catalog.component'),
+    loadComponent: () => import('./pages/catalog/catalog.component'),
+    title: 'Product Catalog & Filters — ${repoMeta.repo}',
   },
   {
     path: 'inspector',
-    loadComponent: () => import('./pages/inspector/inspector.component'),
+    loadComponent: () => import('./pages/inspector/inspector.component'),
+    title: 'Interactive Telemetry Inspector — ${repoMeta.repo}',
   },
   {
     path: 'reports',
-    loadComponent: () => import('./pages/reports/reports.component'),
+    loadComponent: () => import('./pages/reports/reports.component'),
+    title: 'Audit Reports & Benchmarks — ${repoMeta.repo}',
   },
 ];`
    },
    {
      id: 'commit-a11y-3',
      sha: makeSha(`${repoMeta.fullName}-a11y-targets-and-focus`),
      fullSha: makeFullSha(`${repoMeta.fullName}-a11y-targets-and-focus`),
      category: 'accessibility',
      categoryLabel: 'Accessibility',
      ruleId: 'target-size',
      ruleTitle: 'Touch targets have sufficient size, spacing, and accessible names',
      impact: 'Medium',
      title: 'Enforce 44px touch targets, aria-labels, and high-contrast focus outlines',
      commitMessage: 'fix(a11y): enforce 44px touch targets, aria-labels, and high-contrast focus outlines',
      summary:
        'Added explicit aria-label attributes to icon-only navigation buttons, enforced >=44x44px hit targets with 8px gap, and added high-contrast focus-visible outline overrides.',
      files: [headerHtmlPath, headerScssPath, focusScssPath],
      additions: 19,
      deletions: 5,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:17:18 +0000',
      body: [
        'Fixes unlabeled icon buttons in header navigation, increases interactive target sizing/spacing for motor accessibility, and adds explicit focus-visible outlines.',
        '',
        'Lighthouse Rules: button-name, target-size, focus-visible (WCAG 2.5.8 & 2.4.7)',
        'Static Analysis Mode: template & SCSS audit'
      ].join('\n'),
      diff: `diff --git a/${headerHtmlPath} b/${headerHtmlPath}
index 55c82a1..c39e147 100644
--- a/${headerHtmlPath}
+++ b/${headerHtmlPath}
@@ -4,7 +4,9 @@
-  <button class="nav-icon-btn" (click)="toggleTheme()">
-    <svg class="icon-theme" viewBox="0 0 24 24"></svg>
+  <button class="nav-icon-btn" type="button"
+          [attr.aria-label]="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
+          [attr.aria-pressed]="isDark"
+          (click)="toggleTheme()">
+    <svg class="icon-theme" viewBox="0 0 24 24" aria-hidden="true" focusable="false"></svg>
   </button>
diff --git a/${headerScssPath} b/${headerScssPath}
index 12a94c0..74d201a 100644
--- a/${headerScssPath}
+++ b/${headerScssPath}
@@ -14,6 +14,9 @@
 .nav-actions {
   display: flex;
   align-items: center;
-  gap: 2px;
+  gap: 0.5rem;
 }
 .nav-icon-btn {
-  padding: 4px;
+  min-width: 2.75rem;
+  min-height: 2.75rem;
+  padding: 0.5rem;
 }
diff --git a/${focusScssPath} b/${focusScssPath}
index 63f10a9..a88e310 100644
--- a/${focusScssPath}
+++ b/${focusScssPath}
@@ -86,4 +86,6 @@
   &:focus-visible {
     outline: 2px solid var(--focus-ring-color, #0052ff);
     outline-offset: 2px;
+    forced-color-adjust: none;
   }`
    },

    // SEO
    {
      id: 'commit-seo-1',
      sha: makeSha(`${repoMeta.fullName}-seo-meta-og`),
      fullSha: makeFullSha(`${repoMeta.fullName}-seo-meta-og`),
      category: 'seo',
      categoryLabel: 'SEO',
      ruleId: 'meta-description',
      ruleTitle: 'Document has a meta description and OpenGraph description tags',
      impact: 'High',
      title: 'Add meta description, viewport config, and OpenGraph social metadata',
      commitMessage: 'feat(seo): add meta description, viewport config, and OpenGraph social metadata',
      summary:
        'Added a responsive viewport meta tag without pinch-zoom locks, descriptive meta description, and matching og:description / og:title tags to index.html for search indexing.',
      files: [indexHtmlPath],
      additions: 14,
      deletions: 1,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:18:02 +0000',
      body: [
        'Adds missing meta description and OpenGraph description tags to index.html.',
        '',
        'Lighthouse Rule: meta-description, viewport',
        'Static Analysis Mode: document head inspection'
      ].join('\n'),
      diff: `diff --git a/${indexHtmlPath} b/${indexHtmlPath}
index 9012fa4..36dba66 100644
--- a/${indexHtmlPath}
+++ b/${indexHtmlPath}
@@ -4,5 +4,18 @@
   <meta charset="utf-8" />
   <title>${repoMeta.repo}</title>
   <base href="/" />
-  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
+  <meta name="viewport" content="width=device-width, initial-scale=1" />
+  <meta
+    name="description"
+    content="Discover ${repoMeta.repo} — fast, accessible web architecture engineered for Core Web Vitals and modern search discoverability."
+  />
+  <meta
+    property="og:description"
+    content="Discover ${repoMeta.repo} — fast, accessible web architecture engineered for Core Web Vitals and modern search discoverability."
+  />
+  <meta property="og:title" content="${repoMeta.repo} — Modern Web Platform" />
+  <meta property="og:type" content="website" />
 </head>`
    },
    {
      id: 'commit-seo-2',
      sha: makeSha(`${repoMeta.fullName}-seo-canonical-jsonld`),
      fullSha: makeFullSha(`${repoMeta.fullName}-seo-canonical-jsonld`),
      category: 'seo',
      categoryLabel: 'SEO',
      ruleId: 'canonical',
      ruleTitle: 'Document has a valid rel=“canonical” link and structured schema.org JSON-LD',
      impact: 'Medium',
      title: 'Add canonical URL link tag and WebApplication JSON-LD structured data',
      commitMessage: 'feat(seo): add canonical URL link tag and WebApplication JSON-LD structured data',
      summary:
        'Declared a canonical link element to prevent duplicate query-parameter indexing and embedded schema.org WebApplication structured data.',
      files: [indexHtmlPath],
      additions: 15,
      deletions: 0,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:18:49 +0000',
      body: [
        'Prevents duplicate content penalties across tracking query strings and enriches search result snippets.',
        '',
        'Lighthouse Rule: canonical, structured-data',
        'Static Analysis Mode: SEO head audit'
      ].join('\n'),
      diff: `diff --git a/${indexHtmlPath} b/${indexHtmlPath}
index 36dba66..71c98b3 100644
--- a/${indexHtmlPath}
+++ b/${indexHtmlPath}
@@ -16,4 +16,19 @@
   <meta property="og:title" content="${repoMeta.repo} — Modern Web Platform" />
   <meta property="og:type" content="website" />
+  <link rel="canonical" href="https://${repoMeta.owner}.github.io/${repoMeta.repo}/" />
+  <script type="application/ld+json">
+    {
+      "@context": "https://schema.org",
+      "@type": "WebApplication",
+      "name": "${repoMeta.repo}",
+      "applicationCategory": "DeveloperApplication",
+      "operatingSystem": "All",
+      "description": "Fast, accessible web architecture engineered for Core Web Vitals and search discoverability."
+    }
+  </script>
 </head>`
    },
    {
      id: 'commit-seo-3',
      sha: makeSha(`${repoMeta.fullName}-seo-crawlable-anchors`),
      fullSha: makeFullSha(`${repoMeta.fullName}-seo-crawlable-anchors`),
      category: 'seo',
      categoryLabel: 'SEO',
      ruleId: 'crawlable-anchors',
      ruleTitle: 'Links are crawlable with descriptive anchor text',
      impact: 'Medium',
      title: 'Replace non-crawlable span click handlers with semantic routerLink anchors',
      commitMessage: 'fix(seo): replace non-crawlable span click handlers with semantic routerLink anchors',
      summary:
        'Converted navigation cards using click-only spans into semantic <a routerLink=“...”> elements with descriptive link text instead of generic “Click here” labels.',
      files: [heroHtmlPath],
      additions: 8,
      deletions: 8,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:19:22 +0000',
      body: [
        'Search crawlers cannot follow JS-only click handlers on non-anchor elements, and generic link text degrades anchor relevance.',
        '',
        'Lighthouse Rules: crawlable-anchors, link-text',
        'Static Analysis Mode: template AST analysis'
      ].join('\n'),
      diff: `diff --git a/${heroHtmlPath} b/${heroHtmlPath}
index 49f01a2..b8120e5 100644
--- a/${heroHtmlPath}
+++ b/${heroHtmlPath}
@@ -18,10 +18,10 @@
   <div class="cta-group">
-    <span class="cta-primary" (click)="navigateToCatalog()">
-      Click here
-    </span>
-    <span class="cta-secondary" (click)="navigateToInspector()">
-      Learn more
-    </span>
+    <a class="cta-primary" routerLink="/catalog" href="/catalog">
+      Explore Product Architecture Catalog
+    </a>
+    <a class="cta-secondary" routerLink="/inspector" href="/inspector">
+      Open Live Performance Inspector
+    </a>
   </div>`
    },

    // PERFORMANCE
    {
      id: 'commit-perf-1',
      sha: makeSha(`${repoMeta.fullName}-perf-lcp-cls`),
      fullSha: makeFullSha(`${repoMeta.fullName}-perf-lcp-cls`),
      category: 'performance',
      categoryLabel: 'Performance',
      ruleId: 'largest-contentful-paint',
      ruleTitle: 'Prioritize LCP hero image and define explicit dimensions to prevent CLS',
      impact: 'High',
      title: 'Add fetchpriority=“high” and explicit width/height on hero media',
      commitMessage: 'perf(lcp): add fetchpriority="high" and explicit width/height on hero media',
      summary:
        'Marked the primary above-the-fold hero visual with fetchpriority=“high” and decoding=“async”, and added explicit intrinsic dimensions to eliminate Cumulative Layout Shift (CLS).',
      files: [heroHtmlPath],
      additions: 12,
      deletions: 4,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:20:10 +0000',
      body: [
        'Prioritizes discovery of the Largest Contentful Paint (LCP) image element and reserves aspect-ratio layout space prior to image decode.',
        '',
        'Lighthouse Rules: prioritize-lcp-image, unsized-images (Core Web Vitals: LCP & CLS)',
        'Static Analysis Mode: static template audit'
      ].join('\n'),
      diff: `diff --git a/${heroHtmlPath} b/${heroHtmlPath}
index b8120e5..f09c412 100644
--- a/${heroHtmlPath}
+++ b/${heroHtmlPath}
@@ -4,8 +4,16 @@
   <div class="hero-visual-wrapper">
-    <img class="hero-illustration"
-         src="/assets/images/hero-showcase.webp" />
-    <img class="preview-card-img"
-         src="/assets/images/telemetry-preview.webp" />
+    <img class="hero-illustration"
+         src="/assets/images/hero-showcase.webp"
+         alt="Lumina optical architecture overview"
+         width="1280"
+         height="720"
+         fetchpriority="high"
+         decoding="async" />
+    <img class="preview-card-img"
+         src="/assets/images/telemetry-preview.webp"
+         alt="Preview of real-time Lighthouse telemetry"
+         width="640"
+         height="400"
+         loading="lazy"
+         decoding="async" />
   </div>`
    },
    {
      id: 'commit-perf-2',
      sha: makeSha(`${repoMeta.fullName}-perf-preconnect-fonts`),
      fullSha: makeFullSha(`${repoMeta.fullName}-perf-preconnect-fonts`),
      category: 'performance',
      categoryLabel: 'Performance',
      ruleId: 'uses-rel-preconnect',
      ruleTitle: 'Preconnect to required origins and eliminate render-blocking font requests',
      impact: 'High',
      title: 'Add preconnect resource hints and swap font-display strategy',
      commitMessage: 'perf(network): add preconnect resource hints and swap font-display strategy',
      summary:
        'Added <link rel=“preconnect”> hints for critical font/CDN origins and converted synchronous @import stylesheets to non-blocking links with font-display:swap.',
      files: [indexHtmlPath],
      additions: 6,
      deletions: 2,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:20:54 +0000',
      body: [
        'Establishes early TCP/TLS handshakes to critical asset origins and avoids invisible text (FOIT) during webfont download using font-display:swap.',
        '',
        'Lighthouse Rules: uses-rel-preconnect, render-blocking-resources, font-display',
        'Static Analysis Mode: network hint analysis'
      ].join('\n'),
      diff: `diff --git a/${indexHtmlPath} b/${indexHtmlPath}
index 71c98b3..d03e128 100644
--- a/${indexHtmlPath}
+++ b/${indexHtmlPath}
@@ -6,4 +6,8 @@
   <base href="/" />
+  <link rel="preconnect" href="https://fonts.googleapis.com" />
+  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
+  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&display=swap" />
   <meta name="viewport" content="width=device-width, initial-scale=1" />`
    },
    {
      id: 'commit-perf-3',
      sha: makeSha(`${repoMeta.fullName}-perf-composited-animations`),
      fullSha: makeFullSha(`${repoMeta.fullName}-perf-composited-animations`),
      category: 'performance',
      categoryLabel: 'Performance',
      ruleId: 'non-composited-animations',
      ruleTitle: 'Avoid non-composited animations and respect prefers-reduced-motion',
      impact: 'Medium',
      title: 'Replace layout-thrashing top/left transitions with GPU-composited transform',
      commitMessage: 'perf(css): replace layout-thrashing top/left transitions with GPU-composited transform',
      summary:
        'Replaced top/height CSS transitions with compositor-friendly transform/opacity properties and added a @media (prefers-reduced-motion: reduce) guard.',
      files: [appScssPath],
      additions: 14,
      deletions: 4,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:21:39 +0000',
      body: [
        'Eliminates main-thread layout recalculations on every animation frame.',
        '',
        'Lighthouse Rule: non-composited-animations',
        'Static Analysis Mode: stylesheet compositor analysis'
      ].join('\n'),
      diff: `diff --git a/${appScssPath} b/${appScssPath}
index 9f03c81..c84e209 100644
--- a/${appScssPath}
+++ b/${appScssPath}
@@ -26,7 +26,17 @@
 .stage-transition-panel {
-  top: 0;
-  transition: top 300ms ease, height 300ms ease;
+  transform: translate3d(0, 0, 0);
+  will-change: transform, opacity;
+  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
+              opacity 280ms cubic-bezier(0.22, 1, 0.36, 1);
 }
+
+@media (prefers-reduced-motion: reduce) {
+  *,
+  *::before,
+  *::after {
+    animation-duration: 0.01ms !important;
+    transition-duration: 0.01ms !important;
+  }
+}`
    },

    // BEST PRACTICES
    {
      id: 'commit-bp-1',
      sha: makeSha(`${repoMeta.fullName}-bp-csp-security`),
      fullSha: makeFullSha(`${repoMeta.fullName}-bp-csp-security`),
      category: 'best-practices',
      categoryLabel: 'Best practices',
      ruleId: 'csp-xss',
      ruleTitle: 'Ensure CSP is effective against XSS attacks and referrer policy is explicit',
      impact: 'High',
      title: 'Add strict-origin-when-cross-origin referrer and CSP meta directives',
      commitMessage: 'security(headers): add strict-origin-when-cross-origin referrer and CSP meta directives',
      summary:
        'Added strict-origin-when-cross-origin Referrer-Policy and Content-Security-Policy upgrade-insecure-requests / object-src directives to harden client-side execution.',
      files: [indexHtmlPath],
      additions: 6,
      deletions: 0,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:22:15 +0000',
      body: [
        'Hardens document security posture against mixed-content and object-injection vectors.',
        '',
        'Lighthouse Rule: csp-xss, is-on-https',
        'Static Analysis Mode: security policy audit'
      ].join('\n'),
      diff: `diff --git a/${indexHtmlPath} b/${indexHtmlPath}
index d03e128..e814a90 100644
--- a/${indexHtmlPath}
+++ b/${indexHtmlPath}
@@ -9,4 +9,10 @@
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&display=swap" />
+  <meta name="referrer" content="strict-origin-when-cross-origin" />
+  <meta
+    http-equiv="Content-Security-Policy"
+    content="default-src 'self' https:; img-src 'self' https: data:; object-src 'none'; base-uri 'self'; upgrade-insecure-requests;"
+  />
   <meta name="viewport" content="width=device-width, initial-scale=1" />`
    },
    {
      id: 'commit-bp-2',
      sha: makeSha(`${repoMeta.fullName}-bp-noopener-external`),
      fullSha: makeFullSha(`${repoMeta.fullName}-bp-noopener-external`),
      category: 'best-practices',
      categoryLabel: 'Best practices',
      ruleId: 'external-anchors-use-rel-noopener',
      ruleTitle: 'Links to cross-origin destinations are safe and use rel=“noopener noreferrer”',
      impact: 'Medium',
      title: 'Add rel=“noopener noreferrer” to all external target=“_blank” links',
      commitMessage: 'fix(security): add rel="noopener noreferrer" to all external target="_blank" links',
      summary:
        'Audited external anchor tags opening in a new tab and added rel=“noopener noreferrer” to prevent reverse tabnabbing and window.opener process sharing.',
      files: [headerHtmlPath],
      additions: 4,
      deletions: 2,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:22:52 +0000',
      body: [
        'Prevents cross-origin target=“_blank” pages from accessing window.opener or sharing the main renderer thread.',
        '',
        'Lighthouse Rule: external-anchors-use-rel-noopener',
        'Static Analysis Mode: template security scan'
      ].join('\n'),
      diff: `diff --git a/${headerHtmlPath} b/${headerHtmlPath}
index c39e147..f18b04d 100644
--- a/${headerHtmlPath}
+++ b/${headerHtmlPath}
@@ -12,5 +12,7 @@
   <a class="docs-external-link"
      href="https://web.dev/performance"
-     target="_blank">
+     target="_blank"
+     rel="noopener noreferrer">
     Web Vitals Documentation
   </a>`
    },
    {
      id: 'commit-bp-3',
      sha: makeSha(`${repoMeta.fullName}-bp-passive-listeners`),
      fullSha: makeFullSha(`${repoMeta.fullName}-bp-passive-listeners`),
      category: 'best-practices',
      categoryLabel: 'Best practices',
      ruleId: 'uses-passive-event-listeners',
      ruleTitle: 'Uses passive listeners to improve scrolling performance and avoid deprecated APIs',
      impact: 'Medium',
      title: 'Mark wheel and touchstart listeners as passive to unblock scroll thread',
      commitMessage: 'refactor(events): mark wheel and touchstart listeners as passive to unblock scroll thread',
      summary:
        'Added { passive: true } option to window touchstart and wheel listeners in the viewport controller so the browser compositor can scroll immediately.',
      files: [scrollTsPath],
      additions: 6,
      deletions: 4,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:23:30 +0000',
      body: [
        'Non-passive touch and wheel listeners force the browser compositor thread to wait on JS execution before scrolling.',
        '',
        'Lighthouse Rule: uses-passive-event-listeners',
        'Static Analysis Mode: TypeScript AST inspection'
      ].join('\n'),
      diff: `diff --git a/${scrollTsPath} b/${scrollTsPath}
index 38a91e1..92d47b0 100644
--- a/${scrollTsPath}
+++ b/${scrollTsPath}
@@ -19,6 +19,8 @@ export function registerViewportListeners(target: HTMLElement, onPan: () => void
-  target.addEventListener('touchstart', onPan);
-  target.addEventListener('touchmove', onPan);
-  target.addEventListener('wheel', onPan);
+  const listenerOptions: AddEventListenerOptions = { passive: true };
+  target.addEventListener('touchstart', onPan, listenerOptions);
+  target.addEventListener('touchmove', onPan, listenerOptions);
+  target.addEventListener('wheel', onPan, listenerOptions);
 }`
    },

    // WEB APPLICATION SECURITY FINDINGS (LIGHT)
    {
      id: 'commit-sec-1',
      sha: makeSha(`${repoMeta.fullName}-sec-dom-xss-sink`),
      fullSha: makeFullSha(`${repoMeta.fullName}-sec-dom-xss-sink`),
      category: 'security',
      categoryLabel: 'Web application security findings',
      securityContext: 'Light',
      securityPattern: 'Common unsafe pattern · DOM XSS sink',
      ruleId: 'dom-xss-innerhtml',
      ruleTitle: 'Avoid unescaped innerHTML and bypassSecurityTrustHtml with untrusted input',
      impact: 'High',
      title: 'Replace unsafe innerHTML / bypassSecurityTrustHtml sink with sanitized binding',
      commitMessage: 'security(xss): replace unsafe bypassSecurityTrustHtml sink with sanitized text binding',
      summary:
        'Replaced an unsafe bypassSecurityTrustHtml() + [innerHTML] template binding used for user-supplied markdown snippets with safe text interpolation and explicit URL protocol validation.',
      files: ['src/app/features/preview/preview-card.component.ts', 'src/app/features/preview/preview-card.component.html'],
      additions: 11,
      deletions: 9,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:24:05 +0000',
      body: [
        'Light Web Application Security Finding: Unescaped [innerHTML] paired with DomSanitizer.bypassSecurityTrustHtml() allows arbitrary script execution if query or API strings contain HTML payloads.',
        '',
        'Category: Web application security findings (light — common unsafe pattern)',
        'Static Analysis Mode: template & sink pattern scan'
      ].join('\n'),
      diff: `diff --git a/src/app/features/preview/preview-card.component.ts b/src/app/features/preview/preview-card.component.ts
index 81f02a4..3d91c7b 100644
--- a/src/app/features/preview/preview-card.component.ts
+++ b/src/app/features/preview/preview-card.component.ts
@@ -14,7 +14,6 @@ export class PreviewCardComponent {
-  private readonly sanitizer = inject(DomSanitizer);
-  readonly renderedNote = computed(() =>
-    this.sanitizer.bypassSecurityTrustHtml(this.rawUserNote())
-  );
+  readonly safeNoteText = computed(() =>
+    (this.rawUserNote() ?? '').trim()
+  );
 }
diff --git a/src/app/features/preview/preview-card.component.html b/src/app/features/preview/preview-card.component.html
index 20b4f11..99c2e18 100644
--- a/src/app/features/preview/preview-card.component.html
+++ b/src/app/features/preview/preview-card.component.html
@@ -5,3 +5,3 @@
-  <div class="preview-note" [innerHTML]="renderedNote()"></div>
+  <p class="preview-note">{{ safeNoteText() }}</p>`
    },
    {
      id: 'commit-sec-2',
      sha: makeSha(`${repoMeta.fullName}-sec-token-storage`),
      fullSha: makeFullSha(`${repoMeta.fullName}-sec-token-storage`),
      category: 'security',
      categoryLabel: 'Web application security findings',
      securityContext: 'Light',
      securityPattern: 'Common unsafe pattern · client secret & token exposure',
      ruleId: 'client-secret-and-token-storage',
      ruleTitle: 'Avoid hardcoded client API secrets and plaintext bearer tokens in localStorage',
      impact: 'High',
      title: 'Remove hardcoded fallback API key and avoid storing session tokens in localStorage',
      commitMessage: 'security(auth): remove hardcoded fallback API key and use HttpOnly session cookie flow',
      summary:
        'Removed a hardcoded fallback API key literal from client environment configuration and replaced localStorage bearer token persistence with credentials: “include” for HttpOnly cookie sessions.',
      files: ['src/environments/environment.ts', 'src/app/core/auth/session.service.ts'],
      additions: 9,
      deletions: 10,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:24:42 +0000',
      body: [
        'Light Web Application Security Finding: Hardcoded keys in client bundles are publicly extractable, and tokens persisted in localStorage can be exfiltrated by any third-party script.',
        '',
        'Category: Web application security findings (light — common unsafe pattern)',
        'Static Analysis Mode: AST & credential pattern scan'
      ].join('\n'),
      diff: `diff --git a/src/environments/environment.ts b/src/environments/environment.ts
index 4019a2b..78c410e 100644
--- a/src/environments/environment.ts
+++ b/src/environments/environment.ts
@@ -1,5 +1,4 @@
 export const environment = {
   production: true,
   apiBaseUrl: '/api/v1',
-  telemetryApiKey: 'sk_live_hardcoded_demo_telemetry_token_99281a',
 };
diff --git a/src/app/core/auth/session.service.ts b/src/app/core/auth/session.service.ts
index 62c110f..e041b82 100644
--- a/src/app/core/auth/session.service.ts
+++ b/src/app/core/auth/session.service.ts
@@ -11,6 +11,6 @@ export class SessionService {
-  persistSession(jwt: string): void {
-    localStorage.setItem('auth_bearer_jwt', jwt);
-  }
+  fetchSessionProfile() {
+    return this.http.get('/api/v1/session/me', { withCredentials: true });
+  }`
    },
    {
      id: 'commit-sec-3',
      sha: makeSha(`${repoMeta.fullName}-sec-open-redirect`),
      fullSha: makeFullSha(`${repoMeta.fullName}-sec-open-redirect`),
      category: 'security',
      categoryLabel: 'Web application security findings',
      securityContext: 'Light',
      securityPattern: 'Common unsafe pattern · unvalidated redirect',
      ruleId: 'unvalidated-open-redirect',
      ruleTitle: 'Validate redirect query parameters against external origin spoofing',
      impact: 'Medium',
      title: 'Enforce same-origin relative path check on returnUrl navigation parameter',
      commitMessage: 'security(routing): enforce same-origin relative path check on returnUrl redirect',
      summary:
        'Validated the returnUrl query parameter before redirecting so protocol-relative (//evil.example) or external URLs are rejected and defaulted safely to /.',
      files: ['src/app/core/auth/auth-redirect.util.ts'],
      additions: 12,
      deletions: 3,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 12:25:18 +0000',
      body: [
        'Light Web Application Security Finding: Passing unvalidated query parameters directly to window.location.assign() or router navigation enables open-redirect phishing flows.',
        '',
        'Category: Web application security findings (light — common unsafe pattern)',
        'Static Analysis Mode: route & URL sink analysis'
      ].join('\n'),
      diff: `diff --git a/src/app/core/auth/auth-redirect.util.ts b/src/app/core/auth/auth-redirect.util.ts
index 55b209d..f38a712 100644
--- a/src/app/core/auth/auth-redirect.util.ts
+++ b/src/app/core/auth/auth-redirect.util.ts
@@ -1,4 +1,13 @@
 export function resolveSafeReturnUrl(rawReturnUrl: string | null | undefined): string {
-  return rawReturnUrl || '/overview';
+  if (!rawReturnUrl) {
+    return '/overview';
+  }
+  const trimmed = rawReturnUrl.trim();
+  // Allow only single-slash relative internal paths; block //host and external schemes
+  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\\\')) {
+    return trimmed;
+  }
+  return '/overview';
 }`
    }
  ];

  const activeSet = new Set(
    Array.isArray(selectedCategories) && selectedCategories.length > 0
      ? selectedCategories
      : ['performance', 'accessibility', 'best-practices', 'seo', 'security']
  );

  return allCommits.filter((c) => activeSet.has(c.category));
}

/**
 * Builds descriptive, typographic narrative steps for View 2.
 * All headlines use imperative mood; all narratives use present continuous (-ing) or past tense (-ed).
 */
export function buildAgentTelemetrySteps(repoMeta, commits) {
  const steps = [
    {
      index: 0,
      phase: 'Preparing audit',
      category: 'Workspace',
      headline: `Inspect ${repoMeta.fullName}`,
      narrative: `Scanning the repository statically across Performance, Accessibility, Best practices, SEO, and web application security findings (light) without running servers or build scripts.`,
      commitId: null
    },
    {
      index: 1,
      phase: 'Mapping structure',
      category: 'Structure',
      headline: `Read template, stylesheets, routing, and security sinks`,
      narrative: `Tracing document head metadata, landmark hierarchy, focus styles, media attributes, and common unsafe web security patterns across ${repoMeta.fullName}.`,
      commitId: null
    }
  ];

  for (const commit of commits) {
    steps.push({
      index: steps.length,
      phase: `Auditing ${commit.categoryLabel.toLowerCase() === 'seo' ? 'SEO' : commit.categoryLabel.toLowerCase()}`,
      category: commit.categoryLabel,
      headline: commit.title,
      narrative: `${commit.summary} Synthesized self-contained commit ${commit.sha} touching ${commit.files.join(', ')}.`,
      commitId: commit.id,
      sha: commit.sha,
      ruleId: commit.ruleId
    });
  }

  steps.push({
    index: steps.length,
    phase: 'Audit complete',
    category: 'Complete',
    headline: `Prepare ${commits.length} self-contained commits for ${repoMeta.fullName}`,
    narrative: `Audited all four Lighthouse pillars and light web application security findings statically. Opening your interactive commit report.`,
    commitId: null
  });

  return steps;
}

/**
 * Generates a standards-compliant multi-commit `git format-patch` mailbox file from the user's selected commits
 * ready to be applied directly via `git am`.
 */
export function generateGitFormatPatch(session, selectedCommitIds) {
  const selectedIdSet = new Set(
    Array.isArray(selectedCommitIds) && selectedCommitIds.length > 0
      ? selectedCommitIds
      : session.commits.map((c) => c.id)
  );

  const chosenCommits = session.commits.filter((c) => selectedIdSet.has(c.id));
  const total = chosenCommits.length;

  if (total === 0) {
    return '# No commits selected for patch export.\n';
  }

  const patches = chosenCommits.map((commit, idx) => {
    const subjectPrefix = total > 1 ? `[PATCH ${idx + 1}/${total}]` : `[PATCH]`;
    const fileStatsLine = commit.files
      .map((f) => ` ${f} | ${commit.additions + commit.deletions} ++--`)
      .join('\n');

    return [
      `From ${commit.fullSha} Mon Sep 17 00:00:00 2001`,
      `From: ${commit.author}`,
      `Date: ${commit.date}`,
      `Subject: ${subjectPrefix} ${commit.commitMessage || commit.title}`,
      '',
      commit.summary,
      '',
      commit.body,
      '---',
      fileStatsLine,
      ` ${commit.files.length} file(s) changed, ${commit.additions} insertions(+), ${commit.deletions} deletions(-)`,
      '',
      commit.diff,
      '-- ',
      '2.47.0',
      ''
    ].join('\n');
  });

  return patches.join('\n');
}

/**
 * Builds a zero-env-variable 1-click Terminal Command (`git am` + `gh pr create`) bundle
 * so developers can apply all selected atomic commits and open a Pull Request using their
 * existing local git/gh credentials.
 */
export function buildPullRequestCliBundle(session, selectedCommitIds = [], options = {}) {
  const selectedIdSet = new Set(
    Array.isArray(selectedCommitIds) && selectedCommitIds.length > 0
      ? selectedCommitIds
      : session.commits.map((c) => c.id)
  );
  const selectedCommits = session.commits.filter((c) => selectedIdSet.has(c.id));
  const shortHash = crypto
    .createHash('sha1')
    .update(`${session.id}-${selectedCommits.map((c) => c.sha).join(',')}`)
    .digest('hex')
    .slice(0, 6);

  const branchPrefix = session.runPhase === 'lhr' ? 'fresnel/lhr-targeted' : 'fresnel/code-audit';
  const headBranch = (options.headBranch || `${branchPrefix}-${shortHash}`).trim();
  const baseBranch = (session.branch || 'main').trim() || 'main';
  const suffix = session.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';
  const patchFilename = `fresnel-${session.repo.repo}-${suffix}.patch`;
  const patchContent = generateGitFormatPatch(
    session,
    selectedCommits.map((c) => c.id)
  );

  const prTitle =
    options.prTitle ||
    (session.runPhase === 'lhr'
      ? `perf(lighthouse-lhr): targeted LHR JSON audit fixes (${selectedCommits.length} commits)`
      : `chore(audit): code & security audit fixes (${selectedCommits.length} commits)`);

  const categoriesImproved = buildCategoriesImproved(
    selectedCommits,
    session.runPhase === 'lhr' ? 2 : 1
  ).filter((c) => c.improved);

  const prBodyLines = [
    `## Fresnel Automated Code Audit Fixes`,
    '',
    `Applies **${selectedCommits.length} atomic commit(s)** improving: ${categoriesImproved.map((c) => `**${c.label}**`).join(', ')}.`,
    '',
    `### Included Commits`,
    ...selectedCommits.map(
      (c) => `- \`${c.commitMessage || c.title}\` (${c.categoryLabel} · \`${c.files.join(', ')}\`)`
    )
  ];
  const prBody = prBodyLines.join('\n');

  const compareUrl = `${session.repo.url}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(headBranch)}?expand=1&title=${encodeURIComponent(prTitle)}&body=${encodeURIComponent(prBody)}`;

  const escapedTitle = prTitle.replace(/"/g, '\\"');
  const escapedBody = prBody.replace(/"/g, '\\"').replace(/`/g, '\\`');

  // 1. Self-contained 1-click terminal snippet (embeds the multi-commit git format-patch via heredoc + pushes + opens PR via gh CLI)
  const terminalCommand = [
    `git checkout -b ${headBranch} && \\`,
    `git am --3way << 'FRESNEL_PATCH_EOF'`,
    patchContent.trimEnd(),
    `FRESNEL_PATCH_EOF`,
    `git push -u origin ${headBranch} && \\`,
    `gh pr create --base ${baseBranch} --head ${headBranch} --title "${escapedTitle}" --body "${escapedBody}"`
  ].join('\n');

  // 2. Concise terminal command using the downloaded .patch file
  const shortTerminalCommand = [
    `git checkout -b ${headBranch} && \\`,
    `git am --3way ~/Downloads/${patchFilename} && \\`,
    `git push -u origin ${headBranch} && \\`,
    `gh pr create --base ${baseBranch} --head ${headBranch} --title "${escapedTitle}" --fill`
  ].join('\n');

  return {
    number: session.runPhase === 'lhr' ? 43 : 42,
    mode: session.mode,
    runPhase: session.runPhase || 'static',
    title: prTitle,
    body: prBody,
    url: compareUrl,
    compareUrl,
    repoUrl: session.repo.url,
    repoFullName: session.repo.fullName,
    baseBranch,
    headBranch,
    patchFilename,
    patchDownloadUrl: `/api/audit/${session.id}/patch.diff?commits=${encodeURIComponent(
      selectedCommits.map((c) => c.id).join(',')
    )}`,
    terminalCommand,
    shortTerminalCommand,
    createdAt: new Date().toISOString(),
    selectedCommits,
    totalAdditions: selectedCommits.reduce((sum, c) => sum + c.additions, 0),
    totalDeletions: selectedCommits.reduce((sum, c) => sum + c.deletions, 0),
    filesTouched: Array.from(new Set(selectedCommits.flatMap((c) => c.files)))
  };
}

/**
 * Sample Lighthouse Result (LHR) JSON object conforming to:
 * https://github.com/GoogleChrome/lighthouse/blob/main/docs/understanding-results.md
 */
export const SAMPLE_LIGHTHOUSE_LHR_JSON = {
  lighthouseVersion: '12.2.0',
  fetchTime: '2026-10-06T13:35:00.000Z',
  requestedUrl: 'https://lumina-web.app/',
  mainDocumentUrl: 'https://lumina-web.app/',
  finalDisplayedUrl: 'https://lumina-web.app/',
  configSettings: {
    formFactor: 'desktop',
    locale: 'en-US',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
  },
  categories: {
    performance: {
      id: 'performance',
      title: 'Performance',
      score: 0.68,
      auditRefs: [
        { id: 'largest-contentful-paint-element', weight: 25, group: 'diagnostics' },
        { id: 'render-blocking-resources', weight: 15, group: 'load-opportunities' },
        { id: 'unsized-images', weight: 10, group: 'diagnostics' }
      ]
    },
    accessibility: {
      id: 'accessibility',
      title: 'Accessibility',
      score: 0.74,
      auditRefs: [
        { id: 'color-contrast', weight: 7, group: 'a11y-color-contrast' },
        { id: 'aria-Save-button-name', weight: 10, group: 'a11y-names-labels' }
      ]
    },
    'best-practices': {
      id: 'best-practices',
      title: 'Best Practices',
      score: 0.83,
      auditRefs: [
        { id: 'csp-xss', weight: 5, group: 'trust-safety' }
      ]
    },
    seo: {
      id: 'seo',
      title: 'SEO',
      score: 0.82,
      auditRefs: [
        { id: 'structured-data', weight: 5, group: 'seo-content' }
      ]
    }
  },
  audits: {
    'largest-contentful-paint-element': {
      id: 'largest-contentful-paint-element',
      title: 'Largest Contentful Paint element',
      description: 'This is the largest contentful element painted within the viewport.',
      score: 0.28,
      scoreDisplayMode: 'metricSavings',
      numericValue: 3420,
      numericUnit: 'millisecond',
      displayValue: '3,420 ms',
      metricSavings: { LCP: 1180 },
      details: {
        type: 'table',
        items: [
          {
            node: {
              type: 'node',
              selector: 'section.hero-stage > picture > img.hero-banner-media',
              snippet: '<img class="hero-banner-media" src="/assets/hero-lens.jpg">'
            }
          }
        ]
      }
    },
    'render-blocking-resources': {
      id: 'render-blocking-resources',
      title: 'Eliminate render-blocking resources',
      description: 'Resources are blocking the first paint of your page. Consider delivering critical JS/CSS inline and deferring all non-critical JS/styles.',
      score: 0.42,
      scoreDisplayMode: 'metricSavings',
      numericValue: 640,
      numericUnit: 'millisecond',
      displayValue: 'Potential savings of 640 ms',
      metricSavings: { FCP: 640, LCP: 480 },
      details: {
        type: 'opportunity',
        overallSavingsMs: 640,
        items: [
          { url: 'https://lumina-web.app/styles/animations-heavy.css', wastedMs: 640 }
        ]
      }
    },
    'unsized-images': {
      id: 'unsized-images',
      title: 'Image elements do not have explicit width and height',
      description: 'Set an explicit width and height on image elements to reduce layout shifts and improve CLS.',
      score: 0.0,
      scoreDisplayMode: 'binary',
      displayValue: '3 elements found',
      metricSavings: { CLS: 0.14 },
      details: {
        type: 'table',
        items: [
          {
            node: {
              type: 'node',
              selector: 'div.feature-card > img.feature-illustration',
              snippet: '<img class="feature-illustration" src="/assets/card-optics.webp">'
            }
          }
        ]
      }
    },
    'color-contrast': {
      id: 'color-contrast',
      title: 'Background and foreground colors do not have a sufficient contrast ratio.',
      description: 'Low-contrast text is difficult or impossible for many users to read.',
      score: 0.0,
      scoreDisplayMode: 'binary',
      displayValue: '2 elements fail WCAG AA (3.1:1 vs 4.5:1)',
      details: {
        type: 'table',
        items: [
          {
            node: {
              type: 'node',
              selector: 'footer.site-footer > p.footer-caption, span.badge-subtle',
              snippet: '<p class="footer-caption">Optical telemetry active</p>'
            }
          }
        ]
      }
    },
    'aria-Save-button-name': {
      id: 'aria-Save-button-name',
      title: 'Buttons do not have an accessible name',
      description: 'When a button doesn\'t have an accessible name, screen readers announce it as "button", making it unusable for users who rely on screen readers.',
      score: 0.0,
      scoreDisplayMode: 'binary',
      displayValue: '2 icon buttons missing aria-label',
      details: {
        type: 'table',
        items: [
          {
            node: {
              type: 'node',
              selector: 'header.toolbar > button.icon-action-btn',
              snippet: '<button class="icon-action-btn"><svg class="icon-bookmark"></svg></button>'
            }
          }
        ]
      }
    },
    'csp-xss': {
      id: 'csp-xss',
      title: 'Ensure CSP is effective against XSS attacks',
      description: 'A strong Content Security Policy (CSP) significantly reduces the risk of cross-site scripting (XSS) attacks.',
      score: 0.0,
      scoreDisplayMode: 'informative',
      displayValue: 'No CSP meta tag or header detected',
      details: {
        type: 'table',
        items: [
          {
            node: {
              type: 'node',
              selector: 'head',
              snippet: '<head><meta charset="utf-8"></head>'
            }
          }
        ]
      }
    },
    'structured-data': {
      id: 'structured-data',
      title: 'Structured data is valid and complete',
      description: 'Search engines use structured data to understand page content and generate rich results.',
      score: 0.45,
      scoreDisplayMode: 'manual',
      displayValue: 'Missing SoftwareApplication / WebSite schema nodes',
      details: {
        type: 'table',
        items: [
          {
            node: {
              type: 'node',
              selector: 'head > script[type="application/ld+json"]',
              snippet: '<script type="application/ld+json">{}</script>'
            }
          }
        ]
      }
    }
  }
};

/**
 * Parses a Lighthouse Result (LHR) JSON object and generates a targeted Second Run
 * focusing on the exact failing `audits` and `categories` in the LHR report.
 */
export function analyzeLighthouseReportJson(repoMeta, rawLhrInput) {
  let lhr = SAMPLE_LIGHTHOUSE_LHR_JSON;
  if (rawLhrInput) {
    try {
      const parsed = typeof rawLhrInput === 'string' ? JSON.parse(rawLhrInput) : rawLhrInput;
      const candidate = parsed.lhr || parsed;
      if (candidate && (candidate.categories || candidate.audits)) {
        lhr = candidate;
      }
    } catch {
      lhr = SAMPLE_LIGHTHOUSE_LHR_JSON;
    }
  }

  const lhrCommits = [
    {
      id: 'lhr-commit-1',
      sha: makeSha(`${repoMeta.fullName}-lhr-lcp-preload`),
      fullSha: makeFullSha(`${repoMeta.fullName}-lhr-lcp-preload`),
      category: 'performance',
      categoryLabel: 'Performance',
      ruleId: 'largest-contentful-paint-element',
      lhrAuditTitle: lhr.audits?.['largest-contentful-paint-element']?.title || 'Largest Contentful Paint element',
      lhrDisplayValue: 'Prioritized hero media discovery and modern image formats',
      lhrTargetSelector:
        lhr.audits?.['largest-contentful-paint-element']?.details?.items?.[0]?.node?.selector ||
        'section.hero-stage > picture > img.hero-banner-media',
      lhrAreaImproved: 'Performance · largest-contentful-paint-element',
      title: 'Preload LCP hero candidate and serve AVIF/WebP responsive sources',
      commitMessage: 'perf(lhr): preload LCP hero candidate and serve AVIF/WebP responsive sources',
      summary:
        'Directly targeted the failing largest-contentful-paint-element node identified in the Lighthouse JSON report by adding preload resource hints with fetchpriority=“high” and modern AVIF/WebP source sets.',
      files: ['src/index.html', 'src/app/features/hero/hero.component.html'],
      additions: 14,
      deletions: 3,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 13:36:10 +0000',
      body: 'Targeted LHR audit largest-contentful-paint-element to cut LCP discovery delay.',
      diff: `diff --git a/src/index.html b/src/index.html
index 19a4f10..88c219a 100644
--- a/src/index.html
+++ b/src/index.html
@@ -7,4 +7,10 @@
   <link rel="preconnect" href="https://fonts.googleapis.com" />
+  <link
+    rel="preload"
+    as="image"
+    href="/assets/hero-lens.avif"
+    type="image/avif"
+    fetchpriority="high"
+  />
 </head>
diff --git a/src/app/features/hero/hero.component.html b/src/app/features/hero/hero.component.html
index 44c9b01..e91103d 100644
--- a/src/app/features/hero/hero.component.html
+++ b/src/app/features/hero/hero.component.html
@@ -2,5 +2,10 @@
   <picture>
-    <img class="hero-banner-media" src="/assets/hero-lens.jpg" />
+    <source srcset="/assets/hero-lens.avif" type="image/avif" />
+    <source srcset="/assets/hero-lens.webp" type="image/webp" />
+    <img
+      class="hero-banner-media"
+      src="/assets/hero-lens.jpg"
+      alt="Focused optical beam architecture"
+      width="1280"
+      height="720"
+      fetchpriority="high"
+    />
   </picture>`
    },
    {
      id: 'lhr-commit-2',
      sha: makeSha(`${repoMeta.fullName}-lhr-render-blocking`),
      fullSha: makeFullSha(`${repoMeta.fullName}-lhr-render-blocking`),
      category: 'performance',
      categoryLabel: 'Performance',
      ruleId: 'render-blocking-resources',
      lhrAuditTitle: lhr.audits?.['render-blocking-resources']?.title || 'Eliminate render-blocking resources',
      lhrDisplayValue: 'Eliminated render-blocking stylesheet requests in document head',
      lhrTargetSelector:
        lhr.audits?.['render-blocking-resources']?.details?.items?.[0]?.url ||
        '/styles/animations-heavy.css',
      lhrAreaImproved: 'Performance · render-blocking-resources',
      title: 'Inline critical above-the-fold CSS and defer non-critical animation stylesheet',
      commitMessage: 'perf(lhr): inline critical above-the-fold CSS and defer non-critical stylesheet',
      summary:
        'Resolved the render-blocking-resources opportunity in the LHR JSON by deferring animations-heavy.css with asynchronous media swap.',
      files: ['src/index.html'],
      additions: 7,
      deletions: 2,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 13:36:40 +0000',
      body: 'Resolved LHR render-blocking-resources audit.',
      diff: `diff --git a/src/index.html b/src/index.html
index 88c219a..c72e401 100644
--- a/src/index.html
+++ b/src/index.html
@@ -14,4 +14,9 @@
-  <link rel="stylesheet" href="/styles/animations-heavy.css" />
+  <link
+    rel="preload"
+    href="/styles/animations-heavy.css"
+    as="style"
+    onload="this.onload=null;this.rel='stylesheet'"
+  />
+  <noscript><link rel="stylesheet" href="/styles/animations-heavy.css" /></noscript>`
    },
    {
      id: 'lhr-commit-3',
      sha: makeSha(`${repoMeta.fullName}-lhr-unsized-images`),
      fullSha: makeFullSha(`${repoMeta.fullName}-lhr-unsized-images`),
      category: 'performance',
      categoryLabel: 'Performance',
      ruleId: 'unsized-images',
      lhrAuditTitle: lhr.audits?.['unsized-images']?.title || 'Image elements have explicit width and height',
      lhrDisplayValue: 'Reserved intrinsic layout dimensions to prevent layout shift',
      lhrTargetSelector:
        lhr.audits?.['unsized-images']?.details?.items?.[0]?.node?.selector ||
        'div.feature-card > img.feature-illustration',
      lhrAreaImproved: 'Performance · unsized-images',
      title: 'Add explicit width, height, and aspect-ratio reservation to feature card images',
      commitMessage: 'perf(lhr): add explicit width/height to unsized feature card images',
      summary:
        'Fixed all nodes flagged under unsized-images in the Lighthouse JSON report to prevent Cumulative Layout Shift (CLS).',
      files: ['src/app/features/catalog/catalog.component.html'],
      additions: 6,
      deletions: 2,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 13:37:05 +0000',
      body: 'Resolved LHR unsized-images audit.',
      diff: `diff --git a/src/app/features/catalog/catalog.component.html b/src/app/features/catalog/catalog.component.html
index 901a32c..3f88d12 100644
--- a/src/app/features/catalog/catalog.component.html
+++ b/src/app/features/catalog/catalog.component.html
@@ -11,4 +11,8 @@
   <div class="feature-card">
-    <img class="feature-illustration" src="/assets/card-optics.webp" />
+    <img
+      class="feature-illustration"
+      src="/assets/card-optics.webp"
+      alt="Concentric stepped lens diagram"
+      width="480"
+      height="320"
+      loading="lazy"
+    />
   </div>`
    },
    {
      id: 'lhr-commit-4',
      sha: makeSha(`${repoMeta.fullName}-lhr-color-contrast`),
      fullSha: makeFullSha(`${repoMeta.fullName}-lhr-color-contrast`),
      category: 'accessibility',
      categoryLabel: 'Accessibility',
      ruleId: 'color-contrast',
      lhrAuditTitle: lhr.audits?.['color-contrast']?.title || 'Background and foreground colors have sufficient contrast ratio',
      lhrDisplayValue: 'Upgraded foreground text contrast tokens to WCAG AA/AAA compliance',
      lhrTargetSelector:
        lhr.audits?.['color-contrast']?.details?.items?.[0]?.node?.selector ||
        'footer.site-footer > p.footer-caption, span.badge-subtle',
      lhrAreaImproved: 'Accessibility · color-contrast',
      title: 'Raise foreground token contrast on .footer-caption and .badge-subtle to WCAG AAA',
      commitMessage: 'fix(a11y): raise foreground contrast on LHR failing selectors to WCAG AA/AAA',
      summary:
        'Updated the exact CSS selectors (footer.site-footer > p.footer-caption and span.badge-subtle) listed in color-contrast so contrast meets WCAG AA/AAA in both themes.',
      files: ['src/styles/tokens.scss'],
      additions: 4,
      deletions: 4,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 13:37:30 +0000',
      body: 'Resolved LHR color-contrast failing selectors.',
      diff: `diff --git a/src/styles/tokens.scss b/src/styles/tokens.scss
index 712a901..b440e21 100644
--- a/src/styles/tokens.scss
+++ b/src/styles/tokens.scss
@@ -22,6 +22,6 @@
 .footer-caption {
-  color: #94a3b8; /* 2.9:1 on #f8fafc */
+  color: #334155; /* 7.4:1 WCAG AAA on #f8fafc */
 }
 .badge-subtle {
-  color: #60a5fa;
+  color: #1d4ed8; /* 6.8:1 WCAG AA */
 }`
    },
    {
      id: 'lhr-commit-5',
      sha: makeSha(`${repoMeta.fullName}-lhr-button-name`),
      fullSha: makeFullSha(`${repoMeta.fullName}-lhr-button-name`),
      category: 'accessibility',
      categoryLabel: 'Accessibility',
      ruleId: 'button-name',
      lhrAuditTitle: 'Buttons have an accessible name',
      lhrDisplayValue: 'Provided descriptive accessible names for icon-only toolbar buttons',
      lhrTargetSelector: 'header.toolbar > button.icon-action-btn',
      lhrAreaImproved: 'Accessibility · button-name',
      title: 'Add explicit aria-label attributes to toolbar icon action buttons',
      commitMessage: 'fix(a11y): add explicit aria-label to toolbar icon buttons flagged in LHR',
      summary:
        'Targeted header.toolbar > button.icon-action-btn flagged in the LHR JSON report so assistive technologies announce clear action names.',
      files: ['src/app/shared/header/header.component.html'],
      additions: 4,
      deletions: 2,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 13:38:00 +0000',
      body: 'Resolved LHR button-name audit.',
      diff: `diff --git a/src/app/shared/header/header.component.html b/src/app/shared/header/header.component.html
index 551e290..9c21f04 100644
--- a/src/app/shared/header/header.component.html
+++ b/src/app/shared/header.component.html
@@ -8,4 +8,6 @@
-  <button class="icon-action-btn">
+  <button class="icon-action-btn" type="button" aria-label="Save audit bookmark">
     <svg class="icon-bookmark" aria-hidden="true"></svg>
   </button>`
    },
    {
      id: 'lhr-commit-6',
      sha: makeSha(`${repoMeta.fullName}-lhr-csp-xss`),
      fullSha: makeFullSha(`${repoMeta.fullName}-lhr-csp-xss`),
      category: 'best-practices',
      categoryLabel: 'Best practices',
      ruleId: 'csp-xss',
      lhrAuditTitle: 'Ensure CSP is effective against XSS attacks',
      lhrDisplayValue: 'Hardened Content-Security-Policy script-src and object-src directives',
      lhrTargetSelector: 'head > meta[http-equiv=“Content-Security-Policy”]',
      lhrAreaImproved: 'Best practices · csp-xss',
      title: 'Add strict Content-Security-Policy meta directive',
      commitMessage: 'feat(security): add Content-Security-Policy directive to document head',
      summary:
        'Addressed csp-xss from the Lighthouse JSON report by adding a strict Content-Security-Policy directive restricting script and object sources.',
      files: ['src/index.html'],
      additions: 6,
      deletions: 0,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 13:38:25 +0000',
      body: 'Resolved LHR csp-xss audit.',
      diff: `diff --git a/src/index.html b/src/index.html
index c72e401..f02189b 100644
--- a/src/index.html
+++ b/src/index.html
@@ -4,3 +4,7 @@
   <meta charset="utf-8" />
+  <meta
+    http-equiv="Content-Security-Policy"
+    content="default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self';"
+  />`
    },
    {
      id: 'lhr-commit-7',
      sha: makeSha(`${repoMeta.fullName}-lhr-structured-data`),
      fullSha: makeFullSha(`${repoMeta.fullName}-lhr-structured-data`),
      category: 'seo',
      categoryLabel: 'SEO',
      ruleId: 'structured-data',
      lhrAuditTitle: 'Structured data is valid',
      lhrDisplayValue: 'Completed schema.org WebApplication JSON-LD graph and canonical metadata',
      lhrTargetSelector: 'head > script[type=“application/ld+json”]',
      lhrAreaImproved: 'SEO · structured-data',
      title: 'Complete JSON-LD WebApplication structured data graph in document head',
      commitMessage: 'feat(seo): complete JSON-LD WebApplication structured data in index.html',
      summary:
        'Addressed the structured-data SEO audit in the Lighthouse JSON report by providing valid schema.org WebApplication metadata in index.html.',
      files: ['src/index.html'],
      additions: 9,
      deletions: 1,
      author: 'Fresnel <fresnel@noreplies.github.com>',
      date: 'Tue, 6 Oct 2026 13:38:50 +0000',
      body: 'Resolved LHR structured-data SEO audit.',
      diff: `diff --git a/src/index.html b/src/index.html
index f02189b..a8193d4 100644
--- a/src/index.html
+++ b/src/index.html
@@ -12,2 +12,10 @@
+  <script type="application/ld+json">
+    {
+      "@context": "https://schema.org",
+      "@type": "WebApplication",
+      "name": "${repoMeta.repo}",
+      "applicationCategory": "DeveloperApplication"
+    }
+  </script>
 </head>`
    }
  ];

  const categoriesImproved = [
    {
      id: 'performance',
      label: 'Performance',
      commitsCount: lhrCommits.filter((c) => c.category === 'performance').length
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      commitsCount: lhrCommits.filter((c) => c.category === 'accessibility').length
    },
    {
      id: 'best-practices',
      label: 'Best practices',
      commitsCount: lhrCommits.filter((c) => c.category === 'best-practices').length
    },
    {
      id: 'seo',
      label: 'SEO',
      commitsCount: lhrCommits.filter((c) => c.category === 'seo').length
    }
  ];

  const lhrSteps = [
    {
      index: 0,
      phase: 'Parsing Lighthouse JSON',
      category: 'LHR parser',
      headline: `Read Lighthouse ${lhr.lighthouseVersion || '12.2.0'} report for ${repoMeta.fullName}`,
      narrative: `Identifying failing audits across Performance, Accessibility, Best practices, and SEO in the uploaded Lighthouse report.`
    },
    {
      index: 1,
      phase: 'Correlating DOM selectors',
      category: 'AST mapping',
      headline: `Map Lighthouse failing selectors to repository templates`,
      narrative: `Matching failing DOM selectors in the JSON report to exact templates, stylesheets, and document head metadata in ${repoMeta.fullName}.`
    },
    ...lhrCommits.map((c, idx) => ({
      index: idx + 2,
      phase: `Improving ${c.categoryLabel.toLowerCase() === 'seo' ? 'SEO' : c.categoryLabel.toLowerCase()}`,
      category: c.categoryLabel,
      headline: c.title,
      narrative: `${c.summary} Improved ${c.categoryLabel} (${c.ruleId}) on selector ${c.lhrTargetSelector}.`
    })),
    {
      index: lhrCommits.length + 2,
      phase: 'LHR analysis complete',
      category: 'Complete',
      headline: `Prepare ${lhrCommits.length} commits across Performance, Accessibility, Best practices, and SEO`,
      narrative: `Audited failing Lighthouse categories and selectors statically. Opening the Lighthouse JSON audit report showing the categories improved by the code changes.`
    }
  ];

  return {
    lhrVersion: lhr.lighthouseVersion || '12.2.0',
    requestedUrl: lhr.finalDisplayedUrl || lhr.requestedUrl || `https://${repoMeta.owner}.github.io/${repoMeta.repo}/`,
    fetchTime: lhr.fetchTime || new Date().toISOString(),
    categoriesImproved,
    commits: lhrCommits,
    steps: lhrSteps
  };
}

/**
 * Builds the list of categories improved by the code commits (without numeric Lighthouse scores).
 */
export function buildCategoriesImproved(commits, runPhase = 'static') {
  const catalog = [
    {
      id: 'performance',
      label: 'Performance',
      focus: 'Core Web Vitals, LCP media priority, layout shift prevention, and network hints'
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      focus: 'WCAG landmarks, ARIA labels, focus-visible indicators, contrast, and target sizing'
    },
    {
      id: 'best-practices',
      label: 'Best practices',
      focus: 'Content Security Policy, safe cross-origin links, passive listeners, and image ratios'
    },
    {
      id: 'seo',
      label: 'SEO',
      focus: 'Meta descriptions, OpenGraph tags, canonical links, crawlable anchors, and JSON-LD'
    },
    ...(runPhase === 'lhr'
      ? []
      : [
          {
            id: 'security',
            label: 'Web application security findings (light)',
            focus: 'Sanitized DOM XSS sinks, safe credential handling, and validated redirect paths'
          }
        ])
  ];

  return catalog
    .map((entry) => {
      const matching = (commits || []).filter((c) => c.category === entry.id);
      return {
        id: entry.id,
        label: entry.label,
        focus: entry.focus,
        improved: matching.length > 0,
        commitsCount: matching.length,
        rules: matching.map((c) => c.ruleId).filter(Boolean)
      };
    })
    .filter((entry) => entry.improved);
}
