#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const sitemapPath = path.join(root, 'sitemap.xml');
const failures = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function routeToFile(route) {
  const cleanRoute = String(route || '/').replace(/\/+$/, '') || '/';
  if (cleanRoute === '/') return 'index.html';
  return `${cleanRoute.replace(/^\//, '')}.html`;
}

function routeIntent(route) {
  if (route === '/') return 'home';
  if (route.startsWith('/services/')) return 'service';
  if (route === '/services') return 'services-hub';
  if (/landscaping|hardscaping|outdoor-kitchens|outdoor-lighting|artificial-turf|pergola-shade|landscape-design/.test(route)) return 'local-money';
  if (/cost|compare|checklist|vs|planning/.test(route)) return 'resource-money';
  if (route === '/portfolio') return 'portfolio';
  if (route === '/free-consultation') return 'quote';
  return 'support';
}

function extractLinks(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: match[1], text: stripTags(match[2]) }))
    .filter((link) => link.href && !/^tel:|^mailto:/i.test(link.href));
}

function isIntentQuoteLabel(text) {
  return text && !/^(?:Contact|Quote|Project Review|Get Quote|Start Project Review|Request My Project Review)$/i.test(text);
}

if (!fs.existsSync(sitemapPath)) {
  failures.push('sitemap.xml is missing');
} else {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const routes = [...sitemap.matchAll(/<loc>https:\/\/example-website-landscaping\.pages\.dev([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');
  const seenH1 = new Map();
  const seenTitle = new Map();

  routes.forEach((route) => {
    const file = routeToFile(route);
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${route}: sitemap file missing (${file})`);
      return;
    }

    const html = read(file);
    const intent = routeIntent(route);
    const h1 = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
    const title = stripTags((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
    const description = (html.match(/<meta name="description" content="([^"]+)"/i) || [])[1] || '';
    const links = extractLinks(html);
    const quoteLinks = links.filter((link) => /free-consultation/.test(link.href));
    const intentQuoteLinks = quoteLinks.filter((link) => isIntentQuoteLabel(link.text));
    const internalLinks = links.filter((link) => link.href.charAt(0) === '/' || link.href.charAt(0) === '#');
    const stickyBar = (html.match(/<div class="sticky-bar"[\s\S]*?<\/div>/i) || [])[0] || '';

    if (h1.length < 16) failures.push(`${file}: H1 is missing or too thin`);
    if (title.length < 20) failures.push(`${file}: title is missing or too thin`);
    if (description.length < 50) failures.push(`${file}: meta description is missing or too thin`);

    if (h1) {
      const prior = seenH1.get(h1);
      if (prior) failures.push(`${file}: duplicate H1 also used by ${prior}`);
      seenH1.set(h1, file);
    }

    if (title) {
      const prior = seenTitle.get(title);
      if (prior) failures.push(`${file}: duplicate title also used by ${prior}`);
      seenTitle.set(title, file);
    }

    if (internalLinks.length < 6 && intent !== 'quote') {
      failures.push(`${file}: too few internal links for navigation and crawl flow`);
    }

    if (['service', 'services-hub', 'local-money', 'resource-money', 'portfolio'].includes(intent)) {
      if (quoteLinks.length < 2) {
        failures.push(`${file}: money page needs multiple quote paths`);
      }
      if (intent !== 'portfolio' && intentQuoteLinks.length < 2) {
        failures.push(`${file}: money page needs at least two intent-labeled quote CTAs`);
      }
      if (!/sticky-bar/.test(html)) {
        failures.push(`${file}: money page missing mobile sticky CTA shell`);
      }
      if (stickyBar && !/free-consultation/.test(stickyBar) && intent !== 'portfolio') {
        failures.push(`${file}: mobile sticky CTA does not include a quote path`);
      }
    }

    if (intent === 'local-money') {
      const cityMatch = h1.match(/\b(Scottsdale|Phoenix|Paradise Valley|Arcadia|Mesa|Chandler|Tempe|Gilbert|Fountain Hills|Cave Creek|Glendale|Peoria|North Phoenix|Ahwatukee)\b/i);
      if (!cityMatch) failures.push(`${file}: local money page H1 should name the target city/area`);
    }

    const assetVersions = [...html.matchAll(/[?&]v=(\d{8}[a-z])/g)].map((match) => match[1]);
    const distinctVersions = [...new Set(assetVersions)];
    if (distinctVersions.length > 1) {
      failures.push(`${file}: mixed asset versions (${distinctVersions.join(', ')})`);
    }

    const bodyWordCount = stripTags(html).split(/\s+/).filter(Boolean).length;
    if (bodyWordCount < 180 && !['quote'].includes(intent)) {
      warnings.push(`${file}: very low text depth (${bodyWordCount} words)`);
    }
  });
}

if (warnings.length) {
  console.warn('Sitemap UX warnings:');
  warnings.forEach((warning) => console.warn(`  ! ${warning}`));
}

if (failures.length) {
  console.error('Sitemap UX quality check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('Sitemap UX quality check passed.');
