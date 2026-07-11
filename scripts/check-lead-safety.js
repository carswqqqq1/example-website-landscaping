#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const originalFetch = global.fetch;
const originalWarn = console.warn;
const originalError = console.error;
let gatewayImportCounter = 0;

const LEAD_ENV_KEYS = [
  'SITE_URL',
  'OWNER_EMAIL',
  'EMAIL_PROVIDER',
  'OWNER_EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'FROM_EMAIL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'GOOGLE_SHEETS_WEBHOOK_URL',
  'GOOGLE_SHEETS_WEBHOOK_SECRET',
  'GOOGLE_SHEET_URL',
  'GOOGLE_SHEET_ID',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'SLACK_WEBHOOK_URL',
  'CRM_WEBHOOK_URL',
  'CRM_WEBHOOK_SECRET',
  'AIRTABLE_WEBHOOK_URL',
  'HUBSPOT_WEBHOOK_URL',
  'LEAD_PROXY_SECRET'
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function resetLeadEnvironment(overrides = {}) {
  LEAD_ENV_KEYS.forEach((key) => delete process.env[key]);
  Object.entries(overrides).forEach(([key, value]) => {
    process.env[key] = String(value);
  });
}

function loadNetlifyHandler(env = {}) {
  resetLeadEnvironment(env);
  const functionPath = path.join(root, 'netlify', 'functions', 'send-ticket-emails.js');
  delete require.cache[require.resolve(functionPath)];
  return require(functionPath).handler;
}

function loadNetlifyGateway(env = {}) {
  resetLeadEnvironment(env);
  const functionPath = path.join(root, 'netlify', 'functions', 'send-ticket-emails.js');
  const gatewayPath = path.join(root, 'netlify', 'functions', 'lead-gateway.js');
  delete require.cache[require.resolve(functionPath)];
  delete require.cache[require.resolve(gatewayPath)];
  return require(gatewayPath).handler;
}

async function loadGateway() {
  gatewayImportCounter += 1;
  const source = `${read('functions/api/lead.js')}\n// deterministic-test-${gatewayImportCounter}`;
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(url);
}

function validLeadPayload(overrides = {}) {
  return {
    form_type: 'project_request',
    ticket_id: 'TG-SAFETY-TEST-001',
    full_name: 'Safety Test',
    email: 'client@example.com',
    email_visible: 'client@example.com',
    phone: '(480) 555-0199',
    city: 'Scottsdale',
    service: 'Landscape Design',
    selected_service: 'Landscape Design',
    contact_consent: 'yes',
    consent_required: '1',
    js_check: '1',
    form_started_at: String(Date.now() - 5000),
    lead_source: 'automated_safety_test',
    page_url: 'https://qa.example.com/free-consultation',
    ...overrides
  };
}

function validNetlifyEvent(payload = validLeadPayload(), overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'x-lead-client-ip': '198.51.100.20',
      'x-lead-proxy-secret': 'shared-test-secret'
    },
    body: JSON.stringify(payload),
    ...overrides
  };
}

function gatewayRequest(payload = validLeadPayload(), options = {}) {
  const origin = options.origin || 'https://example-website-landscaping.pages.dev';
  const contentType = options.contentType || 'application/x-www-form-urlencoded';
  const body = contentType === 'application/json'
    ? JSON.stringify(payload)
    : new URLSearchParams(payload).toString();
  return new Request(`${origin}/api/lead`, {
    method: options.method || 'POST',
    headers: {
      origin: options.requestOrigin || origin,
      'content-type': contentType,
      ...(options.headers || {})
    },
    body: options.method === 'GET' || options.method === 'OPTIONS' ? undefined : body
  });
}

