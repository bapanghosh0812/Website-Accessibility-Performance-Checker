/**
 * Fresnel — Multi-Flow Application Controller (Run 1 Static Audit + Run 2 Lighthouse JSON Audit)
 */

const SAMPLE_LHR_STRING = JSON.stringify(
  {
    lighthouseVersion: '12.2.0',
    fetchTime: '2026-10-06T13:35:00.000Z',
    requestedUrl: 'https://lumina-web.app/',
    finalDisplayedUrl: 'https://lumina-web.app/',
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
        metricSavings: { LCP: 1180 }
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

const state = {
  step: 1,
  mode: 'live',
  runPhase: 'static',
  theme: localStorage.getItem('fresnel-theme') || 'light',
  sessionId: null,
  session: null,
  pollTimer: null,
  selectedIds: new Set(),
  expandedDiffIds: new Set(),
  categoryFilter: 'all',
  renderedJournalCount: 0,
  lastHeadline: '',
  patchCache: null,
  prData: null,
  prCliMode: 'inline'
};

const htmlEl = document.documentElement;
const navBackBtn = document.getElementById('nav-back-btn');
const stepCounterLabel = document.getElementById('step-counter-label');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

const views = {
  1: document.getElementById('view-1'),
  2: document.getElementById('view-2'),
  3: document.getElementById('view-3'),
  4: document.getElementById('view-4'),
  5: document.getElementById('view-5')
};

// Step 1
const repoForm = document.getElementById('repo-form');
const repoUrlInput = document.getElementById('repo-url-input');
const startDemoBtn = document.getElementById('start-demo-btn');

// Step 2
const processPhaseLabel = document.getElementById('process-phase-label');
const processRepoLabel = document.getElementById('process-repo-label');
const narrativeHeroBlock = document.getElementById('narrative-hero-block');
const processLiveHeadline = document.getElementById('process-live-headline');
const processLiveBody = document.getElementById('process-live-body');
const processProgressFill = document.getElementById('process-progress-fill');
const processStepRatio = document.getElementById('process-step-ratio');
const skipToReportBtn = document.getElementById('skip-to-report-btn');
const narrativeJournalList = document.getElementById('narrative-journal-list');

// Step 3
const reportRepoPill = document.getElementById('report-repo-pill');
const reportHeading = document.getElementById('report-heading');
const reportSubtitle = document.getElementById('report-subtitle');
const reportCategoriesImproved = document.getElementById('report-categories-improved');
const categoriesImprovedGrid = document.getElementById('categories-improved-grid');
const secondRunBanner = document.getElementById('second-run-banner');
const openLhrStepBtn = document.getElementById('open-lhr-step-btn');
const catPills = document.querySelectorAll('[data-cat-filter]');
const selectAllBtn = document.getElementById('select-all-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const reportCommitsList = document.getElementById('report-commits-list');
const selectedCountNum = document.getElementById('selected-count-num');
const togglePatchGuideBtn = document.getElementById('toggle-patch-guide-btn');
const patchGuideCard = document.getElementById('patch-guide-card');
const copyRawPatchBtn = document.getElementById('copy-raw-patch-btn');
const downloadPatchFileBtn = document.getElementById('download-patch-file-btn');
const createPrFlowBtn = document.getElementById('create-pr-flow-btn');
const createPrBtnText = document.getElementById('create-pr-btn-text');

// Step 4
const prDoneSubtitle = document.getElementById('pr-done-subtitle');
const prCliTabInline = document.getElementById('pr-cli-tab-inline');
const prCliTabShort = document.getElementById('pr-cli-tab-short');
const copyPrCliBtn = document.getElementById('copy-pr-cli-btn');
const copyPrCliBtnText = document.getElementById('copy-pr-cli-btn-text');
const prCliCommandCode = document.getElementById('pr-cli-command-code');
const prFinalBranch = document.getElementById('pr-final-branch');
const prFinalUrl = document.getElementById('pr-final-url');
const prFinalLink = document.getElementById('pr-final-link');
const prFinalCommitCount = document.getElementById('pr-final-commit-count');
const prFinalCommitList = document.getElementById('pr-final-commit-list');
const prNextRunBox = document.getElementById('pr-next-run-box');
const prOpenLhrBtn = document.getElementById('pr-open-lhr-btn');
const prBackToReportBtn = document.getElementById('pr-back-to-report-btn');
const prDownloadPatchBtn = document.getElementById('pr-download-patch-btn');
const startNewAuditBtn = document.getElementById('start-new-audit-btn');

// Step 5 (Run 2: LHR JSON Input)
const lhrForm = document.getElementById('lhr-form');
const lhrFileInput = document.getElementById('lhr-file-input');
const loadSampleLhrBtn = document.getElementById('load-sample-lhr-btn');
const lhrFilePill = document.getElementById('lhr-file-pill');
const lhrJsonTextarea = document.getElementById('lhr-json-textarea');

function setTheme(theme) {
  state.theme = theme;
  htmlEl.setAttribute('data-theme', theme);
  localStorage.setItem('fresnel-theme', theme);
}

setTheme(state.theme);

themeToggleBtn.addEventListener('click', () => {
  setTheme(state.theme === 'light' ? 'dark' : 'light');
});

function updateStepCounterLabel(viewNum) {
  if (state.runPhase === 'lhr') {
    if (viewNum === 5) stepCounterLabel.textContent = 'Run 2 (LHR JSON) · Step 1 / 3';
    else if (viewNum === 2) stepCounterLabel.textContent = 'Run 2 (LHR JSON) · Step 2 / 3';
    else stepCounterLabel.textContent = 'Run 2 (LHR JSON) · Step 3 / 3';
  } else {
    stepCounterLabel.textContent = `Run 1 · Step ${viewNum} / 4`;
  }
}

function goToStep(nextStep) {
  const prevStep = state.step;
  if (prevStep === nextStep) return;

  const currentEl = views[prevStep];
  const nextEl = views[nextStep];

  state.step = nextStep;
  updateStepCounterLabel(nextStep);
  navBackBtn.hidden = nextStep === 1;

  if (currentEl) {
    currentEl.classList.remove('is-active');
    currentEl.classList.add('is-exiting');
  }

  setTimeout(() => {
    Object.entries(views).forEach(([k, el]) => {
      const num = Number(k);
      if (num !== nextStep) {
        el.hidden = true;
        el.classList.remove('is-active', 'is-exiting');
      }
    });

    nextEl.hidden = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nextEl.classList.add('is-active');
      });
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 240);
}

navBackBtn.addEventListener('click', () => {
  if (state.step === 2) {
    stopPolling();
    goToStep(state.runPhase === 'lhr' ? 5 : 1);
  } else if (state.step === 3) {
    goToStep(state.runPhase === 'lhr' ? 5 : 1);
  } else if (state.step === 4) {
    goToStep(3);
  } else if (state.step === 5) {
    state.runPhase = 'static';
    goToStep(3);
  }
});

repoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const repoUrl =
    repoUrlInput.value.trim() || 'https://github.com/fresnel-sandbox/lumina-web-app';
  await startAudit(repoUrl, 'live');
});

