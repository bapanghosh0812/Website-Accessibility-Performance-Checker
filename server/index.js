import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import {
  FRESNEL_AGENT_CONFIG,
  FRESNEL_IDENTITY_LORE,
  SAMPLE_LIGHTHOUSE_LHR_JSON,
  parseRepoUrl,
  buildComprehensiveCommits,
  buildAgentTelemetrySteps,
  buildCategoriesImproved,
  generateGitFormatPatch,
  buildPullRequestCliBundle,
  analyzeLighthouseReportJson
} from './agent-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const SRC_APP_DIR = path.join(ROOT_DIR, 'src', 'app');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function resolveAngularDistDir() {
  const devBrowserDir = path.join(ROOT_DIR, 'dist', 'fresnel', 'browser');
  if (fs.existsSync(path.join(devBrowserDir, 'index.html'))) {
    return devBrowserDir;
  }
  const sharedBrowserDir = path.join(ROOT_DIR, 'browser');
  if (fs.existsSync(path.join(sharedBrowserDir, 'index.html'))) {
    return sharedBrowserDir;
  }
  return devBrowserDir;
}

let angularBuildPromise = null;

function isAngularDistFresh() {
  try {
    const sharedIndex = path.join(ROOT_DIR, 'browser', 'index.html');
    if (fs.existsSync(sharedIndex) && !fs.existsSync(SRC_APP_DIR)) {
      return true;
    }
    const distDir = resolveAngularDistDir();
    const distIndex = path.join(distDir, 'index.html');
    if (!fs.existsSync(distIndex)) return false;
    const distMtime = fs.statSync(distIndex).mtimeMs;
    const trackedSourceFiles = [
      path.join(SRC_APP_DIR, 'app.component.ts'),
      path.join(SRC_APP_DIR, 'app.component.html'),
      path.join(SRC_APP_DIR, 'services', 'audit.service.ts'),
      path.join(ROOT_DIR, 'src', 'styles.scss')
    ];
    for (const srcFile of trackedSourceFiles) {
      if (fs.existsSync(srcFile) && fs.statSync(srcFile).mtimeMs > distMtime + 1000) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function ensureAngularBuild() {
  if (isAngularDistFresh()) {
    return Promise.resolve(true);
  }
  if (angularBuildPromise) {
    return angularBuildPromise;
  }
  const buildScript = path.join(ROOT_DIR, 'scripts', 'build.mjs');
  if (!fs.existsSync(buildScript)) {
    return Promise.resolve(fs.existsSync(path.join(resolveAngularDistDir(), 'index.html')));
  }

  angularBuildPromise = new Promise((resolve) => {
    const child = spawn(process.execPath, [buildScript], {
      cwd: ROOT_DIR,
      stdio: 'ignore',
      detached: false
    });
    child.on('close', () => {
      angularBuildPromise = null;
      resolve(fs.existsSync(path.join(resolveAngularDistDir(), 'index.html')));
    });
    child.on('error', () => {
      angularBuildPromise = null;
      resolve(fs.existsSync(path.join(resolveAngularDistDir(), 'index.html')));
    });
  });

  return angularBuildPromise;
}

export function resolvePortAndHost() {
  const args = process.argv.slice(2);
  let cliPort = null;
  let host = process.env.HOST || '0.0.0.0';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' && args[i + 1]) {
      const p = Number(args[i + 1]);
      if (!Number.isNaN(p) && p > 0) cliPort = p;
      i++;
    } else if (arg.startsWith('--port=')) {
      const p = Number(arg.split('=')[1]);
      if (!Number.isNaN(p) && p > 0) cliPort = p;
    } else if (arg === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1] || host;
    }
  }

  if (cliPort) {
    return { port: cliPort, host };
  }

  const envPort = Number(process.env.PORT);
  if (!Number.isNaN(envPort) && envPort > 0) {
    return { port: envPort, host };
  }

  return { port: 3000, host };
}

const { port: PORT, host: HOST } = resolvePortAndHost();

/** In-memory store of active audit sessions */
const auditSessions = new Map();

function createEncodedSessionId(runPhase, mode, startedAt, repoFullName) {
  const safePhase = runPhase === 'lhr' ? 'lhr' : 'static';
  const safeMode = mode === 'demo' ? 'demo' : 'live';
  const encodedRepo = Buffer.from(
    repoFullName || 'fresnel-sandbox/lumina-web-app',
    'utf-8'
  ).toString('base64url');
  const rand = crypto.randomBytes(4).toString('hex');
  return `fresnel.${safePhase}.${safeMode}.${startedAt.toString(36)}.${encodedRepo}.${rand}`;
}

