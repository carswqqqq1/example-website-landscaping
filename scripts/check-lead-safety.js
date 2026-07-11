#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = process.cwd();
const ownerTemplate = fs.readFileSync(path.join(root, "emails", "thinkgreen-owner-email.html"), "utf8");
const clientTemplate = fs.readFileSync(path.join(root, "emails", "thinkgreen-client-email.html"), "utf8");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function validLeadPayload(overrides = {}) {
  return {
    form_type: "project_request",
    ticket_id: "TG-SAFETY-TEST-001",
    full_name: "Safety Test",
    email: "client@example.com",
    email_visible: "client@example.com",
    phone: "(480) 555-0199",
    city: "Scottsdale",
    service: "Landscape Design",
    selected_service: "Landscape Design",
    contact_consent: "yes",
    consent_required: "1",
    js_check: "1",
    form_started_at: String(Date.now() - 5000),
    lead_source: "automated_safety_test",
    page_url: "https://qa.example.com/free-consultation",
    message: "I want a complete backyard landscape design with shade and better outdoor flow.",
    ...overrides
  };
}

function requestFor(payload = validLeadPayload(), options = {}) {
  const origin = options.origin || "https://qa.example.com";
  const contentType = options.contentType || "application/x-www-form-urlencoded";
  const body = contentType === "application/json"
    ? JSON.stringify(payload)
    : new URLSearchParams(payload).toString();
  const method = options.method || "POST";
  return new Request(`${origin}/api/lead`, {
    method,
    headers: {
      origin: options.requestOrigin || origin,
      "content-type": contentType,
      ...(options.headers || {})
    },
    body: method === "GET" || method === "OPTIONS" ? undefined : body
  });
}

function productionEnv(overrides = {}) {
  return {
    SITE_URL: "https://qa.example.com///",
    OWNER_EMAIL: "owner@example.com",
    RESEND_API_KEY: "re_test_only",
    RESEND_FROM_EMAIL: "Think Green <sender@example.com>",
    GOOGLE_SHEETS_WEBHOOK_URL: "https://script.example/lead",
    GOOGLE_SHEETS_WEBHOOK_SECRET: "sheet-secret",
    GOOGLE_SHEET_URL: "https://docs.example/sheet",
    ...overrides
  };
}

async function responseBody(response) {
  return JSON.parse(await response.text());
}