function assertStaticRoutingAndSafety() {
  const script = read('script.js');
  const gateway = read('functions/api/lead.js');
  const netlifyFunction = read('netlify/functions/send-ticket-emails.js');
  const webhook = read('docs/google-sheets-webhook.gs');
  const checklist = read('project-planning-checklist.html');
  const envExample = read('.env.example');

  assert(script.includes("String(SITE_CONFIG.leadEndpoint || '').trim() || '/api/lead'"), 'frontend must use the configured lead endpoint with a same-origin /api/lead default');
  assert(!script.includes('NETLIFY_LEAD_ENDPOINT') && !script.includes('CLOUDFLARE_LEAD_ENDPOINT'), 'frontend must not choose the lead endpoint by hostname');
  assert.strictEqual((script.match(/getOrCreateTicketId\(/g) || []).length >= 4, true, 'all form paths must preserve a ticket ID across retries');
  assert.strictEqual((script.match(/await requireAcceptedLeadResponse\(response\);/g) || []).length, 3, 'all form paths must require a semantic ok response');
  assert(script.includes('window.crypto.randomUUID'), 'ticket IDs should use Web Crypto when available');

  assert(/name="form_started_at"/.test(checklist), 'resource gate must include timing verification');
  assert(/name="js_check"/.test(checklist), 'resource gate must include JavaScript verification');
  assert(/name="contact_consent"[^>]+required/.test(checklist), 'resource gate must require consent');

  assert(!gateway.includes('Access-Control-Allow-Origin'), 'same-origin gateway must not emit wildcard CORS');
  assert(!gateway.includes('FORM_SUBMIT_ENDPOINT') && !gateway.includes('OWNER_BACKUP'), 'gateway must not send a second owner notification');
  assert(!gateway.includes('MAX_ATTEMPTS'), 'gateway must not retry the side-effecting upstream request');
  assert(!gateway.includes('AbortController') && !gateway.includes('UPSTREAM_TIMEOUT_MS'), 'gateway must not create an ambiguous early timeout after upstream side effects');
  assert.strictEqual((gateway.match(/\bfetch\(/g) || []).length, 1, 'gateway must make exactly one upstream fetch');
  assert(gateway.includes('MAX_BODY_BYTES = 64 * 1024'), 'gateway must cap request bodies');
  assert(gateway.includes("'x-lead-proxy-secret': proxySecret"), 'gateway must authenticate to the upstream function');

  assert(!netlifyFunction.includes('shouldSkipDuplicate'), 'backend must not mark a ticket processed before delivery');
  assert(netlifyFunction.includes("headers['Idempotency-Key'] = idempotencyKey"), 'Resend requests must carry idempotency keys');
  assert(netlifyFunction.includes('valueInputOption=RAW'), 'direct Sheets writes must not interpret formulas');
  assert(netlifyFunction.includes('google_sheets_webhook_required_for_atomic_idempotency'), 'production lead capture must require the atomic Apps Script path');
  assert(!netlifyFunction.includes('return sendToGoogleSheetsDirect(row)'), 'non-atomic direct OAuth Sheet writes must not be used for production intake');
  assert(netlifyFunction.includes('sheetsResult.idempotent_replay === true'), 'durable ticket replays must stop before email and CRM side effects');
  assert(netlifyFunction.includes('postJsonOnce') && !netlifyFunction.includes('postJsonWithRetry'), 'CRM fan-out must be at most once per claimed ticket');
  assert(webhook.includes('LockService.getScriptLock()'), 'Apps Script must lock ticket lookup and append');
  assert(webhook.includes('findTicketRow_'), 'Apps Script must reuse an existing exact ticket row');
  assert(webhook.includes('/^[=+\\-@]/'), 'Apps Script must neutralize formula-like values');

  assert(!/OWNER_BACKUP_WEBHOOK_/m.test(envExample), '.env.example must not document the removed duplicate-notification path');
  assert(/^LEAD_BACKEND_ENDPOINT=https:\/\//m.test(envExample), '.env.example must document the backend endpoint');
  assert(/^LEAD_PROXY_SECRET=replace_with_a_long_random_shared_secret$/m.test(envExample), '.env.example must document the shared secret');

  const netlifyConfig = read('netlify.toml');
  assert(/from\s*=\s*"\/favicon\.ico"[\s\S]{0,160}to\s*=\s*"\/img\/favicon-32\.png"[\s\S]{0,80}status\s*=\s*200/i.test(netlifyConfig), 'Netlify must route /favicon.ico to the PNG favicon');
  assert(/from\s*=\s*"\/api\/lead"[\s\S]{0,160}to\s*=\s*"\/\.netlify\/functions\/lead-gateway"[\s\S]{0,80}status\s*=\s*200/i.test(netlifyConfig), 'Netlify must preserve the same-origin /api/lead contract through its server-side gateway');
  const netlifyGateway = read('netlify/functions/lead-gateway.js');
  assert(netlifyGateway.includes("'x-lead-proxy-secret': LEAD_PROXY_SECRET"), 'Netlify gateway must inject the server-side shared secret');
  const cloudflareBuild = read('scripts/build-cloudflare-pages.js');
  assert(cloudflareBuild.includes("'/favicon.ico /img/favicon-32.png 200'"), 'Cloudflare build must route /favicon.ico to the PNG favicon');
}

async function assertGatewayBehavior() {
  const gateway = await loadGateway();
  let calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({
      ok: true,
      status: 'accepted',
      ticket_id: 'TG-SAFETY-TEST-001',
      email_results: [{ to: 'private@example.com' }],
      sheets_result: { row_url: 'https://private.example/row' }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const env = {
    LEAD_BACKEND_ENDPOINT: 'https://backend.example/.netlify/functions/send-ticket-emails',
    LEAD_PROXY_SECRET: 'shared-test-secret'
  };
  const accepted = await gateway.onRequest({ request: gatewayRequest(), env });
  const acceptedBody = await accepted.json();
  assert.strictEqual(accepted.status, 200);
  assert.deepStrictEqual(acceptedBody, { ok: true, status: 'accepted', ticket_id: 'TG-SAFETY-TEST-001' });
  assert.strictEqual(calls.length, 1, 'healthy gateway request must invoke upstream exactly once');
  assert.strictEqual(calls[0].url, env.LEAD_BACKEND_ENDPOINT);
  assert.strictEqual(new Headers(calls[0].options.headers).get('x-lead-proxy-secret'), env.LEAD_PROXY_SECRET);
  assert.strictEqual(JSON.parse(calls[0].options.body).full_name, 'Safety Test', 'urlencoded input must reach upstream as validated JSON');
  assert.strictEqual(accepted.headers.get('access-control-allow-origin'), null, 'gateway must not expose CORS');
  assert.strictEqual(accepted.headers.get('cache-control'), 'no-store');

  calls = [];
  const crossOrigin = await gateway.onRequest({
    request: gatewayRequest(validLeadPayload(), { requestOrigin: 'https://attacker.example' }),
    env
  });
  assert.strictEqual(crossOrigin.status, 403);
  assert.strictEqual(calls.length, 0);

  const invalidConsent = await gateway.onRequest({
    request: gatewayRequest(validLeadPayload({ contact_consent: '' })),
    env
  });
  assert.strictEqual(invalidConsent.status, 422);
  assert.strictEqual(calls.length, 0);

  const oversized = await gateway.onRequest({
    request: gatewayRequest(validLeadPayload({ message: 'x'.repeat(70 * 1024) })),
    env
  });
  assert.strictEqual(oversized.status, 413);
  assert.strictEqual(calls.length, 0);

  const methodRejected = await gateway.onRequest({
    request: gatewayRequest({}, { method: 'OPTIONS' }),
    env
  });
  assert.strictEqual(methodRejected.status, 405);
  assert.strictEqual(methodRejected.headers.get('access-control-allow-origin'), null);

  const missingSecret = await gateway.onRequest({ request: gatewayRequest(), env: {} });
  assert.strictEqual(missingSecret.status, 503);
  assert.strictEqual(calls.length, 0);

  calls = [];
  global.fetch = async () => {
    calls.push('upstream');
    return new Response(JSON.stringify({ ok: false, error: 'private backend detail' }), { status: 503 });
  };
  const failed = await gateway.onRequest({ request: gatewayRequest(), env });
  const failedBody = await failed.json();
  assert.strictEqual(failed.status, 503);
  assert.strictEqual(calls.length, 1, 'gateway must not retry a failed composite submission');
  assert(!JSON.stringify(failedBody).includes('private backend detail'), 'gateway must sanitize upstream failures');

  calls = [];
  global.fetch = async () => {
    calls.push('upstream');
    return new Response(JSON.stringify({ ok: true, status: 'accepted_with_warning', ticket_id: 'TG-SAFETY-JSON-1', internal: 'private' }), { status: 202 });
  };
  const jsonPayload = validLeadPayload({ ticket_id: 'TG-SAFETY-JSON-1' });
  const partial = await gateway.onRequest({
    request: gatewayRequest(jsonPayload, { contentType: 'application/json' }),
    env
  });
  assert.strictEqual(partial.status, 202);
  assert.deepStrictEqual(await partial.json(), { ok: true, status: 'accepted_with_warning', ticket_id: 'TG-SAFETY-JSON-1' });
  assert.strictEqual(calls.length, 1);
}

async function assertNetlifyAcceptedAndEmailRendering() {
  const handler = loadNetlifyHandler({
    SITE_URL: 'https://qa.example.com///',
    OWNER_EMAIL: 'owner-override@example.com',
    EMAIL_PROVIDER: 'resend',
    OWNER_EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_test_only',
    RESEND_FROM_EMAIL: 'Think Green <sender@example.com>',
    GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.example/lead',
    GOOGLE_SHEETS_WEBHOOK_SECRET: 'sheet-secret',
    LEAD_PROXY_SECRET: 'shared-test-secret'
  });

  const capturedEmails = [];
  global.fetch = async (url, options = {}) => {
    if (String(url) === 'https://script.example/lead') {
      return new Response(JSON.stringify({
        ok: true,
        row_id: '12',
        row_url: 'https://docs.example/row/12',
        status: 'New',
        spreadsheet_url: 'https://docs.example/sheet'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    assert.strictEqual(String(url), 'https://api.resend.com/emails', `unexpected external request in safety test: ${url}`);
    capturedEmails.push({
      body: JSON.parse(String(options.body || '{}')),
      idempotencyKey: new Headers(options.headers).get('idempotency-key')
    });
    return new Response(JSON.stringify({ id: `email-${capturedEmails.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const response = await handler(validNetlifyEvent());
  const body = JSON.parse(response.body);
  assert.strictEqual(response.statusCode, 200, `lead handler returned ${response.statusCode}: ${response.body}`);
  assert.deepStrictEqual(body, { ok: true, status: 'accepted', ticket_id: 'TG-SAFETY-TEST-001' }, 'backend response must not leak delivery internals');
  assert.strictEqual(capturedEmails.length, 2, 'lead handler must render owner and client emails');

  const ownerEmail = capturedEmails.find((email) => email.body.to === 'owner-override@example.com');
  const clientEmail = capturedEmails.find((email) => email.body.to === 'client@example.com');
  assert(ownerEmail, 'OWNER_EMAIL must override the configured owner address');
  assert(clientEmail, 'client confirmation email was not rendered');
  assert.strictEqual(ownerEmail.idempotencyKey, 'lead_owner_TG-SAFETY-TEST-001');
  assert.strictEqual(clientEmail.idempotencyKey, 'lead_client_TG-SAFETY-TEST-001');
  assert(ownerEmail.body.html.includes('https://qa.example.com/img/logo.png'), 'owner email logo must use an absolute SITE_URL');
  assert(clientEmail.body.html.includes('https://qa.example.com/img/logo.png'), 'client email logo must use an absolute SITE_URL');
  assert(clientEmail.body.html.includes('https://qa.example.com/portfolio'), 'client email CTA must use an absolute SITE_URL');
  assert(!/\b(?:src|href)="\/(?:img\/logo\.png|portfolio)"/i.test(`${ownerEmail.body.html}\n${clientEmail.body.html}`), 'email templates must not render relative logo or portfolio URLs');
}

async function assertNetlifyFailureSemantics() {
  global.fetch = async () => {
    throw new Error('no external request expected');
  };

  let handler = loadNetlifyHandler({});
  let response = await handler(validNetlifyEvent());
  assert.strictEqual(response.statusCode, 503, 'backend must fail closed when LEAD_PROXY_SECRET is missing');

  handler = loadNetlifyHandler({ LEAD_PROXY_SECRET: 'shared-test-secret' });
  response = await handler(validNetlifyEvent());
  let body = JSON.parse(response.body);
  assert.strictEqual(response.statusCode, 503, 'missing Sheet and email providers must fail closed');
  assert.deepStrictEqual(body, {
    ok: false,
    status: 'unavailable',
    ticket_id: 'TG-SAFETY-TEST-001',
    error: 'Lead routing is temporarily unavailable. Please call us directly.'
  });

  response = await handler(validNetlifyEvent(validLeadPayload(), { httpMethod: 'GET' }));
  assert.strictEqual(response.statusCode, 405, 'backend must reject GET');

  const wrongTypeEvent = validNetlifyEvent();
  wrongTypeEvent.headers['content-type'] = 'text/plain';
  response = await handler(wrongTypeEvent);
  assert.strictEqual(response.statusCode, 415, 'backend must reject unsupported request media types');

  const badSecretEvent = validNetlifyEvent();
  badSecretEvent.headers['x-lead-proxy-secret'] = 'wrong-secret';
  response = await handler(badSecretEvent);
  assert.strictEqual(response.statusCode, 401, 'backend must reject an invalid configured proxy secret');

  response = await handler(validNetlifyEvent(validLeadPayload({ contact_consent: '' })));
  assert.strictEqual(response.statusCode, 422, 'backend must enforce consent independently of the browser');

  handler = loadNetlifyHandler({
    OWNER_EMAIL: 'owner@example.com',
    EMAIL_PROVIDER: 'resend',
    OWNER_EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_test_only',
    RESEND_FROM_EMAIL: 'Think Green <sender@example.com>',
    LEAD_PROXY_SECRET: 'shared-test-secret'
  });
  let resendAttempts = 0;
  global.fetch = async () => {
    resendAttempts += 1;
    return new Response(JSON.stringify({ error: 'simulated' }), { status: 503, headers: { 'content-type': 'application/json' } });
  };
  const firstFailure = await handler(validNetlifyEvent(validLeadPayload({ email: '', email_visible: '' })));
  const secondFailure = await handler(validNetlifyEvent(validLeadPayload({ email: '', email_visible: '' })));
  assert.strictEqual(firstFailure.statusCode, 503);
  assert.strictEqual(secondFailure.statusCode, 503, 'a failed ticket must not be cached as a successful duplicate');
  assert.strictEqual(resendAttempts, 0, 'email side effects must not run without a durable Sheet ticket claim');
}

async function assertNetlifyPartialOutcome() {
  const handler = loadNetlifyHandler({
    OWNER_EMAIL: 'owner@example.com',
    EMAIL_PROVIDER: 'resend',
    OWNER_EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_test_only',
    RESEND_FROM_EMAIL: 'Think Green <sender@example.com>',
    GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.example/lead',
    GOOGLE_SHEETS_WEBHOOK_SECRET: 'sheet-secret',
    LEAD_PROXY_SECRET: 'shared-test-secret'
  });

  global.fetch = async (url) => {
    if (String(url) === 'https://script.example/lead') {
      return new Response(JSON.stringify({ ok: true, row_id: '20', row_url: 'https://docs.example/20', status: 'New' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'simulated email failure' }), { status: 503, headers: { 'content-type': 'application/json' } });
  };

  const response = await handler(validNetlifyEvent());
  assert.strictEqual(response.statusCode, 202, 'a durable Sheet capture with email failure should be accepted with warning');
  assert.deepStrictEqual(JSON.parse(response.body), {
    ok: true,
    status: 'accepted_with_warning',
    ticket_id: 'TG-SAFETY-TEST-001'
  });
}

async function assertDurableDuplicateTicketBehavior() {
  const handler = loadNetlifyHandler({
    SITE_URL: 'https://qa.example.com',
    OWNER_EMAIL: 'owner@example.com',
    EMAIL_PROVIDER: 'resend',
    OWNER_EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_test_only',
    RESEND_FROM_EMAIL: 'Think Green <sender@example.com>',
    GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.example/lead',
    GOOGLE_SHEETS_WEBHOOK_SECRET: 'sheet-secret',
    CRM_WEBHOOK_URL: 'https://crm.example/lead',
    CRM_WEBHOOK_SECRET: 'crm-secret',
    LEAD_PROXY_SECRET: 'shared-test-secret'
  });

  let sheetCalls = 0;
  let emailCalls = 0;
  let crmCalls = 0;
  global.fetch = async (url, options = {}) => {
    if (String(url) === 'https://script.example/lead') {
      sheetCalls += 1;
      return new Response(JSON.stringify({
        ok: true,
        idempotent_replay: sheetCalls > 1,
        row_id: '25',
        row_url: 'https://docs.example/25',
        status: 'New',
        spreadsheet_url: 'https://docs.example/sheet'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url) === 'https://api.resend.com/emails') {
      emailCalls += 1;
      return new Response(JSON.stringify({ id: `email-${emailCalls}` }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url) === 'https://crm.example/lead') {
      crmCalls += 1;
      assert.strictEqual(new Headers(options.headers).get('x-idempotency-key'), 'lead_crm_TG-SAFETY-TEST-001');
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected external request in duplicate-ticket test: ${url}`);
  };

  const first = await handler(validNetlifyEvent());
  const second = await handler(validNetlifyEvent());
  assert.strictEqual(first.statusCode, 200);
  assert.strictEqual(second.statusCode, 200);
  assert.deepStrictEqual(JSON.parse(second.body), {
    ok: true,
    status: 'accepted',
    ticket_id: 'TG-SAFETY-TEST-001'
  });
  assert.strictEqual(sheetCalls, 2, 'each request should resolve its durable ticket state');
  assert.strictEqual(emailCalls, 2, 'owner and client email must only send on the first durable ticket claim');
  assert.strictEqual(crmCalls, 1, 'CRM fan-out must only run on the first durable ticket claim');
}

async function assertNetlifySameOriginGateway() {
  let gateway = loadNetlifyGateway({});
  global.fetch = async () => {
    throw new Error('no external request expected');
  };
  let response = await gateway({
    httpMethod: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://preview.netlify.app',
      host: 'preview.netlify.app',
      'x-forwarded-proto': 'https'
    },
    body: JSON.stringify(validLeadPayload())
  });
  assert.strictEqual(response.statusCode, 503, 'Netlify gateway must fail closed when its server secret is missing');

  gateway = loadNetlifyGateway({
    SITE_URL: 'https://qa.example.com',
    OWNER_EMAIL: 'owner@example.com',
    EMAIL_PROVIDER: 'resend',
    OWNER_EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_test_only',
    RESEND_FROM_EMAIL: 'Think Green <sender@example.com>',
    GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.example/lead',
    GOOGLE_SHEETS_WEBHOOK_SECRET: 'sheet-secret',
    LEAD_PROXY_SECRET: 'shared-test-secret'
  });
  let externalCalls = 0;
  global.fetch = async (url) => {
    externalCalls += 1;
    if (String(url) === 'https://script.example/lead') {
      return new Response(JSON.stringify({ ok: true, row_id: '30', row_url: 'https://docs.example/30', status: 'New' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ id: `email-${externalCalls}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  response = await gateway({
    httpMethod: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://preview.netlify.app',
      host: 'preview.netlify.app',
      'x-forwarded-proto': 'https',
      'x-nf-client-connection-ip': '198.51.100.40'
    },
    body: JSON.stringify(validLeadPayload())
  });
  assert.strictEqual(response.statusCode, 200, 'Netlify /api/lead gateway should preserve the same-origin submission contract');
  assert.deepStrictEqual(JSON.parse(response.body), {
    ok: true,
    status: 'accepted',
    ticket_id: 'TG-SAFETY-TEST-001'
  });
  assert.strictEqual(externalCalls, 3, 'Netlify gateway should dispatch one Sheet write and two idempotent emails');
}

async function main() {
  console.warn = () => {};
  console.error = () => {};
  try {
    assertStaticRoutingAndSafety();
    await assertGatewayBehavior();
    await assertNetlifyAcceptedAndEmailRendering();
    await assertNetlifyFailureSemantics();
    await assertNetlifyPartialOutcome();
    await assertDurableDuplicateTicketBehavior();
    await assertNetlifySameOriginGateway();
    console.log('Lead and email safety check passed.');
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

main().catch((error) => {
  global.fetch = originalFetch;
  console.warn = originalWarn;
  console.error = originalError;
  console.error(`Lead and email safety check failed: ${error.stack || error.message}`);
  process.exit(1);
});
