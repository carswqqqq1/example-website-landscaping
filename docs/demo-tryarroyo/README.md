# demo.tryarroyo.com lead flow (restored Nov 24, 2026)

demo.tryarroyo.com is Cloudflare Worker `arroyo-demo-thinkgreen` serving a cleaned mirror of
thinkgreen-az.netlify.app from KV namespace 322b78a643864250bebbb844f00922ee. `worker.js` here is a
copy of the deployed source for reference. It is deployed through the Cloudflare API, not from this repo.

Form flow:
1. The quote form or consult drawer POSTs to demo.tryarroyo.com/api/lead.
2. The Worker checks Origin (demo.tryarroyo.com only), content type and size, then forwards the body
   to https://thinkgreen-az.netlify.app/api/lead (Netlify lead-gateway, then send-ticket-emails).
3. send-ticket-emails sends the owner notification (OWNER_EMAIL) and the customer confirmation by
   Gmail SMTP as carson.elevatemarketing@gmail.com.
4. Only when the customer ticks the optional `sheet_opt_in` box does it append the lead to the
   Google Sheet through the Apps Script webhook (GOOGLE_SHEETS_WEBHOOK_URL).

Netlify deploys come from the Netlify CLI (`netlify deploy --prod --dir . --functions netlify/functions`).
The Cloudflare Pages copy (example-website-landscaping.pages.dev) uses lib/landscape-lead-handler.mjs,
which does not have the opt-in gate yet and has no RESEND_API_KEY.

## Suggested Worker change (not deployed, owner step 2.21)

Checked Nov 2026: `/services/`, `/about/`, `/portfolio/` and `/thank-you/` return 404 on the live
demo because the Worker appends `index.html` to any path ending in `/`, and `/404` returns 200.
`worker.js` in this folder still matches the deployed source. Suggested patch for whoever deploys the
Worker, placed right after the `/api/lead` check and before the `index.html` line:

```js
// Trailing-slash URLs redirect to the clean path. Preview keys under /p/ stay untouched.
if (!isPreview && p.length > 1 && p.endsWith('/')) {
  return Response.redirect(u.origin + u.pathname.replace(/\/+$/, '') + u.search, 301);
}
// The 404 page itself answers with a real 404 status.
if (p === '/404' || p === '/404.html') {
  const nf = await env.SITE.get('/404.html', { type: 'arrayBuffer' });
  return new Response(nf, { status: 404, headers: { 'content-type': T.html, ...extra } });
}
```

After deploying, `/services/` should 301 to `/services`, `/404` should return 404, and every
`/p/<slug>` preview should behave exactly as before.