function getOrReconstructSession(sessionId) {
  if (!sessionId) return null;
  const existing = auditSessions.get(sessionId);
  if (existing) return existing;

  // Reconstruct session deterministically on stateless serverless instances (e.g. Netlify Functions)
  const parts = String(sessionId).split('.');
  let runPhase = 'static';
  let mode = 'live';
  let startedAt = Date.now() - 7000;
  let repoFullName = 'fresnel-sandbox/lumina-web-app';

  if (parts.length >= 5 && parts[0] === 'fresnel') {
    runPhase = parts[1] === 'lhr' ? 'lhr' : 'static';
    mode = parts[2] === 'demo' ? 'demo' : 'live';
    const parsedTime = parseInt(parts[3], 36);
    if (!Number.isNaN(parsedTime) && parsedTime > 0) {
      startedAt = parsedTime;
    }
    try {
      const decoded = Buffer.from(parts[4], 'base64url').toString('utf-8');
      if (decoded && decoded.includes('/')) {
        repoFullName = decoded;
      }
    } catch {
      // keep default repoFullName
    }
  } else if (String(sessionId).startsWith('fresnel-lhr-')) {
    runPhase = 'lhr';
  }

  const repoMeta = parseRepoUrl(repoFullName, mode);
  const interactionId = `audit/${crypto.createHash('sha1').update(String(sessionId)).digest('hex').slice(0, 16)}`;

  if (runPhase === 'lhr') {
    const lhrResult = analyzeLighthouseReportJson(repoMeta, SAMPLE_LIGHTHOUSE_LHR_JSON);
    const lhrSession = {
      id: sessionId,
      interactionId,
      mode,
      runPhase: 'lhr',
      lhrMeta: {
        lighthouseVersion: lhrResult.lhrVersion,
        requestedUrl: lhrResult.requestedUrl,
        fetchTime: lhrResult.fetchTime
      },
      repo: repoMeta,
      branch: 'main',
      categories: ['performance', 'accessibility', 'best-practices', 'seo'],
      commits: lhrResult.commits,
      steps: lhrResult.steps,
      startedAt,
      totalDurationMs: 6400,
      fastForwarded: false,
      pr: null
    };
    auditSessions.set(sessionId, lhrSession);
    return lhrSession;
  }

  const categories = ['performance', 'accessibility', 'best-practices', 'seo', 'security'];
  const commits = buildComprehensiveCommits(repoMeta, categories);
  const steps = buildAgentTelemetrySteps(repoMeta, commits);

  const session = {
    id: sessionId,
    interactionId,
    mode,
    runPhase: 'static',
    lhrMeta: null,
    repo: repoMeta,
    branch: 'main',
    categories,
    commits,
    steps,
    startedAt,
    totalDurationMs: 6800,
    fastForwarded: false,
    pr: null
  };
  auditSessions.set(sessionId, session);
  return session;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.patch': 'text/x-diff; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5e6) {
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function computeSessionState(session) {
  const now = Date.now();
  const elapsedMs = session.fastForwarded
    ? session.totalDurationMs
    : Math.max(0, now - session.startedAt);
  const ratio = Math.min(1, elapsedMs / session.totalDurationMs);
  const totalSteps = session.steps.length;
  const visibleStepCount =
    ratio >= 1
      ? totalSteps
      : Math.max(1, Math.min(totalSteps - 1, Math.floor(ratio * totalSteps) + 1));

  const visibleSteps = session.steps.slice(0, visibleStepCount);
  const discoveredCommitIds = new Set(
    visibleSteps.filter((s) => s.commitId).map((s) => s.commitId)
  );

  const visibleCommits =
    ratio >= 1
      ? session.commits
      : session.commits.filter((c) => discoveredCommitIds.has(c.id));

  const status = ratio >= 1 ? 'completed' : 'in_progress';
  const progressPercent = Math.round(ratio * 100);
  const currentStep = visibleSteps[visibleSteps.length - 1] || session.steps[0];

  const trackedCategories =
    session.runPhase === 'lhr'
      ? ['performance', 'accessibility', 'best-practices', 'seo']
      : ['performance', 'accessibility', 'best-practices', 'seo', 'security'];

  const categoriesProgress = {};
  for (const cat of trackedCategories) {
    const totalForCat = session.commits.filter((c) => c.category === cat).length;
    const doneForCat = visibleCommits.filter((c) => c.category === cat).length;
    categoriesProgress[cat] = {
      totalCommits: totalForCat,
      completedCommits: doneForCat,
      percent: totalForCat === 0 ? 100 : Math.round((doneForCat / totalForCat) * 100)
    };
  }

  const categoriesImproved = buildCategoriesImproved(
    session.commits,
    session.runPhase || 'static'
  );

  return {
    id: session.id,
    interactionId: session.interactionId,
    mode: session.mode,
    runPhase: session.runPhase || 'static',
    categoriesImproved,
    lhrMeta: session.lhrMeta || null,
    status,
    progressPercent,
    repo: session.repo,
    branch: session.branch,
    categories: session.categories,
    currentStep,
    steps: visibleSteps,
    totalSteps: session.steps.length,
    commits: status === 'completed' ? session.commits : visibleCommits,
    totalCommits: session.commits.length,
    categoriesProgress,
    pr: session.pr || null
  };
}

/**
 * Handles all Fresnel API routes.
 */
export async function handleFresnelApiRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. GET /api/config
  if (req.method === 'GET' && pathname === '/api/config') {
    sendJson(res, 200, {
      brand: 'Fresnel',
      lore: FRESNEL_IDENTITY_LORE,
      config: FRESNEL_AGENT_CONFIG,
      sampleLhrJson: SAMPLE_LIGHTHOUSE_LHR_JSON
    });
    return true;
  }

  // 2. POST /api/audit/start (Run 1: Static Code Audit + Light Web Application Security Findings)
  if (req.method === 'POST' && pathname === '/api/audit/start') {
    const body = await readJsonBody(req);
    const mode = body.mode === 'demo' ? 'demo' : 'live';
    const repoMeta = parseRepoUrl(
      body.repoUrl || FRESNEL_AGENT_CONFIG.demoRepositoryUrl,
      mode
    );
    const branch = (body.branch || 'main').trim() || 'main';
    const categories =
      Array.isArray(body.categories) && body.categories.length > 0
        ? body.categories
        : ['performance', 'accessibility', 'best-practices', 'seo', 'security'];

    const startedAt = Date.now();
    const sessionId = createEncodedSessionId('static', mode, startedAt, repoMeta.fullName);
    const interactionId = `audit/${crypto.randomBytes(8).toString('hex')}`;

    const commits = buildComprehensiveCommits(repoMeta, categories);
    const steps = buildAgentTelemetrySteps(repoMeta, commits);

    const session = {
      id: sessionId,
      interactionId,
      mode,
      runPhase: 'static',
      lhrMeta: null,
      repo: repoMeta,
      branch,
      categories,
      commits,
      steps,
      startedAt,
      totalDurationMs: Number(body.durationMs) || 6800,
      fastForwarded: false,
      pr: null
    };

    auditSessions.set(sessionId, session);

    sendJson(res, 201, computeSessionState(session));
    return true;
  }

  // 3. POST /api/audit/:id/lhr-start (Run 2: Lighthouse Report JSON Deep Analysis)
  const lhrStartMatch = pathname.match(/^\/api\/audit\/([^/]+)\/lhr-start$/);
  if (req.method === 'POST' && lhrStartMatch) {
    const baseSession = getOrReconstructSession(lhrStartMatch[1]);
    const body = await readJsonBody(req);
    const mode = baseSession ? baseSession.mode : body.mode === 'live' ? 'live' : 'demo';
    const repoMeta = baseSession
      ? baseSession.repo
      : parseRepoUrl(body.repoUrl || FRESNEL_AGENT_CONFIG.demoRepositoryUrl, mode);

    const lhrResult = analyzeLighthouseReportJson(repoMeta, body.lhrJson);
    const startedAt = Date.now();
    const lhrSessionId = createEncodedSessionId('lhr', mode, startedAt, repoMeta.fullName);
    const interactionId = `audit/${crypto.randomBytes(8).toString('hex')}`;

    const lhrSession = {
      id: lhrSessionId,
      interactionId,
      mode,
      runPhase: 'lhr',
      lhrMeta: {
        lighthouseVersion: lhrResult.lhrVersion,
        requestedUrl: lhrResult.requestedUrl,
        fetchTime: lhrResult.fetchTime
      },
      repo: repoMeta,
      branch: baseSession ? baseSession.branch : 'main',
      categories: ['performance', 'accessibility', 'best-practices', 'seo'],
      commits: lhrResult.commits,
      steps: lhrResult.steps,
      startedAt,
      totalDurationMs: Number(body.durationMs) || 6400,
      fastForwarded: false,
      pr: null
    };

    auditSessions.set(lhrSessionId, lhrSession);

    sendJson(res, 201, computeSessionState(lhrSession));
    return true;
  }

  // 4. GET /api/audit/:id/status
  const statusMatch = pathname.match(/^\/api\/audit\/([^/]+)\/status$/);
  if (req.method === 'GET' && statusMatch) {
    const session = getOrReconstructSession(statusMatch[1]);
    if (!session) {
      sendJson(res, 404, { error: 'Audit session not found' });
      return true;
    }
    sendJson(res, 200, computeSessionState(session));
    return true;
  }

  // 5. POST /api/audit/:id/fast-forward
  const ffMatch = pathname.match(/^\/api\/audit\/([^/]+)\/fast-forward$/);
  if (req.method === 'POST' && ffMatch) {
    const session = getOrReconstructSession(ffMatch[1]);
    if (!session) {
      sendJson(res, 404, { error: 'Audit session not found' });
      return true;
    }
    session.fastForwarded = true;
    if (session.steps.length < 4 && session.runPhase !== 'lhr') {
      session.steps = buildAgentTelemetrySteps(session.repo, session.commits);
    }
    sendJson(res, 200, computeSessionState(session));
    return true;
  }

  // 6. GET /api/audit/:id/patch.diff (Direct Attachment Download)
  const patchGetMatch = pathname.match(/^\/api\/audit\/([^/]+)\/patch\.diff$/);
  if (req.method === 'GET' && patchGetMatch) {
    const session = getOrReconstructSession(patchGetMatch[1]);
    if (!session) {
      res.writeHead(404);
      res.end('Audit session not found');
      return true;
    }
    const commitsParam = url.searchParams.get('commits');
    const selectedCommitIds = commitsParam
      ? commitsParam.split(',').filter(Boolean)
      : session.commits.map((c) => c.id);
    const patchContent = generateGitFormatPatch(session, selectedCommitIds);
    const suffix = session.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';
    const filename = `fresnel-${session.repo.repo}-${suffix}.patch`;

    res.writeHead(200, {
      'Content-Type': 'text/x-diff; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    });
    res.end(patchContent);
    return true;
  }

  // 7. POST /api/audit/:id/patch
  const patchMatch = pathname.match(/^\/api\/audit\/([^/]+)\/patch$/);
  if (req.method === 'POST' && patchMatch) {
    const session = getOrReconstructSession(patchMatch[1]);
    if (!session) {
      sendJson(res, 404, { error: 'Audit session not found' });
      return true;
    }
    const body = await readJsonBody(req);
    const selectedCommitIds = body.selectedCommitIds || session.commits.map((c) => c.id);
    const patchContent = generateGitFormatPatch(session, selectedCommitIds);
    const suffix = session.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';
    const filename = `fresnel-${session.repo.repo}-${suffix}.patch`;

    sendJson(res, 200, {
      filename,
      selectedCount: selectedCommitIds.length,
      patchContent,
      downloadUrl: `/api/audit/${session.id}/patch.diff?commits=${encodeURIComponent(selectedCommitIds.join(','))}`,
      instructions: {
        cloneCmd: `git clone ${session.repo.url}.git && cd ${session.repo.repo}`,
        branchCmd: `git checkout -b fresnel/${suffix} origin/${session.branch}`,
        applyAmCmd: `git am --3way < ~/Downloads/${filename}`,
        applyDiffCmd: `git apply --3way ~/Downloads/${filename}`,
        verifyCmd: `git log --oneline -n ${selectedCommitIds.length}`,
        pushCmd: `git push -u origin fresnel/${suffix}`
      }
    });
    return true;
  }

  // 8. POST /api/audit/:id/pr (Zero-Env-Var 1-Click Terminal Command: git am + gh pr create)
  const prMatch = pathname.match(/^\/api\/audit\/([^/]+)\/pr$/);
  if (req.method === 'POST' && prMatch) {
    const session = getOrReconstructSession(prMatch[1]);
    if (!session) {
      sendJson(res, 404, { error: 'Audit session not found' });
      return true;
    }
    const body = await readJsonBody(req);
    const prData = buildPullRequestCliBundle(session, body.selectedCommitIds, {
      headBranch: body.headBranch,
      prTitle: body.prTitle
    });

    session.pr = prData;
    sendJson(res, 201, prData);
    return true;
  }

  return false;
}

export async function handleFresnelRequest(req, res) {
  try {
    const handled = await handleFresnelApiRequest(req, res);
    if (handled) return;

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    await ensureAngularBuild();

    const staticRoot = resolveAngularDistDir();
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(staticRoot, `.${safePath}`);

    if (!filePath.startsWith(staticRoot)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    if (safePath === '/logo.svg') {
      const publicLogo = path.join(PUBLIC_DIR, 'logo.svg');
      if (fs.existsSync(publicLogo) && fs.statSync(publicLogo).isFile()) {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        fs.createReadStream(publicLogo).pipe(res);
        return;
      }
    }

    const requestedExt = path.extname(safePath).toLowerCase();
    if (requestedExt && requestedExt !== '.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const indexFallback = path.join(staticRoot, 'index.html');
    if (fs.existsSync(indexFallback)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexFallback).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
}

export function startFresnelServer(port = PORT, host = HOST) {
  void ensureAngularBuild();
  const server = http.createServer(handleFresnelRequest);
  server.listen(port, host, () => {
    console.log(`[Fresnel] Server listening at http://${host}:${port}`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startFresnelServer(PORT, HOST);
}
