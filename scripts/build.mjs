import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist', 'fresnel');
const DIST_SERVER_DIR = path.join(DIST_DIR, 'server');

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildApp() {
  const angularJsonPath = path.join(ROOT_DIR, 'angular.json');
  const angularConfig = JSON.parse(fs.readFileSync(angularJsonPath, 'utf-8'));

  // Temporarily omit outputMode during ng build so @angular-devkit/build-angular:application
  // builds dist/fresnel/browser without requiring @angular/ssr, then restore outputMode: "server"
  // in finally so AI Studio's archive handler packages the full-stack server bundle (app.tar.gz).
  const cliConfig = structuredClone(angularConfig);
  if (cliConfig?.projects?.fresnel?.architect?.build?.options) {
    delete cliConfig.projects.fresnel.architect.build.options.outputMode;
  }

  fs.writeFileSync(angularJsonPath, JSON.stringify(cliConfig, null, 2) + '\n', 'utf-8');

  let buildStatus = 0;
  try {
    const ngBin = path.join(ROOT_DIR, 'node_modules', '.bin', 'ng');
    const res = spawnSync(ngBin, ['build'], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    buildStatus = res.status ?? 1;
  } finally {
    if (angularConfig?.projects?.fresnel?.architect?.build?.options) {
      angularConfig.projects.fresnel.architect.build.options.outputMode = 'server';
    }
    fs.writeFileSync(angularJsonPath, JSON.stringify(angularConfig, null, 2) + '\n', 'utf-8');
  }

  if (buildStatus !== 0) {
    process.exit(buildStatus);
  }

  // Persist phantom-gdemo-1 runtime configuration into server/runtime-env.json so all shared users
  // automatically run against phantom-gdemo-1 without needing to enter a project or API key
  const placeholderKeys = new Set(['MY_GEMINI_API_KEY', 'GEMINI_API_KEY', 'YOUR_API_KEY', 'TODO', 'undefined', 'null']);
  const isValidKey = (val) => typeof val === 'string' && val.trim().length > 0 && !placeholderKeys.has(val.trim());

  let resolvedKey = '';
  const candidateEnvFiles = [
    '/app/.dev.env.json',
    path.join(ROOT_DIR, '.dev.env.json'),
    path.join(ROOT_DIR, 'server', 'runtime-env.json'),
    '/tmp/.dev.env.json'
  ];
  for (const envFile of candidateEnvFiles) {
    if (resolvedKey) break;
    try {
      if (fs.existsSync(envFile)) {
        const parsed = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
        for (const k of [parsed?.GEMINI_API_KEY, parsed?.API_KEY, parsed?.env?.GEMINI_API_KEY]) {
          if (isValidKey(k)) {
            resolvedKey = k.trim();
            break;
          }
        }
      }
    } catch {
      // ignore read errors
    }
  }
  if (!resolvedKey) {
    for (const k of [process.env.GEMINI_API_KEY, process.env.API_KEY]) {
      if (isValidKey(k)) {
        resolvedKey = k.trim();
        break;
      }
    }
  }

  const runtimeEnvPayload = {
    GCP_PROJECT: 'phantom-gdemo-1',
    GCP_PROJECT_NUMBER: '20833501260',
    GCP_LOCATION: 'global',
    FRESNEL_GCP_PROJECT: 'phantom-gdemo-1',
    MANAGED_AGENT: 'antigravity-preview-09-2026',
    MODEL: 'gemini-4-argon',
    FALLBACK_MODEL: 'gemini-3.8-flash',
    ...(resolvedKey ? { GEMINI_API_KEY: resolvedKey } : {})
  };
  fs.writeFileSync(
    path.join(ROOT_DIR, 'server', 'runtime-env.json'),
    JSON.stringify(runtimeEnvPayload, null, 2) + '\n',
    'utf-8'
  );

  // Copy backend server/, agent/, public/, server.ts, and metadata.json into dist/fresnel/
  fs.mkdirSync(DIST_SERVER_DIR, { recursive: true });
  copyDirRecursive(path.join(ROOT_DIR, 'server'), DIST_SERVER_DIR);
  copyDirRecursive(path.join(ROOT_DIR, 'agent'), path.join(DIST_DIR, 'agent'));
  copyDirRecursive(path.join(ROOT_DIR, 'public'), path.join(DIST_DIR, 'public'));

  if (resolvedKey) {
    fs.writeFileSync(
      path.join(DIST_DIR, '.dev.env.json'),
      JSON.stringify({ GEMINI_API_KEY: resolvedKey }, null, 2) + '\n',
      'utf-8'
    );
  }

  for (const rootFile of ['server.ts', 'metadata.json', '.env.example']) {
    const srcFile = path.join(ROOT_DIR, rootFile);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(DIST_DIR, rootFile));
    }
  }

  // Create dist/fresnel/server/server.mjs entrypoint expected by AI Studio full-stack Angular deployment
  const serverMjsContent = `import { startFresnelServer, resolvePortAndHost } from './index.js';

const { port, host } = resolvePortAndHost();
startFresnelServer(port, host);
`;
  fs.writeFileSync(path.join(DIST_SERVER_DIR, 'server.mjs'), serverMjsContent, 'utf-8');
}

buildApp();
