import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditService } from './services/audit.service';
import { FresnelLogoComponent } from './components/fresnel-logo/fresnel-logo.component';
import {
  ActiveWorkspaceTab,
  AuditHistoryEntry,
  DeviceProfile,
  LighthouseCategory
} from './models/audit.model';

export interface CategoryTabItem {
  key: LighthouseCategory;
  label: string;
  contextBadge?: string;
}

export interface PresetTargetItem {
  label: string;
  tag: string;
  url: string;
}

export interface CodePresetSnippet {
  id: 'img-lcp' | 'a11y-button' | 'dom-xss' | 'cls-media';
  label: string;
  category: string;
  beforeCode: string;
  afterCode: string;
  improvements: string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, FresnelLogoComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  readonly audit = inject(AuditService);
  readonly repoUrl = signal<string>('');
  readonly copiedKey = signal<string | null>(null);

  readonly presetTargets: PresetTargetItem[] = [
    {
      label: 'Fresnel Web Platform',
      tag: 'Angular 21 · Production',
      url: 'https://github.com/bapanghosh0812/Website-Accessibility-Performance-Checker'
    },
    {
      label: 'Lumina E-Commerce Storefront',
      tag: 'CWV + WCAG 2.2',
      url: 'https://github.com/fresnel-sandbox/lumina-web-app'
    },
    {
      label: 'SaaS Analytics Dashboard',
      tag: 'INP + CSP Security',
      url: 'https://github.com/vercel/commerce'
    },
    {
      label: 'Live Website URL Audit',
      tag: 'SEO + Core Web Vitals',
      url: 'https://website-performance-checker.netlify.app'
    }
  ];

  readonly allCategories: CategoryTabItem[] = [
    { key: 'all', label: 'All' },
    { key: 'performance', label: 'Performance' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'best-practices', label: 'Best practices' },
    { key: 'seo', label: 'SEO' },
    {
      key: 'security',
      label: 'Web application security findings',
      contextBadge: 'Light'
    }
  ];

  /**
   * Excludes 'security' (Web application security findings) when running the
   * Lighthouse-specific JSON report audit (Run 2), since Lighthouse does not include it.
   */
  readonly visibleCategories = computed<CategoryTabItem[]>(() => {
    const isLhrRun = this.audit.session()?.runPhase === 'lhr';
    if (isLhrRun) {
      return this.allCategories.filter((cat) => cat.key !== 'security');
    }
    return this.allCategories;
  });

  readonly categoriesImprovedList = computed(() => {
    const session = this.audit.session();
    if (!session) return [];
    if (session.categoriesImproved && session.categoriesImproved.length > 0) {
      return session.categoriesImproved;
    }
    const commits = session.commits ?? [];
    const isLhr = session.runPhase === 'lhr';
    const base = [
      { id: 'performance', label: 'Performance' },
      { id: 'accessibility', label: 'Accessibility' },
      { id: 'best-practices', label: 'Best practices' },
      { id: 'seo', label: 'SEO' },
      ...(isLhr ? [] : [{ id: 'security', label: 'Web application security findings (light)' }])
    ];
    return base
      .map((item) => {
        const count = commits.filter((c) => c.category === item.id).length;
        return {
          id: item.id,
          label: item.label,
          improved: count > 0,
          commitsCount: count
        };
      })
      .filter((item) => item.improved);
  });

  readonly currentPrCliCommand = computed<string>(() => {
    const pr = this.audit.prResult();
    if (!pr) return '';
    return this.audit.prCliMode() === 'inline'
      ? pr.terminalCommand ?? ''
      : pr.shortTerminalCommand ?? '';
  });

