#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function routeToFile(route) {
  const cleanRoute = String(route || '/').replace(/\/+$/, '') || '/';
  if (cleanRoute === '/') return 'index.html';
  return `${cleanRoute.replace(/^\//, '')}.html`;
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractLinks(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: match[1], text: stripTags(match[2]) }))
    .filter((link) => link.href && /free-consultation/.test(link.href));
}

function routeIntent(route) {
  if (route === '/') return 'home';
  if (route.startsWith('/services/')) return 'service';
  if (route === '/services') return 'services-hub';
  if (/landscaping|hardscaping|outdoor-kitchens|outdoor-lighting|artificial-turf|pergola-shade|landscape-design/.test(route)) return 'local-money';
  if (/cost|compare|checklist|vs|planning|best-landscaper/.test(route)) return 'resource-money';
  if (route === '/portfolio') return 'portfolio';
  if (route === '/free-consultation') return 'quote';
  return 'support';
}

function assertIncludes(file, text, label) {
  if (!text.includes(label)) failures.push(`${file}: missing ${label}`);
}

const script = read('script.js');
const functionSource = read(path.join('netlify', 'functions', 'send-ticket-emails.js'));
const requiredHiddenFields = [
  'name="lead_source"',
  'name="utm_source"',
  'name="utm_medium"',
  'name="utm_campaign"',
  'name="utm_content"',
  'name="referrer"',
  'name="landing_path"',
  'name="page_url"',
  'name="selected_service"',
  'name="selected_style"',
  'name="selected_image"',
  'name="selected_project_label"'
];
const requiredFunctionFields = [
  "'lead_source'",
  "'page_url'",
  "'referrer'",
  "'landing_path'",
  "'utm_source'",
  "'utm_medium'",
  "'utm_campaign'",
  "'utm_content'"
];

requiredHiddenFields.forEach((field) => assertIncludes('script.js', script, field));
requiredFunctionFields.forEach((field) => assertIncludes('netlify/functions/send-ticket-emails.js', functionSource, field));

[
  'normalized.referrer',
  'normalized.landing_path',
  'normalized.page_url',
  'ownerSheetValue(row.referrer)',
  'ownerSheetValue(row.landing_path)',
  'ownerSheetValue(row.utm_content)'
].forEach((field) => assertIncludes('netlify/functions/send-ticket-emails.js', functionSource, field));

const sitemapPath = path.join(root, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  failures.push('sitemap.xml is missing');
} else {
  const routes = [...read('sitemap.xml').matchAll(/<loc>https:\/\/example-website-landscaping\.pages\.dev([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');

  routes.forEach((route) => {
    const intent = routeIntent(route);
    if (!['home', 'service', 'services-hub', 'local-money', 'resource-money', 'portfolio'].includes(intent)) return;

    const file = routeToFile(route);
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${route}: missing file for lead routing check (${file})`);
      return;
    }

    const links = extractLinks(read(file));
    const trackedLinks = links.filter((link) => /[?&]source=/.test(link.href) || /autostart=1/.test(link.href));
    if (links.length < 1) failures.push(`${file}: no quote links found for attribution`);
    if (trackedLinks.length < Math.min(2, links.length)) {
      failures.push(`${file}: quote links should include source/autostart attribution (${trackedLinks.length}/${links.length})`);
    }
  });
}

if (failures.length) {
  console.error('Lead routing quality check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('Lead routing quality check passed.');
