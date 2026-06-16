#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.cwd();
const servicesPath = path.join(root, 'services-data.js');
const allowedServiceKeys = new Set([
  'navLabel',
  'title',
  'formValue',
  'metaTitle',
  'metaDescription',
  'heroHeadline',
  'heroSubtext',
  'typicalRange',
  'goodFit',
  'planFor',
  'pricingDrivers',
  'quotePrep',
  'proofBlurbs',
  'whatYouGet',
  'process',
  'serviceAreaText',
  'featuredProject',
  'resources',
  'faqs',
  'gallery'
]);

function loadServicesData() {
  const previousWindow = global.window;
  global.window = {};
  delete require.cache[require.resolve(servicesPath)];
  require(servicesPath);
  const services = Array.isArray(global.window.SERVICES_DATA) ? global.window.SERVICES_DATA : [];
  const proofItems = Array.isArray(global.window.SERVICE_PROOF_ITEMS) ? global.window.SERVICE_PROOF_ITEMS : [];
  global.window = previousWindow;
  return { services, proofItems };
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeService(service, override) {
  const next = { ...service };
  Object.keys(override || {}).forEach((key) => {
    if (key === 'enabled' || key === 'ctaLabel' || key === 'faqNotes' || key === 'photoNotes') return;
    if (!allowedServiceKeys.has(key)) {
      throw new Error(`${service.slug}: "${key}" is not an allowed service override key`);
    }

    const value = override[key];
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      next[key] = value;
      return;
    }
    if (isObject(value) && isObject(next[key])) {
      next[key] = { ...next[key], ...value };
      return;
    }
    next[key] = value;
  });

  return next;
}

function validateOverrides(overrides, services) {
  if (!isObject(overrides)) {
    throw new Error('Override file must contain a serviceContentOverrides object');
  }

  const knownSlugs = new Set(services.map((service) => service.slug));
  Object.keys(overrides).forEach((slug) => {
    if (!knownSlugs.has(slug)) {
      throw new Error(`Unknown service slug in overrides: ${slug}`);
    }
  });
}

function serializeServicesData(services, proofItems) {
  return `(function () {\n` +
    `  'use strict';\n\n` +
    `  window.SERVICES_DATA = ${JSON.stringify(services, null, 4)};\n\n` +
    `  window.SERVICE_PROOF_ITEMS = ${JSON.stringify(proofItems, null, 4)};\n\n` +
    `  window.getServiceBySlug = function getServiceBySlug(slug) {\n` +
    `    if (!slug) return null;\n` +
    `    return (window.SERVICES_DATA || []).find(function (service) {\n` +
    `      return service.slug === slug;\n` +
    `    }) || null;\n` +
    `  };\n` +
    `})();\n`;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/apply-service-content-overrides.js <path-to-service-overrides.json>');
  process.exit(1);
}

const absoluteInputPath = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
const incoming = JSON.parse(fs.readFileSync(absoluteInputPath, 'utf8'));
const overrides = incoming.serviceContentOverrides || incoming;
const { services, proofItems } = loadServicesData();

validateOverrides(overrides, services);

const nextServices = services.map((service) => {
  const override = overrides[service.slug];
  if (!override || override.enabled === false) return service;
  return mergeService(service, override);
});

fs.writeFileSync(servicesPath, serializeServicesData(nextServices, proofItems));

try {
  execFileSync('node', [path.join(root, 'scripts', 'check-service-data-quality.js')], {
    cwd: root,
    stdio: 'pipe'
  });
} catch (error) {
  process.stderr.write(error.stdout || '');
  process.stderr.write(error.stderr || '');
  throw error;
}

console.log(`Applied service content overrides from ${absoluteInputPath}`);
console.log('Run npm run build:assets before deploying so services-data.min.js is regenerated.');
