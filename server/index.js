import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import {
  API_BASE_URL,
  FRESNEL_AGENT_CONFIG,
  FRESNEL_IDENTITY_LORE,
  SAMPLE_LIGHTHOUSE_LHR_JSON,
  parseRepoUrl,
  buildComprehensiveCommits,
  buildAgentTelemetrySteps,
  buildCategoriesImproved,
  generateGitFormatPatch,
  buildPullRequestCliBundle,
  analyzeLighthouseReportJson,
  resolveGeminiApiKey,
  loadAgentFiles,
  startCloudManagedAgentAudit
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

function cleanupLegacyVanillaFiles() {
  // No-op: preserve workspace files across shared instances
}

function isAngularDistFresh() {
  try {
    // In a shared/deployed app.tar.gz container, /app/applet/browser/index.html is prebuilt
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
  const ngBin = path.join(ROOT_DIR, 'node_modules', '.bin', 'ng');
  if (!fs.existsSync(buildScript) && !fs.existsSync(ngBin)) {
    return Promise.resolve(fs.existsSync(path.join(resolveAngularDistDir(), 'index.html')));
  }

  angularBuildPromise = new Promise((resolve) => {
    const cmd = fs.existsSync(buildScript) ? process.execPath : ngBin;
    const cmdArgs = fs.existsSync(buildScript) ? [buildScript] : ['build'];
    const child = spawn(cmd, cmdArgs, {
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

  // When running behind AI Studio's container Nginx (where NGINX_PORT=8080 and DEFAULT_APP_PORT=3000),
  // bind to DEFAULT_APP_PORT (3000) so Nginx can proxy requests and EADDRINUSE on 8080 is avoided.
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT);
  if (!Number.isNaN(defaultAppPort) && defaultAppPort > 0) {
    return { port: defaultAppPort, host };
  }

  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (!Number.isNaN(envPort) && envPort > 0 && envPort !== nginxPort) {
    return { port: envPort, host };
  }

  return { port: 3000, host };
}

const { port: PORT, host: HOST } = resolvePortAndHost();

/** In-memory store of Managed Agent audit sessions */
const auditSessions = new Map();

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
  const isCloudLive =
    session.mode === 'live' &&
    session.cloudManagedAgent &&
    (session.cloudManagedAgent.active || session.cloudManagedAgent.completed);

  let status = 'in_progress';
  let progressPercent = 12;
  let visibleSteps = session.steps;
  let visibleCommits = session.commits;

  if (session.fastForwarded || (isCloudLive && session.cloudManagedAgent.completed)) {
    status = 'completed';
    progressPercent = 100;
    visibleSteps = session.steps;
    visibleCommits = session.commits;
  } else if (isCloudLive && session.cloudManagedAgent.active) {
    status = 'in_progress';
    const elapsedSec = Math.max(1, (Date.now() - session.startedAt) / 1000);
    progressPercent = Math.min(94, Math.max(14, Math.round(session.steps.length * 14 + elapsedSec * 3)));
    visibleSteps = session.steps;
    visibleCommits = session.commits;
  } else {
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

    visibleSteps = session.steps.slice(0, visibleStepCount);
    const discoveredCommitIds = new Set(
      visibleSteps.filter((s) => s.commitId).map((s) => s.commitId)
    );

    visibleCommits =
      ratio >= 1
        ? session.commits
        : session.commits.filter((c) => discoveredCommitIds.has(c.id));

    status = ratio >= 1 ? 'completed' : 'in_progress';
    progressPercent = Math.round(ratio * 100);
  }

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
    environmentId: session.environmentId || null,
    mode: session.mode,
    runPhase: session.runPhase || 'static',
    categoriesImproved,
    lhrMeta: session.lhrMeta || null,
    status,
    progressPercent,
    repo: session.repo,
    branch: session.branch,
    categories: session.categories,
    agentConfig: {
      gcpProject: FRESNEL_AGENT_CONFIG.gcpProject,
      gcpProjectNumber: FRESNEL_AGENT_CONFIG.gcpProjectNumber,
      gcpLocation: FRESNEL_AGENT_CONFIG.gcpLocation,
      agentHarness:
        session.cloudManagedAgent?.agentHarness || FRESNEL_AGENT_CONFIG.agentHarness,
      model: FRESNEL_AGENT_CONFIG.model,
      fallbackModel: FRESNEL_AGENT_CONFIG.fallbackModel,
      executionPolicy: FRESNEL_AGENT_CONFIG.executionPolicy
    },
    cloudManagedAgent: session.cloudManagedAgent || null,
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
 * Handles all Fresnel API routes and static file fallback.
 * Returns true if the request was handled, or false if caller (e.g. Vite middleware) should handle it.
 */
export async function handleFresnelApiRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 0. Server-Side Managed Agent Proxy (/api/gemini/v1beta/*)
  if (pathname.startsWith('/api/gemini/v1beta/')) {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      sendJson(res, 401, {
        error: {
          code: 'missing_api_key',
          message:
            'Missing valid GEMINI_API_KEY. Add GEMINI_API_KEY in AI Studio Settings → Secrets (GCP project: phantom-gdemo-1).'
        }
      });
      return true;
    }

    const upstreamSubpath = pathname.replace(/^\/api\/gemini\/v1beta\//, '');
    const upstreamUrl = `${API_BASE_URL}/${upstreamSubpath}${url.search}`;

    let forwardBody = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const bodyObj = await readJsonBody(req);
      // Strip agent_config when calling custom agents so upstream does not return 400
      if (
        bodyObj &&
        typeof bodyObj === 'object' &&
        typeof bodyObj.agent === 'string' &&
        !bodyObj.agent.startsWith('antigravity-') &&
        bodyObj.agent_config
      ) {
        delete bodyObj.agent_config;
      }
      forwardBody = JSON.stringify(bodyObj);
    }

    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: forwardBody
    });

    const contentType = upstreamRes.headers.get('content-type') || 'application/json';
    res.writeHead(upstreamRes.status, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });

    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
    }
    res.end();
    return true;
  }

  // 0b. GET /api/agent/info (AI Studio Managed Agent metadata & sources)
  if (req.method === 'GET' && pathname === '/api/agent/info') {
    const agentFiles = loadAgentFiles();
    const sourcesCount = Array.isArray(agentFiles)
      ? agentFiles.length
      : agentFiles?.sources?.length || 0;
    sendJson(res, 200, {
      agent: FRESNEL_AGENT_CONFIG,
      hasApiKey: Boolean(resolveGeminiApiKey()),
      sourcesCount
    });
    return true;
  }

  // 1. GET /api/config
  if (req.method === 'GET' && pathname === '/api/config') {
    sendJson(res, 200, {
      brand: 'Fresnel',
      lore: FRESNEL_IDENTITY_LORE,
      agentConfig: FRESNEL_AGENT_CONFIG,
      hasCloudApiKey: Boolean(resolveGeminiApiKey()),
      sampleLhrJson: SAMPLE_LIGHTHOUSE_LHR_JSON
    });
    return true;
  }

  // 2. POST /api/audit/start (Run 1: Static Code Audit + Light Web Application Security Findings — No Lighthouse Scores)
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

    const sessionId = `fresnel-${crypto.randomBytes(5).toString('hex')}`;
    const interactionId = `interactions/${crypto.randomBytes(8).toString('hex')}`;

    const commits = mode === 'demo' ? buildComprehensiveCommits(repoMeta, categories) : [];
    const steps = mode === 'demo' ? buildAgentTelemetrySteps(repoMeta, commits) : [];

    const session = {
      id: sessionId,
      interactionId,
      environmentId: null,
      previousInteractionId: null,
      mode,
      runPhase: 'static',
      lhrMeta: null,
      repo: repoMeta,
      branch,
      categories,
      commits,
      steps,
      startedAt: Date.now(),
      totalDurationMs: Number(body.durationMs) || 6800,
      fastForwarded: false,
      pr: null
    };

    auditSessions.set(sessionId, session);

    // When mode === 'live', trigger the real Cloud Managed Agent in GCP (phantom-gdemo-1)
    if (mode === 'live') {
      void startCloudManagedAgentAudit(session);
    }

    sendJson(res, 201, computeSessionState(session));
    return true;
  }

  // 3. POST /api/audit/:id/lhr-start (Run 2: Lighthouse Report JSON Deep Analysis — excludes Web Application security findings)
  const lhrStartMatch = pathname.match(/^\/api\/audit\/([^/]+)\/lhr-start$/);
  if (req.method === 'POST' && lhrStartMatch) {
    const baseSession = auditSessions.get(lhrStartMatch[1]);
    const body = await readJsonBody(req);
    const mode = baseSession ? baseSession.mode : body.mode === 'live' ? 'live' : 'demo';
    const repoMeta = baseSession
      ? baseSession.repo
      : parseRepoUrl(body.repoUrl || FRESNEL_AGENT_CONFIG.demoRepositoryUrl, mode);

    const lhrResult = analyzeLighthouseReportJson(repoMeta, body.lhrJson);
    const lhrSessionId = `fresnel-lhr-${crypto.randomBytes(5).toString('hex')}`;
    const interactionId = `interactions/${crypto.randomBytes(8).toString('hex')}`;

    const lhrSession = {
      id: lhrSessionId,
      interactionId,
      environmentId: baseSession?.environmentId || null,
      previousInteractionId: baseSession?.interactionId || null,
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
      commits: mode === 'demo' ? lhrResult.commits : [],
      steps: mode === 'demo' ? lhrResult.steps : [],
      startedAt: Date.now(),
      totalDurationMs: Number(body.durationMs) || 6400,
      fastForwarded: false,
      pr: null
    };

    auditSessions.set(lhrSessionId, lhrSession);

    if (mode === 'live') {
      void startCloudManagedAgentAudit(lhrSession, {
        lhrSummary: {
          lighthouseVersion: lhrResult.lhrVersion,
          categoriesImproved: lhrResult.categoriesImproved
        }
      });
    }

    sendJson(res, 201, computeSessionState(lhrSession));
    return true;
  }

  // 4. GET /api/audit/:id/status
  const statusMatch = pathname.match(/^\/api\/audit\/([^/]+)\/status$/);
  if (req.method === 'GET' && statusMatch) {
    const session = auditSessions.get(statusMatch[1]);
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
    const session = auditSessions.get(ffMatch[1]);
    if (!session) {
      sendJson(res, 404, { error: 'Audit session not found' });
      return true;
    }
    session.fastForwarded = true;
    if (session.abortController) {
      try {
        session.abortController.abort();
      } catch {
        // ignore abort errors
      }
    }
    if (session.cloudManagedAgent) {
      session.cloudManagedAgent.active = false;
      session.cloudManagedAgent.completed = true;
    }
    if (session.steps.length < 4 && session.runPhase !== 'lhr') {
      session.steps = buildAgentTelemetrySteps(session.repo, session.commits);
    }
    sendJson(res, 200, computeSessionState(session));
    return true;
  }

  // 6. GET /api/audit/:id/patch.diff (Direct Attachment Download)
  const patchGetMatch = pathname.match(/^\/api\/audit\/([^/]+)\/patch\.diff$/);
  if (req.method === 'GET' && patchGetMatch) {
    const session = auditSessions.get(patchGetMatch[1]);
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
    const session = auditSessions.get(patchMatch[1]);
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
    const session = auditSessions.get(prMatch[1]);
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

    // Fallback to public/logo.svg if requested directly before asset copy
    if (safePath === '/logo.svg') {
      const publicLogo = path.join(PUBLIC_DIR, 'logo.svg');
      if (fs.existsSync(publicLogo) && fs.statSync(publicLogo).isFile()) {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        fs.createReadStream(publicLogo).pipe(res);
        return;
      }
    }

    // Do NOT return index.html (text/html) for missing static assets (.css, .js, .mjs, .svg, etc.)
    const requestedExt = path.extname(safePath).toLowerCase();
    if (requestedExt && requestedExt !== '.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    // Fallback to Angular index.html for extensionless SPA routes
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
  cleanupLegacyVanillaFiles();
  void ensureAngularBuild();
  const server = http.createServer(handleFresnelRequest);
  server.listen(port, host, () => {
    console.log(`[Fresnel] Managed Agent Server (phantom-gdemo-1) listening at http://${host}:${port}`);
  });

  // Also bind to process.env.PORT (e.g. 8080) if running in a direct Cloud Run container without Nginx
  const envPort = Number(process.env.PORT);
  if (!Number.isNaN(envPort) && envPort > 0 && envPort !== port) {
    const directServer = http.createServer(handleFresnelRequest);
    directServer.on('error', () => {
      // Ignore EADDRINUSE when Nginx already owns port 8080 and proxies to 3000
    });
    directServer.listen(envPort, host);
  }

  return server;
}

// Start automatically when executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startFresnelServer(PORT, HOST);
}
