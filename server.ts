/**
 * Fresnel — Website Accessibility & Performance Checker Server Entrypoint
 */

import { startFresnelServer, resolvePortAndHost } from './server/index.js';

const { port, host } = resolvePortAndHost();
startFresnelServer(port, host);
