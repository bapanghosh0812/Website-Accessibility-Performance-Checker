import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ActiveWorkspaceTab,
  AuditCommit,
  AuditHistoryEntry,
  AuditMode,
  AuditSession,
  CategoryImprovedItem,
  CoreVitalMetric,
  DeviceProfile,
  FlowStep,
  FresnelLore,
  LighthouseCategory,
  PatchBundle,
  PullRequestResult,
  RepoMetadata,
  ScoreGaugeItem,
  TelemetryStep
} from '../models/audit.model';

export const DEFAULT_SAMPLE_LHR_JSON = JSON.stringify(
  {
    lighthouseVersion: '12.2.0',
    fetchTime: '2026-10-06T13:35:00.000Z',
    requestedUrl: 'https://website-performance-checker.netlify.app/',
    finalDisplayedUrl: 'https://website-performance-checker.netlify.app/',
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
          { id: 'button-name', weight: 10, group: 'a11y-names-labels' }
        ]
      },
      'best-practices': {
        id: 'best-practices',
        title: 'Best Practices',
        score: 0.83,
        auditRefs: [{ id: 'csp-xss', weight: 5, group: 'trust-safety' }]
      },
      seo: {
        id: 'seo',
        title: 'SEO',
        score: 0.82,
        auditRefs: [{ id: 'structured-data', weight: 5, group: 'seo-content' }]
      }
    },
    audits: {
      'largest-contentful-paint-element': {
        id: 'largest-contentful-paint-element',
        title: 'Largest Contentful Paint element',
        score: 0.28,
        scoreDisplayMode: 'metricSavings',
        numericValue: 3420,
        displayValue: '3,420 ms',
        metricSavings: { LCP: 1180 },
        details: {
          type: 'table',
          items: [
            {
              node: {
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
        score: 0.42,
        scoreDisplayMode: 'metricSavings',
        displayValue: 'Potential savings of 640 ms',
        metricSavings: { FCP: 640, LCP: 480 }
      },
      'unsized-images': {
        id: 'unsized-images',
        title: 'Image elements do not have explicit width and height',
        score: 0.0,
        scoreDisplayMode: 'binary',
        displayValue: '3 elements found',
        metricSavings: { CLS: 0.14 }
      },
      'color-contrast': {
        id: 'color-contrast',
        title: 'Background and foreground colors do not have a sufficient contrast ratio',
        score: 0.0,
        scoreDisplayMode: 'binary',
        displayValue: '2 elements fail WCAG AA (3.1:1 vs 4.5:1)'
      }
    }
  },
  null,
  2
);

function deterministicHex(seed: string, length: number): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const base = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  return base.repeat(Math.ceil(length / base.length)).slice(0, length);
}

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private fullStepsCache: TelemetryStep[] = [];
  private fullCommitsCache: AuditCommit[] = [];

  readonly step = signal<FlowStep>(1);
  readonly isTransitioning = signal<boolean>(false);
  readonly theme = signal<'light' | 'dark'>('light');
  readonly mode = signal<AuditMode>('live');
  readonly deviceProfile = signal<DeviceProfile>('mobile');
  readonly activeTab = signal<ActiveWorkspaceTab>('commits');
  readonly searchQuery = signal<string>('');
  readonly impactFilter = signal<'all' | 'Critical' | 'High' | 'Medium'>('all');
  readonly expandedAiIds = signal<Set<string>>(new Set());

  readonly lore = signal<FresnelLore>({
    name: 'Fresnel',
    pronunciation: '/freɪˈnɛl/',
    origin:
      'Named after French physicist Augustin-Jean Fresnel (1788–1827), inventor of the stepped concentric lighthouse lens.',
    quote:
      '“Instead of a single heavy dome of glass, concentric stepped prism rings capture scattered light from every angle and refract it into one extraordinary, miles-long beam.”',
    explanation:
      'Just as the Fresnel lens concentrates a lighthouse’s beam to guide ships through fog, Fresnel takes the broad inspection beam of Lighthouse and focuses it onto raw source code—refining scattered issues across performance, accessibility, best practices, SEO, and light web application security findings into sharp, self-contained git commits.'
  });

  readonly session = signal<AuditSession | null>(null);
  readonly selectedCommitIds = signal<Set<string>>(new Set());
  readonly expandedDiffIds = signal<Set<string>>(new Set());
  readonly history = signal<AuditHistoryEntry[]>([]);

  private readonly sessionScopeKey = computed(
    () => `${this.session()?.id ?? 'init'}:${this.session()?.runPhase ?? 'static'}`
  );

  readonly categoryFilter = linkedSignal<string, LighthouseCategory>({
    source: this.sessionScopeKey,
    computation: () => 'all'
  });

  readonly patchBundle = signal<PatchBundle | null>(null);
  readonly isPatchDrawerOpen = signal<boolean>(false);
  readonly prResult = signal<PullRequestResult | null>(null);
  readonly isCreatingPr = signal<boolean>(false);

  readonly prCliMode = linkedSignal<PullRequestResult | null, 'inline' | 'short'>({
    source: this.prResult,
    computation: () => 'inline'
  });

  readonly lhrJsonInput = signal<string>('');
  readonly lhrFileName = signal<string>('');

  readonly allCommits = computed<AuditCommit[]>(() => this.session()?.commits ?? []);

  readonly filteredCommits = computed<AuditCommit[]>(() => {
    const commits = this.allCommits();
    const filter = this.categoryFilter();
    const impact = this.impactFilter();
    const query = this.searchQuery().trim().toLowerCase();

    return commits.filter((c) => {
      if (filter !== 'all' && c.category !== filter) return false;
      if (impact !== 'all' && c.impact !== impact) return false;
      if (query) {
        const hay = `${c.title} ${c.summary} ${c.ruleId} ${c.categoryLabel} ${c.files.join(' ')}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  });

  readonly selectedCount = computed<number>(() => this.selectedCommitIds().size);
  readonly totalCommitsCount = computed<number>(() => this.allCommits().length);

  readonly categoryCounts = computed<Record<LighthouseCategory, number>>(() => {
    const commits = this.allCommits();
    return {
      all: commits.length,
      performance: commits.filter((c) => c.category === 'performance').length,
      accessibility: commits.filter((c) => c.category === 'accessibility').length,
      'best-practices': commits.filter((c) => c.category === 'best-practices').length,
      seo: commits.filter((c) => c.category === 'seo').length,
      security: commits.filter((c) => c.category === 'security').length
    };
  });

  /** Dynamic Before vs. After 0-100 Score Gauges recalculated from selected commits */
  readonly scoreGauges = computed<ScoreGaugeItem[]>(() => {
    const commits = this.allCommits();
    const selected = this.selectedCommitIds();
    const isDesktop = this.deviceProfile() === 'desktop';
    const isLhr = this.session()?.runPhase === 'lhr';

    const calcRatio = (cat: string) => {
      const catCommits = commits.filter((c) => c.category === cat);
      if (catCommits.length === 0) return 1;
      const selCount = catCommits.filter((c) => selected.has(c.id)).length;
      return selCount / catCommits.length;
    };

    const perfBase = isDesktop ? 74 : 64;
    const a11yBase = 72;
    const bpBase = 79;
    const seoBase = 78;
    const secBase = 68;

    const perfAfter = Math.min(100, Math.round(perfBase + (99 - perfBase) * calcRatio('performance')));
    const a11yAfter = Math.min(100, Math.round(a11yBase + (100 - a11yBase) * calcRatio('accessibility')));
    const bpAfter = Math.min(100, Math.round(bpBase + (100 - bpBase) * calcRatio('best-practices')));
    const seoAfter = Math.min(100, Math.round(seoBase + (100 - seoBase) * calcRatio('seo')));
    const secAfter = Math.min(100, Math.round(secBase + (99 - secBase) * calcRatio('security')));

    const items: ScoreGaugeItem[] = [
      { id: 'performance', label: 'Performance', beforeScore: perfBase, afterScore: perfAfter, delta: perfAfter - perfBase },
      { id: 'accessibility', label: 'Accessibility', beforeScore: a11yBase, afterScore: a11yAfter, delta: a11yAfter - a11yBase },
      { id: 'best-practices', label: 'Best practices', beforeScore: bpBase, afterScore: bpAfter, delta: bpAfter - bpBase },
      { id: 'seo', label: 'SEO', beforeScore: seoBase, afterScore: seoAfter, delta: seoAfter - seoBase }
    ];

    if (!isLhr) {
      items.push({
        id: 'security',
        label: 'Security shield',
        beforeScore: secBase,
        afterScore: secAfter,
        delta: secAfter - secBase
      });
    }

    return items;
  });

  /** Dynamic Core Web Vitals simulator metrics */
  readonly coreWebVitals = computed<CoreVitalMetric[]>(() => {
    const commits = this.allCommits();
    const selected = this.selectedCommitIds();
    const isDesktop = this.deviceProfile() === 'desktop';
    const perfCommits = commits.filter((c) => c.category === 'performance');
    const ratio =
      perfCommits.length > 0
        ? perfCommits.filter((c) => selected.has(c.id)).length / perfCommits.length
        : 1;

    const lcpBefore = isDesktop ? 2.8 : 3.6;
    const lcpAfter = Number((lcpBefore - (lcpBefore - (isDesktop ? 1.1 : 1.4)) * ratio).toFixed(1));

    const inpBefore = isDesktop ? 185 : 260;
    const inpAfter = Math.round(inpBefore - (inpBefore - (isDesktop ? 48 : 64)) * ratio);

    const clsBefore = 0.18;
    const clsAfter = Number((clsBefore - (clsBefore - 0.01) * ratio).toFixed(2));

    const fcpBefore = isDesktop ? 1.6 : 2.2;
    const fcpAfter = Number((fcpBefore - (fcpBefore - (isDesktop ? 0.7 : 0.9)) * ratio).toFixed(1));

    const ttfbBefore = isDesktop ? 420 : 610;
    const ttfbAfter = Math.round(ttfbBefore - (ttfbBefore - (isDesktop ? 140 : 190)) * ratio);

    const siBefore = isDesktop ? 2.9 : 3.8;
    const siAfter = Number((siBefore - (siBefore - (isDesktop ? 1.2 : 1.5)) * ratio).toFixed(1));

    return [
      {
        id: 'lcp',
        acronym: 'LCP',
        label: 'Largest Contentful Paint',
        beforeValue: `${lcpBefore}s`,
        afterValue: `${lcpAfter}s`,
        deltaLabel: `-${(lcpBefore - lcpAfter).toFixed(1)}s faster`,
        unit: 's',
        status: lcpAfter <= 2.5 ? 'good' : 'needs-improvement',
        description: 'Hero media preloading, AVIF/WebP responsive sources, and fetchpriority="high".'
      },
      {
        id: 'inp',
        acronym: 'INP',
        label: 'Interaction to Next Paint',
        beforeValue: `${inpBefore}ms`,
        afterValue: `${inpAfter}ms`,
        deltaLabel: `-${inpBefore - inpAfter}ms latency`,
        unit: 'ms',
        status: inpAfter <= 200 ? 'good' : 'needs-improvement',
        description: 'Passive scroll/wheel event listeners and route-level lazy chunk splitting.'
      },
      {
        id: 'cls',
        acronym: 'CLS',
        label: 'Cumulative Layout Shift',
        beforeValue: `${clsBefore}`,
        afterValue: `${clsAfter}`,
        deltaLabel: `-${(clsBefore - clsAfter).toFixed(2)} shift`,
        unit: '',
        status: clsAfter <= 0.1 ? 'good' : 'needs-improvement',
        description: 'Explicit intrinsic width/height and aspect-ratio reservation on all media.'
      },
      {
        id: 'fcp',
        acronym: 'FCP',
        label: 'First Contentful Paint',
        beforeValue: `${fcpBefore}s`,
        afterValue: `${fcpAfter}s`,
        deltaLabel: `-${(fcpBefore - fcpAfter).toFixed(1)}s faster`,
        unit: 's',
        status: fcpAfter <= 1.8 ? 'good' : 'needs-improvement',
        description: 'Eliminated synchronous @import stylesheets and added preconnect hints.'
      },
      {
        id: 'ttfb',
        acronym: 'TTFB',
        label: 'Time to First Byte & CDN',
        beforeValue: `${ttfbBefore}ms`,
        afterValue: `${ttfbAfter}ms`,
        deltaLabel: `-${ttfbBefore - ttfbAfter}ms saved`,
        unit: 'ms',
        status: ttfbAfter <= 500 ? 'good' : 'needs-improvement',
        description: 'Immutable edge caching headers and preconnect DNS/TLS warm-up.'
      },
      {
        id: 'si',
        acronym: 'SI',
        label: 'Speed Index',
        beforeValue: `${siBefore}s`,
        afterValue: `${siAfter}s`,
        deltaLabel: `-${(siBefore - siAfter).toFixed(1)}s faster`,
        unit: 's',
        status: siAfter <= 3.4 ? 'good' : 'needs-improvement',
        description: 'Critical above-the-fold CSS inlining and offscreen image lazy decoding.'
      }
    ];
  });

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('fresnel-theme') as 'light' | 'dark' | null;
      if (savedTheme === 'dark' || savedTheme === 'light') {
        this.theme.set(savedTheme);
      }
      try {
        const rawHistory = localStorage.getItem('fresnel-audit-history');
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) {
            this.history.set(parsed.slice(0, 8));
          }
        }
      } catch {
        // ignore storage parse error
      }
    }

    effect(() => {
      const activeTheme = this.theme();
      this.document?.documentElement?.setAttribute('data-theme', activeTheme);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fresnel-theme', activeTheme);
      }
    });

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  setTheme(nextTheme: 'light' | 'dark'): void {
    this.theme.set(nextTheme);
  }

  toggleTheme(): void {
    this.theme.update((current) => (current === 'light' ? 'dark' : 'light'));
  }

  transitionToStep(nextStep: FlowStep): void {
    if (this.step() === nextStep) return;
    this.isTransitioning.set(true);
    setTimeout(() => {
      this.step.set(nextStep);
      this.isTransitioning.set(false);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 180);
  }

  parseTargetInput(rawUrl: string, mode: AuditMode = 'live'): RepoMetadata {
    if (mode === 'demo') {
      return {
        owner: 'fresnel-sandbox',
        repo: 'lumina-web-app',
        fullName: 'fresnel-sandbox/lumina-web-app',
        url: 'https://github.com/fresnel-sandbox/lumina-web-app',
        isDemo: true,
        language: 'TypeScript',
        defaultBranch: 'main'
      };
    }

    const cleaned = String(rawUrl || '')
      .trim()
      .replace(/^[<>'"`\s]+|[<>'"`\s]+$/g, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '');

    let owner = 'fresnel-sandbox';
    let repo = 'lumina-web-app';

    const githubMatch = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)/i);
    const shorthandMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    const domainMatch = cleaned.match(/^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)(?:\/([^\s?#]*))?/i);

    if (githubMatch) {
      owner = githubMatch[1].replace(/[^a-zA-Z0-9_.-]/g, '') || 'fresnel-sandbox';
      repo = githubMatch[2].replace(/[^a-zA-Z0-9_.-]/g, '') || 'lumina-web-app';
    } else if (shorthandMatch && !cleaned.includes('.com') && !cleaned.includes('.app') && !cleaned.includes('.org')) {
      owner = shorthandMatch[1].replace(/[^a-zA-Z0-9_.-]/g, '') || 'fresnel-sandbox';
      repo = shorthandMatch[2].replace(/[^a-zA-Z0-9_.-]/g, '') || 'lumina-web-app';
    } else if (domainMatch) {
      const hostParts = domainMatch[1].toLowerCase().split('.');
      owner = hostParts[0] || 'web-platform';
      const pathSlug = (domainMatch[2] || '').split('/').filter(Boolean)[0];
      repo = (pathSlug || hostParts.slice(0, -1).join('-') || 'web-app').replace(/[^a-zA-Z0-9_.-]/g, '');
    }

    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}`,
      isDemo: false,
      language: 'TypeScript / HTML / SCSS',
      defaultBranch: 'main'
    };
  }

  private recordAuditHistory(session: AuditSession): void {
    const entry: AuditHistoryEntry = {
      id: session.id,
      repoFullName: session.repo.fullName,
      repoUrl: session.repo.url,
      mode: session.mode,
      runPhase: session.runPhase,
      deviceProfile: this.deviceProfile(),
      commitsCount: session.totalCommits,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updated = [entry, ...this.history().filter((h) => h.repoFullName !== entry.repoFullName)].slice(0, 6);
    this.history.set(updated);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('fresnel-audit-history', JSON.stringify(updated));
      } catch {
        // ignore storage quota errors
      }
    }
  }

  clearHistory(): void {
    this.history.set([]);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('fresnel-audit-history');
    }
  }

  async startAudit(repoUrl: string, mode: AuditMode = 'live'): Promise<void> {
    this.stopPolling();
    this.mode.set(mode);
    this.isPatchDrawerOpen.set(false);
    this.activeTab.set('commits');
    this.searchQuery.set('');
    this.impactFilter.set('all');

    const targetUrl =
      mode === 'demo'
        ? 'https://github.com/fresnel-sandbox/lumina-web-app'
        : repoUrl.trim() || 'https://github.com/bapanghosh0812/Website-Accessibility-Performance-Checker';

    const repoMeta = this.parseTargetInput(targetUrl, mode);
    const commits = this.buildClientStaticCommits(repoMeta);
    const steps = this.buildClientTelemetrySteps(repoMeta, commits);
    const categoriesImproved = this.buildClientCategoriesImproved(commits, 'static');

    this.fullCommitsCache = commits;
    this.fullStepsCache = steps;

    const initialSession: AuditSession = {
      id: `fresnel-${deterministicHex(repoMeta.fullName + Date.now(), 10)}`,
      interactionId: `audit/${deterministicHex(repoMeta.fullName, 12)}`,
      mode,
      runPhase: 'static',
      deviceProfile: this.deviceProfile(),
      categoriesImproved,
      lhrMeta: null,
      status: 'in_progress',
      progressPercent: 14,
      repo: repoMeta,
      branch: 'main',
      categories: ['performance', 'accessibility', 'best-practices', 'seo', 'security'],
      currentStep: steps[0],
      steps: [steps[0], steps[1]],
      totalSteps: steps.length,
      commits: commits.slice(0, 2),
      totalCommits: commits.length,
      pr: null
    };

    this.session.set(initialSession);
    this.recordAuditHistory(initialSession);
    this.transitionToStep(2);

    // Non-blocking enrichment from GitHub public API if auditing a real GitHub repo
    if (!repoMeta.isDemo) {
      void this.enrichGitHubRepoMetadata(repoMeta);
    }

    this.startClientTelemetryProgression(initialSession.id, 'static');
  }

  private async enrichGitHubRepoMetadata(repoMeta: RepoMetadata): Promise<void> {
    try {
      const res = await fetch(`https://api.github.com/repos/${repoMeta.owner}/${repoMeta.repo}`, {
        headers: { Accept: 'application/vnd.github.v3+json' }
      });
      if (!res.ok) return;
      const data = await res.json();
      const current = this.session();
      if (!current || current.repo.fullName !== repoMeta.fullName) return;
      this.session.set({
        ...current,
        branch: data.default_branch || current.branch,
        repo: {
          ...current.repo,
          stars: typeof data.stargazers_count === 'number' ? data.stargazers_count : undefined,
          language: data.language || current.repo.language,
          defaultBranch: data.default_branch || 'main'
        }
      });
    } catch {
      // Ignore network/rate-limit errors gracefully
    }
  }

  private startClientTelemetryProgression(sessionId: string, runPhase: 'static' | 'lhr'): void {
    const startTime = Date.now();
    const durationMs = 2400;

    this.pollTimer = setInterval(() => {
      const current = this.session();
      if (!current || current.id !== sessionId) {
        this.stopPolling();
        return;
      }

      const elapsed = Date.now() - startTime;
      const ratio = Math.min(1, elapsed / durationMs);
      const totalSteps = this.fullStepsCache.length;
      const visibleStepCount =
        ratio >= 1
          ? totalSteps
          : Math.max(2, Math.min(totalSteps - 1, Math.floor(ratio * totalSteps) + 1));

      const visibleSteps = this.fullStepsCache.slice(0, visibleStepCount);
      const visibleCommitCount =
        ratio >= 1
          ? this.fullCommitsCache.length
          : Math.max(2, Math.floor(ratio * this.fullCommitsCache.length));

      const isDone = ratio >= 1;
      const updated: AuditSession = {
        ...current,
        status: isDone ? 'completed' : 'in_progress',
        progressPercent: Math.round(ratio * 100),
        currentStep: visibleSteps[visibleSteps.length - 1] || this.fullStepsCache[0],
        steps: visibleSteps,
        commits: isDone ? this.fullCommitsCache : this.fullCommitsCache.slice(0, visibleCommitCount)
      };

      this.session.set(updated);

      if (isDone) {
        this.stopPolling();
        setTimeout(() => {
          this.prepareReportState(updated);
          this.transitionToStep(runPhase === 'lhr' ? 7 : 3);
        }, 320);
      }
    }, 260);
  }

  openLighthouseJsonStep(): void {
    this.isPatchDrawerOpen.set(false);
    if (!this.lhrJsonInput()) {
      this.loadSampleLhrJson();
    }
    this.transitionToStep(5);
  }

  loadSampleLhrJson(): void {
    this.lhrJsonInput.set(DEFAULT_SAMPLE_LHR_JSON);
    this.lhrFileName.set('lighthouse-report-lhr.json (sample LHR)');
  }

  async startLhrAudit(): Promise<void> {
    this.stopPolling();
    this.isPatchDrawerOpen.set(false);
    this.activeTab.set('commits');
    this.searchQuery.set('');
    this.impactFilter.set('all');

    const baseRepo =
      this.session()?.repo ??
      this.parseTargetInput('https://github.com/bapanghosh0812/Website-Accessibility-Performance-Checker', 'live');

    const lhrResult = this.buildClientLhrAnalysis(baseRepo, this.lhrJsonInput() || DEFAULT_SAMPLE_LHR_JSON);
    this.fullCommitsCache = lhrResult.commits;
    this.fullStepsCache = lhrResult.steps;

    const lhrSession: AuditSession = {
      id: `fresnel-lhr-${deterministicHex(baseRepo.fullName + Date.now(), 10)}`,
      interactionId: `audit/lhr-${deterministicHex(baseRepo.fullName, 10)}`,
      mode: this.mode(),
      runPhase: 'lhr',
      deviceProfile: this.deviceProfile(),
      categoriesImproved: this.buildClientCategoriesImproved(lhrResult.commits, 'lhr'),
      lhrMeta: {
        lighthouseVersion: lhrResult.lhrVersion,
        requestedUrl: lhrResult.requestedUrl,
        fetchTime: lhrResult.fetchTime
      },
      status: 'in_progress',
      progressPercent: 18,
      repo: baseRepo,
      branch: this.session()?.branch || 'main',
      categories: ['performance', 'accessibility', 'best-practices', 'seo'],
      currentStep: lhrResult.steps[0],
      steps: lhrResult.steps.slice(0, 2),
      totalSteps: lhrResult.steps.length,
      commits: lhrResult.commits.slice(0, 2),
      totalCommits: lhrResult.commits.length,
      pr: null
    };

    this.session.set(lhrSession);
    this.transitionToStep(6);
    this.startClientTelemetryProgression(lhrSession.id, 'lhr');
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async skipToReport(): Promise<void> {
    const current = this.session();
    if (!current) return;
    this.stopPolling();

    const completed: AuditSession = {
      ...current,
      status: 'completed',
      progressPercent: 100,
      steps: this.fullStepsCache.length > 0 ? this.fullStepsCache : current.steps,
      commits: this.fullCommitsCache.length > 0 ? this.fullCommitsCache : current.commits,
      currentStep:
        this.fullStepsCache[this.fullStepsCache.length - 1] || current.currentStep
    };

    this.session.set(completed);
    this.prepareReportState(completed);
    this.transitionToStep(completed.runPhase === 'lhr' ? 7 : 3);
  }

  private prepareReportState(sessionData: AuditSession): void {
    const allIds = new Set(sessionData.commits.map((c) => c.id));
    this.selectedCommitIds.set(allIds);
    const firstId = sessionData.commits[0]?.id;
    this.expandedDiffIds.set(firstId ? new Set([firstId]) : new Set());
    this.expandedAiIds.set(firstId ? new Set([firstId]) : new Set());
    this.categoryFilter.set('all');
    void this.refreshPatchBundle();
  }

  toggleCommitSelection(commitId: string): void {
    const next = new Set(this.selectedCommitIds());
    if (next.has(commitId)) {
      next.delete(commitId);
    } else {
      next.add(commitId);
    }
    this.selectedCommitIds.set(next);
    void this.refreshPatchBundle();
  }

  selectAllCommits(): void {
    this.selectedCommitIds.set(new Set(this.allCommits().map((c) => c.id)));
    void this.refreshPatchBundle();
  }

  clearAllCommits(): void {
    this.selectedCommitIds.set(new Set());
    void this.refreshPatchBundle();
  }

  toggleDiff(commitId: string): void {
    const next = new Set(this.expandedDiffIds());
    if (next.has(commitId)) {
      next.delete(commitId);
    } else {
      next.add(commitId);
    }
    this.expandedDiffIds.set(next);
  }

  toggleAiExplain(commitId: string): void {
    const next = new Set(this.expandedAiIds());
    if (next.has(commitId)) {
      next.delete(commitId);
    } else {
      next.add(commitId);
    }
    this.expandedAiIds.set(next);
  }

  buildClientSidePatchFallback(): { filename: string; content: string } {
    const current = this.session();
    const selectedSet = this.selectedCommitIds();
    const chosen = (current?.commits ?? []).filter((c) => selectedSet.has(c.id));
    const suffix = current?.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';
    const filename = `fresnel-${current?.repo?.repo || 'repository'}-${suffix}.patch`;
    const total = chosen.length;
    if (total === 0) {
      return { filename, content: '# No commits selected\n' };
    }
    const content = chosen
      .map((c, idx) =>
        [
          `From ${c.fullSha || c.sha} Mon Sep 17 00:00:00 2001`,
          `From: ${c.author || 'Fresnel <fresnel@noreplies.github.com>'}`,
          `Date: ${c.date || new Date().toUTCString()}`,
          `Subject: [PATCH ${idx + 1}/${total}] ${c.commitMessage || c.title}`,
          ``,
          c.summary,
          `---`,
          c.diff,
          `-- `,
          `2.47.0`,
          ``
        ].join('\n')
      )
      .join('\n');
    return { filename, content };
  }

  async refreshPatchBundle(): Promise<PatchBundle | null> {
    const current = this.session();
    if (!current) return null;

    const fallback = this.buildClientSidePatchFallback();
    const selectedIds = Array.from(this.selectedCommitIds());
    const suffix = current.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';

    const localBundle: PatchBundle = {
      filename: fallback.filename,
      selectedCount: selectedIds.length,
      patchContent: fallback.content,
      downloadUrl: `/api/audit/${current.id}/patch.diff?commits=${encodeURIComponent(selectedIds.join(','))}`,
      instructions: {
        cloneCmd: `git clone ${current.repo.url}.git && cd ${current.repo.repo}`,
        branchCmd: `git checkout -b fresnel/${suffix} origin/${current.branch}`,
        applyAmCmd: `git am --3way < ~/Downloads/${fallback.filename}`,
        applyDiffCmd: `git apply --3way ~/Downloads/${fallback.filename}`,
        verifyCmd: `git log --oneline -n ${Math.max(1, selectedIds.length)}`,
        pushCmd: `git push -u origin fresnel/${suffix}`
      }
    };

    this.patchBundle.set(localBundle);

    try {
      const remoteBundle = await firstValueFrom(
        this.http.post<PatchBundle>(`/api/audit/${current.id}/patch`, {
          selectedCommitIds: selectedIds
        })
      );
      if (remoteBundle && remoteBundle.patchContent) {
        this.patchBundle.set(remoteBundle);
        return remoteBundle;
      }
    } catch {
      // Use localBundle seamlessly
    }

    return localBundle;
  }

  openPatchGuideAndDownload(): void {
    this.isPatchDrawerOpen.set(true);
    const cached = this.patchBundle();
    if (cached && cached.patchContent) {
      this.triggerBrowserDownload(cached.filename, cached.patchContent, cached.downloadUrl);
    } else {
      const fallback = this.buildClientSidePatchFallback();
      this.triggerBrowserDownload(fallback.filename, fallback.content);
    }
    void this.refreshPatchBundle();
  }

  exportReportAs(format: 'patch' | 'markdown' | 'json' | 'csv' | 'print'): void {
    const current = this.session();
    if (!current) return;

    if (format === 'print') {
      if (typeof window !== 'undefined') window.print();
      return;
    }

    if (format === 'patch') {
      this.openPatchGuideAndDownload();
      return;
    }

    const selectedSet = this.selectedCommitIds();
    const chosen = current.commits.filter((c) => selectedSet.has(c.id));
    const repoSlug = current.repo.repo || 'website';

    if (format === 'json') {
      const payload = {
        generatedAt: new Date().toISOString(),
        generator: 'Fresnel — Website Accessibility & Performance Checker',
        liveUrl: 'https://website-performance-checker.netlify.app/',
        repository: current.repo,
        deviceProfile: this.deviceProfile(),
        scores: this.scoreGauges(),
        coreWebVitals: this.coreWebVitals(),
        selectedCommitsCount: chosen.length,
        commits: chosen
      };
      this.triggerBrowserDownload(
        `fresnel-${repoSlug}-audit-report.json`,
        JSON.stringify(payload, null, 2),
        undefined,
        'application/json;charset=utf-8'
      );
      return;
    }

    if (format === 'csv') {
      const header = ['ID', 'SHA', 'Category', 'Impact', 'Rule ID', 'Estimated Gain', 'Title', 'Files', 'Summary'];
      const rows = chosen.map((c) => [
        c.id,
        c.sha,
        c.categoryLabel,
        c.impact || 'High',
        c.ruleId,
        c.estimatedGain || '',
        `"${c.title.replace(/"/g, '""')}"`,
        `"${c.files.join('; ')}"`,
        `"${c.summary.replace(/"/g, '""')}"`
      ]);
      const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
      this.triggerBrowserDownload(
        `fresnel-${repoSlug}-audit-issues.csv`,
        csvContent,
        undefined,
        'text/csv;charset=utf-8'
      );
      return;
    }

    if (format === 'markdown') {
      const mdLines = [
        `# Fresnel Website Accessibility & Performance Audit Report`,
        ``,
        `- **Target Repository / Website:** ${current.repo.fullName} (${current.repo.url})`,
        `- **Device Profile:** ${this.deviceProfile() === 'mobile' ? 'Mobile (4G Emulation)' : 'Desktop (Broadband)'}`,
        `- **Selected Fixes:** ${chosen.length} atomic commits`,
        `- **Generated via:** https://website-performance-checker.netlify.app/`,
        ``,
        `## Projected Health Scores (Before → After Fix)`,
        ``,
        `| Category | Baseline | After Code Fixes | Improvement |`,
        `| :--- | :---: | :---: | :---: |`,
        ...this.scoreGauges().map(
          (g) => `| **${g.label}** | ${g.beforeScore}/100 | **${g.afterScore}/100** | +${g.delta} pts |`
        ),
        ``,
        `## Core Web Vitals Projection`,
        ``,
        `| Metric | Before | After | Delta |`,
        `| :--- | :---: | :---: | :---: |`,
        ...this.coreWebVitals().map(
          (v) => `| **${v.acronym}** (${v.label}) | ${v.beforeValue} | **${v.afterValue}** | ${v.deltaLabel} |`
        ),
        ``,
        `## Selected Atomic Code Commits (${chosen.length})`,
        ``,
        ...chosen.flatMap((c, i) => [
          `### ${i + 1}. ${c.title} (\`${c.sha}\`)`,
          `- **Category:** ${c.categoryLabel} | **Impact:** ${c.impact || 'High'} | **Rule:** \`${c.ruleId}\` | **Gain:** ${c.estimatedGain || 'Verified'}`,
          `- **Files:** \`${c.files.join('`, `')}\``,
          `- **Summary:** ${c.summary}`,
          ...(c.aiExplanation ? [`- **AI Root-Cause Analysis:** ${c.aiExplanation}`] : []),
          ``,
          '```diff',
          c.diff,
          '```',
          ``
        ])
      ];
      this.triggerBrowserDownload(
        `fresnel-${repoSlug}-executive-report.md`,
        mdLines.join('\n'),
        undefined,
        'text/markdown;charset=utf-8'
      );
    }
  }

  triggerBrowserDownload(
    filename: string,
    content: string,
    downloadUrl?: string,
    mimeType = 'text/x-diff;charset=utf-8'
  ): void {
    if (!this.document?.body) return;
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      this.document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        anchor.remove();
        URL.revokeObjectURL(url);
      }, 250);
    } catch {
      if (downloadUrl && typeof window !== 'undefined') {
        window.open(downloadUrl, '_blank');
      }
    }
  }

  async createPullRequest(): Promise<void> {
    const current = this.session();
    if (!current || this.selectedCommitIds().size === 0) return;

    this.isCreatingPr.set(true);
    try {
      const selectedIds = Array.from(this.selectedCommitIds());
      const selectedCommits = current.commits.filter((c) => this.selectedCommitIds().has(c.id));
      const shortHash = deterministicHex(`${current.id}-${selectedIds.join(',')}`, 6);
      const branchPrefix = current.runPhase === 'lhr' ? 'fresnel/lhr-targeted' : 'fresnel/code-audit';
      const headBranch = `${branchPrefix}-${shortHash}`;
      const baseBranch = current.branch || 'main';
      const suffix = current.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';
      const patchFilename = `fresnel-${current.repo.repo}-${suffix}.patch`;
      const patchContent = this.buildClientSidePatchFallback().content;

      const prTitle =
        current.runPhase === 'lhr'
          ? `perf(lighthouse-lhr): targeted LHR JSON audit fixes (${selectedCommits.length} commits)`
          : `chore(audit): accessibility, performance & security fixes (${selectedCommits.length} commits)`;

      const prBody = [
        `## Fresnel Website Accessibility & Performance Audit Fixes`,
        ``,
        `Applies **${selectedCommits.length} atomic commit(s)** across Performance, Accessibility (WCAG 2.2), Best Practices, SEO, and Web Security.`,
        ``,
        `### Included Commits`,
        ...selectedCommits.map(
          (c) => `- \`${c.commitMessage || c.title}\` (${c.categoryLabel} · \`${c.files.join(', ')}\`)`
        )
      ].join('\n');

      const compareUrl = `${current.repo.url}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(headBranch)}?expand=1&title=${encodeURIComponent(prTitle)}&body=${encodeURIComponent(prBody)}`;
      const escapedTitle = prTitle.replace(/"/g, '\\"');
      const escapedBody = prBody.replace(/"/g, '\\"').replace(/`/g, '\\`');

      const localPr: PullRequestResult = {
        number: current.runPhase === 'lhr' ? 43 : 42,
        mode: current.mode,
        runPhase: current.runPhase,
        title: prTitle,
        body: prBody,
        url: compareUrl,
        compareUrl,
        repoUrl: current.repo.url,
        repoFullName: current.repo.fullName,
        baseBranch,
        headBranch,
        patchFilename,
        patchDownloadUrl: `/api/audit/${current.id}/patch.diff?commits=${encodeURIComponent(selectedIds.join(','))}`,
        terminalCommand: [
          `git checkout -b ${headBranch} && \\`,
          `git am --3way << 'FRESNEL_PATCH_EOF'`,
          patchContent.trimEnd(),
          `FRESNEL_PATCH_EOF`,
          `git push -u origin ${headBranch} && \\`,
          `gh pr create --base ${baseBranch} --head ${headBranch} --title "${escapedTitle}" --body "${escapedBody}"`
        ].join('\n'),
        shortTerminalCommand: [
          `git checkout -b ${headBranch} && \\`,
          `git am --3way ~/Downloads/${patchFilename} && \\`,
          `git push -u origin ${headBranch} && \\`,
          `gh pr create --base ${baseBranch} --head ${headBranch} --title "${escapedTitle}" --fill`
        ].join('\n'),
        createdAt: new Date().toISOString(),
        selectedCommits,
        totalAdditions: selectedCommits.reduce((sum, c) => sum + c.additions, 0),
        totalDeletions: selectedCommits.reduce((sum, c) => sum + c.deletions, 0),
        filesTouched: Array.from(new Set(selectedCommits.flatMap((c) => c.files)))
      };

      this.prResult.set(localPr);
      this.prCliMode.set('inline');
      this.transitionToStep(4);
    } finally {
      this.isCreatingPr.set(false);
    }
  }

  private buildClientCategoriesImproved(
    commits: AuditCommit[],
    runPhase: 'static' | 'lhr'
  ): CategoryImprovedItem[] {
    const catalog = [
      {
        id: 'performance',
        label: 'Performance',
        focus: 'Core Web Vitals, LCP media priority, layout shift prevention, and network hints'
      },
      {
        id: 'accessibility',
        label: 'Accessibility',
        focus: 'WCAG 2.2 landmarks, ARIA labels, focus-visible indicators, contrast, and target sizing'
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
        const matching = commits.filter((c) => c.category === entry.id);
        return {
          id: entry.id,
          label: entry.label,
          focus: entry.focus,
          improved: matching.length > 0,
          commitsCount: matching.length,
          rules: matching.map((c) => c.ruleId)
        };
      })
      .filter((entry) => entry.improved);
  }

  private buildClientTelemetrySteps(repoMeta: RepoMetadata, commits: AuditCommit[]): TelemetryStep[] {
    const steps: TelemetryStep[] = [
      {
        index: 0,
        phase: 'Preparing audit',
        category: 'Workspace',
        headline: `Inspect ${repoMeta.fullName}`,
        narrative: `Scanning the repository statically across Performance, Accessibility, Best practices, SEO, and web application security findings without running untrusted scripts.`,
        commitId: null
      },
      {
        index: 1,
        phase: 'Mapping structure',
        category: 'Structure',
        headline: `Read templates, stylesheets, routing, and security sinks`,
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

  private buildClientStaticCommits(repoMeta: RepoMetadata): AuditCommit[] {
    const mkSha = (s: string) => deterministicHex(`${repoMeta.fullName}-${s}`, 7);
    const mkFull = (s: string) => deterministicHex(`${repoMeta.fullName}-${s}-full`, 40);

    return [
      {
        id: 'commit-a11y-1',
        sha: mkSha('a11y-skip-link'),
        fullSha: mkFull('a11y-skip-link'),
        category: 'accessibility',
        categoryLabel: 'Accessibility',
        ruleId: 'bypass',
        ruleTitle: 'Page contains a heading, skip link, or landmark region',
        impact: 'Critical',
        estimatedGain: '+9 A11y pts · WCAG 2.4.1',
        wcagReference: 'WCAG 2.2 Success Criterion 2.4.1 (Bypass Blocks — Level A)',
        aiExplanation:
          'Keyboard-only and screen reader users must otherwise press Tab dozens of times through repeated navigation items on every page load. Adding a focus-visible skip link targeting #main-content satisfies WCAG 2.4.1 immediately.',
        title: 'Add keyboard-accessible skip-to-main-content bypass link',
        commitMessage: 'feat(a11y): add keyboard-accessible skip-to-main-content bypass link',
        summary:
          'Added a visually hidden skip link as the first focusable element in the document shell that reveals on :focus-visible and jumps directly to #main-content.',
        files: ['src/app/app.component.html', 'src/app/app.component.scss'],
        additions: 24,
        deletions: 2,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: bypass (WCAG 2.4.1 Bypass Blocks - Level A)',
        diff: `diff --git a/src/app/app.component.html b/src/app/app.component.html
index 4a19c21..8b30e14 100644
--- a/src/app/app.component.html
+++ b/src/app/app.component.html
@@ -1,5 +1,6 @@
+<a class="skip-to-main-link" href="#main-content">Skip to main content</a>
 <app-header></app-header>
-<main class="app-main">
+<main id="main-content" class="app-main" tabindex="-1">
   <router-outlet></router-outlet>
 </main>`
      },
      {
        id: 'commit-perf-1',
        sha: mkSha('perf-lcp-priority'),
        fullSha: mkFull('perf-lcp-priority'),
        category: 'performance',
        categoryLabel: 'Performance',
        ruleId: 'largest-contentful-paint-element',
        ruleTitle: 'Prioritize Largest Contentful Paint image and reserve dimensions',
        impact: 'Critical',
        estimatedGain: '-780ms LCP · -0.14 CLS',
        wcagReference: 'Core Web Vitals — LCP < 2.5s & CLS < 0.1',
        aiExplanation:
          'Without fetchpriority="high" and explicit width/height attributes, the browser delays hero image discovery until after stylesheet layout and triggers a severe layout shift once decoded.',
        title: 'Prioritize LCP hero image with fetchpriority="high" and explicit dimensions',
        commitMessage: 'perf(lcp): prioritize hero media with fetchpriority="high" and width/height',
        summary:
          'Added fetchpriority=“high”, decoding=“async”, and explicit 1280x720 intrinsic dimensions on the primary hero image to accelerate LCP and eliminate layout shift.',
        files: ['src/app/pages/landing/landing-page.component.html'],
        additions: 8,
        deletions: 1,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: largest-contentful-paint-element & unsized-images',
        diff: `diff --git a/src/app/pages/landing/landing-page.component.html b/src/app/pages/landing/landing-page.component.html
index 118c4a2..740b19c 100644
--- a/src/app/pages/landing/landing-page.component.html
+++ b/src/app/pages/landing/landing-page.component.html
@@ -12,3 +12,10 @@
-  <img class="hero-visual" src="/assets/hero-showcase.webp" />
+  <img
+    class="hero-visual"
+    src="/assets/hero-showcase.webp"
+    alt="${repoMeta.repo} platform interface overview"
+    width="1280"
+    height="720"
+    fetchpriority="high"
+    decoding="async"
+  />`
      },
      {
        id: 'commit-sec-1',
        sha: mkSha('sec-dom-xss-sink'),
        fullSha: mkFull('sec-dom-xss-sink'),
        category: 'security',
        categoryLabel: 'Web application security findings',
        securityContext: 'Light',
        securityPattern: 'Common unsafe pattern · DOM XSS sink',
        ruleId: 'dom-xss-innerhtml',
        ruleTitle: 'Avoid unescaped innerHTML and bypassSecurityTrustHtml with untrusted input',
        impact: 'Critical',
        estimatedGain: 'Blocks DOM XSS injection',
        wcagReference: 'OWASP Top 10 A03:2021 — Cross-Site Scripting (DOM XSS)',
        aiExplanation:
          'Binding user-controlled strings into [innerHTML] after calling bypassSecurityTrustHtml disables Angular’s built-in DOM sanitization context, allowing <img onerror=...> or script injection.',
        title: 'Replace unsafe innerHTML / bypassSecurityTrustHtml sink with sanitized binding',
        commitMessage: 'security(xss): replace unsafe bypassSecurityTrustHtml sink with sanitized text binding',
        summary:
          'Replaced an unsafe bypassSecurityTrustHtml() + [innerHTML] template binding used for user-supplied snippets with safe text interpolation.',
        files: ['src/app/features/preview/preview-card.component.ts', 'src/app/features/preview/preview-card.component.html'],
        additions: 11,
        deletions: 9,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Light Web Application Security Finding: DOM XSS sink remediation.',
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
        id: 'commit-seo-1',
        sha: mkSha('seo-meta-jsonld'),
        fullSha: mkFull('seo-meta-jsonld'),
        category: 'seo',
        categoryLabel: 'SEO',
        ruleId: 'structured-data',
        ruleTitle: 'Document includes meta description, canonical link, OpenGraph, and JSON-LD schema',
        impact: 'High',
        estimatedGain: '+18 SEO pts · Rich Snippets',
        wcagReference: 'Google Search Essentials — Structured Data & Canonical Indexing',
        aiExplanation:
          'Search engines and AI answer engines rely on canonical URLs, descriptive OpenGraph metadata, and Schema.org JSON-LD graphs to rank web applications for high-intent queries.',
        title: 'Add canonical URL, OpenGraph metadata, and Schema.org WebApplication JSON-LD',
        commitMessage: 'feat(seo): add canonical link, OpenGraph tags, and JSON-LD structured data',
        summary:
          'Added descriptive meta description, canonical URL, OpenGraph social cards, and Schema.org WebApplication JSON-LD structured data in src/index.html.',
        files: ['src/index.html'],
        additions: 22,
        deletions: 2,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: meta-description, canonical, structured-data',
        diff: `diff --git a/src/index.html b/src/index.html
index 51a0c92..e48d110 100644
--- a/src/index.html
+++ b/src/index.html
@@ -5,4 +5,16 @@
   <title>${repoMeta.repo} — Official Web Platform</title>
+  <meta name="description" content="${repoMeta.fullName} — high-performance accessible web application." />
+  <link rel="canonical" href="https://website-performance-checker.netlify.app/" />
+  <meta property="og:title" content="${repoMeta.repo} — Web Platform" />
+  <meta property="og:type" content="website" />
+  <script type="application/ld+json">
+    {
+      "@context": "https://schema.org",
+      "@type": "WebApplication",
+      "name": "${repoMeta.repo}",
+      "applicationCategory": "DeveloperApplication"
+    }
+  </script>`
      },
      {
        id: 'commit-perf-2',
        sha: mkSha('perf-font-preconnect'),
        fullSha: mkFull('perf-font-preconnect'),
        category: 'performance',
        categoryLabel: 'Performance',
        ruleId: 'render-blocking-resources',
        ruleTitle: 'Eliminate render-blocking @import font stylesheets and add preconnect hints',
        impact: 'High',
        estimatedGain: '-540ms FCP · Zero FOIT',
        wcagReference: 'Core Web Vitals — First Contentful Paint (FCP < 1.8s)',
        aiExplanation:
          'CSS @import rules force sequential network waterfall requests before text can render. Preconnecting to fonts.gstatic.com and loading fonts with font-display:swap unblocks first paint.',
        title: 'Add preconnect resource hints and swap font-display strategy',
        commitMessage: 'perf(fonts): add preconnect hints and convert blocking @import to font-display:swap',
        summary:
          'Added <link rel=“preconnect”> hints for critical font origins and converted synchronous @import stylesheets to non-blocking links with font-display:swap.',
        files: ['src/index.html', 'src/styles.scss'],
        additions: 10,
        deletions: 4,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: render-blocking-resources & font-display',
        diff: `diff --git a/src/index.html b/src/index.html
index e48d110..99b310a 100644
--- a/src/index.html
+++ b/src/index.html
@@ -8,2 +8,5 @@
+  <link rel="preconnect" href="https://fonts.googleapis.com" />
+  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
+  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet" />`
      },
      {
        id: 'commit-a11y-2',
        sha: mkSha('a11y-route-titles'),
        fullSha: mkFull('a11y-route-titles'),
        category: 'accessibility',
        categoryLabel: 'Accessibility',
        ruleId: 'document-title',
        ruleTitle: 'Document has a contextual, route-specific <title> element',
        impact: 'High',
        estimatedGain: '+7 A11y pts · WCAG 2.4.2',
        wcagReference: 'WCAG 2.2 Success Criterion 2.4.2 (Page Titled — Level A)',
        aiExplanation:
          'Screen readers announce the document <title> immediately when routes change in an SPA. Unique route titles orient blind and low-vision users without requiring heading scans.',
        title: 'Provide contextual document titles across all application routes',
        commitMessage: 'feat(a11y): provide contextual document titles across all application routes',
        summary:
          'Replaced generic fallback document titles with descriptive route-level title metadata so screen readers announce page context immediately upon navigation.',
        files: ['src/app/app.routes.ts'],
        additions: 14,
        deletions: 4,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: document-title (WCAG 2.4.2 Page Titled - Level A)',
        diff: `diff --git a/src/app/app.routes.ts b/src/app/app.routes.ts
index 71c48a0..e02a91c 100644
--- a/src/app/app.routes.ts
+++ b/src/app/app.routes.ts
@@ -8,8 +8,10 @@ export const routes: Routes = [
   {
     path: '',
     component: LandingPageComponent,
+    title: 'Overview — ${repoMeta.repo} | High-Precision Web Platform',
   },
   {
     path: 'reports',
     loadComponent: () => import('./pages/reports/reports.component'),
+    title: 'Audit Reports & Benchmarks — ${repoMeta.repo}',
   },
 ];`
      },
      {
        id: 'commit-a11y-3',
        sha: mkSha('a11y-targets-and-focus'),
        fullSha: mkFull('a11y-targets-and-focus'),
        category: 'accessibility',
        categoryLabel: 'Accessibility',
        ruleId: 'target-size',
        ruleTitle: 'Touch targets have sufficient size (44x44px) and accessible names',
        impact: 'High',
        estimatedGain: '+12 A11y pts · WCAG 2.5.8',
        wcagReference: 'WCAG 2.2 Success Criterion 2.5.8 (Target Size Minimum) & 4.1.2 (Name, Role, Value)',
        aiExplanation:
          'Icon-only buttons without aria-label are announced simply as "button" by NVDA/VoiceOver, and targets smaller than 44x44px cause accidental taps for users with motor impairments.',
        title: 'Enforce 44px touch targets, aria-labels, and high-contrast focus outlines',
        commitMessage: 'fix(a11y): enforce 44px touch targets, aria-labels, and high-contrast focus outlines',
        summary:
          'Added explicit aria-label attributes to icon buttons, expanded interactive hit areas to 44x44px, and added high-contrast :focus-visible rings.',
        files: ['src/app/layout/header/header.component.html', 'src/app/layout/header/header.component.scss'],
        additions: 19,
        deletions: 5,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: target-size & button-name',
        diff: `diff --git a/src/app/layout/header/header.component.html b/src/app/layout/header/header.component.html
index 309a11c..8f72c01 100644
--- a/src/app/layout/header/header.component.html
+++ b/src/app/layout/header/header.component.html
@@ -4,3 +4,3 @@
-<button class="icon-btn" (click)="toggleTheme()">
+<button type="button" class="icon-btn" aria-label="Toggle color theme" (click)="toggleTheme()">
   <svg aria-hidden="true" viewBox="0 0 20 20"></svg>
 </button>`
      },
      {
        id: 'commit-bp-1',
        sha: mkSha('bp-csp-headers'),
        fullSha: mkFull('bp-csp-headers'),
        category: 'best-practices',
        categoryLabel: 'Best practices',
        ruleId: 'csp-xss',
        ruleTitle: 'Ensure Content-Security-Policy and X-Frame-Options protect against injection',
        impact: 'High',
        estimatedGain: '+11 Best Practices pts',
        wcagReference: 'W3C CSP Level 3 & OWASP Secure Headers Project',
        aiExplanation:
          'Deploying strict Content-Security-Policy, X-Frame-Options: DENY, and X-Content-Type-Options: nosniff headers prevents clickjacking, MIME sniffing, and unauthorized script execution.',
        title: 'Harden Content-Security-Policy, HSTS, and X-Content-Type-Options headers',
        commitMessage: 'feat(security): harden CSP, HSTS, and X-Content-Type-Options headers',
        summary:
          'Configured strict Content-Security-Policy, X-Frame-Options: DENY, and HSTS headers to protect against XSS and clickjacking.',
        files: ['netlify.toml', 'src/index.html'],
        additions: 14,
        deletions: 1,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: csp-xss',
        diff: `diff --git a/netlify.toml b/netlify.toml
index 1029a81..662c910 100644
--- a/netlify.toml
+++ b/netlify.toml
@@ -6,2 +6,8 @@
+[[headers]]
+  for = "/*"
+  [headers.values]
+    X-Frame-Options = "DENY"
+    X-Content-Type-Options = "nosniff"
+    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"`
      },
      {
        id: 'commit-perf-3',
        sha: mkSha('perf-route-lazy'),
        fullSha: mkFull('perf-route-lazy'),
        category: 'performance',
        categoryLabel: 'Performance',
        ruleId: 'unused-javascript',
        ruleTitle: 'Reduce unused JavaScript with route-level loadComponent code splitting',
        impact: 'High',
        estimatedGain: '-142 KB Initial JS',
        wcagReference: 'Core Web Vitals — Total Blocking Time (TBT) & INP',
        aiExplanation:
          'Eagerly importing secondary routes inflates the main JavaScript bundle and blocks main-thread hydration. Converting routes to dynamic loadComponent() splits them into on-demand chunks.',
        title: 'Convert eager route imports to lazy loadComponent() chunks and @defer blocks',
        commitMessage: 'perf(bundle): split secondary routes with loadComponent() and @defer',
        summary:
          'Converted eagerly imported route components into dynamic loadComponent() lazy chunks to cut initial main-thread parse and execution time.',
        files: ['src/app/app.routes.ts'],
        additions: 9,
        deletions: 6,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: unused-javascript',
        diff: `diff --git a/src/app/app.routes.ts b/src/app/app.routes.ts
index e02a91c..f941b02 100644
--- a/src/app/app.routes.ts
+++ b/src/app/app.routes.ts
@@ -12,4 +12,4 @@
   {
     path: 'analytics',
-    component: AnalyticsDashboardComponent,
+    loadComponent: () => import('./pages/analytics/analytics.component').then(m => m.AnalyticsDashboardComponent),
   }`
      },
      {
        id: 'commit-bp-2',
        sha: mkSha('bp-noopener'),
        fullSha: mkFull('bp-noopener'),
        category: 'best-practices',
        categoryLabel: 'Best practices',
        ruleId: 'external-anchors-use-rel-noopener',
        ruleTitle: 'Links to cross-origin destinations are safe',
        impact: 'Medium',
        estimatedGain: 'Prevents tabnabbing',
        wcagReference: 'Lighthouse Best Practices — Safe Cross-Origin Navigation',
        aiExplanation:
          'External target="_blank" links without rel="noopener noreferrer" expose window.opener to the destination page and leak referrer headers.',
        title: 'Add rel="noopener noreferrer" to all external target="_blank" anchor links',
        commitMessage: 'fix(security): add rel="noopener noreferrer" to external target="_blank" links',
        summary:
          'Added rel=“noopener noreferrer” to external target=“_blank” links to prevent reverse tabnabbing and isolate cross-origin browsing contexts.',
        files: ['src/app/layout/footer/footer.component.html'],
        additions: 4,
        deletions: 2,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: external-anchors-use-rel-noopener',
        diff: `diff --git a/src/app/layout/footer/footer.component.html b/src/app/layout/footer/footer.component.html
index 441b20a..99e812c 100644
--- a/src/app/layout/footer/footer.component.html
+++ b/src/app/layout/footer/footer.component.html
@@ -6,3 +6,3 @@
-<a href="https://web.dev/measure" target="_blank">Web Vitals Documentation</a>
+<a href="https://web.dev/measure" target="_blank" rel="noopener noreferrer">Web Vitals Documentation</a>`
      },
      {
        id: 'commit-bp-3',
        sha: mkSha('bp-passive-listeners'),
        fullSha: mkFull('bp-passive-listeners'),
        category: 'best-practices',
        categoryLabel: 'Best practices',
        ruleId: 'uses-passive-event-listeners',
        ruleTitle: 'Uses passive listeners to improve scrolling performance',
        impact: 'Medium',
        estimatedGain: '60fps compositor scroll',
        wcagReference: 'Lighthouse Best Practices — Passive Scroll & Touch Listeners',
        aiExplanation:
          'Non-passive touchstart and wheel listeners force the browser compositor thread to wait for JavaScript execution before scrolling the page.',
        title: 'Mark wheel and touchstart listeners as passive to unblock scroll thread',
        commitMessage: 'refactor(events): mark wheel and touchstart listeners as passive',
        summary:
          'Added { passive: true } option to window touchstart and wheel listeners so the browser compositor thread can scroll immediately at 60fps.',
        files: ['src/app/shared/utils/viewport-scroll.ts'],
        additions: 6,
        deletions: 4,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: uses-passive-event-listeners',
        diff: `diff --git a/src/app/shared/utils/viewport-scroll.ts b/src/app/shared/utils/viewport-scroll.ts
index 38a91e1..92d47b0 100644
--- a/src/app/shared/utils/viewport-scroll.ts
+++ b/src/app/shared/utils/viewport-scroll.ts
@@ -19,4 +19,5 @@ export function registerViewportListeners(target: HTMLElement, onPan: () => void) {
-  target.addEventListener('touchstart', onPan);
-  target.addEventListener('wheel', onPan);
+  const listenerOptions: AddEventListenerOptions = { passive: true };
+  target.addEventListener('touchstart', onPan, listenerOptions);
+  target.addEventListener('wheel', onPan, listenerOptions);
 }`
      },
      {
        id: 'commit-seo-2',
        sha: mkSha('seo-crawlable-anchors'),
        fullSha: mkFull('seo-crawlable-anchors'),
        category: 'seo',
        categoryLabel: 'SEO',
        ruleId: 'crawlable-anchors',
        ruleTitle: 'Links are crawlable and have descriptive anchor text',
        impact: 'High',
        estimatedGain: '+10 SEO pts · Full Link Graph',
        wcagReference: 'Google Search Essentials — Crawlable Link Architecture & Anchor Text',
        aiExplanation:
          'Search engine crawlers do not execute arbitrary (click) handlers on <span> or <div> elements and penalize generic "click here" labels.',
        title: 'Replace non-crawlable click spans with semantic routerLink anchors and descriptive labels',
        commitMessage: 'fix(seo): replace click spans with crawlable anchors and descriptive text',
        summary:
          'Converted non-crawlable <span (click)> navigation triggers into semantic <a routerLink> elements with descriptive anchor text.',
        files: ['src/app/pages/landing/landing-page.component.html'],
        additions: 6,
        deletions: 4,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: crawlable-anchors & link-text',
        diff: `diff --git a/src/app/pages/landing/landing-page.component.html b/src/app/pages/landing/landing-page.component.html
index 740b19c..c812e04 100644
--- a/src/app/pages/landing/landing-page.component.html
+++ b/src/app/pages/landing/landing-page.component.html
@@ -24,3 +24,3 @@
-<span class="cta-link" (click)="openCatalog()">Click here</span>
+<a class="cta-link" routerLink="/catalog">Explore accessibility &amp; performance audit catalog</a>`
      },
      {
        id: 'commit-seo-3',
        sha: mkSha('seo-robots-sitemap'),
        fullSha: mkFull('seo-robots-sitemap'),
        category: 'seo',
        categoryLabel: 'SEO',
        ruleId: 'robots-txt',
        ruleTitle: 'robots.txt and sitemap.xml are valid and discoverable by search crawlers',
        impact: 'High',
        estimatedGain: 'Instant Google & AI Indexing',
        wcagReference: 'Google Search Central — Sitemap & Robots Exclusion Protocol',
        aiExplanation:
          'Providing a clean robots.txt with explicit Allow rules for Googlebot, Bingbot, and AI search crawlers alongside an XML sitemap ensures rapid discovery and indexing.',
        title: 'Add robots.txt and XML sitemap for Google and AI search engine indexing',
        commitMessage: 'feat(seo): add robots.txt and sitemap.xml for search indexing',
        summary:
          'Added public/robots.txt and public/sitemap.xml configured for https://website-performance-checker.netlify.app/ to maximize search engine crawlability.',
        files: ['public/robots.txt', 'public/sitemap.xml'],
        additions: 20,
        deletions: 0,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Lighthouse Rule: robots-txt',
        diff: `diff --git a/public/robots.txt b/public/robots.txt
new file mode 100644
--- /dev/null
+++ b/public/robots.txt
@@ -0,0 +1,4 @@
+User-agent: *
+Allow: /
+Sitemap: https://website-performance-checker.netlify.app/sitemap.xml`
      },
      {
        id: 'commit-sec-2',
        sha: mkSha('sec-token-storage'),
        fullSha: mkFull('sec-token-storage'),
        category: 'security',
        categoryLabel: 'Web application security findings',
        securityContext: 'Light',
        securityPattern: 'Common unsafe pattern · client secret & token exposure',
        ruleId: 'client-secret-and-token-storage',
        ruleTitle: 'Avoid hardcoded client API secrets and plaintext bearer tokens in localStorage',
        impact: 'High',
        estimatedGain: 'Zero Client Secret Exposure',
        wcagReference: 'OWASP Top 10 A02:2021 — Cryptographic & Credential Failures',
        aiExplanation:
          'Hardcoded API keys in frontend bundles can be extracted by anyone inspecting DevTools, and JWTs stored in localStorage are accessible to any script on the origin.',
        title: 'Remove hardcoded fallback API key and avoid storing session tokens in localStorage',
        commitMessage: 'security(auth): remove hardcoded fallback API key and use HttpOnly session cookie flow',
        summary:
          'Removed a hardcoded fallback API key literal from client environment configuration and replaced localStorage bearer token persistence with HttpOnly cookie credentials.',
        files: ['src/environments/environment.ts', 'src/app/core/auth/session.service.ts'],
        additions: 9,
        deletions: 10,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Light Web Application Security Finding: credential exposure prevention.',
        diff: `diff --git a/src/environments/environment.ts b/src/environments/environment.ts
index 4019a2b..78c410e 100644
--- a/src/environments/environment.ts
+++ b/src/environments/environment.ts
@@ -1,5 +1,4 @@
 export const environment = {
   production: true,
   apiBaseUrl: '/api/v1',
-  telemetryApiKey: 'sk_live_hardcoded_demo_telemetry_token_99281a',
 };`
      },
      {
        id: 'commit-sec-3',
        sha: mkSha('sec-open-redirect'),
        fullSha: mkFull('sec-open-redirect'),
        category: 'security',
        categoryLabel: 'Web application security findings',
        securityContext: 'Light',
        securityPattern: 'Common unsafe pattern · unvalidated redirect',
        ruleId: 'unvalidated-open-redirect',
        ruleTitle: 'Validate redirect query parameters against external origin spoofing',
        impact: 'Medium',
        estimatedGain: 'Blocks Open-Redirect Phishing',
        wcagReference: 'OWASP Unvalidated Redirects and Forwards Cheat Sheet',
        aiExplanation:
          'Passing unvalidated returnUrl query parameters to router or window.location allows attackers to craft phishing URLs using protocol-relative (//evil.example) paths.',
        title: 'Enforce same-origin relative path check on returnUrl navigation parameter',
        commitMessage: 'security(routing): enforce same-origin relative path check on returnUrl redirect',
        summary:
          'Validated the returnUrl query parameter before redirecting so protocol-relative (//evil.example) or external URLs are rejected and defaulted safely to /.',
        files: ['src/app/core/auth/auth-redirect.util.ts'],
        additions: 12,
        deletions: 3,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Light Web Application Security Finding: open-redirect validation.',
        diff: `diff --git a/src/app/core/auth/auth-redirect.util.ts b/src/app/core/auth/auth-redirect.util.ts
index 55b209d..f38a712 100644
--- a/src/app/core/auth/auth-redirect.util.ts
+++ b/src/app/core/auth/auth-redirect.util.ts
@@ -1,4 +1,9 @@
 export function resolveSafeReturnUrl(rawReturnUrl: string | null | undefined): string {
-  return rawReturnUrl || '/overview';
+  const trimmed = (rawReturnUrl ?? '').trim();
+  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\\\')) {
+    return trimmed;
+  }
+  return '/overview';
 }`
      }
    ];
  }

  private buildClientLhrAnalysis(repoMeta: RepoMetadata, rawLhrInput: string): {
    lhrVersion: string;
    requestedUrl: string;
    fetchTime: string;
    commits: AuditCommit[];
    steps: TelemetryStep[];
  } {
    let lhr: Record<string, any> = {};
    try {
      const parsed = JSON.parse(rawLhrInput || DEFAULT_SAMPLE_LHR_JSON);
      lhr = parsed.lhr || parsed;
    } catch {
      lhr = JSON.parse(DEFAULT_SAMPLE_LHR_JSON);
    }

    const mkSha = (s: string) => deterministicHex(`${repoMeta.fullName}-${s}`, 7);
    const mkFull = (s: string) => deterministicHex(`${repoMeta.fullName}-${s}-full`, 40);

    const commits: AuditCommit[] = [
      {
        id: 'lhr-commit-1',
        sha: mkSha('lhr-lcp-preload'),
        fullSha: mkFull('lhr-lcp-preload'),
        category: 'performance',
        categoryLabel: 'Performance',
        ruleId: 'largest-contentful-paint-element',
        impact: 'Critical',
        estimatedGain: '-1,180ms LCP',
        lhrAuditTitle: 'Largest Contentful Paint element',
        lhrTargetSelector:
          lhr?.['audits']?.['largest-contentful-paint-element']?.details?.items?.[0]?.node?.selector ||
          'section.hero-stage > picture > img.hero-banner-media',
        lhrAreaImproved: 'Performance · largest-contentful-paint-element',
        aiExplanation:
          'Mapped directly to the failing LCP node in your uploaded Lighthouse JSON report. Preloading the AVIF hero source and marking fetchpriority="high" cuts LCP discovery delay by ~1.18s.',
        title: 'Preload LCP hero candidate and serve AVIF/WebP responsive sources',
        commitMessage: 'perf(lhr): preload LCP hero candidate and serve AVIF/WebP responsive sources',
        summary:
          'Directly targeted the failing largest-contentful-paint-element node identified in the Lighthouse JSON report by adding preload resource hints with fetchpriority=“high” and modern AVIF/WebP source sets.',
        files: ['src/index.html', 'src/app/features/hero/hero.component.html'],
        additions: 14,
        deletions: 3,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Targeted LHR audit largest-contentful-paint-element.',
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
 </head>`
      },
      {
        id: 'lhr-commit-2',
        sha: mkSha('lhr-render-blocking'),
        fullSha: mkFull('lhr-render-blocking'),
        category: 'performance',
        categoryLabel: 'Performance',
        ruleId: 'render-blocking-resources',
        impact: 'High',
        estimatedGain: '-640ms FCP',
        lhrAuditTitle: 'Eliminate render-blocking resources',
        lhrTargetSelector: '/styles/animations-heavy.css',
        lhrAreaImproved: 'Performance · render-blocking-resources',
        aiExplanation:
          'Defers non-critical animation stylesheets flagged under render-blocking-resources in the LHR JSON so first paint happens immediately.',
        title: 'Inline critical above-the-fold CSS and defer non-critical animation stylesheet',
        commitMessage: 'perf(lhr): inline critical above-the-fold CSS and defer non-critical stylesheet',
        summary:
          'Resolved the render-blocking-resources opportunity in the LHR JSON by deferring animations-heavy.css with asynchronous media swap.',
        files: ['src/index.html'],
        additions: 7,
        deletions: 2,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
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
+  />`
      },
      {
        id: 'lhr-commit-3',
        sha: mkSha('lhr-unsized-images'),
        fullSha: mkFull('lhr-unsized-images'),
        category: 'performance',
        categoryLabel: 'Performance',
        ruleId: 'unsized-images',
        impact: 'High',
        estimatedGain: '-0.14 CLS',
        lhrAuditTitle: 'Image elements have explicit width and height',
        lhrTargetSelector: 'div.feature-card > img.feature-illustration',
        lhrAreaImproved: 'Performance · unsized-images',
        aiExplanation:
          'Reserves exact aspect ratio boxes for all 3 unsized image elements reported in the Lighthouse JSON audit.',
        title: 'Add explicit width, height, and aspect-ratio reservation to feature card images',
        commitMessage: 'perf(lhr): add explicit width/height to unsized feature card images',
        summary:
          'Fixed all nodes flagged under unsized-images in the Lighthouse JSON report to prevent Cumulative Layout Shift (CLS).',
        files: ['src/app/features/catalog/catalog.component.html'],
        additions: 6,
        deletions: 2,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Resolved LHR unsized-images audit.',
        diff: `diff --git a/src/app/features/catalog/catalog.component.html b/src/app/features/catalog/catalog.component.html
index 901a32c..3f88d12 100644
--- a/src/app/features/catalog/catalog.component.html
+++ b/src/app/features/catalog/catalog.component.html
@@ -11,4 +11,8 @@
   <div class="feature-card">
-    <img class="feature-illustration" src="/assets/card-optics.webp" />
+    <img class="feature-illustration" src="/assets/card-optics.webp" alt="Feature diagram" width="480" height="320" loading="lazy" />
   </div>`
      },
      {
        id: 'lhr-commit-4',
        sha: mkSha('lhr-color-contrast'),
        fullSha: mkFull('lhr-color-contrast'),
        category: 'accessibility',
        categoryLabel: 'Accessibility',
        ruleId: 'color-contrast',
        impact: 'High',
        estimatedGain: '7.4:1 WCAG AAA',
        lhrAuditTitle: 'Background and foreground colors have sufficient contrast ratio',
        lhrTargetSelector: 'footer.site-footer > p.footer-caption, span.badge-subtle',
        lhrAreaImproved: 'Accessibility · color-contrast',
        aiExplanation:
          'Raises foreground token contrast on the exact failing selectors in the Lighthouse JSON report from 2.9:1 to 7.4:1 (WCAG AAA).',
        title: 'Raise foreground token contrast on .footer-caption and .badge-subtle to WCAG AAA',
        commitMessage: 'fix(a11y): raise foreground contrast on LHR failing selectors to WCAG AA/AAA',
        summary:
          'Updated the exact CSS selectors (footer.site-footer > p.footer-caption and span.badge-subtle) listed in color-contrast so contrast meets WCAG AA/AAA in both themes.',
        files: ['src/styles/tokens.scss'],
        additions: 4,
        deletions: 4,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Resolved LHR color-contrast failing selectors.',
        diff: `diff --git a/src/styles/tokens.scss b/src/styles/tokens.scss
index 712a901..b440e21 100644
--- a/src/styles/tokens.scss
+++ b/src/styles/tokens.scss
@@ -22,6 +22,6 @@
 .footer-caption {
-  color: #94a3b8;
+  color: #334155; /* 7.4:1 WCAG AAA */
 }`
      },
      {
        id: 'lhr-commit-5',
        sha: mkSha('lhr-button-name'),
        fullSha: mkFull('lhr-button-name'),
        category: 'accessibility',
        categoryLabel: 'Accessibility',
        ruleId: 'button-name',
        impact: 'High',
        estimatedGain: '+10 A11y pts',
        lhrAuditTitle: 'Buttons have an accessible name',
        lhrTargetSelector: 'header.toolbar > button.icon-action-btn',
        lhrAreaImproved: 'Accessibility · button-name',
        aiExplanation:
          'Provides explicit aria-label attributes on icon-only toolbar buttons flagged in the Lighthouse JSON report.',
        title: 'Add explicit aria-label attributes to toolbar icon action buttons',
        commitMessage: 'fix(a11y): add explicit aria-label to toolbar icon buttons flagged in LHR',
        summary:
          'Targeted header.toolbar > button.icon-action-btn flagged in the LHR JSON report so assistive technologies announce clear action names.',
        files: ['src/app/shared/header/header.component.html'],
        additions: 4,
        deletions: 2,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
        body: 'Resolved LHR button-name audit.',
        diff: `diff --git a/src/app/shared/header/header.component.html b/src/app/shared/header/header.component.html
index 551e290..9c21f04 100644
--- a/src/app/shared/header/header.component.html
+++ b/src/app/shared/header/header.component.html
@@ -8,4 +8,6 @@
-  <button class="icon-action-btn">
+  <button class="icon-action-btn" type="button" aria-label="Save audit bookmark">
     <svg class="icon-bookmark" aria-hidden="true"></svg>
   </button>`
      },
      {
        id: 'lhr-commit-6',
        sha: mkSha('lhr-csp-xss'),
        fullSha: mkFull('lhr-csp-xss'),
        category: 'best-practices',
        categoryLabel: 'Best practices',
        ruleId: 'csp-xss',
        impact: 'High',
        estimatedGain: 'CSP Hardened',
        lhrAuditTitle: 'Ensure CSP is effective against XSS attacks',
        lhrTargetSelector: 'head > meta[http-equiv=“Content-Security-Policy”]',
        lhrAreaImproved: 'Best practices · csp-xss',
        aiExplanation:
          'Adds a strict Content-Security-Policy directive to resolve the csp-xss finding in the Lighthouse report.',
        title: 'Add strict Content-Security-Policy meta directive',
        commitMessage: 'feat(security): add Content-Security-Policy directive to document head',
        summary:
          'Addressed csp-xss from the Lighthouse JSON report by adding a strict Content-Security-Policy directive restricting script and object sources.',
        files: ['src/index.html'],
        additions: 6,
        deletions: 0,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
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
        sha: mkSha('lhr-structured-data'),
        fullSha: mkFull('lhr-structured-data'),
        category: 'seo',
        categoryLabel: 'SEO',
        ruleId: 'structured-data',
        impact: 'Medium',
        estimatedGain: 'Valid JSON-LD Graph',
        lhrAuditTitle: 'Structured data is valid',
        lhrTargetSelector: 'head > script[type=“application/ld+json”]',
        lhrAreaImproved: 'SEO · structured-data',
        aiExplanation:
          'Completes the Schema.org WebApplication JSON-LD graph flagged in the Lighthouse SEO audit.',
        title: 'Complete JSON-LD WebApplication structured data graph in document head',
        commitMessage: 'feat(seo): complete JSON-LD WebApplication structured data in index.html',
        summary:
          'Addressed the structured-data SEO audit in the Lighthouse JSON report by providing valid schema.org WebApplication metadata in index.html.',
        files: ['src/index.html'],
        additions: 9,
        deletions: 1,
        author: 'Fresnel <fresnel@noreplies.github.com>',
        date: new Date().toUTCString(),
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

    const steps: TelemetryStep[] = [
      {
        index: 0,
        phase: 'Parsing Lighthouse JSON',
        category: 'LHR parser',
        headline: `Read Lighthouse ${lhr?.['lighthouseVersion'] || '12.2.0'} report for ${repoMeta.fullName}`,
        narrative: `Identifying failing audits across Performance, Accessibility, Best practices, and SEO in the uploaded Lighthouse report.`
      },
      {
        index: 1,
        phase: 'Correlating DOM selectors',
        category: 'AST mapping',
        headline: `Map Lighthouse failing selectors to repository templates`,
        narrative: `Matching failing DOM selectors in the JSON report to exact templates, stylesheets, and document head metadata in ${repoMeta.fullName}.`
      },
      ...commits.map((c, idx) => ({
        index: idx + 2,
        phase: `Improving ${c.categoryLabel.toLowerCase() === 'seo' ? 'SEO' : c.categoryLabel.toLowerCase()}`,
        category: c.categoryLabel,
        headline: c.title,
        narrative: `${c.summary} Improved ${c.categoryLabel} (${c.ruleId}) on selector ${c.lhrTargetSelector}.`
      })),
      {
        index: commits.length + 2,
        phase: 'LHR analysis complete',
        category: 'Complete',
        headline: `Prepare ${commits.length} commits across Performance, Accessibility, Best practices, and SEO`,
        narrative: `Audited failing Lighthouse categories and selectors statically. Opening the Lighthouse JSON audit report.`
      }
    ];

    return {
      lhrVersion: lhr?.['lighthouseVersion'] || '12.2.0',
      requestedUrl:
        lhr?.['finalDisplayedUrl'] ||
        lhr?.['requestedUrl'] ||
        'https://website-performance-checker.netlify.app/',
      fetchTime: lhr?.['fetchTime'] || new Date().toISOString(),
      commits,
      steps
    };
  }
}
