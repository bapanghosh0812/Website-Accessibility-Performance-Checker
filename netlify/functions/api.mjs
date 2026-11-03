import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
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
} from '../../server/agent-client.js';

const MAX_SESSIONS = 500;
const auditSessions = new Map();

function setSessionBounded(id, session) {
  if (auditSessions.size >= MAX_SESSIONS) {
    const oldestKey = auditSessions.keys().next().value;
    if (oldestKey) auditSessions.delete(oldestKey);
  }
  auditSessions.set(id, session);
}

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
      // keep default
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
      totalDurationMs: 4200,
      fastForwarded: false,
      pr: null
    };
    setSessionBounded(sessionId, lhrSession);
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
    totalDurationMs: 4500,
    fastForwarded: false,
    pr: null
  };
  setSessionBounded(sessionId, session);
  return session;
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

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload)
  };
}

export const handler = async (event) => {
  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    let pathname = event.path || '/';
    if (pathname.startsWith('/.netlify/functions/api')) {
      const sub = pathname.slice('/.netlify/functions/api'.length);
      pathname = sub.startsWith('/api') ? sub : `/api${sub.startsWith('/') ? sub : `/${sub}`}`;
    }

    let body = {};
    if (event.body) {
      const rawBodyStr = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      try {
        body = JSON.parse(rawBodyStr);
      } catch {
        body = {};
      }
    }

    if (method === 'GET' && pathname === '/api/config') {
      return jsonResponse(200, {
        brand: 'Fresnel',
        lore: FRESNEL_IDENTITY_LORE,
        config: FRESNEL_AGENT_CONFIG,
        sampleLhrJson: SAMPLE_LIGHTHOUSE_LHR_JSON
      });
    }

    if (method === 'POST' && pathname === '/api/audit/start') {
      const mode = body.mode === 'demo' ? 'demo' : 'live';
      const repoMeta = parseRepoUrl(
        body.repoUrl || FRESNEL_AGENT_CONFIG.demoRepositoryUrl,
        mode
      );
      const branch = String(body.branch || 'main').trim() || 'main';
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
        totalDurationMs: Number(body.durationMs) || 4500,
        fastForwarded: false,
        pr: null
      };

      setSessionBounded(sessionId, session);
      return jsonResponse(201, computeSessionState(session));
    }

    const lhrStartMatch = pathname.match(/^\/api\/audit\/([^/]+)\/lhr-start$/);
    if (method === 'POST' && lhrStartMatch) {
      const baseSession = getOrReconstructSession(lhrStartMatch[1]);
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
        totalDurationMs: Number(body.durationMs) || 4200,
        fastForwarded: false,
        pr: null
      };

      setSessionBounded(lhrSessionId, lhrSession);
      return jsonResponse(201, computeSessionState(lhrSession));
    }

    const statusMatch = pathname.match(/^\/api\/audit\/([^/]+)\/status$/);
    if (method === 'GET' && statusMatch) {
      const session = getOrReconstructSession(statusMatch[1]);
      if (!session) return jsonResponse(404, { error: 'Audit session not found' });
      return jsonResponse(200, computeSessionState(session));
    }

    const ffMatch = pathname.match(/^\/api\/audit\/([^/]+)\/fast-forward$/);
    if (method === 'POST' && ffMatch) {
      const session = getOrReconstructSession(ffMatch[1]);
      if (!session) return jsonResponse(404, { error: 'Audit session not found' });
      session.fastForwarded = true;
      return jsonResponse(200, computeSessionState(session));
    }

    const patchGetMatch = pathname.match(/^\/api\/audit\/([^/]+)\/patch\.diff$/);
    if (method === 'GET' && patchGetMatch) {
      const session = getOrReconstructSession(patchGetMatch[1]);
      if (!session) return jsonResponse(404, { error: 'Audit session not found' });
      const commitsParam = event.queryStringParameters?.commits || '';
      const selectedCommitIds = commitsParam
        ? String(commitsParam).split(',').filter(Boolean)
        : session.commits.map((c) => c.id);
      const patchContent = generateGitFormatPatch(session, selectedCommitIds);
      const suffix = session.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';
      const filename = `fresnel-${session.repo.repo}-${suffix}.patch`;

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/x-diff; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store'
        },
        body: patchContent
      };
    }

    const patchMatch = pathname.match(/^\/api\/audit\/([^/]+)\/patch$/);
    if (method === 'POST' && patchMatch) {
      const session = getOrReconstructSession(patchMatch[1]);
      if (!session) return jsonResponse(404, { error: 'Audit session not found' });
      const selectedCommitIds = body.selectedCommitIds || session.commits.map((c) => c.id);
      const patchContent = generateGitFormatPatch(session, selectedCommitIds);
      const suffix = session.runPhase === 'lhr' ? 'lhr-fixes' : 'code-audit';
      const filename = `fresnel-${session.repo.repo}-${suffix}.patch`;

      return jsonResponse(200, {
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
    }

    const prMatch = pathname.match(/^\/api\/audit\/([^/]+)\/pr$/);
    if (method === 'POST' && prMatch) {
      const session = getOrReconstructSession(prMatch[1]);
      if (!session) return jsonResponse(404, { error: 'Audit session not found' });
      const prData = buildPullRequestCliBundle(session, body.selectedCommitIds, {
        headBranch: body.headBranch,
        prTitle: body.prTitle
      });
      session.pr = prData;
      return jsonResponse(201, prData);
    }

    return jsonResponse(404, { error: 'API route not found' });
  } catch (err) {
    return jsonResponse(500, { error: err?.message || 'Internal Server Error' });
  }
};
