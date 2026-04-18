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

const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

htmlFiles.forEach((file) => {
  const html = read(file);

  if (!/<a class="skip-link" href="#main-content">/i.test(html)) {
    failures.push(`${file}: missing skip link to #main-content`);
  }

  if (!/<main[^>]+id="main-content"/i.test(html)) {
    failures.push(`${file}: missing main-content target`);
  }

  if (/class="nav__burger"/i.test(html) && !/aria-expanded="false"/i.test(html)) {
    failures.push(`${file}: nav burger missing default aria-expanded state`);
  }
});

['index.html', 'reviews.html'].forEach((file) => {
  const html = read(file);
  if (!/<noscript>/i.test(html)) {
    failures.push(`${file}: missing noscript fallback message`);
  }
});

if (failures.length) {
  console.error('Accessibility baseline check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Accessibility baseline check passed.');
