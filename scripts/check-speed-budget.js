#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();

const budgets = [
  { file: 'styles.css', maxBytes: 210 * 1024 },
  { file: 'script.js', maxBytes: 260 * 1024 },
  { file: 'portfolio.css', maxBytes: 140 * 1024 },
  { file: 'services.css', maxBytes: 170 * 1024 }
];

const imageBudgets = [
  { file: 'img/projects/slide1.webp', maxBytes: 700 * 1024 },
  { file: 'img/projects/slide6.webp', maxBytes: 700 * 1024 },
  { file: 'img/projects/firepit.jpg', maxBytes: 900 * 1024 },
  { file: 'img/projects/fireplace.jpg', maxBytes: 900 * 1024 }
];

const failures = [];

function fileSize(filePath) {
  const fullPath = path.join(root, filePath);
  const stats = fs.statSync(fullPath);
  return stats.size;
}

for (const budget of budgets) {
  const size = fileSize(budget.file);
  if (size > budget.maxBytes) {
    failures.push(`${budget.file} is ${size} bytes (max ${budget.maxBytes})`);
  }
}

for (const budget of imageBudgets) {
  const size = fileSize(budget.file);
  if (size > budget.maxBytes) {
    failures.push(`${budget.file} is ${size} bytes (max ${budget.maxBytes})`);
  }
}

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const heroSlides = [...indexHtml.matchAll(/<div\b[^>]*>/g)]
  .map((match) => match[0])
  .filter((tag) => {
    const classMatch = tag.match(/\bclass="([^"]*)"/i);
    return classMatch && classMatch[1].split(/\s+/).includes('hero__slide');
  });
const eagerHeroSlides = heroSlides.filter((tag) => /style="[^"]*background-image/i.test(tag));
const deferredHeroSlides = heroSlides.filter((tag) => /data-hero-image-avif=/i.test(tag) && !/style="[^"]*background-image/i.test(tag));

if (heroSlides.length > 1 && eagerHeroSlides.length !== 1) {
  failures.push(`index.html eagerly declares ${eagerHeroSlides.length} hero backgrounds (expected exactly 1)`);
}
if (heroSlides.length > 1 && deferredHeroSlides.length !== heroSlides.length - 1) {
  failures.push('index.html must defer every non-active hero background with data-hero-image attributes');
}

if (failures.length) {
  console.error('Speed budget check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Speed budget check passed.');
