#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const sitemapPath = path.join(root, 'sitemap.xml');
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function routeToFile(route) {
  const cleanRoute = String(route || '/').replace(/\/+$/, '') || '/';
  if (cleanRoute === '/') return 'index.html';
  return `${cleanRoute.replace(/^\//, '')}.html`;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function visibleText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function countPhrase(text, phrase) {
  return (text.match(new RegExp(`\\b${escapeRegExp(phrase.toLowerCase())}\\b`, 'g')) || []).length;
}

const phraseRules = [
  { phrase: 'next step', perPageMax: 4, globalMax: 26 },
  { phrase: 'cleaner', perPageMax: 4, globalMax: 30 },
  { phrase: 'premium', perPageMax: 5, globalMax: 65 },
  { phrase: 'outdoor living', perPageMax: 8, globalMax: 70 },
  { phrase: 'curb appeal', perPageMax: 5, globalMax: 35 },
  { phrase: 'project fit', perPageMax: 2, globalMax: 10 },
  { phrase: 'transformation', perPageMax: 4, globalMax: 14 },
  { phrase: 'one accountable team', perPageMax: 2, globalMax: 5 }
];

const bannedGenericPhrases = [
  'bring your vision to life',
  'dream backyard',
  'dream outdoor space',
  'seamless journey',
  'endless possibilities',
  'quality craftsmanship you can trust',
  'turn your dreams into reality',
  'beauty and functionality'
];

if (!fs.existsSync(sitemapPath)) {
  failures.push('sitemap.xml is missing');
} else {
  const routes = [...read('sitemap.xml').matchAll(/<loc>https:\/\/example-website-landscaping\.pages\.dev([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');
  const globalCounts = new Map(phraseRules.map((rule) => [rule.phrase, 0]));

  routes.forEach((route) => {
    const file = routeToFile(route);
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${route}: missing file for copy quality check (${file})`);
      return;
    }

    const text = visibleText(read(file));

    bannedGenericPhrases.forEach((phrase) => {
      if (text.includes(phrase)) {
        failures.push(`${file}: banned generic phrase "${phrase}"`);
      }
    });

    phraseRules.forEach((rule) => {
      const count = countPhrase(text, rule.phrase);
      globalCounts.set(rule.phrase, globalCounts.get(rule.phrase) + count);
      if (count > rule.perPageMax) {
        failures.push(`${file}: phrase "${rule.phrase}" appears ${count} times (max ${rule.perPageMax})`);
      }
    });
  });

  phraseRules.forEach((rule) => {
    const count = globalCounts.get(rule.phrase);
    if (count > rule.globalMax) {
      failures.push(`indexed pages: phrase "${rule.phrase}" appears ${count} times globally (max ${rule.globalMax})`);
    }
  });
}

if (failures.length) {
  console.error('Copy quality check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('Copy quality check passed.');
