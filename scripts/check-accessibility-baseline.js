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
if (!/id="contact-consent"[^>]+name="contact_consent"[^>]+required/i.test(indexHtml)) {
  failures.push('index.html: contact form missing required contact consent checkbox');
}
if (!/name="consent_required" value="1"/i.test(indexHtml)) {
  failures.push('index.html: contact form missing consent_required safety field');
}
if (!/name="form_started_at"/i.test(indexHtml) || !/name="js_check"/i.test(indexHtml)) {
  failures.push('index.html: contact form missing anti-abuse timing/javascript fields');
}
if (!/name="bot-field"/i.test(indexHtml)) {
  failures.push('index.html: contact form missing honeypot field');
}
if (!/id="form-error"[^>]+role="alert"[^>]+aria-live="polite"/i.test(indexHtml)) {
  failures.push('index.html: contact form error message missing alert live region');
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
