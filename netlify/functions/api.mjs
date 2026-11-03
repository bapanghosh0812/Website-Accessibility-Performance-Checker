import { Buffer } from 'node:buffer';
import { handleFresnelApiRequest } from '../../server/index.js';

export const handler = async (event) => {
  try {
    let rawPath = event.path || '/';
    if (rawPath.startsWith('/.netlify/functions/api')) {
      const sub = rawPath.slice('/.netlify/functions/api'.length);
      rawPath = sub.startsWith('/api') ? sub : `/api${sub.startsWith('/') ? sub : `/${sub}`}`;
    }

    let queryString = '';
    if (typeof event.rawQuery === 'string' && event.rawQuery.length > 0) {
      queryString = `?${event.rawQuery}`;
    } else if (event.queryStringParameters && Object.keys(event.queryStringParameters).length > 0) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(event.queryStringParameters)) {
        if (v !== undefined && v !== null) {
          params.set(k, String(v));
        }
      }
      const qs = params.toString();
      if (qs) queryString = `?${qs}`;
    }

    let parsedBody = undefined;
    if (event.body) {
      const rawBodyStr = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      try {
        parsedBody = JSON.parse(rawBodyStr);
      } catch {
        parsedBody = {};
      }
    }

    let statusCode = 200;
    const responseHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    };
    const chunks = [];

    const req = {
      method: event.httpMethod || 'GET',
      url: `${rawPath}${queryString}`,
      headers: event.headers || { host: 'localhost' },
      body: parsedBody,
      on(evName, cb) {
        if (evName === 'end') {
          cb();
        }
      }
    };

    const res = {
      writeHead(code, headers = {}) {
        statusCode = code;
        for (const [k, v] of Object.entries(headers)) {
          responseHeaders[k] = v;
        }
      },
      write(chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      },
      end(body) {
        if (body !== undefined && body !== null) {
          chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
        }
      }
    };

    const handled = await handleFresnelApiRequest(req, res);
    if (!handled) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ error: 'API route not found' })
      };
    }

    return {
      statusCode,
      headers: responseHeaders,
      body: Buffer.concat(chunks).toString('utf-8')
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: err?.message || 'Internal Server Error' })
    };
  }
};

