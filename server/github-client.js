/**
 * Compatibility stub for legacy GitHub client imports.
 * Fresnel uses zero-env-var 1-Click Terminal Commands (`git am` + `gh pr create`)
 * via `buildPullRequestCliBundle` in `./agent-client.js`.
 */

export function resolveGitHubToken(token = '') {
  return String(token || '').trim();
}

export function resolveGitHubOAuthClientId(clientId = '') {
  return String(clientId || '').trim();
}

export async function verifyGitHubCredentials() {
  return { authenticated: false, user: null };
}

export async function startGitHubDeviceFlow() {
  return {};
}

export async function pollGitHubDeviceFlow() {
  return { status: 'pending' };
}

export async function createRealGitHubPullRequest() {
  return null;
}
