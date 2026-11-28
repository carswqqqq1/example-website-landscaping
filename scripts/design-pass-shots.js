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
  for (let y = 0; y < height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Show the first hero slide, held, so every run captures the same photo.
  const firstDot = page.locator('.hero__dot[data-slide="0"]');
  if (await firstDot.count()) {
    await firstDot.click().catch(() => {});
    const pause = page.locator('.hero__pause[aria-pressed="false"]');
    if (await pause.count()) await pause.click().catch(() => {});
    await page.mouse.move(1, 1);
    await page.waitForTimeout(2400);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => Promise.all(Array.from(document.images).map((img) =>
    img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 4000); })
  )));
  await page.waitForTimeout(700);
}


// Worst-case contrast of white hero text over the photo: hide the text, grab
// the pixels behind each line, and test white against the brightest 5% of them.
async function heroContrast(page) {
  const sel = '.hero__heading, .hero__sub, .hero__eyebrow, .hero__assure li, .page-hero h1, .page-hero__inner > p, .service-hero h1, .service-hero__sub';
  const rects = await page.evaluate((s) => Array.from(document.querySelectorAll(s)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return { name: (el.className || el.tagName).toString().split(' ')[0], x: r.left, y: r.top, w: r.width, h: r.height };
  }), sel);
  if (!rects.length) return [];
  await page.addStyleTag({ content: sel.split(',').map((x) => x.trim() + '{visibility:hidden !important}').join('\n') + '\n.__dp_contrast{}' });
  const png = await page.screenshot({ type: 'png' });
  await page.evaluate(() => {
    const tags = Array.from(document.querySelectorAll('style')).filter((t) => t.textContent.includes('.__dp_contrast'));
    tags.forEach((t) => t.remove());
  });
  return page.evaluate(async ({ data, rects }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const scale = img.width / window.innerWidth;
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return rects.map((r) => {
      const x = Math.max(0, Math.floor(r.x * scale)), y = Math.max(0, Math.floor(r.y * scale));
      const w = Math.max(1, Math.min(canvas.width - x, Math.floor(r.w * scale))), h = Math.max(1, Math.min(canvas.height - y, Math.floor(r.h * scale)));
      const px = ctx.getImageData(x, y, w, h).data;
      const lums = [];
      for (let i = 0; i < px.length; i += 16) lums.push(0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]));
      lums.sort((a, b) => a - b);
      const p95 = lums[Math.floor(lums.length * 0.95)] || 0;
      const median = lums[Math.floor(lums.length * 0.5)] || 0;
      return { el: r.name, worst: +(1.05 / (p95 + 0.05)).toFixed(2), typical: +(1.05 / (median + 0.05)).toFixed(2) };
    });
  }, { data: png.toString('base64'), rects });
}

// Small text on flat backgrounds below the hero: text colour against the first
// opaque background behind it. Text over photos is skipped (heroContrast covers it).
async function labelContrast(page) {
  return page.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const out = [];
    document.querySelectorAll('main .eyebrow, main [class*="__label"], main .portfolio__tag, main .review-card__sample, main .review-card__who span, main .areas__chips a, main figcaption, main .about-stats__label').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || !el.textContent.trim()) return;
      const fg = parse(cs.color); if (!fg) return;
      let node = el, bg = null;
      while (node && node.nodeType === 1) {
        const ns = getComputedStyle(node);
        if (ns.backgroundImage && ns.backgroundImage !== 'none' && !ns.backgroundImage.startsWith('linear-gradient')) return;
        if (node.tagName === 'FIGURE' && node.querySelector('img') && getComputedStyle(el).position === 'absolute') return;
        const b = parse(ns.backgroundColor);
        if (b && b.a > 0.85) { bg = b; break; }
        node = node.parentElement;
      }
      if (!bg) bg = { r: 255, g: 255, b: 255 };
      const l1 = lum(fg), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 4.5) out.push(el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) + ' (' + ratio.toFixed(2) + ')');
    });
    return Array.from(new Set(out)).slice(0, 15);
  });
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
        const m = await metrics(page);
        m.lowContrastLabels = await labelContrast(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        m.heroTextContrast = await heroContrast(page);
        report[source.label][`${p.name}-${vp.name}`] = m;
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