function assertStaticRoutingAndSafety() {
  const browserScript = read("script.js");
  const entry = read("functions/api/lead.js");
  const handler = read("lib/landscape-lead-handler.mjs");
  const webhook = read("docs/google-sheets-webhook.gs");
  const checklist = read("project-planning-checklist.html");
  const envExample = read(".env.example");
  const packageJson = read("package.json");

  assert(browserScript.includes("String(SITE_CONFIG.leadEndpoint || '').trim() || '/api/lead'"), "frontend must default to same-origin /api/lead");
  assert(!browserScript.includes("NETLIFY_LEAD_ENDPOINT") && !browserScript.includes("CLOUDFLARE_LEAD_ENDPOINT"), "frontend must not choose lead routing by hostname");
  assert.strictEqual((browserScript.match(/getOrCreateTicketId\(/g) || []).length >= 4, true, "all form paths must preserve a ticket ID across retries");
  assert.strictEqual((browserScript.match(/await requireAcceptedLeadResponse\(response\);/g) || []).length, 3, "all form paths must require a semantic accepted response");
  assert(browserScript.includes("window.crypto.randomUUID"), "browser ticket IDs should use Web Crypto");

  assert(/name="form_started_at"/.test(checklist), "resource gate must include timing verification");
  assert(/name="js_check"/.test(checklist), "resource gate must include JavaScript verification");
  assert(/name="contact_consent"[^>]+required/.test(checklist), "resource gate must require consent");

  assert(entry.includes("landscape-lead-handler.mjs"), "Pages Function must use the native Cloudflare handler");
  assert(entry.includes("thinkgreen-owner-email.html") && entry.includes("thinkgreen-client-email.html"), "Pages Function must bundle the branded templates as text modules");
  assert(!/netlify|LEAD_BACKEND_ENDPOINT|LEAD_PROXY_SECRET/i.test(entry), "Pages Function must not proxy to another hosting platform");
  assert(!/\brequire\s*\(|\bprocess\.env\b|\bBuffer\b|node:|nodemailer|appendFileSync|readFileSync/.test(handler), "runtime handler must use Web APIs only");
  assert(handler.includes('headers["Idempotency-Key"] = idempotencyKey'), "Resend requests must carry ticket-scoped idempotency keys");
  assert(handler.includes("sheetsResult.idempotent_replay === true"), "durable ticket replays must stop before email and CRM side effects");
  assert(handler.includes("postJsonOnce") && !handler.includes("postJsonWithRetry"), "CRM fan-out must be at most once per claimed ticket");
  assert(handler.includes("MAX_BODY_BYTES = 64 * 1024"), "handler must cap request bodies");
  assert(!/netlify|LEAD_BACKEND_ENDPOINT|LEAD_PROXY_SECRET|SMTP_/i.test(envExample), "environment template must describe only the Cloudflare runtime");
  assert(!/deploy:netlify|nodemailer/i.test(packageJson), "package scripts and dependencies must be Cloudflare-only");

  assert(webhook.includes("LockService.getScriptLock()"), "Apps Script must lock ticket lookup and append");
  assert(webhook.includes("findTicketRow_"), "Apps Script must reuse an existing exact ticket row");
  assert(webhook.includes("/^[=+\\-@]/"), "Apps Script must neutralize formula-like values");
  for (const field of ["referrer", "landing_path", "utm_content"]) {
    assert(webhook.includes(`'${field}'`), `Apps Script dashboard must preserve ${field}`);
  }

  const cloudflareBuild = read("scripts/build-cloudflare-pages.js");
  assert(cloudflareBuild.includes("'/favicon.ico /img/favicon-32.png 200'"), "Cloudflare build must route /favicon.ico to the PNG favicon");
  assert(/'\/img\/\*'[\s\S]{0,180}'  Cross-Origin-Resource-Policy: cross-origin'/i.test(cloudflareBuild), "Cloudflare images must remain embeddable in email clients");
}

async function assertAcceptedAndEmailRendering(handleLeadRequest) {
  const calls = [];
  const response = await handleLeadRequest({
    request: requestFor(),
    env: productionEnv(),
    ownerTemplate,
    clientTemplate,
    fetchImpl: async (url, options = {}) => {
      if (String(url) === "https://script.example/lead") {
        calls.push({ type: "sheet", options });
        return new Response(JSON.stringify({
          ok: true,
          row_id: "12",
          row_url: "https://docs.example/row/12",
          status: "New",
          spreadsheet_url: "https://docs.example/sheet"
        }), { status: 200 });
      }
      assert.strictEqual(String(url), "https://api.resend.com/emails", `unexpected external request: ${url}`);
      calls.push({
        type: "email",
        body: JSON.parse(String(options.body || "{}")),
        idempotencyKey: new Headers(options.headers).get("idempotency-key")
      });
      return new Response(JSON.stringify({ id: `email-${calls.length}` }), { status: 200 });
    }
  });
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await responseBody(response), { ok: true, status: "accepted", ticket_id: "TG-SAFETY-TEST-001" });
  const emails = calls.filter((call) => call.type === "email");
  assert.strictEqual(emails.length, 2, "healthy lead must send owner and client emails");
  const ownerEmail = emails.find((email) => email.body.to === "owner@example.com");
  const clientEmail = emails.find((email) => email.body.to === "client@example.com");
  assert(ownerEmail && clientEmail, "expected owner and client recipients");
  assert.strictEqual(ownerEmail.idempotencyKey, "lead_owner_TG-SAFETY-TEST-001");
  assert.strictEqual(clientEmail.idempotencyKey, "lead_client_TG-SAFETY-TEST-001");
  assert(ownerEmail.body.html.includes("https://qa.example.com/img/logo.png"), "owner email logo must be absolute");
  assert(clientEmail.body.html.includes("https://qa.example.com/img/logo.png"), "client email logo must be absolute");
  assert(clientEmail.body.html.includes("https://qa.example.com/portfolio"), "client CTA must be absolute");
  assert(!/\b(?:src|href)="\/(?:img\/logo\.png|portfolio)"/i.test(`${ownerEmail.body.html}\n${clientEmail.body.html}`), "email templates must not render relative brand links");
  const sheetBody = JSON.parse(calls.find((call) => call.type === "sheet").options.body);
  assert.strictEqual(sheetBody.secret, "sheet-secret");
  assert.strictEqual(sheetBody.row.referrer, "direct");
  assert.strictEqual(sheetBody.row.landing_path, "/");
}

async function assertRequestFailures(handleLeadRequest) {
  let fetchCalls = 0;
  const noFetch = async () => {
    fetchCalls += 1;
    throw new Error("no external request expected");
  };
  let response = await handleLeadRequest({
    request: requestFor(validLeadPayload(), { requestOrigin: "https://attacker.example" }),
    env: productionEnv(), ownerTemplate, clientTemplate, fetchImpl: noFetch
  });
  assert.strictEqual(response.status, 403);

  response = await handleLeadRequest({
    request: requestFor(validLeadPayload({ contact_consent: "" })),
    env: productionEnv(), ownerTemplate, clientTemplate, fetchImpl: noFetch
  });
  assert.strictEqual(response.status, 422);

  response = await handleLeadRequest({
    request: requestFor(validLeadPayload({ message: "x".repeat(70 * 1024) })),
    env: productionEnv(), ownerTemplate, clientTemplate, fetchImpl: noFetch
  });
  assert.strictEqual(response.status, 413);

  response = await handleLeadRequest({
    request: requestFor({}, { method: "GET" }),
    env: productionEnv(), ownerTemplate, clientTemplate, fetchImpl: noFetch
  });
  assert.strictEqual(response.status, 405);
  assert.strictEqual(response.headers.get("allow"), "POST");

  response = await handleLeadRequest({
    request: requestFor(validLeadPayload(), { contentType: "text/plain" }),
    env: productionEnv(), ownerTemplate, clientTemplate, fetchImpl: noFetch
  });
  assert.strictEqual(response.status, 415);

  response = await handleLeadRequest({
    request: requestFor(validLeadPayload({ email: "person@mailinator.com", email_visible: "person@mailinator.com" })),
    env: productionEnv(), ownerTemplate, clientTemplate, fetchImpl: noFetch
  });
  assert.strictEqual(response.status, 422);

  response = await handleLeadRequest({
    request: requestFor(validLeadPayload({ "bot-field": "spam" })),
    env: productionEnv(), ownerTemplate, clientTemplate, fetchImpl: noFetch
  });
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await responseBody(response), { ok: true, status: "accepted", ticket_id: "TG-SAFETY-TEST-001" });

  response = await handleLeadRequest({
    request: requestFor(),
    env: productionEnv({ GOOGLE_SHEETS_WEBHOOK_URL: "", GOOGLE_SHEETS_WEBHOOK_SECRET: "" }),
    ownerTemplate, clientTemplate, fetchImpl: noFetch
  });
  assert.strictEqual(response.status, 503, "missing durable Sheet route must fail closed");
  assert.strictEqual(fetchCalls, 0, "rejected requests must not cause side effects");
}

