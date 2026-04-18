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

function merge(target, source) {
  const output = Array.isArray(target) ? target.slice() : { ...target };
  Object.keys(source || {}).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (Array.isArray(sourceValue)) {
      output[key] = sourceValue;
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

console.log(`Updated site-config.js from ${absoluteInputPath}`);