startDemoBtn.addEventListener('click', async () => {
  repoUrlInput.value = 'https://github.com/fresnel-sandbox/lumina-web-app';
  await startAudit('https://github.com/fresnel-sandbox/lumina-web-app', 'demo');
});

async function startAudit(repoUrl, mode = 'live') {
  stopPolling();
  state.mode = mode;
  state.runPhase = 'static';
  state.renderedJournalCount = 0;
  state.lastHeadline = '';
  narrativeJournalList.innerHTML = '';

  const res = await fetch('/api/audit/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repoUrl,
      mode,
      branch: 'main',
      categories: ['performance', 'accessibility', 'best-practices', 'seo', 'security']
    })
  });

  const data = await res.json();
  state.sessionId = data.id;
  state.session = data;

  processRepoLabel.textContent = data.repo.fullName;
  updateNarrativeView(data);
  goToStep(2);

  state.pollTimer = setInterval(pollStatus, 700);
}

function openLighthouseJsonStep() {
  state.runPhase = 'lhr';
  patchGuideCard.hidden = true;
  if (!lhrJsonTextarea.value.trim()) {
    lhrJsonTextarea.value = SAMPLE_LHR_STRING;
    lhrFilePill.textContent = 'Loaded: lighthouse-report-lhr.json (sample LHR)';
    lhrFilePill.hidden = false;
  }
  goToStep(5);
}

openLhrStepBtn.addEventListener('click', openLighthouseJsonStep);
prOpenLhrBtn.addEventListener('click', openLighthouseJsonStep);

loadSampleLhrBtn.addEventListener('click', () => {
  lhrJsonTextarea.value = SAMPLE_LHR_STRING;
  lhrFilePill.textContent = 'Loaded: lighthouse-report-lhr.json (sample LHR)';
  lhrFilePill.hidden = false;
});

lhrFileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  lhrFilePill.textContent = `Loaded: ${file.name}`;
  lhrFilePill.hidden = false;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      lhrJsonTextarea.value = reader.result;
    }
  };
  reader.readAsText(file);
});

lhrForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  stopPolling();
  state.runPhase = 'lhr';
  state.renderedJournalCount = 0;
  state.lastHeadline = '';
  narrativeJournalList.innerHTML = '';

  const currentId = state.sessionId || 'demo';
  const res = await fetch(`/api/audit/${currentId}/lhr-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lhrJson: lhrJsonTextarea.value.trim() || SAMPLE_LHR_STRING
    })
  });

  const data = await res.json();
  state.sessionId = data.id;
  state.session = data;

  processRepoLabel.textContent = data.repo.fullName;
  updateNarrativeView(data);
  goToStep(2);

  state.pollTimer = setInterval(pollStatus, 700);
});

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

async function pollStatus() {
  if (!state.sessionId) return;
  try {
    const res = await fetch(`/api/audit/${state.sessionId}/status`);
    if (!res.ok) {
      if (res.status === 404) stopPolling();
      return;
    }
    const data = await res.json();
    state.session = data;
    updateNarrativeView(data);

    if (data.status === 'completed') {
      stopPolling();
      setTimeout(() => {
        if (state.step === 2) {
          prepareReportView(data);
          goToStep(3);
        }
      }, 650);
    }
  } catch (err) {
    stopPolling();
    console.error('Status poll error:', err instanceof Error ? err : new Error(String(err)));
  }
}

const CLIENT_VERB_TABLE = [
  ['read', 'reads', 'read', 'reading'],
  ['inspect', 'inspects', 'inspected', 'inspecting'],
  ['scan', 'scans', 'scanned', 'scanning'],
  ['analyze', 'analyzes', 'analyzed', 'analyzing'],
  ['map', 'maps', 'mapped', 'mapping'],
  ['prepare', 'prepares', 'prepared', 'preparing'],
  ['review', 'reviews', 'reviewed', 'reviewing'],
  ['audit', 'audits', 'audited', 'auditing'],
  ['trace', 'traces', 'traced', 'tracing'],
  ['load', 'loads', 'loaded', 'loading'],
  ['identify', 'identifies', 'identified', 'identifying'],
  ['match', 'matches', 'matched', 'matching'],
  ['correlate', 'correlates', 'correlated', 'correlating'],
  ['connect', 'connects', 'connected', 'connecting'],
  ['check', 'checks', 'checked', 'checking'],
  ['verify', 'verifies', 'verified', 'verifying'],
  ['validate', 'validates', 'validated', 'validating'],
  ['add', 'adds', 'added', 'adding'],
  ['replace', 'replaces', 'replaced', 'replacing'],
  ['update', 'updates', 'updated', 'updating'],
  ['fix', 'fixes', 'fixed', 'fixing'],
  ['remove', 'removes', 'removed', 'removing'],
  ['enforce', 'enforces', 'enforced', 'enforcing'],
  ['mark', 'marks', 'marked', 'marking'],
  ['inline', 'inlines', 'inlined', 'inlining'],
  ['preload', 'preloads', 'preloaded', 'preloading'],
  ['raise', 'raises', 'raised', 'raising'],
  ['complete', 'completes', 'completed', 'completing'],
  ['convert', 'converts', 'converted', 'converting'],
  ['declare', 'declares', 'declared', 'declaring'],
  ['embed', 'embeds', 'embedded', 'embedding'],
  ['target', 'targets', 'targeted', 'targeting'],
  ['resolve', 'resolves', 'resolved', 'resolving'],
  ['address', 'addresses', 'addressed', 'addressing'],
  ['improve', 'improves', 'improved', 'improving'],
  ['harden', 'hardens', 'hardened', 'hardening'],
  ['sanitize', 'sanitizes', 'sanitized', 'sanitizing'],
  ['extract', 'extracts', 'extracted', 'extracting'],
  ['parse', 'parses', 'parsed', 'parsing'],
  ['build', 'builds', 'built', 'building'],
  ['generate', 'generates', 'generated', 'generating'],
  ['create', 'creates', 'created', 'creating'],
  ['apply', 'applies', 'applied', 'applying'],
  ['defer', 'defers', 'deferred', 'deferring'],
  ['prioritize', 'prioritizes', 'prioritized', 'prioritizing'],
  ['eliminate', 'eliminates', 'eliminated', 'eliminating'],
  ['prevent', 'prevents', 'prevented', 'preventing'],
  ['ensure', 'ensures', 'ensured', 'ensuring'],
  ['provide', 'provides', 'provided', 'providing'],
  ['use', 'uses', 'used', 'using'],
  ['set', 'sets', 'set', 'setting'],
  ['configure', 'configures', 'configured', 'configuring'],
  ['optimize', 'optimizes', 'optimized', 'optimizing'],
  ['refactor', 'refactors', 'refactored', 'refactoring'],
  ['reserve', 'reserves', 'reserved', 'reserving'],
  ['upgrade', 'upgrades', 'upgraded', 'upgrading'],
  ['open', 'opens', 'opened', 'opening'],
  ['serve', 'serves', 'served', 'serving'],
  ['swap', 'swaps', 'swapped', 'swapping'],
  ['synthesize', 'synthesizes', 'synthesized', 'synthesizing'],
  ['clone', 'clones', 'cloned', 'cloning'],
  ['classify', 'classifies', 'classified', 'classifying'],
  ['clear', 'clears', 'cleared', 'clearing'],
  ['close', 'closes', 'closed', 'closing']
];

const CLIENT_IMPERATIVE_MAP = new Map();
const CLIENT_PAST_MAP = new Map();
const CLIENT_ING_MAP = new Map();

for (const [base, third, past, ing] of CLIENT_VERB_TABLE) {
  CLIENT_IMPERATIVE_MAP.set(base, base);
  CLIENT_IMPERATIVE_MAP.set(third, base);
  CLIENT_IMPERATIVE_MAP.set(past, base);
  CLIENT_IMPERATIVE_MAP.set(ing, base);

  CLIENT_PAST_MAP.set(base, past);
  CLIENT_PAST_MAP.set(third, past);
  CLIENT_PAST_MAP.set(past, past);
  CLIENT_PAST_MAP.set(ing, past);

  CLIENT_ING_MAP.set(base, ing);
  CLIENT_ING_MAP.set(third, ing);
  CLIENT_ING_MAP.set(past, ing);
  CLIENT_ING_MAP.set(ing, ing);
}

function formatPlainText(rawText) {
  if (typeof rawText !== 'string' || !rawText) return '';
  return rawText
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*+/g, '')
    .replace(/__+/g, '')
    .replace(/`+/g, '')
    .replace(/(^|\s)\*+(\S)/g, '$1$2')
    .replace(/(\S)\*+(\s|$|[.,!?;:])/g, '$1$2')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\b(?:powered\s+by|using|via|on|in)\s+(?:GCP\s+project\s+)?(?:Gemini\s*4\s*Argon(?:\s*EAP)?|gemini-4-argon|gemini-3\.8-flash|antigravity-[a-zA-Z0-9._-]+|phantom-gdemo-1)\b/gi, '')
    .replace(/\bGemini\s*4\s*Argon(?:\s*EAP)?\b/gi, '')
    .replace(/\b(?:gemini-4-argon|gemini-3\.8-flash)\b/gi, '')
    .replace(/\bantigravity-[a-zA-Z0-9._-]+\b/gi, '')
    .replace(/\bphantom-gdemo-1\b/gi, '')
    .replace(/\binteractions\/[a-zA-Z0-9._-]+\b/gi, '')
    .replace(/\/v1beta\/interactions\b/gi, '')
    .replace(/\b\.?agents\/AGENTS\.md\b/gi, '')
    .replace(/\bAGENTS\.md\b/gi, '')
    .replace(/\/workspace\/[a-zA-Z0-9._-]+\//g, '')
    .replace(/\/workspace\b/g, 'the repository')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+(?:using|on|via|with)\s*(?=[.,!?;:]|$)/gi, '')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/@import\s+font\s+stylesheets\b/gi, '@import stylesheets')
    .replace(/\bwith\s+display=swap\b/gi, 'with font-display:swap')
    .replace(/([a-z0-9%"'’”\]}>])([.!?])(["'‘“(\[{]*[A-Z])/g, '$1$2 $3')
    .replace(/([A-Z]{2,})([.!?])(["'‘“(\[{]*[A-Z])/g, '$1$2 $3')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatImperativeHeadline(rawText) {
  let text = formatPlainText(rawText);
  if (!text) return '';
  text = text.replace(
    /^([A-Za-z]+)(\b)/,
    (_, firstWord, sep) => {
      const lower = firstWord.toLowerCase();
      if (CLIENT_IMPERATIVE_MAP.has(lower)) {
        const base = CLIENT_IMPERATIVE_MAP.get(lower);
        return `${base.charAt(0).toUpperCase() + base.slice(1)}${sep}`;
      }
      return `${firstWord}${sep}`;
    }
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDetailTense(rawText) {
  const cleaned = formatPlainText(rawText);
  if (!cleaned) return '';
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences
    .map((sentence) => {
      let s = sentence.replace(
        /^(?:(Directly|Automatically|Statically|Explicitly|Safely|Cleanly)\s+)?([A-Za-z]+)(\b)/,
        (full, adverb, verbWord, sep) => {
          const lower = verbWord.toLowerCase();
          if (!CLIENT_PAST_MAP.has(lower)) return full;
          if (
            CLIENT_ING_MAP.get(lower) === lower ||
            (CLIENT_PAST_MAP.get(lower) === lower && lower !== CLIENT_IMPERATIVE_MAP.get(lower))
          ) {
            return full;
          }
          const past = CLIENT_PAST_MAP.get(lower);
          if (adverb) {
            return `${adverb.charAt(0).toUpperCase() + adverb.slice(1)} ${past}${sep}`;
          }
          return `${past.charAt(0).toUpperCase() + past.slice(1)}${sep}`;
        }
      );

      const firstWordMatch = s.match(/^(?:(?:Directly|Automatically|Statically|Explicitly|Safely|Cleanly)\s+)?([A-Za-z]+)\b/);
      const firstLower = firstWordMatch ? firstWordMatch[1].toLowerCase() : '';
      const isIng = CLIENT_ING_MAP.get(firstLower) === firstLower;

      s = s.replace(/(\band\s+|,\s+)([a-z]+)\b/g, (full, prefix, word) => {
        const lower = word.toLowerCase();
        for (const [, third, past, ing] of CLIENT_VERB_TABLE) {
          if (lower === third) {
            return `${prefix}${isIng ? ing : past}`;
          }
        }
        return full;
      });

      return s.charAt(0).toUpperCase() + s.slice(1);
    })
    .join(' ');
}

function shortenCompleteSentences(rawText, maxChars = 220) {
  const cleaned = formatDetailTense(rawText);
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

function updateNarrativeView(data) {
  const repoName = data.repo?.fullName || 'repository';
  processStepRatio.textContent =
    data.runPhase === 'lhr'
      ? `Analyzing Lighthouse report for ${repoName}`
      : `Inspecting ${repoName}`;

  const isDemoMode = data.mode === 'demo' || state.mode === 'demo';
  if (skipToReportBtn) {
    skipToReportBtn.hidden = !isDemoMode;
  }

  const step = data.currentStep;
  const cleanHeadline = formatImperativeHeadline(step?.headline || '');
  const cleanNarrative = shortenCompleteSentences(step?.narrative || '', 240);
  const cleanPhase = formatPlainText(step?.phase || 'Auditing code');

  if (step && cleanHeadline && cleanHeadline !== state.lastHeadline) {
    state.lastHeadline = cleanHeadline;
    narrativeHeroBlock.classList.add('is-Transitioning');
    setTimeout(() => {
      processPhaseLabel.textContent = cleanPhase;
      processLiveHeadline.textContent = cleanHeadline;
      processLiveBody.textContent = cleanNarrative;
      narrativeHeroBlock.classList.remove('is-Transitioning');
    }, 150);
  }

  const steps = data.steps || [];
  for (let i = state.renderedJournalCount; i < steps.length; i++) {
    const item = steps[i];
    const itemCat = formatPlainText(item.category || 'Code inspection');
    const itemHeadline = formatImperativeHeadline(item.headline || '');
    const itemNarrative = shortenCompleteSentences(item.narrative || '', 240);
    const li = document.createElement('li');
    li.className = 'journal-item';
    li.innerHTML = `
      <span class="journal-item__cat">${escapeHtml(itemCat)}</span>
      <div>
        <h3 class="journal-item__title">${escapeHtml(itemHeadline)}</h3>
        <p class="journal-item__desc">${escapeHtml(itemNarrative)}</p>
      </div>
    `;
    narrativeJournalList.prepend(li);
  }
  state.renderedJournalCount = steps.length;
}

skipToReportBtn.addEventListener('click', async () => {
  if (!state.sessionId) return;
  if (state.mode !== 'demo' && state.session?.mode !== 'demo') return;
  stopPolling();
  const res = await fetch(`/api/audit/${state.sessionId}/fast-forward`, { method: 'POST' });
  const data = await res.json();
  state.session = data;
  prepareReportView(data);
  goToStep(3);
});

function renderCategoriesImproved(data) {
  if (!reportCategoriesImproved || !categoriesImprovedGrid) return;
  const commits = data.commits || [];
  const isLhr = data.runPhase === 'lhr';

  const categoriesToDisplay = [
    { id: 'performance', label: 'Performance' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'best-practices', label: 'Best practices' },
    { id: 'seo', label: 'SEO' },
    ...(isLhr
      ? []
      : [{ id: 'security', label: 'Web application security findings (light)' }])
  ];

  const items = categoriesToDisplay
    .map((cat) => {
      const count = commits.filter((c) => c.category === cat.id).length;
      return { ...cat, count };
    })
    .filter((cat) => cat.count > 0);

  if (items.length === 0) {
    reportCategoriesImproved.hidden = true;
    return;
  }

  reportCategoriesImproved.hidden = false;
  categoriesImprovedGrid.innerHTML = items
    .map(
      (item) => `
      <div class="category-improved-card">
        <div class="category-improved-card__top">
          <span class="category-improved-card__check" aria-hidden="true">✓</span>
          <span class="category-improved-card__name">${escapeHtml(item.label)}</span>
        </div>
        <span class="category-improved-card__meta">Improved with code · ${item.count} ${
          item.count === 1 ? 'commit' : 'commits'
        }</span>
      </div>
    `
    )
    .join('');
}

function prepareReportView(data) {
  const isLhr = data.runPhase === 'lhr';
  state.runPhase = isLhr ? 'lhr' : 'static';

  reportRepoPill.textContent = data.repo.fullName;
  reportHeading.textContent = isLhr ? 'Lighthouse JSON audit report' : 'Code audit report';
  reportSubtitle.textContent = isLhr
    ? 'Targeted code commits mapped directly to failing audits and DOM selectors in your Lighthouse Result (LHR) JSON report.'
    : 'Select the static code commits you would like to include in a pull request, download as a patch, or continue to a second run with a Lighthouse JSON report.';

  renderCategoriesImproved(data);

  secondRunBanner.hidden = isLhr;

  // Exclude Web Application security findings when doing Lighthouse specifically (Run 2)
  const pillSecurityBtn = document.getElementById('pill-btn-security');
  if (pillSecurityBtn) {
    pillSecurityBtn.hidden = isLhr;
  }

  state.selectedIds = new Set(data.commits.map((c) => c.id));
  state.expandedDiffIds = new Set([data.commits[0]?.id]);
  state.categoryFilter = 'all';
  patchGuideCard.hidden = true;

  document.getElementById('pill-count-all').textContent = data.commits.length;
  for (const cat of ['performance', 'accessibility', 'best-practices', 'seo', 'security']) {
    const count = data.commits.filter((c) => c.category === cat).length;
    const el = document.getElementById(`pill-count-${cat}`);
    if (el) el.textContent = count;
  }

  renderCategoryPills();
  renderReportCommits();
  updateActionFooter();
  void refreshPatchInstructions();
}

catPills.forEach((pill) => {
  pill.addEventListener('click', () => {
    state.categoryFilter = pill.getAttribute('data-cat-filter');
    renderCategoryPills();
    renderReportCommits();
  });
});

function renderCategoryPills() {
  catPills.forEach((pill) => {
    const active = pill.getAttribute('data-cat-filter') === state.categoryFilter;
    pill.classList.toggle('is-active', active);
    pill.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const secNote = document.getElementById('security-context-note');
  if (secNote) {
    secNote.hidden = !(state.runPhase === 'static' && state.categoryFilter === 'security');
  }
}

function renderReportCommits() {
  const allCommits = state.session?.commits || [];
  const isLhr = state.session?.runPhase === 'lhr';
  const visible =
    state.categoryFilter === 'all'
      ? allCommits
      : allCommits.filter((c) => c.category === state.categoryFilter);

  reportCommitsList.innerHTML = '';

  visible.forEach((commit, idx) => {
    const isSelected = state.selectedIds.has(commit.id);
    const isDiffOpen = state.expandedDiffIds.has(commit.id);
    const numStr = String(idx + 1).padStart(2, '0');

    const card = document.createElement('article');
    card.className = `commit-card ${!isSelected ? 'is-unchecked' : ''}`;

    const diffHtml = isDiffOpen
      ? `<div class="commit-diff-drawer">${formatUnifiedDiff(commit.diff)}</div>`
      : '';

    const lhrBoxHtml =
      isLhr && commit.lhrAreaImproved
        ? `
          <div class="lhr-target-box">
            <div class="lhr-target-row">
              <span class="lhr-target-key">Category &amp; audit improved:</span>
              <code>${escapeHtml(commit.lhrAreaImproved)}</code>
            </div>
            ${
              commit.lhrTargetSelector
                ? `<div class="lhr-target-row">
                    <span class="lhr-target-key">JSON target node:</span>
                    <code>${escapeHtml(commit.lhrTargetSelector)}</code>
                  </div>`
                : ''
            }
          </div>
        `
        : '';

    const securityContextHtml = commit.securityContext
      ? `<span class="security-light-badge">${escapeHtml(commit.securityContext)}</span>`
      : '';

    const securityPatternHtml = commit.securityPattern
      ? `<span class="commit-pattern-tag">${escapeHtml(commit.securityPattern)}</span>`
      : '';

    card.innerHTML = `
      <div class="commit-card__main">
        <div class="commit-card__content">
          <div class="commit-card__eyebrow">
            <span class="commit-index">${numStr}</span>
            <span class="commit-cat-badge">${escapeHtml(commit.categoryLabel)}</span>
            ${securityContextHtml}
            <span class="commit-sha-pill">${escapeHtml(commit.sha)}</span>
            ${securityPatternHtml}
          </div>

          <h2 class="commit-card__title">${escapeHtml(formatImperativeHeadline(commit.title))}</h2>
          <p class="commit-card__summary">${escapeHtml(formatDetailTense(commit.summary))}</p>
          ${lhrBoxHtml}

          <div class="commit-card__footer">
            <button type="button" class="diff-toggle-btn" data-toggle-diff="${commit.id}">
              ${isDiffOpen ? 'Hide diff' : 'View diff'}
            </button>
            <span class="commit-files-text">
              ${escapeHtml(commit.files.join(', '))}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="friendly-check-btn ${isSelected ? 'is-checked' : ''}"
          data-toggle-select="${commit.id}"
          role="checkbox"
          aria-checked="${isSelected ? 'true' : 'false'}"
          aria-label="Include ${escapeHtml(commit.title)}"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M4.5 10.5l3.8 3.8 7.2-7.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      ${diffHtml}
    `;

    card.querySelector('[data-toggle-select]').addEventListener('click', () => {
      if (state.selectedIds.has(commit.id)) {
        state.selectedIds.delete(commit.id);
      } else {
        state.selectedIds.add(commit.id);
      }
      renderReportCommits();
      updateActionFooter();
      void refreshPatchInstructions();
    });

    card.querySelector('[data-toggle-diff]').addEventListener('click', () => {
      if (state.expandedDiffIds.has(commit.id)) {
        state.expandedDiffIds.delete(commit.id);
      } else {
        state.expandedDiffIds.add(commit.id);
      }
      renderReportCommits();
    });

    reportCommitsList.appendChild(card);
  });
}

function formatUnifiedDiff(diffText) {
  return diffText
    .split('\n')
    .map((line) => {
      let cls = 'diff-line';
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ')
      ) {
        cls += ' diff-line--meta';
      } else if (line.startsWith('@@')) {
        cls += ' diff-line--hunk';
      } else if (line.startsWith('+')) {
        cls += ' diff-line--add';
      } else if (line.startsWith('-')) {
        cls += ' diff-line--del';
      }
      return `<div class="${cls}">${escapeHtml(line)}</div>`;
    })
    .join('');
}

function updateActionFooter() {
  const total = state.session?.commits?.length || 0;
  const count = state.selectedIds.size;
  selectedCountNum.textContent = `${count} of ${total}`;
  createPrBtnText.textContent = `Create pull request`;
  createPrFlowBtn.disabled = count === 0;
}

selectAllBtn.addEventListener('click', () => {
  (state.session?.commits || []).forEach((c) => state.selectedIds.add(c.id));
  renderReportCommits();
  updateActionFooter();
  void refreshPatchInstructions();
});

clearAllBtn.addEventListener('click', () => {
  state.selectedIds.clear();
  renderReportCommits();
  updateActionFooter();
  void refreshPatchInstructions();
});

function buildClientFallbackPatch() {
  const commits = (state.session?.commits || []).filter((c) => state.selectedIds.has(c.id));
  const suffix = state.session?.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';
  const filename = `fresnel-${state.session?.repo?.repo || 'repository'}-${suffix}.patch`;
  const total = commits.length;
  if (total === 0) {
    return { filename, patchContent: '# No commits selected\n' };
  }
  const patchContent = commits
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
  return { filename, patchContent };
}

async function refreshPatchInstructions() {
  if (!state.sessionId) return;
  const res = await fetch(`/api/audit/${state.sessionId}/patch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedCommitIds: Array.from(state.selectedIds) })
  });
  const payload = await res.json();
  state.patchCache = payload;

  document.getElementById('cmd-step-1').textContent = payload.instructions.branchCmd;
  document.getElementById('cmd-step-2').textContent = payload.instructions.applyAmCmd;
  document.getElementById('cmd-step-3').textContent = `${payload.instructions.verifyCmd} && ${payload.instructions.pushCmd}`;
}

function triggerPatchDownloadSync() {
  const payload = state.patchCache || buildClientFallbackPatch();
  const blob = new Blob([payload.patchContent], { type: 'text/x-diff;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = payload.filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 250);
}

togglePatchGuideBtn.addEventListener('click', () => {
  patchGuideCard.hidden = false;
  triggerPatchDownloadSync();
  patchGuideCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  void refreshPatchInstructions();
});

downloadPatchFileBtn.addEventListener('click', triggerPatchDownloadSync);
prDownloadPatchBtn.addEventListener('click', triggerPatchDownloadSync);

copyRawPatchBtn.addEventListener('click', () => {
  const payload = state.patchCache || buildClientFallbackPatch();
  navigator.clipboard.writeText(payload.patchContent);
  const span = copyRawPatchBtn.querySelector('span');
  const prev = span.textContent;
  span.textContent = 'Copied .patch!';
  setTimeout(() => {
    span.textContent = prev;
  }, 1500);
});

document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('[data-copy]');
  if (!copyBtn) return;
  const targetId = copyBtn.getAttribute('data-copy');
  const codeEl = document.getElementById(targetId);
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.textContent);
  const prev = copyBtn.textContent;
  copyBtn.textContent = 'Copied';
  setTimeout(() => {
    copyBtn.textContent = prev;
  }, 1400);
});

// ============================================================================
// 1-CLICK TERMINAL COMMAND (`git am` + `gh pr create`) PR SUBMISSION
// ============================================================================

function renderPrCliCommand() {
  if (!state.prData || !prCliCommandCode) return;
  const isInline = state.prCliMode === 'inline';
  if (prCliTabInline) {
    prCliTabInline.classList.toggle('is-active', isInline);
    prCliTabInline.setAttribute('aria-selected', isInline ? 'true' : 'false');
  }
  if (prCliTabShort) {
    prCliTabShort.classList.toggle('is-active', !isInline);
    prCliTabShort.setAttribute('aria-selected', !isInline ? 'true' : 'false');
  }
  prCliCommandCode.textContent = isInline
    ? state.prData.terminalCommand
    : state.prData.shortTerminalCommand;
}

if (prCliTabInline) {
  prCliTabInline.addEventListener('click', () => {
    state.prCliMode = 'inline';
    renderPrCliCommand();
  });
}

if (prCliTabShort) {
  prCliTabShort.addEventListener('click', () => {
    state.prCliMode = 'short';
    renderPrCliCommand();
  });
}

if (copyPrCliBtn) {
  copyPrCliBtn.addEventListener('click', () => {
    if (!state.prData) return;
    const cmd =
      state.prCliMode === 'inline'
        ? state.prData.terminalCommand
        : state.prData.shortTerminalCommand;
    navigator.clipboard.writeText(cmd);
    if (copyPrCliBtnText) {
      copyPrCliBtnText.textContent = '✓ Copied to clipboard!';
      setTimeout(() => {
        copyPrCliBtnText.textContent = 'Copy terminal command';
      }, 1800);
    }
  });
}

createPrFlowBtn.addEventListener('click', async () => {
  if (!state.sessionId || state.selectedIds.size === 0) return;
  createPrFlowBtn.disabled = true;
  createPrBtnText.textContent = 'Preparing pull request...';

  try {
    const res = await fetch(`/api/audit/${state.sessionId}/pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedCommitIds: Array.from(state.selectedIds)
      })
    });

    const pr = await res.json();
    createPrFlowBtn.disabled = false;
    updateActionFooter();

    state.prData = pr;
    state.prCliMode = 'inline';
    renderPrCliCommand();

    if (prFinalBranch) {
      prFinalBranch.textContent = `(${pr.headBranch} → ${pr.baseBranch})`;
    }
    if (prFinalUrl) {
      prFinalUrl.textContent = `Open GitHub compare & pull request page`;
    }
    prFinalLink.href = pr.compareUrl || pr.url;
    prFinalCommitCount.textContent = `${pr.selectedCommits.length}`;
    prNextRunBox.hidden = pr.runPhase === 'lhr';

    prFinalCommitList.innerHTML = pr.selectedCommits
      .map(
        (c) => `
        <li>
          <span>${escapeHtml(formatImperativeHeadline(c.title))}</span>
          <span class="commit-sha-pill">${escapeHtml(c.sha)}</span>
        </li>
      `
      )
      .join('');

    goToStep(4);
  } catch {
    createPrFlowBtn.disabled = false;
    updateActionFooter();
  }
});

prBackToReportBtn.addEventListener('click', () => {
  goToStep(3);
});

startNewAuditBtn.addEventListener('click', () => {
  state.runPhase = 'static';
  goToStep(1);
});

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