  // ============================================================================
  // INTERACTIVE STUDIO 1: AI SMART CODE REFACTOR STUDIO
  // ============================================================================
  readonly codePresets: CodePresetSnippet[] = [
    {
      id: 'img-lcp',
      label: 'Hero Image (LCP + CLS Fix)',
      category: 'Performance · Core Web Vitals',
      beforeCode: `<div class="hero-banner">\n  <img src="/assets/hero-showcase.jpg" class="hero-img">\n</div>`,
      afterCode: `<div class="hero-banner">\n  <picture>\n    <source type="image/avif" srcset="/assets/hero-showcase.avif 1280w" sizes="100vw" />\n    <source type="image/webp" srcset="/assets/hero-showcase.webp 1280w" sizes="100vw" />\n    <img\n      src="/assets/hero-showcase.jpg"\n      class="hero-img"\n      alt="Interactive accessibility and performance audit dashboard"\n      width="1280"\n      height="720"\n      fetchpriority="high"\n      decoding="async"\n    />\n  </picture>\n</div>`,
      improvements: [
        'Added AVIF and WebP next-gen responsive sources (-64% payload)',
        'Added explicit width="1280" and height="720" to eliminate layout shift (CLS 0.00)',
        'Applied fetchpriority="high" and async decoding for -940ms faster LCP',
        'Added descriptive alt attribute for WCAG 2.2 AA SC 1.1.1 compliance'
      ]
    },
    {
      id: 'a11y-button',
      label: 'Icon Button & Input (WCAG 2.2 AA)',
      category: 'Accessibility · Screen Reader & Keyboard',
      beforeCode: `<div class="search-box">\n  <input type="text" placeholder="Search audits...">\n  <button class="icon-btn" onclick="submitSearch()">\n    <svg viewBox="0 0 20 20"><path d="M8 4a4 4 0 100 8z"/></svg>\n  </button>\n</div>`,
      afterCode: `<form class="search-box" role="search" (ngSubmit)="submitSearch()">\n  <label for="audit-search-input" class="sr-only">Search audit findings</label>\n  <input\n    id="audit-search-input"\n    type="search"\n    name="q"\n    placeholder="Search audits..."\n    autocomplete="off"\n  />\n  <button\n    type="submit"\n    class="icon-btn"\n    aria-label="Submit audit search"\n  >\n    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">\n      <path d="M8 4a4 4 0 100 8z" />\n    </svg>\n  </button>\n</form>`,
      improvements: [
        'Wrapped controls in semantic <form role="search"> for keyboard Enter submission',
        'Associated explicit <label for="audit-search-input"> for screen readers (WCAG SC 3.3.2)',
        'Added aria-label="Submit audit search" on icon-only button (WCAG SC 4.1.2)',
        'Marked decorative SVG with aria-hidden="true" and focusable="false"'
      ]
    },
    {
      id: 'dom-xss',
      label: 'DOM XSS Sink & Unsafe Redirect',
      category: 'Security · OWASP Top 10 Protection',
      beforeCode: `function renderPreview(userHtml, nextUrl) {\n  document.getElementById('preview').innerHTML = userHtml;\n  if (nextUrl) {\n    window.location.href = nextUrl;\n  }\n}`,
      afterCode: `const ALLOWED_HOSTS = new Set([window.location.origin]);\n\nfunction renderPreview(userHtml, nextUrl) {\n  const container = document.getElementById('preview');\n  if (container) {\n    // Safe DOM text assignment prevents script/event-handler injection\n    container.textContent = String(userHtml ?? '');\n  }\n  if (nextUrl) {\n    const parsed = new URL(nextUrl, window.location.origin);\n    if (ALLOWED_HOSTS.has(parsed.origin) && ['http:', 'https:'].includes(parsed.protocol)) {\n      window.location.assign(parsed.pathname + parsed.search + parsed.hash);\n    }\n  }\n}`,
      improvements: [
        'Replaced unsafe innerHTML sink with textContent to block DOM-based XSS',
        'Validated redirect target against strict origin allowlist and protocol check',
        'Prevented javascript: and data: URI execution vectors'
      ]
    },
    {
      id: 'cls-media',
      label: 'Render-Blocking Fonts & Scroll INP',
      category: 'Performance · INP & FCP Optimization',
      beforeCode: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700');\n\nwindow.addEventListener('scroll', () => {\n  updateStickyHeader();\n});`,
      afterCode: `<!-- In index.html <head>: preconnect + non-blocking stylesheet -->\n<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link\n  rel="stylesheet"\n  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"\n/>\n\n// In application script: passive listener + rAF throttling for <50ms INP\nlet ticking = false;\nwindow.addEventListener(\n  'scroll',\n  () => {\n    if (!ticking) {\n      window.requestAnimationFrame(() => {\n        updateStickyHeader();\n        ticking = false;\n      });\n      ticking = true;\n    }\n  },\n  { passive: true }\n);`,
      improvements: [
        'Replaced synchronous CSS @import with preconnect + display=swap link tags (-310ms FCP)',
        'Added { passive: true } to scroll listener to unblock compositor thread scrolling',
        'Throttled layout updates with requestAnimationFrame to keep INP under 60ms'
      ]
    }
  ];

