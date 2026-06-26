const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const publicFiles = [
  '404.html',
  'about.html',
  'ahwatukee-landscape-design.html',
  'arcadia-landscaping.html',
  'best-landscaper-scottsdale.html',
  'cave-creek-landscaping.html',
  'chandler-landscaping.html',
  'contact.html',
  'cookie-policy.html',
  'cost-calculator.html',
  'faq.html',
  'financing.html',
  'fonts.css',
  'fonts.min.css',
  'fountain-hills-landscaping.html',
  'free-consultation.html',
  'gilbert-landscaping.html',
  'glendale-hardscaping.html',
  'google-form-intake-generator.txt',
  'index.html',
  'landscaping-cost-scottsdale.html',
  'llms-full.txt',
  'llms.txt',
  'manifest.json',
  'mesa-artificial-turf.html',
  'mesa-landscaping.html',
  'north-phoenix-outdoor-lighting.html',
  'outdoor-kitchen-planning-arizona.html',
  'pages.css',
  'pages.min.css',
  'paradise-valley-landscaping.html',
  'paradise-valley-outdoor-lighting.html',
  'pavers-vs-concrete-arizona.html',
  'peoria-artificial-turf.html',
  'phoenix-landscaping.html',
  'phoenix-outdoor-kitchens.html',
  'portfolio.css',
  'portfolio.html',
  'portfolio.js',
  'portfolio.min.css',
  'portfolio.min.js',
  'privacy-policy.html',
  'process.html',
  'project-planning-checklist.html',
  'projects-data.js',
  'projects-data.min.js',
  'resources.html',
  'reviews.html',
  'robots.txt',
  'scottsdale-hardscaping.html',
  'scottsdale-landscaping.html',
  'script.js',
  'script.min.js',
  'search.html',
  'services-data.js',
  'services-data.min.js',
  'services.css',
  'services.html',
  'services.js',
  'services.min.css',
  'services.min.js',
  'site-config.js',
  'sitemap.xml',
  'styles.css',
  'styles.min.css',
  'tempe-landscaping.html',
  'tempe-pergola-shade.html',
  'terms-of-service.html',
  'thank-you.html',
  'warranty.html',
  'xeriscape-vs-turf-arizona.html'
];

const publicDirs = ['downloads', 'fonts', 'img', 'services'];

function copyFile(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(dist, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing public file: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDir(relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(dist, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing public directory: ${relativePath}`);
  }
  fs.cpSync(source, target, {
    recursive: true,
    filter: (entry) => !entry.includes(`${path.sep}.DS_Store`)
  });
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

publicFiles.forEach(copyFile);
publicDirs.forEach(copyDir);

const headers = [
  '/*',
  '  X-Frame-Options: DENY',
  '  X-XSS-Protection: 1; mode=block',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()',
  '',
  '/*.min.css',
  '  Cache-Control: public, max-age=604800, must-revalidate',
  '',
  '/*.min.js',
  '  Cache-Control: public, max-age=604800, must-revalidate',
  '',
  '/fonts/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
  '/img/*',
  '  Cache-Control: public, max-age=604800',
  ''
].join('\n');

fs.writeFileSync(path.join(dist, '_headers'), headers);

console.log(`Cloudflare Pages build ready: ${path.relative(root, dist)}`);
