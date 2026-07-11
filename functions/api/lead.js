const DEFAULT_LEAD_BACKEND_ENDPOINT = 'https://thinkgreen-az.netlify.app/.netlify/functions/send-ticket-emails';
const MAX_BODY_BYTES = 64 * 1024;
const MIN_SUBMISSION_MS = 2500;
const MAX_SUBMISSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const FIELD_LIMITS = {
  ticket_id: 128,
  form_type: 32,
  full_name: 120,
  first_name: 80,
  last_name: 80,
  email: 254,
  email_visible: 254,
  phone: 32,
  city: 80,
  service: 120,
  selected_service: 120,
  message: 3000,
  vision: 3000,
  project_address: 240,
  property_address: 240,
  budget_range: 120,
  start_timeline: 120,
  estimated_timeline: 120,
  lead_source: 120,
  page_url: 1000,
  referrer: 1000,
  landing_path: 500,
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_content: 300,
  selected_style: 200,
  selected_image: 1000,
  selected_project_label: 300,
  owner_summary: 3000,
  owner_contact_card: 3000,
  owner_project_snapshot: 5000,
  owner_tracking: 5000
};

class LeadRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function responseHeaders(extra = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra
  };
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(extraHeaders)
  });
}

function cleanValue(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function valueFrom(data, keys, fallback = '') {
  for (const key of keys) {
    const value = cleanValue(data && data[key]);
    if (value) return value;
  }
  return fallback;
}

function isConsentGiven(value) {
  return /^(1|true|yes|on|agree|agreed)$/i.test(cleanValue(value));
}

function isValidEmail(value) {
  const email = cleanValue(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(value) {
  const digits = cleanValue(value).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function isValidTicketId(value) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(cleanValue(value));
}

function validateScalarPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new LeadRequestError(422, 'Please review the form and try again.');
  }

  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === 'object') {
      throw new LeadRequestError(422, 'Please review the form and try again.');
    }
    const text = String(value === undefined || value === null ? '' : value);
    const limit = FIELD_LIMITS[key] || 5000;
    if (text.length > limit) {
      throw new LeadRequestError(422, 'One or more fields are too long.');
    }
  }
}

function validateLeadPayload(data, now = Date.now()) {
  validateScalarPayload(data);

  const ticketId = valueFrom(data, ['ticket_id']);
  const fullName = valueFrom(data, ['full_name', 'name']);
  const service = valueFrom(data, ['service', 'selected_service']);
  const email = valueFrom(data, ['email', 'email_visible']);
  const phone = valueFrom(data, ['phone', 'phone_number']);
  const city = valueFrom(data, ['city', 'project_city']);
  const formType = valueFrom(data, ['form_type'], 'project_request');
  const formStartedAt = Number(valueFrom(data, ['form_started_at']));
  const elapsed = now - formStartedAt;

  if (formType !== 'project_request' && formType !== 'resource_gate') {
    throw new LeadRequestError(422, 'Please review the form and try again.');
  }
  if (!isValidTicketId(ticketId)) {
    throw new LeadRequestError(422, 'Please refresh the page and try again.');
  }
  if (fullName.length < 2 || fullName.length > FIELD_LIMITS.full_name) {
    throw new LeadRequestError(422, 'Please enter your name.');
  }
  if (service.length < 2 || service.length > FIELD_LIMITS.service) {
    throw new LeadRequestError(422, 'Please choose a project type.');
  }
  if (cleanValue(data.js_check) !== '1') {
    throw new LeadRequestError(422, 'Submission could not be verified.');
  }
  if (!Number.isFinite(formStartedAt) || elapsed < MIN_SUBMISSION_MS || elapsed > MAX_SUBMISSION_AGE_MS) {
    throw new LeadRequestError(422, 'Please take a moment to review the form before submitting.');
  }
  if (!isConsentGiven(data.contact_consent)) {
    throw new LeadRequestError(422, 'Please confirm we can contact you about this request.');
  }
  if (email && !isValidEmail(email)) {
    throw new LeadRequestError(422, 'Please enter a valid email address.');
  }

  if (formType === 'resource_gate') {
    if (!isValidEmail(email)) {
      throw new LeadRequestError(422, 'Please enter a valid email address.');
    }
    if (service !== 'Project Planning Checklist') {
      throw new LeadRequestError(422, 'Please review the form and try again.');
    }
    if (phone && !isValidPhone(phone)) {
      throw new LeadRequestError(422, 'Please enter a valid phone number.');
    }
  } else {
    if (!isValidPhone(phone)) {
      throw new LeadRequestError(422, 'Please enter a valid phone number.');
    }
    if (city.length < 2 || city.length > FIELD_LIMITS.city) {
      throw new LeadRequestError(422, 'Please enter your city.');
    }
  }

  return { ticketId, formType };
}

