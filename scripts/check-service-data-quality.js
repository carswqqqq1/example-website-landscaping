#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
global.window = {};
require(path.join(root, 'services-data.js'));

const services = Array.isArray(window.SERVICES_DATA) ? window.SERVICES_DATA : [];
const failures = [];

function localAssetExists(assetPath) {
  if (!assetPath || /^(?:https?:)?\/\//i.test(assetPath) || /^data:/i.test(assetPath)) return true;
  return fs.existsSync(path.join(root, assetPath.replace(/^\/+/, '')));
}

function requireArray(service, key, min) {
  const value = service[key];
  if (!Array.isArray(value) || value.length < min) {
    failures.push(`${service.slug}: ${key} needs at least ${min} entries`);
  }
}

function requireText(service, key, minLength = 12) {
  const value = String(service[key] || '').trim();
  if (value.length < minLength) {
    failures.push(`${service.slug}: ${key} is missing useful text`);
  }
}

if (services.length < 8) {
  failures.push('SERVICES_DATA: expected the full service catalog');
}

services.forEach((service) => {
  requireText(service, 'slug', 3);
  requireText(service, 'title', 4);
  requireText(service, 'heroHeadline', 20);
  requireText(service, 'heroSubtext', 60);
  requireText(service, 'typicalRange', 4);
  requireText(service, 'serviceAreaText', 60);
  requireArray(service, 'goodFit', 3);
  requireArray(service, 'planFor', 3);
  requireArray(service, 'proofBlurbs', 3);
  requireArray(service, 'whatYouGet', 5);
  requireArray(service, 'process', 4);
  requireArray(service, 'resources', 3);
  requireArray(service, 'faqs', 5);
  requireArray(service, 'gallery', 4);

  const story = service.featuredProject || {};
  ['title', 'location', 'scope', 'timeline', 'outcome'].forEach((key) => {
    if (!String(story[key] || '').trim()) {
      failures.push(`${service.slug}: featuredProject.${key} is required`);
    }
  });

  (service.faqs || []).forEach((faq, index) => {
    if (!String(faq.q || '').trim().endsWith('?')) {
      failures.push(`${service.slug}: FAQ ${index + 1} should be written as a question`);
    }
    if (String(faq.a || '').trim().length < 45) {
      failures.push(`${service.slug}: FAQ ${index + 1} answer is too thin`);
    }
  });

  (service.gallery || []).forEach((item, index) => {
    ['src', 'alt', 'chip', 'label'].forEach((key) => {
      if (!String(item[key] || '').trim()) {
        failures.push(`${service.slug}: gallery item ${index + 1} missing ${key}`);
      }
    });
    if (!Number(item.width) || !Number(item.height)) {
      failures.push(`${service.slug}: gallery item ${index + 1} missing dimensions`);
    }
    if (!localAssetExists(item.src)) {
      failures.push(`${service.slug}: gallery item ${index + 1} asset missing: ${item.src}`);
    }
  });
});

if (failures.length) {
  console.error('Service data quality check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('Service data quality check passed.');