async function assertPartialAndFailureSemantics(handleLeadRequest) {
  let resendCalls = 0;
  let response = await handleLeadRequest({
    request: requestFor(),
    env: productionEnv(), ownerTemplate, clientTemplate,
    fetchImpl: async (url) => {
      if (String(url) === "https://script.example/lead") {
        return new Response(JSON.stringify({ ok: true, row_id: "20", row_url: "https://docs.example/20", status: "New" }), { status: 200 });
      }
      resendCalls += 1;
      return new Response(JSON.stringify({ error: "simulated email failure" }), { status: 503 });
    }
  });
  assert.strictEqual(response.status, 202, "durable capture with an email failure should be accepted with warning");
  assert.deepStrictEqual(await responseBody(response), { ok: true, status: "accepted_with_warning", ticket_id: "TG-SAFETY-TEST-001" });
  assert.strictEqual(resendCalls, 2);

  let sheetCalls = 0;
  resendCalls = 0;
  response = await handleLeadRequest({
    request: requestFor(),
    env: productionEnv(), ownerTemplate, clientTemplate,
    fetchImpl: async (url) => {
      if (String(url) === "https://script.example/lead") {
        sheetCalls += 1;
        return new Response(JSON.stringify({ ok: false, error: "simulated" }), { status: 200 });
      }
      resendCalls += 1;
      throw new Error("email must not run before durable capture");
    }
  });
  assert.strictEqual(response.status, 503);
  assert.strictEqual(sheetCalls, 1);
  assert.strictEqual(resendCalls, 0, "email side effects must not run without a durable ticket claim");
}