async function readBoundedBody(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new LeadRequestError(413, 'Request is too large.');
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new LeadRequestError(413, 'Request is too large.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseRequestBody(text, contentType) {
  if (contentType === 'application/json') {
    try {
      return JSON.parse(text || '{}');
    } catch (error) {
      throw new LeadRequestError(400, 'Request body is not valid JSON.');
    }
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    const payload = Object.create(null);
    const params = new URLSearchParams(text || '');
    for (const [key, value] of params.entries()) payload[key] = value;
    return payload;
  }

  throw new LeadRequestError(415, 'Unsupported request format.');
}

function resolveBackendEndpoint(env) {
  const raw = cleanValue(env && env.LEAD_BACKEND_ENDPOINT) || DEFAULT_LEAD_BACKEND_ENDPOINT;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch (error) {
    return '';
  }
}

function sanitizeAcceptedStatus(value) {
  const status = cleanValue(value);
  if (status === 'accepted' || status === 'accepted_with_warning') return status;
  return '';
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405, { allow: 'POST' });
  }

  const requestUrl = new URL(request.url);
  const origin = cleanValue(request.headers.get('origin'));
  if (!origin || origin !== requestUrl.origin) {
    return jsonResponse({ ok: false, error: 'Request origin is not allowed.' }, 403);
  }

  const contentType = cleanValue(request.headers.get('content-type')).split(';')[0].toLowerCase();
  if (contentType !== 'application/json' && contentType !== 'application/x-www-form-urlencoded') {
    return jsonResponse({ ok: false, error: 'Unsupported request format.' }, 415);
  }

  try {
    const text = await readBoundedBody(request);
    const data = parseRequestBody(text, contentType);

    if (cleanValue(data['bot-field'] || data.bot_field)) {
      return jsonResponse({ ok: true, status: 'accepted', ticket_id: valueFrom(data, ['ticket_id']) }, 200);
    }

    const { ticketId } = validateLeadPayload(data);
    const backendEndpoint = resolveBackendEndpoint(env || {});
    const proxySecret = cleanValue(env && env.LEAD_PROXY_SECRET);
    if (!backendEndpoint || !proxySecret) {
      console.error(JSON.stringify({ message: 'lead gateway is not configured', has_backend: Boolean(backendEndpoint), has_secret: Boolean(proxySecret) }));
      return jsonResponse({ ok: false, error: 'Lead routing is temporarily unavailable. Please call us directly.' }, 503);
    }

    const upstreamHeaders = new Headers({
      accept: 'application/json',
      'content-type': 'application/json',
      'x-lead-proxy-secret': proxySecret
    });
    const clientIp = cleanValue(request.headers.get('cf-connecting-ip'));
    if (clientIp && clientIp.length <= 64) upstreamHeaders.set('x-lead-client-ip', clientIp);

    let upstream;
    try {
      upstream = await fetch(backendEndpoint, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error(JSON.stringify({ message: 'lead upstream request failed', ticket_id: ticketId, error: cleanValue(error && error.message) }));
      return jsonResponse({ ok: false, error: 'Lead routing is temporarily unavailable. Please call us directly.' }, 503);
    }

    const payload = await upstream.json().catch(() => null);
    if (upstream.ok && payload && payload.ok === true) {
      const status = sanitizeAcceptedStatus(payload.status);
      if (!status) {
        console.error(JSON.stringify({ message: 'lead upstream returned an invalid success status', ticket_id: ticketId, status: upstream.status }));
        return jsonResponse({ ok: false, error: 'Lead routing is temporarily unavailable. Please call us directly.' }, 503);
      }
      return jsonResponse({
        ok: true,
        status,
        ticket_id: valueFrom(payload, ['ticket_id'], ticketId)
      }, status === 'accepted_with_warning' ? 202 : 200);
    }

    if (upstream.status === 422) {
      return jsonResponse({ ok: false, error: 'Please review the form and try again.' }, 422);
    }
    if (upstream.status === 429) {
      return jsonResponse({ ok: false, error: 'Too many submissions. Please wait a few minutes and try again.' }, 429);
    }

    console.error(JSON.stringify({ message: 'lead upstream rejected request', ticket_id: ticketId, status: upstream.status }));
    return jsonResponse({ ok: false, error: 'Lead routing is temporarily unavailable. Please call us directly.' }, 503);
  } catch (error) {
    if (error instanceof LeadRequestError) {
      return jsonResponse({ ok: false, error: error.message }, error.status);
    }
    console.error(JSON.stringify({ message: 'lead gateway error', error: cleanValue(error && error.message) }));
    return jsonResponse({ ok: false, error: 'Lead routing is temporarily unavailable. Please call us directly.' }, 503);
  }
}
