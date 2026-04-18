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

const mainIndexedPages = [
  'index.html',
  'services.html',
  'portfolio.html',
  'resources.html',
  'scottsdale-landscaping.html',
  'phoenix-landscaping.html'
];

const failures = [];
const warnings = [];
const envExamplePath = path.join(root, '.env.example');
const legacyManifestPath = path.join(root, 'site.webmanifest');
const pricingDocPath = path.join(root, 'docs', 'pricing-and-contracts.md');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

// HTML checks
htmlFiles.forEach((file) => {
  const html = read(file);

  const manifestMatches = html.match(/rel="manifest"/g) || [];
  if (manifestMatches.length > 1) {
    failures.push(`${file}: duplicate manifest links`);
  }

  if (/https:\/\/fonts\.googleapis\.com/i.test(html)) {
    failures.push(`${file}: external Google Fonts reference found`);
  }

  if (/href="\/#reviews"/i.test(html)) {
    failures.push(`${file}: homepage reviews anchor fallback still present`);
  }

  if (/href="\/#contact"/i.test(html) && file !== 'index.html') {
    failures.push(`${file}: homepage contact fallback still present`);
  }

  if (file === 'index.html' && /<script src="\/site-config\.js"(?![^>]*defer)/i.test(html)) {
    failures.push(`${file}: site-config.js is not deferred`);
  }

  if (file === 'index.html' && /<script src="\/script\.min\.js"(?![^>]*defer)/i.test(html)) {
    failures.push(`${file}: script.min.js is not deferred`);
  }
});

// Canonical + schema checks
mainIndexedPages.forEach((file) => {
  const html = read(file);

  if (!/rel="canonical"/i.test(html)) {
    failures.push(`${file}: missing canonical link`);
  }

  if (!/application\/ld\+json/i.test(html)) {
    failures.push(`${file}: missing JSON-LD schema`);
  }
});

// .env.example checks
if (fs.existsSync(envExamplePath)) {
  const envExample = fs.readFileSync(envExamplePath, 'utf8');

  if (/carsonweso@icloud\.com|carson\.elevatemarketing@gmail\.com/i.test(envExample)) {
    failures.push('.env.example: personal email fallback found');
  }
}

// Legacy manifest check
if (fs.existsSync(legacyManifestPath)) {
  failures.push('site.webmanifest: legacy orphan manifest should be removed');
}

// Pricing doc check (warning only — template may not be in a client build)
if (!fs.existsSync(pricingDocPath)) {
  warnings.push('docs/pricing-and-contracts.md not found — create it before cloning for a new client');
}

// site-config.js demo residue warnings (non-blocking — expected on template branch)
const siteConfigPath = path.join(root, 'site-config.js');
if (fs.existsSync(siteConfigPath)) {
  const siteConfig = fs.readFileSync(siteConfigPath, 'utf8');

  if (/thinkgreen@thinkgreenaz\.com/i.test(siteConfig)) {
    warnings.push('site-config.js: contains Think Green demo email — update for client before launch');
  }

  if (/thinkgreen-az\.netlify\.app/i.test(siteConfig)) {
    warnings.push('site-config.js: contains Think Green demo URL — update for client before launch');
  }
}

// Output
if (warnings.length) {
  console.warn('Site quality warnings:');
  warnings.forEach((warning) => console.warn(`  ! ${warning}`));
}

if (failures.length) {
  console.error('Site quality check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('Site quality check passed.');
