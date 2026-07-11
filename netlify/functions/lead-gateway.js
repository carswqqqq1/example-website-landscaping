const { handler: dispatchLead } = require('./send-ticket-emails');

const MAX_BODY_BYTES = 64 * 1024;
const LEAD_PROXY_SECRET = process.env.LEAD_PROXY_SECRET || '';

function getHeader(headers, name) {
  const target = String(name || '').toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (String(key).toLowerCase() === target) return String(value || '');
  }
  return '';
}

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function requestOrigin(event) {
  const headers = event && event.headers ? event.headers : {};
  const host = getHeader(headers, 'host') || getHeader(headers, 'x-forwarded-host');
  const protocol = getHeader(headers, 'x-forwarded-proto') || 'https';
  if (!host || !/^https?$/.test(protocol)) return '';
  return `${protocol}://${host}`;
}

exports.handler = async (event) => {
  if (String(event && event.httpMethod || '').toUpperCase() !== 'POST') {
    return response(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
  }
  if (!LEAD_PROXY_SECRET) {
    return response(503, { ok: false, error: 'Lead routing is temporarily unavailable.' });
  }

  const contentType = getHeader(event.headers, 'content-type').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json' && contentType !== 'application/x-www-form-urlencoded') {
    return response(415, { ok: false, error: 'Unsupported request format.' });
  }

  const encodedBody = String(event && event.body || '');
  const bodyBytes = Buffer.byteLength(encodedBody, event && event.isBase64Encoded ? 'base64' : 'utf8');
  if (bodyBytes > MAX_BODY_BYTES) {
    return response(413, { ok: false, error: 'Request is too large.' });
  }

  const origin = getHeader(event.headers, 'origin');
  const expectedOrigin = requestOrigin(event);
  if (!origin || !expectedOrigin || origin !== expectedOrigin) {
    return response(403, { ok: false, error: 'Request origin is not allowed.' });
  }

  const headers = {
    ...(event.headers || {}),
    'x-lead-proxy-secret': LEAD_PROXY_SECRET
  };
  const clientIp = getHeader(event.headers, 'x-nf-client-connection-ip') ||
    getHeader(event.headers, 'x-forwarded-for').split(',')[0].trim();
  if (clientIp && clientIp.length <= 64) headers['x-lead-client-ip'] = clientIp;

  try {
    return await dispatchLead({ ...event, headers });
  } catch (error) {
    console.error('[thinkgreen-netlify-lead-gateway]', JSON.stringify({ message: String(error && error.message || error) }));
    return response(503, { ok: false, error: 'Lead routing is temporarily unavailable.' });
  }
};