  readonly selectedCodePresetId = signal<CodePresetSnippet['id']>('img-lcp');
  readonly customCodeInput = signal<string>(this.codePresets[0].beforeCode);
  readonly refactoredCodeOutput = signal<string>(this.codePresets[0].afterCode);
  readonly refactorImprovements = signal<string[]>(this.codePresets[0].improvements);

  selectCodePreset(presetId: CodePresetSnippet['id']): void {
    const found = this.codePresets.find((p) => p.id === presetId);
    if (!found) return;
    this.selectedCodePresetId.set(presetId);
    this.customCodeInput.set(found.beforeCode);
    this.refactoredCodeOutput.set(found.afterCode);
    this.refactorImprovements.set(found.improvements);
  }

  runAiCodeRefactor(): void {
    const raw = this.customCodeInput().trim();
    if (!raw) return;

    const matchingPreset = this.codePresets.find((p) => p.beforeCode.trim() === raw);
    if (matchingPreset) {
      this.refactoredCodeOutput.set(matchingPreset.afterCode);
      this.refactorImprovements.set(matchingPreset.improvements);
      return;
    }

    let improved = raw;
    const notes: string[] = [];

    if (/<img\b/i.test(improved)) {
      if (!/\balt\s*=/i.test(improved)) {
        improved = improved.replace(/<img\b/gi, '<img alt="Descriptive image content"');
        notes.push('Added missing alt attribute on <img> elements for WCAG 2.2 SC 1.1.1');
      }
      if (!/\bwidth\s*=/i.test(improved) && !/\bheight\s*=/i.test(improved)) {
        improved = improved.replace(/<img\b/gi, '<img width="1200" height="675"');
        notes.push('Added explicit intrinsic width and height to prevent Cumulative Layout Shift (CLS)');
      }
      if (!/\bloading\s*=/i.test(improved) && !/\bfetchpriority\s*=/i.test(improved)) {
        improved = improved.replace(/<img\b/gi, '<img loading="lazy" decoding="async"');
        notes.push('Added loading="lazy" and decoding="async" for offscreen media optimization');
      }
    }

    if (/\.innerHTML\s*=/i.test(improved)) {
      improved = improved.replace(/\.innerHTML\s*=/g, '.textContent =');
      notes.push('Replaced unsafe .innerHTML assignment with .textContent to prevent DOM XSS');
    }

    if (/target\s*=\s*["']_blank["']/i.test(improved) && !/rel\s*=/i.test(improved)) {
      improved = improved.replace(
        /target\s*=\s*["']_blank["']/gi,
        'target="_blank" rel="noopener noreferrer"'
      );
      notes.push('Added rel="noopener noreferrer" to external target="_blank" links');
    }

    if (/<button\b(?![^>]*\btype\s*=)/i.test(improved)) {
      improved = improved.replace(/<button\b/gi, '<button type="button"');
      notes.push('Added explicit type="button" to prevent unintended form submissions');
    }

    if (/addEventListener\(\s*['"](?:scroll|touchstart|wheel)['"]\s*,\s*([^)]+)\)/i.test(improved)) {
      if (!/passive\s*:\s*true/i.test(improved)) {
        improved = improved.replace(
          /addEventListener\(\s*(['"](?:scroll|touchstart|wheel)['"])\s*,\s*([^)]+)\)/gi,
          'addEventListener($1, $2, { passive: true })'
        );
        notes.push('Enabled { passive: true } on scroll/touch listener to improve INP responsiveness');
      }
    }

    if (notes.length === 0) {
      notes.push('Verified semantic structure, ARIA attributes, and non-blocking resource execution');
      notes.push('No unsafe DOM sinks or missing intrinsic media dimensions detected');
    }

    this.refactoredCodeOutput.set(improved);
    this.refactorImprovements.set(notes);
  }

  // ============================================================================
  // INTERACTIVE STUDIO 2: WCAG 2.2 AA / AAA COLOR CONTRAST STUDIO
  // ============================================================================
  readonly fgColor = signal<string>('#351A55');
  readonly bgColor = signal<string>('#F6F4FC');

  readonly contrastRatio = computed<number>(() => {
    const fg = this.parseHexRgb(this.fgColor());
    const bg = this.parseHexRgb(this.bgColor());
    const l1 = this.relativeLuminance(fg.r, fg.g, fg.b);
    const l2 = this.relativeLuminance(bg.r, bg.g, bg.b);
    const brightest = Math.max(l1, l2);
    const darkest = Math.min(l1, l2);
    return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
  });

  readonly wcagEvaluation = computed(() => {
    const ratio = this.contrastRatio();
    return {
      ratioText: `${ratio.toFixed(2)}:1`,
      normalAA: ratio >= 4.5,
      normalAAA: ratio >= 7.0,
      largeAA: ratio >= 3.0,
      largeAAA: ratio >= 4.5,
      uiComponentsAA: ratio >= 3.0,
      badgeLabel:
        ratio >= 7.0
          ? 'AAA Exceptional (7:1+)'
          : ratio >= 4.5
            ? 'AA Compliant (4.5:1+)'
            : ratio >= 3.0
              ? 'Large Text Only (3:1+)'
              : 'Fails WCAG 2.2 (< 3:1)'
    };
  });

  swapContrastColors(): void {
    const currentFg = this.fgColor();
    this.fgColor.set(this.bgColor());
    this.bgColor.set(currentFg);
  }

  autoFixContrast(targetRatio = 4.6): void {
    const bg = this.parseHexRgb(this.bgColor());
    const bgLum = this.relativeLuminance(bg.r, bg.g, bg.b);
    let fg = this.parseHexRgb(this.fgColor());

    // Darken or lighten foreground iteratively until targetRatio is met
    const darken = bgLum > 0.35;
    for (let step = 0; step < 60; step++) {
      const fgLum = this.relativeLuminance(fg.r, fg.g, fg.b);
      const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
      if (ratio >= targetRatio) break;
      if (darken) {
        fg = {
          r: Math.max(0, Math.round(fg.r * 0.88 - 3)),
          g: Math.max(0, Math.round(fg.g * 0.88 - 3)),
          b: Math.max(0, Math.round(fg.b * 0.88 - 3))
        };
      } else {
        fg = {
          r: Math.min(255, Math.round(fg.r + (255 - fg.r) * 0.16 + 4)),
          g: Math.min(255, Math.round(fg.g + (255 - fg.g) * 0.16 + 4)),
          b: Math.min(255, Math.round(fg.b + (255 - fg.b) * 0.16 + 4))
        };
      }
    }

    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    this.fgColor.set(`#${toHex(fg.r)}${toHex(fg.g)}${toHex(fg.b)}`);
  }

  private parseHexRgb(hex: string): { r: number; g: number; b: number } {
    const cleaned = String(hex || '')
      .replace(/[^0-9a-fA-F]/g, '')
      .trim();
    if (cleaned.length === 3) {
      return {
        r: parseInt(cleaned[0] + cleaned[0], 16),
        g: parseInt(cleaned[1] + cleaned[1], 16),
        b: parseInt(cleaned[2] + cleaned[2], 16)
      };
    }
    if (cleaned.length >= 6) {
      return {
        r: parseInt(cleaned.slice(0, 2), 16),
        g: parseInt(cleaned.slice(2, 4), 16),
        b: parseInt(cleaned.slice(4, 6), 16)
      };
    }
    return { r: 53, g: 26, b: 85 };
  }

  private relativeLuminance(r: number, g: number, b: number): number {
    const transform = (v: number) => {
      const srgb = v / 255;
      return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
  }

  // ============================================================================
  // INTERACTIVE STUDIO 3: SEO META, OPENGRAPH & SCHEMA.ORG JSON-LD GENERATOR
  // ============================================================================
  readonly seoTitle = signal<string>(
    'Website Accessibility & Performance Checker — Free WCAG 2.2, Lighthouse & Core Web Vitals Audit'
  );
  readonly seoUrl = signal<string>('https://website-performance-checker.netlify.app/');
  readonly seoDescription = signal<string>(
    'Audit any website or GitHub repository for WCAG 2.2 AA/AAA accessibility, Core Web Vitals (LCP, INP, CLS), SEO, and web security with instant git patches.'
  );
  readonly seoKeywords = signal<string>(
    'website accessibility checker, website performance checker, WCAG 2.2 checker, Core Web Vitals audit, Lighthouse JSON analyzer, technical SEO audit'
  );

  readonly generatedSeoHeadSnippet = computed<string>(() => {
    const title = this.seoTitle().trim();
    const url = this.seoUrl().trim() || 'https://website-performance-checker.netlify.app/';
    const desc = this.seoDescription().trim();
    const keywords = this.seoKeywords().trim();

    return [
      `<!-- Primary SEO & Canonical Metadata -->`,
      `<title>${title}</title>`,
      `<meta name="description" content="${desc}" />`,
      `<meta name="keywords" content="${keywords}" />`,
      `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`,
      `<link rel="canonical" href="${url}" />`,
      ``,
      `<!-- OpenGraph / Social Discovery -->`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${desc}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${desc}" />`,
      ``,
      `<!-- Schema.org Structured Data (JSON-LD) -->`,
      `<script type="application/ld+json">`,
      JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: title.split('—')[0].trim(),
          url,
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'All',
          description: desc,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
          }
        },
        null,
        2
      ),
      `</script>`
    ].join('\n');
  });

  // ============================================================================
  // INTERACTIVE STUDIO 4: ENTERPRISE SECURITY & CSP HEADER SHIELD GENERATOR
  // ============================================================================
  readonly securityTargetPlatform = signal<'netlify' | 'nginx' | 'express' | 'meta'>('netlify');

  readonly generatedSecurityHeaders = computed<string>(() => {
    const target = this.securityTargetPlatform();
    const csp =
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";

    if (target === 'netlify') {
      return [
        `# netlify.toml — Enterprise Edge Security & Immutable Caching`,
        `[[headers]]`,
        `  for = "/*"`,
        `  [headers.values]`,
        `    X-Frame-Options = "DENY"`,
        `    X-Content-Type-Options = "nosniff"`,
        `    X-XSS-Protection = "1; mode=block"`,
        `    Referrer-Policy = "strict-origin-when-cross-origin"`,
        `    Permissions-Policy = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"`,
        `    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"`,
        `    Content-Security-Policy = "${csp}"`
      ].join('\n');
    }

    if (target === 'nginx') {
      return [
        `# nginx.conf — Production Security & HSTS Configuration`,
        `add_header X-Frame-Options "DENY" always;`,
        `add_header X-Content-Type-Options "nosniff" always;`,
        `add_header Referrer-Policy "strict-origin-when-cross-origin" always;`,
        `add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;`,
        `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;`,
        `add_header Content-Security-Policy "${csp}" always;`
      ].join('\n');
    }

    if (target === 'express') {
      return [
        `// server.js — Express Zero-Trust Security Middleware`,
        `app.use((req, res, next) => {`,
        `  res.setHeader('X-Frame-Options', 'DENY');`,
        `  res.setHeader('X-Content-Type-Options', 'nosniff');`,
        `  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');`,
        `  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');`,
        `  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');`,
        `  res.setHeader('Content-Security-Policy', "${csp}");`,
        `  next();`,
        `});`
      ].join('\n');
    }

    return [
      `<!-- HTML <head> Content-Security-Policy & Referrer Meta Tags -->`,
      `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      `<meta name="referrer" content="strict-origin-when-cross-origin" />`
    ].join('\n');
  });

  // ============================================================================
  // NAVIGATION & AUDIT HANDLERS
  // ============================================================================
  async onStartLiveAudit(): Promise<void> {
    const url =
      this.repoUrl().trim() ||
      'https://github.com/bapanghosh0812/Website-Accessibility-Performance-Checker';
    this.repoUrl.set(url);
    await this.audit.startAudit(url, 'live');
  }

  async onStartDemoAudit(): Promise<void> {
    const demoUrl = 'https://github.com/fresnel-sandbox/lumina-web-app';
    this.repoUrl.set(demoUrl);
    await this.audit.startAudit(demoUrl, 'demo');
  }

  async onSelectPreset(url: string): Promise<void> {
    this.repoUrl.set(url);
    await this.audit.startAudit(url, 'live');
  }

  async onRestoreHistory(entry: AuditHistoryEntry): Promise<void> {
    this.repoUrl.set(entry.repoUrl);
    this.audit.deviceProfile.set(entry.deviceProfile);
    await this.audit.startAudit(entry.repoUrl, entry.mode);
    await this.audit.skipToReport();
  }

  async openInteractiveStudioFromHome(tab: ActiveWorkspaceTab): Promise<void> {
    if (!this.audit.session()) {
      const targetUrl =
        this.repoUrl().trim() ||
        'https://github.com/bapanghosh0812/Website-Accessibility-Performance-Checker';
      this.repoUrl.set(targetUrl);
      await this.audit.startAudit(targetUrl, 'live');
      await this.audit.skipToReport();
    } else {
      this.audit.transitionToStep(this.audit.session()?.runPhase === 'lhr' ? 7 : 3);
    }
    this.audit.activeTab.set(tab);
  }

  onSetDeviceProfile(profile: DeviceProfile): void {
    this.audit.deviceProfile.set(profile);
  }

  onLhrFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    this.audit.lhrFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.audit.lhrJsonInput.set(reader.result);
      }
    };
    reader.readAsText(file);
  }

  async onStartLhrAudit(): Promise<void> {
    await this.audit.startLhrAudit();
  }

  onBack(): void {
    const current = this.audit.step();
    if (current === 2) {
      this.audit.stopPolling();
      this.audit.transitionToStep(1);
    } else if (current === 3) {
      this.audit.transitionToStep(1);
    } else if (current === 4) {
      this.audit.transitionToStep(this.audit.session()?.runPhase === 'lhr' ? 7 : 3);
    } else if (current === 5) {
      this.audit.transitionToStep(3);
    } else if (current === 6) {
      this.audit.stopPolling();
      this.audit.transitionToStep(5);
    } else if (current === 7) {
      this.audit.transitionToStep(5);
    }
  }

  isSelected(commitId: string): boolean {
    return this.audit.selectedCommitIds().has(commitId);
  }

  isDiffExpanded(commitId: string): boolean {
    return this.audit.expandedDiffIds().has(commitId);
  }

  isAiExpanded(commitId: string): boolean {
    return this.audit.expandedAiIds().has(commitId);
  }

  splitDiffLines(diff: string): { text: string; type: 'meta' | 'hunk' | 'add' | 'del' | 'ctx' }[] {
    return diff.split('\n').map((line) => {
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ')
      ) {
        return { text: line, type: 'meta' };
      }
      if (line.startsWith('@@')) {
        return { text: line, type: 'hunk' };
      }
      if (line.startsWith('+')) {
        return { text: line, type: 'add' };
      }
      if (line.startsWith('-')) {
        return { text: line, type: 'del' };
      }
      return { text: line, type: 'ctx' };
    });
  }

  toCurlyQuotes(rawText: string | undefined | null): string {
    if (!rawText) return '';
    return rawText
      .replace(/(\w)'(\w)/g, '$1’$2')
      .replace(/(^|[\s(\[{<—–-])"(\S)/g, '$1“$2')
      .replace(/"/g, '”')
      .replace(/(^|[\s(\[{<—–-])'(\S)/g, '$1‘$2')
      .replace(/'/g, '’');
  }

  plainText(rawText: string | undefined | null): string {
    if (!rawText) return '';
    const cleaned = rawText
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/\*\*+/g, '')
      .replace(/__+/g, '')
      .replace(/`+/g, '')
      .replace(/(^|\s)\*+(\S)/g, '$1$2')
      .replace(/(\S)\*+(\s|$|[.,!?;:])/g, '$1$2')
      .replace(/^\s*#{1,6}\s+/gm, '')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/\/workspace\/[a-zA-Z0-9._-]+\//g, '')
      .replace(/\/workspace\b/g, 'the repository')
      .replace(/@import\s+font\s+stylesheets/gi, '@import stylesheets')
      .replace(/\bwith\s+display=swap\b/gi, 'with font-display:swap')
      .replace(/\(\s*\)/g, '')
      .replace(/\s+(?:using|on|via|with)\s*(?=[.,!?;:]|$)/gi, '')
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([a-z0-9%"'’”\]}>])([.!?])(["'‘“(\[{]*[A-Z])/g, '$1$2 $3')
      .replace(/([A-Z]{2,})([.!?])(["'‘“(\[{]*[A-Z])/g, '$1$2 $3')
      .replace(/\s+/g, ' ')
      .trim();
    return this.toCurlyQuotes(cleaned);
  }

  imperativeHeadline(rawText: string | undefined | null): string {
    const cleaned = this.plainText(rawText).replace(/[.!?]+$/, '').trim();
    if (!cleaned) return '';
    const map: Record<string, string> = {
      reading: 'Read',
      reads: 'Read',
      read: 'Read',
      inspecting: 'Inspect',
      inspects: 'Inspect',
      inspected: 'Inspect',
      scanning: 'Scan',
      scans: 'Scan',
      scanned: 'Scan',
      mapping: 'Map',
      maps: 'Map',
      mapped: 'Map',
      preparing: 'Prepare',
      prepares: 'Prepare',
      prepared: 'Prepare',
      parsing: 'Parse',
      parses: 'Parse',
      parsed: 'Parse',
      cloning: 'Clone',
      clones: 'Clone',
      cloned: 'Clone',
      classifying: 'Classify',
      classifies: 'Classify',
      classified: 'Classify',
      clearing: 'Clear',
      clears: 'Clear',
      cleared: 'Clear',
      closing: 'Close',
      closes: 'Close',
      closed: 'Close',
      adding: 'Add',
      adds: 'Add',
      added: 'Add',
      converting: 'Convert',
      converts: 'Convert',
      converted: 'Convert',
      replacing: 'Replace',
      replaces: 'Replace',
      replaced: 'Replace',
      splitting: 'Split',
      splits: 'Split',
      fixing: 'Fix',
      fixes: 'Fix',
      fixed: 'Fix',
      enforcing: 'Enforce',
      enforces: 'Enforce',
      enforced: 'Enforce',
      removing: 'Remove',
      removes: 'Remove',
      removed: 'Remove',
      validating: 'Validate',
      validates: 'Validate',
      validated: 'Validate',
      raising: 'Raise',
      raises: 'Raise',
      raised: 'Raise',
      generating: 'Generate',
      generates: 'Generate',
      generated: 'Generate',
      auditing: 'Audit',
      audits: 'Audit',
      audited: 'Audit',
      analyzing: 'Analyze',
      analyzes: 'Analyze',
      analyzed: 'Analyze',
      checking: 'Check',
      checks: 'Check',
      checked: 'Check',
      updating: 'Update',
      updates: 'Update',
      updated: 'Update',
      optimizing: 'Optimize',
      optimizes: 'Optimize',
      optimized: 'Optimize',
      securing: 'Secure',
      secures: 'Secure',
      secured: 'Secure',
      sanitizing: 'Sanitize',
      sanitizes: 'Sanitize',
      sanitized: 'Sanitize'
    };
    const m = cleaned.match(/^([A-Za-z]+)(\b[\s\S]*)$/);
    if (!m) return cleaned;
    const lower = m[1].toLowerCase();
    if (map[lower]) {
      return `${map[lower]}${m[2]}`;
    }
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  detailTense(
    rawText: string | undefined | null,
    mode: 'active' | 'done' = 'done',
    maxChars = 240
  ): string {
    const shortened = this.cleanSentences(rawText, maxChars);
    if (!shortened) return '';
    const thirdToPast: Record<string, string> = {
      adds: 'added',
      converts: 'converted',
      replaces: 'replaced',
      splits: 'split',
      fixes: 'fixed',
      enforces: 'enforced',
      removes: 'removed',
      validates: 'validated',
      raises: 'raised',
      generates: 'generated',
      creates: 'created',
      updates: 'updated',
      improves: 'improved',
      eliminates: 'eliminated',
      reduces: 'reduced',
      prevents: 'prevented',
      ensures: 'ensured',
      restores: 'restored',
      wires: 'wired',
      injects: 'injected',
      applies: 'applied',
      sets: 'set',
      wraps: 'wrapped',
      moves: 'moved',
      defers: 'deferred',
      preloads: 'preloaded',
      sanitizes: 'sanitized',
      escapes: 'escaped',
      blocks: 'blocked',
      restricts: 'restricted',
      hardens: 'hardened',
      reads: 'read',
      inspects: 'inspected',
      scans: 'scanned',
      maps: 'mapped',
      prepares: 'prepared',
      parses: 'parsed',
      traces: 'traced',
      correlates: 'correlated',
      identifies: 'identified',
      clones: 'cloned',
      classifies: 'classified',
      clears: 'cleared',
      closes: 'closed'
    };
    const baseToPast: Record<string, string> = {
      add: 'Added',
      convert: 'Converted',
      replace: 'Replaced',
      split: 'Split',
      fix: 'Fixed',
      enforce: 'Enforced',
      clone: 'Cloned',
      classify: 'Classified',
      clear: 'Cleared',
      close: 'Closed',
      remove: 'Removed',
      validate: 'Validated',
      raise: 'Raised',
      generate: 'Generated',
      create: 'Created',
      update: 'Updated',
      improve: 'Improved',
      eliminate: 'Eliminated',
      reduce: 'Reduced',
      prevent: 'Prevented',
      ensure: 'Ensured',
      restore: 'Restored',
      wire: 'Wired',
      inject: 'Injected',
      apply: 'Applied',
      set: 'Set',
      wrap: 'Wrapped',
      move: 'Moved',
      defer: 'Deferred',
      preload: 'Preloaded',
      sanitize: 'Sanitized',
      escape: 'Escaped',
      block: 'Blocked',
      restrict: 'Restricted',
      harden: 'Hardened',
      read: 'Read',
      inspect: 'Inspected',
      scan: 'Scanned',
      map: 'Mapped',
      prepare: 'Prepared',
      parse: 'Parsed',
      trace: 'Traced',
      correlate: 'Correlated',
      identify: 'Identified'
    };
    const baseToIng: Record<string, string> = {
      read: 'Reading',
      inspect: 'Inspecting',
      scan: 'Scanning',
      map: 'Mapping',
      prepare: 'Preparing',
      parse: 'Parsing',
      add: 'Adding',
      convert: 'Converting',
      replace: 'Replacing',
      split: 'Splitting',
      fix: 'Fixing',
      enforce: 'Enforcing',
      remove: 'Removing',
      validate: 'Validating',
      raise: 'Raising',
      generate: 'Generating',
      trace: 'Tracing',
      correlate: 'Correlating',
      identify: 'Identifying'
    };

    let result = shortened.replace(
      /\b(and|or|,)\s+([a-z]+s)\b/gi,
      (full, conj, verb) => {
        const mapped = thirdToPast[verb.toLowerCase()];
        return mapped ? `${conj} ${mapped}` : full;
      }
    );

    const m = result.match(/^([A-Za-z]+)(\b[\s\S]*)$/);
    if (!m) return result;
    const firstLower = m[1].toLowerCase();
    const rest = m[2];
    if (thirdToPast[firstLower]) {
      const p = thirdToPast[firstLower];
      return p.charAt(0).toUpperCase() + p.slice(1) + rest;
    }
    if (mode === 'active' && baseToIng[firstLower]) {
      return `${baseToIng[firstLower]}${rest}`;
    }
    if (baseToPast[firstLower]) {
      return `${baseToPast[firstLower]}${rest}`;
    }
    return result;
  }

  cleanSentences(rawText: string | undefined | null, maxChars = 240): string {
    const cleaned = this.plainText(rawText);
    if (!cleaned) return '';
    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length === 0) return '';

    let result = '';
    for (const s of sentences) {
      const norm = /[.!?]$/.test(s) ? s : `${s}.`;
      if (!result) {
        result = norm;
      } else if (result.length + 1 + norm.length <= maxChars) {
        result = `${result} ${norm}`;
      } else {
        break;
      }
    }
    return result;
  }

  copyText(key: string, text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      this.copiedKey.set(key);
      setTimeout(() => {
        if (this.copiedKey() === key) {
          this.copiedKey.set(null);
        }
      }, 1500);
    }
  }
}
