#!/usr/bin/env node
/*
 * Before/after screenshots and layout metrics for design passes.
 *
 * Serves two local copies of the site (clean URLs, like the hosts do) and uses
 * Playwright's Chromium to capture each page at 1440 and 390 wide, above the
 * fold and full page, plus a few numbers worth checking by eye: page height,
 * horizontal overflow, tap targets under 44px, and a throttled mobile LCP.
 *
 * Usage:
 *   node scripts/design-pass-shots.js --before <dir> --after <dir> --out <dir>
 *   (either --before or --after may be left out)
 *
 * Needs Playwright with Chromium installed (npx playwright install chromium).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf('--' + name);
  return i === -1 ? '' : args[i + 1];
}

const OUT = path.resolve(arg('out') || 'docs/screenshots/design-pass');
const SOURCES = [
  { label: 'before', dir: arg('before') },
  { label: 'after', dir: arg('after') }
].filter((s) => s.dir);

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'pergola', path: '/services/pergola-shade' },
  { name: 'about', path: '/about' }
];

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900, scale: 1, mobile: false },
  { name: '390', width: 390, height: 844, scale: 2, mobile: true }
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml'
};

function serve(root) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/index';
    const candidates = [rel, rel + '.html', path.join(rel, 'index.html')];
    for (const candidate of candidates) {
      const full = path.join(root, candidate);
      if (!full.startsWith(root)) break;
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(full).pipe(res);
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, base: 'http://127.0.0.1:' + server.address().port }));
  });
}

async function settle(page) {
  // Dismiss the cookie notice so it does not cover the shots.
  const decline = page.locator('[data-cookie-decline], .cookie-banner button:has-text("Decline"), button:has-text("Decline")').first();
  if (await decline.isVisible().catch(() => false)) {
    await decline.click().catch(() => {});
  }
  // Walk the page so lazy images load and reveal animations finish.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => Promise.all(Array.from(document.images).map((img) =>
    img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 4000); })
  )));
  await page.waitForTimeout(700);
}

async function metrics(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const small = [];
    document.querySelectorAll('main a, main button, header a, header button, .mobile-cta a, .mobile-cta-bar a').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') return;
      // Inline text links inside running copy are exempt (WCAG 2.5.8 inline exception).
      if (cs.display === 'inline' && el.closest('p, li')) return;
      if (r.height < 44 || r.width < 44) {
        small.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50) + ' (' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
      }
    });
    const wide = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
        if (!el.closest('[aria-hidden="true"], .hero__slides')) wide.push((el.className && String(el.className).split(' ')[0]) || el.tagName);
      }
    });
    return {
      height: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: vw,
      overflowingElements: Array.from(new Set(wide)).slice(0, 12),
      smallTapTargets: small.length,
      smallTapTargetSamples: small.slice(0, 12)
    };
  });
}

async function mobileLcp(browser, base, pagePath) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  // Roughly Lighthouse's mobile profile: slow 4G and a 4x slower CPU.
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      window.__lcp = last.renderTime || last.loadTime || last.startTime;
      window.__lcpEl = last.element ? (last.element.className || last.element.tagName) : '';
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto(base + pagePath, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(3000);
  const result = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), element: String(window.__lcpEl || '') }));
  await context.close();
  return result;
}

(async () => {
  const { chromium } = require('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = {};

  for (const source of SOURCES) {
    const { server, base } = await serve(source.dir);
    report[source.label] = {};
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.scale,
        isMobile: vp.mobile,
        hasTouch: vp.mobile
      });
      for (const p of PAGES) {
        const page = await context.newPage();
        await page.goto(base + p.path, { waitUntil: 'load', timeout: 60000 });
        await settle(page);
        const stem = path.join(OUT, `${source.label}-${p.name}-${vp.name}`);
        await page.screenshot({ path: stem + '-fold.jpg', type: 'jpeg', quality: 82 });
        await page.screenshot({ path: stem + '-full.jpg', type: 'jpeg', quality: 72, fullPage: true });
        report[source.label][`${p.name}-${vp.name}`] = await metrics(page);
        await page.close();
        console.log(`${source.label} ${p.name} ${vp.name}: ${report[source.label][`${p.name}-${vp.name}`].height}px`);
      }
      await context.close();
    }
    for (const p of PAGES) {
      report[source.label][`${p.name}-390`].throttledLcpMs = await mobileLcp(browser, base, p.path);
    }
    server.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
