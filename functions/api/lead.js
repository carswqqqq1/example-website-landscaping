const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};

const LEAD_BACKEND_ENDPOINT = 'https://thinkgreen-az.netlify.app/.netlify/functions/send-ticket-emails';
const OWNER_NOTIFY_EMAIL = 'carson.elevatemarketing@gmail.com';
const FORM_SUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${OWNER_NOTIFY_EMAIL}`;
const SITE_ORIGIN = 'https://example-website-landscaping.pages.dev';
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

function cleanValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function valueFrom(data, keys, fallback = '') {
  for (const key of keys) {
    const value = cleanValue(data && data[key]);
    if (value) return value;
  }
  return fallback;
}

function buildOwnerBackupMessage(data, upstreamPayload) {
  const ticketId = valueFrom(data, ['ticket_id'], valueFrom(upstreamPayload, ['ticket_id'], 'Website lead'));
  const name = valueFrom(data, ['name', 'full_name'], [data && data.first_name, data && data.last_name].map(cleanValue).filter(Boolean).join(' '));
  const phone = valueFrom(data, ['phone', 'phone_number']);
  const email = valueFrom(data, ['email']);
  const service = valueFrom(data, ['service', 'selected_service'], 'Project review');
  const city = valueFrom(data, ['city', 'project_location']);
  const budget = valueFrom(data, ['budget_range', 'budget']);
  const timeline = valueFrom(data, ['start_timeline', 'timeline', 'estimated_timeline']);
  const notes = valueFrom(data, ['notes', 'message', 'project_details']);
  const source = valueFrom(data, ['lead_source', 'source', 'utm_source'], 'website');
  const pageUrl = valueFrom(data, ['page_url']);
  const rowUrl = upstreamPayload && upstreamPayload.sheets_result && upstreamPayload.sheets_result.row_url
    ? cleanValue(upstreamPayload.sheets_result.row_url)
    : '';

  return {
    _subject: `New Think Green lead: ${name || ticketId}`,
    _template: 'table',
    _captcha: 'false',
    _replyto: email,
    ticket_id: ticketId,
    name,
    phone,
    email,
    service,
    city,
    budget_range: budget,
    start_timeline: timeline,
    lead_source: source,
    notes,
    lead_dashboard: rowUrl,
    page_url: pageUrl,
    backup_notice: 'Sent by Cloudflare Pages backup owner notification.'
  };
}

async function sendOwnerBackupNotification(data, upstreamPayload, env = {}) {
  if (!OWNER_NOTIFY_EMAIL) {
    return { skipped: true, reason: 'missing_owner_notify_email' };
  }

  const ownerBackupWebhookUrl = cleanValue(env.OWNER_BACKUP_WEBHOOK_URL);
  const ownerBackupWebhookSecret = cleanValue(env.OWNER_BACKUP_WEBHOOK_SECRET);

  if (ownerBackupWebhookUrl) {
    const webhookPayload = buildOwnerBackupMessage(data || {}, upstreamPayload || {});
    const response = await fetch(ownerBackupWebhookUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        secret: ownerBackupWebhookSecret,
        to: OWNER_NOTIFY_EMAIL,
        lead: webhookPayload
      })
    });

    const body = await response.text();
    const payload = parseJson(body);
    if (!response.ok || (payload && payload.ok === false)) {
      return {
        ok: false,
        provider: 'owner_webhook',
        status: response.status,
        error: payload && payload.error ? cleanValue(payload.error) : body.slice(0, 500)
      };
    }

    return {
      ok: true,
      provider: 'owner_webhook',
      status: response.status,
      response: payload || body.slice(0, 500)
    };
  }

  const response = await fetch(FORM_SUBMIT_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: SITE_ORIGIN,
      referer: `${SITE_ORIGIN}/free-consultation`
    },
    body: JSON.stringify(buildOwnerBackupMessage(data || {}, upstreamPayload || {}))
  });

  const body = await response.text();
  const payload = parseJson(body);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body.slice(0, 500)
    };
  }

  if (payload && String(payload.success).toLowerCase() === 'false') {
    const message = cleanValue(payload.message);
    return {
      ok: false,
      status: response.status,
      reason: /activation/i.test(message) ? 'activation_required' : 'formsubmit_rejected',
      message
    };
  }

  return {
    ok: true,
    status: response.status,
    response: payload || body.slice(0, 500)
  };
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

export async function onRequest({ request, env }) {
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
  const requestText = new TextDecoder().decode(requestBody.slice(0));
  const requestPayload = parseJson(requestText) || {};

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

      if (upstream.ok) {
        const ownerBackupResult = await sendOwnerBackupNotification(requestPayload, payload || {}, env || {});
        if (payload && typeof payload === 'object') {
          payload.owner_backup_result = ownerBackupResult;
          return new Response(JSON.stringify(payload), {
            status: upstream.status,
            headers: responseHeaders()
          });
        }
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
