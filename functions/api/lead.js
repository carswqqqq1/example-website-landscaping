const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};

const LEAD_BACKEND_ENDPOINT = 'https://thinkgreen-az.netlify.app/.netlify/functions/send-ticket-emails';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;
const RETRYABLE_SHEET_ERRORS = [
  'Google Sheets webhook error',
  'Service invoked too many times',
  'Exceeded maximum execution time',
  'The script completed but did not return anything'
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responseHeaders(contentType = 'application/json') {
  const headers = new Headers(corsHeaders);
  headers.set('content-type', contentType);
  return headers;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasRetryableSheetError(payload) {
  const error = String(payload && payload.sheets_result && payload.sheets_result.error ? payload.sheets_result.error : '');
  return RETRYABLE_SHEET_ERRORS.some((pattern) => error.includes(pattern));
}

function shouldRetryResponse(status, text, payload) {
  if (status === 408 || status === 429 || status >= 500) return true;
  if (payload && payload.sheets_result && payload.sheets_result.ok === false) {
    return hasRetryableSheetError(payload);
  }
  return /error code:\\s*50[024]/i.test(text);
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders
    });
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('accept', 'application/json');
  const requestBody = await request.arrayBuffer();

  let lastBody = '';
  let lastStatus = 502;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const upstream = await fetch(LEAD_BACKEND_ENDPOINT, {
      method: 'POST',
      headers,
      body: requestBody.slice(0)
    });
    const body = await upstream.text();
    const payload = parseJson(body);
    lastBody = body;
    lastStatus = upstream.status;

    if (!shouldRetryResponse(upstream.status, body, payload) || attempt === MAX_ATTEMPTS) {
      if (upstream.ok && payload && payload.sheets_result && payload.sheets_result.ok === false) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Lead received, but the lead dashboard did not update. Please call us directly.'
        }), {
          status: 502,
          headers: responseHeaders()
        });
      }

      return new Response(body, {
        status: upstream.status,
        headers: responseHeaders(upstream.headers.get('content-type') || 'application/json')
      });
    }

    await wait(RETRY_DELAY_MS * attempt);
  }

  return new Response(JSON.stringify({
    ok: false,
    error: 'Lead routing is temporarily unavailable. Please call us directly.',
    status: lastStatus,
    details: lastBody ? 'Upstream response was not usable.' : 'No upstream response.'
  }), {
    status: 502,
    headers: responseHeaders()
  });
}
