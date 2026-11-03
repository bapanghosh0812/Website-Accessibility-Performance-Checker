import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist', 'fresnel');
const DIST_SERVER_DIR = path.join(DIST_DIR, 'server');

function buildApp() {
  const ngCliJs = path.join(ROOT_DIR, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  const res = spawnSync(process.execPath, [ngCliJs, 'build'], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  const buildStatus = res.status ?? 1;
  if (buildStatus !== 0) {
    process.exit(buildStatus);
  }

  // Ensure dist/fresnel/server is not present so @netlify/angular-runtime
  // treats this build as a browser application and skips SSR edge function bundling.
  if (fs.existsSync(DIST_SERVER_DIR)) {
    fs.rmSync(DIST_SERVER_DIR, { recursive: true, force: true });
  }
}

buildApp();
