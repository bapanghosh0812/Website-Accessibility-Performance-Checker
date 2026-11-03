/**
 * Fresnel — AI Studio Full-Stack Managed Agent Server Entrypoint (server.ts)
 *
 * Compatible with:
 * - AI Studio preview container (`npm run dev -- --port 3000 --host 0.0.0.0`)
 * - Cloud Run Share/Deploy (`npm start` or `node server.ts` with Node 22 strip-types)
 * - Local development (`npm run dev` or `npm start`)
 *
 * Target GCP Project for Managed Agent: phantom-gdemo-1
 */

import { startFresnelServer, resolvePortAndHost } from './server/index.js';

const { port, host } = resolvePortAndHost();
startFresnelServer(port, host);
