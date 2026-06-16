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
const utilityPages = new Set([
  '404.html',
  'thank-you.html'
]);

const failures = [];
const warnings = [];
const envExamplePath = path.join(root, '.env.example');
const legacyManifestPath = path.join(root, 'site.webmanifest');
const pricingDocPath = path.join(root, 'docs', 'pricing-and-contracts.md');
const sitemapPath = path.join(root, 'sitemap.xml');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function routeToFile(route) {
  const cleanRoute = String(route || '/').replace(/\/+$/, '') || '/';
  if (cleanRoute === '/') return 'index.html';
  return `${cleanRoute.replace(/^\//, '')}.html`;
}

function extractSitemapRoutes() {
  if (!fs.existsSync(sitemapPath)) {
    failures.push('sitemap.xml: missing sitemap');
    return [];
  }

  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  return [...sitemap.matchAll(/<loc>https:\/\/thinkgreendesignbuild\.com([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');
}

function hasRealQuotePath(html) {
  return /href="\/free-consultation\?[^"]*autostart=1/i.test(html) ||
    /href="\/free-consultation(?:["#?])/i.test(html);
}

function hasOnlyOnPageQuotePath(html) {
  return /(?:Request Free Quote|Get Quote)[\s\S]{0,120}href="#/i.test(html) ||
    /href="#[^"]*(?:consultation|quote|contact)[^"]*"/i.test(html);
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

  if (!/<title>[^<]{12,}<\/title>/i.test(html)) {
    failures.push(`${file}: missing useful title`);
  }

  if (!/<meta name="description" content="[^"]{50,}"/i.test(html)) {
    failures.push(`${file}: missing useful meta description`);
  }

  if (!utilityPages.has(file) && !/rel="canonical"/i.test(html)) {
    failures.push(`${file}: missing canonical link`);
  }

  if (/<script src="[^"]*\.js(?!\?v=)/i.test(html) || /<link rel="stylesheet" href="[^"]*\.css(?!\?v=)/i.test(html)) {
    failures.push(`${file}: unversioned CSS or JS asset reference`);
  }

  if (/Request Free Quote|Get Quote/i.test(html) && !hasRealQuotePath(html)) {
    failures.push(`${file}: quote CTA does not link to the real quote path`);
  }

  if (hasOnlyOnPageQuotePath(html) && !/free-consultation\.html|index\.html/.test(file)) {
    failures.push(`${file}: high-intent quote/contact CTA still points only to an on-page anchor`);
  }
});

const sitemapRoutes = extractSitemapRoutes();
const sitemapFiles = sitemapRoutes.map(routeToFile);
const sitemapFileSet = new Set(sitemapFiles);

sitemapFiles.forEach((file) => {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`sitemap.xml: ${file} listed but file is missing`);
  }
});

mainIndexedPages.forEach((file) => {
  if (!sitemapFileSet.has(file)) {
    failures.push(`${file}: key indexed page missing from sitemap`);
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
