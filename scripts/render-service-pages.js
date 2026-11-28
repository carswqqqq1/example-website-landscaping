#!/usr/bin/env node
/*
 * 5.06: renders the one service-detail shell into each services/*.html page.
 *
 * Every detail page gets the same structure: a short hero (title, one sentence,
 * one sample-quote action and a quieter examples link), then three sections only:
 * "What you can plan", "What affects the scope" (with one planning range) and
 * "Example work" (three cards plus a link to /portfolio?service=<slug>).
 *
 * Copy comes from services-data.js plus the short hero lines below. Run it after
 * changing services-data.js:  node scripts/render-service-pages.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadServices() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'services-data.js'), 'utf8'), sandbox);
  return sandbox.window.SERVICES_DATA || [];
}

function loadPricingDrivers() {
  const src = fs.readFileSync(path.join(root, 'services.js'), 'utf8');
  const start = src.indexOf('function pricingDriversFor');
  const objStart = src.indexOf('var fallback = {', start) + 'var fallback = '.length;
  const objEnd = src.indexOf('\n    };', objStart) + '\n    }'.length;
  return vm.runInNewContext('(' + src.slice(objStart, objEnd) + ')');
}

const esc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const quoteHref = (params) => '/free-consultation?' + Object.entries(params)
  .map(([key, value]) => key + '=' + encodeURIComponent(value).replace(/%20/g, '+'))
  .join('&');

// Short hero copy per page: a plain title, one practical sentence, the
// contextual action label, and any page-specific extras from 5.06.
const SHELL = {
  'landscape-design': {
    title: 'Landscape design and build',
    sentence: 'One plan for layout, planting, shade and lighting, then one team to build it.',
    action: 'Plan this landscape',
    rangeLabel: 'Design planning range',
    rangeNote: 'Covers the design phase for a typical Valley yard. Construction is priced from the finished plan.'
  },
  hardscaping: {
    title: 'Patios, walkways and stonework',
    sentence: 'Pavers and stone laid on a proper base, with drainage and edges planned for Arizona heat.',
    action: 'Plan my hardscape'
  },
  'outdoor-kitchens': {
    title: 'Outdoor kitchens',
    sentence: 'Grill, prep and seating laid out around how you cook, with gas, power and shade planned up front.',
    action: 'Plan my outdoor kitchen'
  },
  'outdoor-lighting': {
    title: 'Outdoor lighting',
    sentence: 'Low-voltage path, patio and accent lighting so the yard is safe and usable after dark.',
    action: 'Plan my lighting'
  },
  'pergola-shade': {
    title: 'Pergolas and shade',
    sentence: 'Shade over the patio, kitchen or lounge, sized to the sun and attached the right way.',
    action: 'Plan my shade structure'
  },
  'fire-features': {
    title: 'Fire pits, fireplaces and fire tables',
    sentence: 'A fire pit, fireplace or fire table placed where people sit, with gas and clearances handled.',
    action: 'Plan my fire feature',
    types: [
      { label: 'Fire pit', line: 'Round or square, gas or wood, set into the patio or a seat wall.' },
      { label: 'Built-in fireplace', line: 'A covered-patio or freestanding hearth that anchors a lounge.' },
      { label: 'Fire table', line: 'A linear table at dining or lounge height, often beside the pool.' }
    ]
  },
  'desert-landscaping': {
    title: 'Desert landscaping',
    sentence: 'Low-water planting, rock and drip irrigation that look settled within a year, not sparse.',
    action: 'Plan my desert yard'
  },
  'artificial-turf': {
    title: 'Artificial turf installation',
    sentence: 'Turf on a compacted, draining base with clean edges against pavers and planting beds.',
    action: 'Plan my turf project'
  },
  irrigation: {
    title: 'Irrigation repair and new systems',
    sentence: 'Fix dry spots, leaks and runoff, or plan drip and zones for new planting.',
    action: 'Fix an irrigation problem',
    entries: [
      { label: 'Fix an irrigation problem', params: { type: 'one_time', service: 'irrigation', source: 'service_irrigation_fix', selected_project_label: 'Irrigation repair', autostart: '1' } },
      { label: 'Plan a new system', params: { type: 'project', service: 'irrigation', source: 'service_irrigation_new', selected_project_label: 'New irrigation system', autostart: '1' } }
    ]
  }
};

function avif640(src) {
  return src.replace(/\.(jpg|jpeg|png|webp)$/i, '-640.avif');
}

function rangeParts(service, shell) {
  const value = String(service.typicalRange || '')
    .replace(/\s*design planning\s*$/i, '')
    .replace(/(\$[\d.]+k)\s*-\s*(\$[\d.]+k)/i, '$1 to $2')
    .trim();
  return {
    label: shell.rangeLabel || 'Typical planning range',
    value,
    note: shell.rangeNote || 'For a typical Valley yard. Size, access and finish choices move it up or down.'
  };
}

function renderMain(service, drivers) {
  const slug = service.slug;
  const shell = SHELL[slug];
  if (!shell) throw new Error('No shell copy for ' + slug);

  const mainHref = shell.entries
    ? quoteHref(shell.entries[0].params)
    : quoteHref({ service: slug, source: 'service_page', autostart: '1' });

  const heroActions = shell.entries
    ? shell.entries.map((entry, index) =>
      `          <a href="${esc(quoteHref(entry.params))}" class="btn ${index === 0 ? 'btn--solid' : 'btn--ghost'}"${index === 0 ? ' data-service-consultation-link' : ''}>${esc(entry.label)}</a>`
    ).join('\n')
    : `          <a href="${esc(mainHref)}" class="btn btn--solid" data-service-consultation-link>${esc(shell.action)}</a>`;

  const types = shell.types
    ? `
        <ul class="service-types" aria-label="Fire feature types">
${shell.types.map((type) => `          <li><a class="service-type" href="${esc(quoteHref({ service: slug, source: 'service_type', selected_project_label: type.label, autostart: '1' }))}"><span class="service-type__name">${esc(type.label)}</span><span class="service-type__line">${esc(type.line)}</span><span class="service-type__go">Try a sample quote for a ${esc(type.label.toLowerCase())}</span></a></li>`).join('\n')}
        </ul>`
    : '';

  const range = rangeParts(service, shell);
  const scope = (drivers[slug] || []).slice(0, 3);
  const examples = (service.gallery || []).slice(0, 3);

  return `  <main id="main-content" data-service-shell>
    <section class="service-hero" aria-labelledby="service-heading">
      <div class="service-hero__bg" aria-hidden="true"></div>
      <div class="service-hero__overlay" aria-hidden="true"></div>
      <div class="container service-hero__content">
        <h1 id="service-heading">${esc(shell.title)}</h1>
        <p class="service-hero__sub" id="service-subtext">${esc(shell.sentence)}</p>
        <div class="service-hero__actions">
${heroActions}
          <a href="#service-examples" class="service-hero__link">See example work</a>
        </div>
      </div>
    </section>

    <section class="service-block" id="service-plan" aria-labelledby="service-plan-title">
      <div class="container">
        <h2 class="section-title" id="service-plan-title">What you can plan</h2>${types}
        <ul class="service-checklist">
${service.whatYouGet.slice(0, 6).map((item) => `          <li>${esc(item)}</li>`).join('\n')}
        </ul>
      </div>
    </section>

    <section class="service-block service-block--alt" id="service-scope" aria-labelledby="service-scope-title">
      <div class="container service-scope">
        <div>
          <h2 class="section-title" id="service-scope-title">What affects the scope</h2>
          <ul class="service-scope__list">
${scope.map((item) => `            <li>${esc(item)}</li>`).join('\n')}
          </ul>
        </div>
        <aside class="service-scope__range" aria-label="${esc(range.label)}">
          <p class="service-scope__label">${esc(range.label)}</p>
          <p class="service-scope__value">${esc(range.value)}</p>
          <p class="service-scope__note">${esc(range.note)}</p>
        </aside>
      </div>
    </section>

    <section class="service-block" id="service-examples" aria-labelledby="service-examples-title">
      <div class="container">
        <h2 class="section-title" id="service-examples-title">Example work</h2>
        <ul class="service-examples">
${examples.map((item) => `          <li>
            <a class="service-example" href="${esc(quoteHref({ service: slug, source: 'service_gallery', selected_project_label: item.label, autostart: '1' }))}">
              <picture>
                <source type="image/avif" srcset="../${esc(avif640(item.src))}" />
                <img src="../${esc(item.src)}" alt="${esc(item.alt)}" loading="lazy" decoding="async" sizes="(max-width: 768px) 100vw, 33vw" width="${item.width}" height="${item.height}" />
              </picture>
              <span class="service-example__title">${esc(item.label)}</span>
              <span class="service-example__line" aria-hidden="true">${esc(item.alt)}</span>
              <span class="service-example__go">Try a sample quote like this</span>
            </a>
          </li>`).join('\n')}
        </ul>
        <p class="service-examples__more"><a href="/portfolio?service=${esc(slug)}">See more ${esc(service.title.toLowerCase())} projects</a><span aria-hidden="true"> · </span><a href="/services">All services</a></p>
      </div>
    </section>
  </main>`;
}

function run() {
  const services = loadServices();
  const drivers = loadPricingDrivers();
  services.forEach((service) => {
    const file = path.join(root, 'services', service.slug + '.html');
    if (!fs.existsSync(file)) return;
    const html = fs.readFileSync(file, 'utf8');
    const start = html.indexOf('  <main id="main-content"');
    const end = html.indexOf('</main>', start) + '</main>'.length;
    if (start < 0 || end < start) throw new Error('No <main> in ' + file);
    const next = html.slice(0, start) + renderMain(service, drivers) + html.slice(end);
    fs.writeFileSync(file, next);
    console.log('rendered', path.relative(root, file));
  });
}

run();