async function assertDurableDuplicateBehavior(handleLeadRequest) {
  let sheetCalls = 0;
  let emailCalls = 0;
  let crmCalls = 0;
  const env = productionEnv({ CRM_WEBHOOK_URL: "https://crm.example/lead", CRM_WEBHOOK_SECRET: "crm-secret" });
  const fetchImpl = async (url, options = {}) => {
    if (String(url) === "https://script.example/lead") {
      sheetCalls += 1;
      return new Response(JSON.stringify({
        ok: true,
        idempotent_replay: sheetCalls > 1,
        row_id: "25",
        row_url: "https://docs.example/25",
        status: "New",
        spreadsheet_url: "https://docs.example/sheet"
      }), { status: 200 });
    }
    if (String(url) === "https://api.resend.com/emails") {
      emailCalls += 1;
      return new Response(JSON.stringify({ id: `email-${emailCalls}` }), { status: 200 });
    }
    if (String(url) === "https://crm.example/lead") {
      crmCalls += 1;
      assert.strictEqual(new Headers(options.headers).get("x-idempotency-key"), "lead_crm_TG-SAFETY-TEST-001");
      assert.strictEqual(new Headers(options.headers).get("x-webhook-secret"), "crm-secret");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  };
  const first = await handleLeadRequest({ request: requestFor(), env, ownerTemplate, clientTemplate, fetchImpl });
  const second = await handleLeadRequest({ request: requestFor(), env, ownerTemplate, clientTemplate, fetchImpl });
  assert.strictEqual(first.status, 200);
  assert.strictEqual(second.status, 200);
  assert.deepStrictEqual(await responseBody(second), { ok: true, status: "accepted", ticket_id: "TG-SAFETY-TEST-001" });
  assert.strictEqual(sheetCalls, 2, "each request must resolve durable ticket state");
  assert.strictEqual(emailCalls, 2, "owner and client email must send only on the first claim");
  assert.strictEqual(crmCalls, 1, "CRM fan-out must run only on the first claim");
}

async function assertResourceGate(handleLeadRequest) {
  let emailCalls = 0;
  const payload = validLeadPayload({
    form_type: "resource_gate",
    ticket_id: "TG-RESOURCE-TEST-001",
    service: "Project Planning Checklist",
    selected_service: "Project Planning Checklist",
    phone: "",
    city: ""
  });
  const response = await handleLeadRequest({
    request: requestFor(payload), env: productionEnv(), ownerTemplate, clientTemplate,
    fetchImpl: async (url) => {
      if (String(url) === "https://script.example/lead") {
        return new Response(JSON.stringify({ ok: true, row_id: "31", status: "New" }), { status: 200 });
      }
      emailCalls += 1;
      return new Response(JSON.stringify({ id: `resource-email-${emailCalls}` }), { status: 200 });
    }
  });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(emailCalls, 2, "resource gate should send owner and client emails");
}

async function main() {
  const moduleUrl = `${pathToFileURL(path.join(root, "lib", "landscape-lead-handler.mjs")).href}?test=${Date.now()}`;
  const { handleLeadRequest } = await import(moduleUrl);
  const originalError = console.error;
  const originalLog = console.log;
  console.error = () => {};
  console.log = () => {};
  try {
    assertStaticRoutingAndSafety();
    await assertAcceptedAndEmailRendering(handleLeadRequest);
    await assertRequestFailures(handleLeadRequest);
    await assertPartialAndFailureSemantics(handleLeadRequest);
    await assertDurableDuplicateBehavior(handleLeadRequest);
    await assertResourceGate(handleLeadRequest);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
  console.log("Cloudflare lead and email safety check passed.");
}

main().catch((error) => {
  console.error(`Cloudflare lead and email safety check failed: ${error.stack || error.message}`);
  process.exit(1);
});
