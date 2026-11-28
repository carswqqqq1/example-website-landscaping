#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const servicesDir = path.join(root, 'services');
const htmlFiles = fs.readdirSync(root)
  .filter((file) => file.endsWith('.html'))
  .concat(
    fs.readdirSync(servicesDir)
      .filter((file) => file.endsWith('.html'))
      .map((file) => path.join('services', file))
  );

const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

htmlFiles.forEach((file) => {
  const html = read(file);

  if (!/<a class="skip-link" href="#main-content">/i.test(html)) {
    failures.push(`${file}: missing skip link to #main-content`);
  }

  if (!/<main[^>]+id="main-content"/i.test(html)) {
    failures.push(`${file}: missing main-content target`);
  }

  if (/class="nav__burger"/i.test(html) && !/aria-expanded="false"/i.test(html)) {
    failures.push(`${file}: nav burger missing default aria-expanded state`);
  }
});

['index.html', 'reviews.html'].forEach((file) => {
  const html = read(file);
  if (!/<noscript>/i.test(html)) {
    failures.push(`${file}: missing noscript fallback message`);
  }
});

const indexHtml = read('index.html');
// 4.07: the homepage final CTA opens the quote drawer instead of carrying the long form.
// When the form is on the page it must keep these safeguards; when it is not, the drawer
// (built in script.js) must carry them instead.
const homepageHasForm = /id="contact-form"/i.test(indexHtml);
const formSource = homepageHasForm ? indexHtml : read('script.js');
const formLabel = homepageHasForm ? 'index.html: contact form' : 'script.js: quote drawer form';
if (!/name="contact_consent"[^>]*required|required[^>]*name="contact_consent"/i.test(formSource)) {
  failures.push(`${formLabel} missing required contact consent checkbox`);
}
if (!/consent_required/i.test(formSource)) {
  failures.push(`${formLabel} missing consent_required safety field`);
}
if (!/form_started_at/i.test(formSource) || !/js_check/i.test(formSource)) {
  failures.push(`${formLabel} missing anti-abuse timing/javascript fields`);
}
if (!/bot-field/i.test(formSource)) {
  failures.push(`${formLabel} missing honeypot field`);
}
if (homepageHasForm && !/id="form-error"[^>]+role="alert"[^>]+aria-live="polite"/i.test(indexHtml)) {
  failures.push('index.html: contact form error message missing alert live region');
}
if (!homepageHasForm && !/role="alert"/i.test(formSource)) {
  failures.push(`${formLabel} error message missing alert live region`);
}

const script = read('script.js');
if (!/role="dialog" aria-modal="true" aria-labelledby="consult-drawer-title"/i.test(script)) {
  failures.push('script.js: consultation drawer missing accessible dialog attributes');
}
if (!/id="consult-contact-consent"[^']+name="contact_consent"[^']+required/i.test(script)) {
  failures.push('script.js: consultation drawer missing required contact consent checkbox');
}
if (!/name="bot-field"/i.test(script) || !/id="consult-form-started-at"/i.test(script) || !/id="consult-js-check"/i.test(script)) {
  failures.push('script.js: consultation drawer missing matching anti-abuse fields');
}
if (!/id="consult-drawer-error"[^']+role="alert"[^']+aria-live="polite"/i.test(script)) {
  failures.push('script.js: consultation drawer error message missing alert live region');
}

const reviewsHtml = read('reviews.html');
if (!/id="reviews-page-instructions"/i.test(reviewsHtml) || !/id="reviews-grid"[^>]+aria-describedby="reviews-page-instructions"/i.test(reviewsHtml)) {
  failures.push('reviews.html: review grid missing visible instructions and aria-describedby relationship');
}
if (!/textToggle\.setAttribute\('aria-expanded', 'false'\)/i.test(script) || !/textToggle\.setAttribute\('aria-controls', text\.id\)/i.test(script)) {
  failures.push('script.js: long-review disclosure controls missing aria-expanded or aria-controls');
}
if (!/paginationStatus\.setAttribute\('role', 'status'\)/i.test(script) || !/showMore\.setAttribute\('aria-controls', grid\.id\)/i.test(script)) {
  failures.push('script.js: review pagination missing accessible status or controlled-grid relationship');
}

if (failures.length) {
  console.error('Accessibility baseline check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Accessibility baseline check passed.');
