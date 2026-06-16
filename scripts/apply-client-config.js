#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const configPath = path.join(root, 'site-config.js');

function loadSiteConfig() {
  delete require.cache[require.resolve(configPath)];
  return require(configPath);
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

const REPLACE_OBJECT_KEYS = new Set([
  'locationPages',
  'pageConversionGuides'
]);

function merge(target, source) {
  const output = Array.isArray(target) ? target.slice() : { ...target };
  Object.keys(source || {}).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (Array.isArray(sourceValue)) {
      output[key] = sourceValue;
      return;
    }

    if (REPLACE_OBJECT_KEYS.has(key) && isObject(sourceValue)) {
      output[key] = { ...sourceValue };
      return;
    }

    if (isObject(sourceValue) && isObject(targetValue)) {
      output[key] = merge(targetValue, sourceValue);
      return;
    }

    output[key] = sourceValue;
  });
  return output;
}

function validate(config) {
  const required = [
    ['businessName', config.businessName],
    ['shortName', config.shortName],
    ['email', config.email],
    ['ownerEmail', config.ownerEmail],
    ['phone.raw', config.phone && config.phone.raw],
    ['phone.display', config.phone && config.phone.display],
    ['address.line1', config.address && config.address.line1],
    ['address.city', config.address && config.address.city],
    ['address.state', config.address && config.address.state],
    ['address.zip', config.address && config.address.zip],
    ['reviewRating', config.reviewRating],
    ['reviewCount', config.reviewCount],
    ['reviewSource', config.reviewSource],
    ['reviewSourceUrl', config.reviewSourceUrl],
    ['reviewSnapshotDate', config.reviewSnapshotDate]
  ];

  const missing = required
    .filter((entry) => !String(entry[1] || '').trim())
    .map((entry) => entry[0]);

  if (missing.length) {
    throw new Error(`Missing required config fields: ${missing.join(', ')}`);
  }
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listFiles(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'client-builds') return;

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(entryPath, files);
      return;
    }

    files.push(entryPath);
  });

  return files;
}

function replaceLiteral(content, before, after) {
  const oldValue = String(before || '');
  const newValue = String(after || '');

  if (!oldValue || oldValue === newValue) return content;
  return content.replace(new RegExp(escapeRegExp(oldValue), 'g'), newValue);
}

function applyStaticReplacements(previousConfig, nextConfig) {
  const replaceableExtensions = new Set([
    '.html',
    '.xml',
    '.txt',
    '.json',
    '.md',
    '.js',
    '.css'
  ]);
  const skipFiles = new Set([
    path.join(root, 'scripts', 'apply-client-config.js')
  ]);
  const oldPhone = previousConfig.phone || {};
  const newPhone = nextConfig.phone || {};
  const oldReview = previousConfig.reviewSummary || {};
  const newReview = nextConfig.reviewSummary || {};
  const replacements = [
    [previousConfig.siteBaseUrl, nextConfig.siteBaseUrl],
    [previousConfig.businessName, nextConfig.businessName],
    [previousConfig.shortName, nextConfig.shortName],
    [previousConfig.email, nextConfig.email],
    [previousConfig.ownerEmail, nextConfig.ownerEmail],
    [oldPhone.raw, newPhone.raw],
    [oldPhone.display, newPhone.display],
    [previousConfig.reviewSourceUrl, nextConfig.reviewSourceUrl],
    [oldReview.sourceUrl, newReview.sourceUrl]
  ];

  let changedCount = 0;

  listFiles(root)
    .filter((filePath) => replaceableExtensions.has(path.extname(filePath)))
    .filter((filePath) => !skipFiles.has(filePath))
    .forEach((filePath) => {
      const original = fs.readFileSync(filePath, 'utf8');
      const updated = replacements.reduce((content, pair) => replaceLiteral(content, pair[0], pair[1]), original);

      if (updated !== original) {
        fs.writeFileSync(filePath, updated);
        changedCount += 1;
      }
    });

  return changedCount;
}

function serializeConfig(config) {
  return `(function (root, factory) {\n` +
    `  var config = factory();\n\n` +
    `  if (typeof module === 'object' && module.exports) {\n` +
    `    module.exports = config;\n` +
    `  }\n\n` +
    `  if (root) {\n` +
    `    root.SITE_CONFIG = config;\n` +
    `  }\n` +
    `})(typeof globalThis !== 'undefined' ? globalThis : this, function () {\n` +
    `  return ${JSON.stringify(config, null, 2)};\n` +
    `});\n`;
}

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: node scripts/apply-client-config.js <path-to-client-config.json>');
  process.exit(1);
}

const absoluteInputPath = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
const incoming = JSON.parse(fs.readFileSync(absoluteInputPath, 'utf8'));
const currentConfig = loadSiteConfig();
const mergedConfig = merge(currentConfig, incoming);

validate(mergedConfig);
fs.writeFileSync(configPath, serializeConfig(mergedConfig));
const staticFilesUpdated = applyStaticReplacements(currentConfig, mergedConfig);

console.log(`Updated site-config.js from ${absoluteInputPath}`);
console.log(`Updated ${staticFilesUpdated} static template files with client brand/contact/base URL replacements`);
