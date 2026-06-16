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

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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

function routeCity(route) {
  const cityMap = [
    ['scottsdale', 'Scottsdale'],
    ['phoenix', 'Phoenix'],
    ['paradise-valley', 'Paradise Valley'],
    ['arcadia', 'Arcadia'],
    ['mesa', 'Mesa'],
    ['chandler', 'Chandler'],
    ['tempe', 'Tempe'],
    ['gilbert', 'Gilbert'],
    ['fountain-hills', 'Fountain Hills'],
    ['cave-creek', 'Cave Creek'],
    ['glendale', 'Glendale'],
    ['peoria', 'Peoria'],
    ['north-phoenix', 'North Phoenix'],
    ['ahwatukee', 'Ahwatukee']
  ];
  const match = cityMap.find(([slug]) => route.includes(slug));
  return match ? match[1] : '';
}

function extractJsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim());
}

function hasJsonLdType(html, typeName) {
  return extractJsonLdBlocks(html).some((block) => block.includes(`"@type": "${typeName}"`) || block.includes(`"@type":"${typeName}"`));
}

function canonicalFor(route) {
  return `https://thinkgreendesignbuild.com${route === '/' ? '/' : route}`;
}

if (!fs.existsSync(sitemapPath)) {
  failures.push('sitemap.xml is missing');
} else {
  const routes = [...read('sitemap.xml').matchAll(/<loc>https:\/\/thinkgreendesignbuild\.com([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');

  routes.forEach((route) => {
    const file = routeToFile(route);
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${route}: sitemap file missing (${file})`);
      return;
    }

    const html = read(file);
    const intent = routeIntent(route);
    const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    const h1 = stripTags(h1Matches[0] && h1Matches[0][1]);
    const canonical = (html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i) || [])[1] || '';
    const city = routeCity(route);

    if (h1Matches.length !== 1) failures.push(`${file}: expected exactly one H1, found ${h1Matches.length}`);
    if (!canonical) failures.push(`${file}: missing canonical`);
    if (canonical && canonical !== canonicalFor(route)) {
      failures.push(`${file}: canonical ${canonical} does not match sitemap route ${canonicalFor(route)}`);
    }

    if (route !== '/' && !/class="breadcrumbs"|class="service-breadcrumb"/.test(html)) {
      failures.push(`${file}: missing visible breadcrumb navigation`);
    }

    if (['service', 'services-hub', 'local-money', 'resource-money', 'portfolio', 'quote'].includes(intent) && !hasJsonLdType(html, 'BreadcrumbList')) {
      failures.push(`${file}: indexed money/support page missing BreadcrumbList JSON-LD`);
    }

    if (intent === 'local-money') {
      if (city && !new RegExp(`\\b${city.replace(/\s+/g, '\\s+')}\\b`, 'i').test(h1 + ' ' + stripTags(html))) {
        failures.push(`${file}: local page should visibly mention ${city}`);
      }
      if (!hasJsonLdType(html, 'Service')) {
        failures.push(`${file}: local money page missing Service JSON-LD`);
      }
      if (!/"areaServed"\s*:/.test(html)) {
        failures.push(`${file}: local money page Service schema missing areaServed`);
      }
    }

    if (intent === 'service' && !hasJsonLdType(html, 'Service')) {
      failures.push(`${file}: service page missing Service JSON-LD`);
    }
  });
}

if (failures.length) {
  console.error('Local SEO quality check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('Local SEO quality check passed.');
