#!/usr/bin/env node
/*
 * 5.10: renders one local shell into every city and specialty page that is
 * still linked (the thin unlinked pages from 3.06 are left alone).
 *
 * Each page gets: a short local opener with one sample-quote action that
 * carries an editable city and service, one short decision block, a few
 * nearby examples captioned only with what the photo shows, and guide links.
 * Visible FAQs are gone, so any FAQPage JSON-LD on these pages is removed too.
 *
 * Run after editing the copy below:  node scripts/render-local-pages.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// Photos and what each one shows, matching the portfolio captions.
const PHOTOS = {
  slide6: { file: 'slide6', w: 1630, h: 860, title: 'Camelback view backyard', city: 'Scottsdale', alt: 'Pool with a rock waterfall, turf and desert planting below Camelback Mountain' },
  fireplace: { file: 'fireplace', w: 1600, h: 1066, title: 'Covered fireplace patio', city: 'Paradise Valley', alt: 'Covered patio with a fireplace, lounge seating and travertine pavers in Paradise Valley' },
  shade: { file: 'shade-structure', w: 1000, h: 668, title: 'Pergola kitchen', city: 'Phoenix', alt: 'Pergola with string lights over an outdoor kitchen, paver patio and turf in Phoenix' },
  slide8: { file: 'slide8', w: 1000, h: 563, title: 'Evening pool deck', city: 'Scottsdale', alt: 'Lit pool with a linear fire feature on the flagstone edge in Scottsdale' },
  firepit: { file: 'firepit', w: 1600, h: 900, title: 'Poolside fire pit', city: 'Scottsdale', alt: 'Round stone fire pit on a travertine patio beside a pool in Scottsdale' },
  slide7: { file: 'slide7', w: 1630, h: 860, title: 'Desert island backyard', city: 'Chandler', alt: 'Backyard with a gravel planting island, palms, turf and a pool in Chandler' },
  slide4: { file: 'slide4', w: 1620, h: 860, title: 'Turf and paver pool deck', city: 'North Phoenix', alt: 'Paver steps, turf with stepping pavers and lounge seating beside a pool in North Phoenix' },
  slide3: { file: 'slide3', w: 1630, h: 860, title: 'Fire table patio', city: 'Mesa', alt: 'Fire table on a paver patio beside a lit pool in Mesa' },
  slide5: { file: 'slide5', w: 1630, h: 860, title: 'Desert front yard', city: 'Cave Creek', alt: 'Front yard with decomposed granite, boulders, a dry creek bed and desert plants in Cave Creek' },
  slide1: { file: 'slide1', w: 1630, h: 860, title: 'Palm court cabana', city: 'Chandler', alt: 'Pool and cabana with a fireplace under palms in Chandler' },
  water: { file: 'water-feature', w: 1333, h: 2000, title: 'Entry bowl fountain', city: 'Scottsdale', alt: 'Bowl fountain filled with river rock at a front entry in Scottsdale' }
};

const GUIDES = {
  cost: { href: '/landscaping-cost-scottsdale', label: 'Landscaping cost guide' },
  checklist: { href: '/project-planning-checklist', label: 'Project planning checklist' },
  turfVsXeri: { href: '/xeriscape-vs-turf-arizona', label: 'Turf or xeriscape?' },
  pavers: { href: '/pavers-vs-concrete-arizona', label: 'Pavers or concrete?' },
  process: { href: '/process', label: 'How a project works' },
  portfolio: { href: '/portfolio', label: 'All project examples' }
};

const quote = (params) => '/free-consultation?' + Object.entries(Object.assign({}, params, { autostart: '1' }))
  .map(([k, v]) => k + '=' + encodeURIComponent(v).replace(/%20/g, '+'))
  .join('&');

const PAGES = [
  {
    slug: 'scottsdale-landscaping', city: 'Scottsdale', bg: 'slide6',
    eyebrow: 'Scottsdale', h1: 'Scottsdale landscape design and outdoor living',
    opener: 'Backyards, pool decks and front yards around Scottsdale, planned for the heat, the views and the way you use the space.',
    action: { label: 'Plan my Scottsdale project', href: quote({ city: 'Scottsdale', type: 'project', source: 'location_page' }) },
    decision: {
      title: 'Where Scottsdale projects usually start',
      cards: [
        { title: 'Pool deck and shade', text: 'Cooler paving, shade over the seating and lighting so the deck works on summer evenings.' },
        { title: 'View-friendly planting', text: 'Low desert planting that frames the mountains instead of blocking them.' },
        { title: 'HOA-ready plans', text: 'Many communities review materials and plant lists, so the plan is drawn with that in mind.' }
      ]
    },
    examples: ['slide6', 'firepit', 'slide8'],
    guides: ['cost', 'pavers', 'process']
  },
  {
    slug: 'phoenix-landscaping', city: 'Phoenix', bg: 'slide3',
    eyebrow: 'Phoenix', h1: 'Phoenix landscape design and outdoor living',
    opener: 'Outdoor kitchens, shade, turf and desert planting for Phoenix homes, built for long summers and real use.',
    action: { label: 'Plan my Phoenix project', href: quote({ city: 'Phoenix', type: 'project', source: 'location_page' }) },
    decision: {
      title: 'Where Phoenix projects usually start',
      cards: [
        { title: 'Shade first', text: 'A pergola or covered patio often decides whether the yard gets used from May to October.' },
        { title: 'Water and irrigation', text: 'Drip zones and low-water planting that cut overspray and keep plants healthy.' },
        { title: 'One finished zone', text: 'Many homeowners finish one area well, then add to it, instead of spreading a budget thin.' }
      ]
    },
    examples: ['shade', 'slide4', 'slide3'],
    guides: ['cost', 'turfVsXeri', 'process']
  },
  {
    slug: 'paradise-valley-landscaping', city: 'Paradise Valley', bg: 'fireplace',
    eyebrow: 'Paradise Valley', h1: 'Paradise Valley landscape design and outdoor living',
    opener: 'Larger outdoor living projects for Paradise Valley homes, with finishes, lighting and planting that match the house.',
    action: { label: 'Plan my Paradise Valley project', href: quote({ city: 'Paradise Valley', type: 'project', source: 'location_page' }) },
    decision: {
      title: 'What these projects usually need decided early',
      cards: [
        { title: 'Finish level', text: 'Stone, lighting fixtures and fire features are chosen up front so the budget reflects them.' },
        { title: 'Access and sequencing', text: 'Large lots and finished homes need a plan for equipment access and the order of trades.' },
        { title: 'Night use', text: 'Covered patios, fireplaces and lighting are planned together so evenings feel calm, not bright.' }
      ]
    },
    examples: ['fireplace', 'slide8', 'slide6'],
    guides: ['cost', 'process', 'portfolio']
  },
  {
    slug: 'mesa-landscaping', city: 'Mesa', bg: 'slide7',
    eyebrow: 'Mesa', h1: 'Mesa landscaping that starts with a practical first phase',
    opener: 'Most Mesa yards do not need everything at once. Start with the part that fixes the most, and leave room to add shade, lighting or a kitchen later.',
    action: { label: 'Plan a first phase', href: quote({ city: 'Mesa', type: 'project', source: 'mesa_first_phase', project_goal: 'Focused first phase' }) },
    secondary: { label: 'Explore Mesa turf', href: '/mesa-artificial-turf' },
    decision: {
      title: 'What a first phase can cover',
      intro: 'Typical starting points for a Mesa backyard. Access, demolition, drainage and size move the price, so treat these as planning ranges.',
      phases: [
        { title: '$10k to $15k turf refresh', scope: 'A family or pet turf area, rock edge cleanup, simple planting and an irrigation check.', tradeoff: 'Patio expansion, shade, lighting and kitchens wait.', next: 'Measure the turf area and check drainage.' },
        { title: '$15k to $20k paver and play', scope: 'A compact paver dining pad, turf cleanup and an easier path from the house to the yard.', tradeoff: 'Fire features, pergolas and premium finishes wait.', next: 'Pick the patio size and where people walk.' },
        { title: '$20k to $25k backyard starter', scope: 'Turf, pavers, irrigation tuning and a planting refresh in one coordinated plan.', tradeoff: 'Large kitchens, big shade structures and major grading wait.', next: 'Rank the zones so the plan can grow later.' }
      ]
    },
    examples: ['slide3', 'slide7', 'slide4'],
    guides: ['cost', 'turfVsXeri', 'checklist']
  },
  {
    slug: 'scottsdale-hardscaping', city: 'Scottsdale', service: 'hardscaping', bg: 'firepit',
    eyebrow: 'Scottsdale hardscaping', h1: 'Scottsdale pavers, patios and hardscape',
    opener: 'Paver patios, walkways, seat walls and fire-pit pads for Scottsdale homes, laid on a base that holds up to heat and monsoon rain.',
    action: { label: 'Plan my hardscape', href: quote({ city: 'Scottsdale', service: 'hardscaping', source: 'location_page' }) },
    decision: {
      title: 'Decide these before choosing pavers',
      cards: [
        { title: 'Surface heat', text: 'Lighter travertine and pavers stay cooler underfoot around pools than dark concrete.' },
        { title: 'Drainage', text: 'Slope and edge details matter more than the paver itself when summer storms hit.' },
        { title: 'Future features', text: 'Leave sleeves for gas, power or lighting if a fire pit or kitchen may come later.' }
      ]
    },
    examples: ['firepit', 'slide4', 'fireplace'],
    guides: ['pavers', 'cost', 'process']
  },
  {
    slug: 'phoenix-outdoor-kitchens', city: 'Phoenix', service: 'outdoor-kitchens', bg: 'shade',
    eyebrow: 'Phoenix outdoor kitchens', h1: 'Phoenix outdoor kitchens planned for summer',
    opener: 'Grill, prep and seating laid out around how you cook, with gas, power and shade planned before anything is built.',
    action: { label: 'Plan my outdoor kitchen', href: quote({ city: 'Phoenix', service: 'outdoor-kitchens', source: 'location_page' }) },
    decision: {
      title: 'Decide these before choosing appliances',
      cards: [
        { title: 'Shade over the cook', text: 'Without a pergola or cover, a west-facing kitchen sits unused most of the summer.' },
        { title: 'Utility runs', text: 'Gas, power and water routes set the cost more than the counter length does.' },
        { title: 'Where people stand', text: 'Keep guests out of the cook path and close enough to talk.' }
      ]
    },
    examples: ['shade', 'slide1', 'fireplace'],
    guides: ['cost', 'process', 'portfolio']
  },
  {
    slug: 'paradise-valley-outdoor-lighting', city: 'Paradise Valley', service: 'outdoor-lighting', bg: 'slide8',
    eyebrow: 'Paradise Valley lighting', h1: 'Paradise Valley outdoor lighting',
    opener: 'Path, patio and accent lighting for Paradise Valley homes that keeps the night sky dark and the yard usable.',
    action: { label: 'Plan my lighting', href: quote({ city: 'Paradise Valley', service: 'outdoor-lighting', source: 'location_page' }) },
    decision: {
      title: 'Decide these before choosing fixtures',
      cards: [
        { title: 'Glare and dark skies', text: 'Shielded, low-level fixtures light paths and trees without washing out the view.' },
        { title: 'Zones and timers', text: 'Separate entry, patio and accent zones so each can be dimmed or scheduled.' },
        { title: 'Wiring before paving', text: 'Running conduit before hardscape goes in avoids cutting new stone later.' }
      ]
    },
    examples: ['slide8', 'fireplace', 'shade'],
    guides: ['process', 'cost', 'portfolio']
  },
  {
    slug: 'mesa-artificial-turf', city: 'Mesa', service: 'artificial-turf', bg: 'slide4',
    eyebrow: 'Mesa artificial turf', h1: 'Mesa artificial turf for front and back yards',
    opener: 'Turf on a compacted, draining base with clean edges, sized for kids, pets and less watering.',
    action: { label: 'Plan my turf project', href: quote({ city: 'Mesa', service: 'artificial-turf', source: 'location_page' }) },
    secondary: { label: 'Back to Mesa landscaping', href: '/mesa-landscaping' },
    decision: {
      title: 'Decide these before choosing turf',
      cards: [
        { title: 'Pets or play', text: 'Pet areas need a draining infill and base; play areas may need extra padding.' },
        { title: 'Edges and borders', text: 'Clean edges against pavers and planting beds are what make turf look finished.' },
        { title: 'Sun and heat', text: 'Turf gets hot in full sun, so shade or nearby planting helps on summer afternoons.' }
      ]
    },
    examples: ['slide4', 'slide7', 'slide3'],
    guides: ['turfVsXeri', 'cost', 'checklist']
  },
  {
    slug: 'glendale-hardscaping', city: 'Glendale', service: 'hardscaping', bg: 'slide1',
    eyebrow: 'Glendale hardscaping', h1: 'Glendale pavers, patios and hardscape',
    opener: 'Patios, paver walkways and seat walls for Glendale homes that drain correctly and hold up through the heat.',
    action: { label: 'Plan my hardscape', href: quote({ city: 'Glendale', service: 'hardscaping', source: 'location_page' }) },
    decision: {
      title: 'Decide these before choosing pavers',
      cards: [
        { title: 'Patio size', text: 'Size the patio around the table and chairs you actually own, plus room to walk.' },
        { title: 'Drainage', text: 'Slope water away from the house and toward planting, not the neighbor.' },
        { title: 'Material', text: 'Pavers cost more than concrete up front but repair one piece at a time.' }
      ]
    },
    examples: ['slide1', 'slide4', 'firepit'],
    guides: ['pavers', 'cost', 'process']
  },
  {
    slug: 'peoria-artificial-turf', city: 'Peoria', service: 'artificial-turf', bg: 'slide4',
    eyebrow: 'Peoria artificial turf', h1: 'Peoria artificial turf for family yards',
    opener: 'Turf for kids, pets and curb appeal, on a base that drains and with edges that stay clean.',
    action: { label: 'Plan my turf project', href: quote({ city: 'Peoria', service: 'artificial-turf', source: 'location_page' }) },
    decision: {
      title: 'Decide these before choosing turf',
      cards: [
        { title: 'Where it goes', text: 'Turf works best where people play; rock and planting suit the edges and hot corners.' },
        { title: 'Pets', text: 'Pet areas need a draining infill and a base that can be rinsed.' },
        { title: 'Irrigation changes', text: 'Old sprinkler lines under the turf area are capped so nothing leaks below it.' }
      ]
    },
    examples: ['slide4', 'slide7', 'slide6'],
    guides: ['turfVsXeri', 'cost', 'checklist']
  },
  {
    slug: 'north-phoenix-outdoor-lighting', city: 'North Phoenix', service: 'outdoor-lighting', bg: 'slide8',
    eyebrow: 'North Phoenix lighting', h1: 'North Phoenix outdoor lighting',
    opener: 'Path, patio and accent lighting that makes the yard safe and usable after dark, without glare.',
    action: { label: 'Plan my lighting', href: quote({ city: 'North Phoenix', service: 'outdoor-lighting', source: 'location_page' }) },
    decision: {
      title: 'Decide these before choosing fixtures',
      cards: [
        { title: 'Paths and steps first', text: 'Light where people walk, then add accent light on trees and walls.' },
        { title: 'Warm, low output', text: 'Warm, shielded fixtures keep the yard calm and the sky dark.' },
        { title: 'Zones', text: 'Separate the entry, patio and accents so each can run on its own schedule.' }
      ]
    },
    examples: ['slide8', 'shade'],
    guides: ['process', 'cost', 'portfolio']
  },
  {
    slug: 'ahwatukee-landscape-design', city: 'Ahwatukee', service: 'landscape-design', bg: 'slide6',
    eyebrow: 'Ahwatukee landscape design', h1: 'Ahwatukee landscape design for backyards',
    opener: 'One plan for layout, planting, shade and lighting before anything is built, so the yard comes together instead of piece by piece.',
    action: { label: 'Plan this landscape', href: quote({ city: 'Ahwatukee', service: 'landscape-design', source: 'location_page' }) },
    decision: {
      title: 'What a design plan settles',
      cards: [
        { title: 'Layout', text: 'Where the patio, turf, planting and paths go, and how people move between them.' },
        { title: 'Phasing', text: 'What to build first and what can wait, without redoing work later.' },
        { title: 'Materials', text: 'Paving, rock and plants chosen for heat, water use and the look you want.' }
      ]
    },
    examples: ['slide6', 'slide5', 'slide7'],
    guides: ['cost', 'checklist', 'process']
  }
];

const esc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function picture(key) {
  const p = PHOTOS[key];
  return `<picture>
                <source type="image/avif" srcset="img/projects/${p.file}-640.avif 640w, img/projects/${p.file}-1280.avif 1280w" sizes="(max-width: 768px) 100vw, 33vw" />
                <img src="img/projects/${p.file}-640.avif" alt="${esc(p.alt)}" loading="lazy" decoding="async" width="${p.w}" height="${p.h}" />
              </picture>`;
}

function decisionHtml(page) {
  const d = page.decision;
  const intro = d.intro ? `\n        <p class="local-decision__intro">${esc(d.intro)}</p>` : '';
  if (d.phases) {
    return `${intro}
        <ul class="local-phases">
${d.phases.map((phase) => `          <li class="local-phase">
            <h3>${esc(phase.title)}</h3>
            <dl>
              <div><dt>Scope</dt><dd>${esc(phase.scope)}</dd></div>
              <div><dt>Tradeoff</dt><dd>${esc(phase.tradeoff)}</dd></div>
              <div><dt>Next step</dt><dd>${esc(phase.next)}</dd></div>
            </dl>
          </li>`).join('\n')}
        </ul>`;
  }
  return `${intro}
        <ul class="local-cards">
${d.cards.map((card) => `          <li class="local-card"><h3>${esc(card.title)}</h3><p>${esc(card.text)}</p></li>`).join('\n')}
        </ul>`;
}

function renderMain(page) {
  const bg = PHOTOS[page.bg];
  const secondary = page.secondary
    ? `\n          <a href="${esc(page.secondary.href)}" class="local-hero__link">${esc(page.secondary.label)}</a>`
    : '';
  return `<main id="main-content" data-local-shell>
    <section class="page-hero page-hero--short local-hero">
      <div class="page-hero__bg" style="background-image:url('img/projects/${bg.file}-1280.avif')"></div>
      <div class="page-hero__overlay"></div>
      <div class="container page-hero__inner">
        <p class="eyebrow">${esc(page.eyebrow)}</p>
        <h1>${esc(page.h1)}</h1>
        <p>${esc(page.opener)}</p>
        <div class="page-hero__actions">
          <a href="${esc(page.action.href)}" class="btn btn--solid" data-keep-href>${esc(page.action.label)}</a>${secondary}
        </div>
      </div>
    </section>

    <section class="page-section local-decision" aria-labelledby="local-decision-title">
      <div class="container">
        <h2 class="section-title" id="local-decision-title">${esc(page.decision.title)}</h2>${decisionHtml(page)}
      </div>
    </section>

    <section class="page-section page-section--alt local-examples" aria-labelledby="local-examples-title">
      <div class="container">
        <h2 class="section-title" id="local-examples-title">Nearby examples</h2>
        <ul class="local-examples__grid">
${page.examples.map((key) => `          <li>
            <figure class="local-example">
              ${picture(key)}
              <figcaption>${esc(PHOTOS[key].title)} · ${esc(PHOTOS[key].city)}</figcaption>
            </figure>
          </li>`).join('\n')}
        </ul>
        <p class="local-guides"><span>Helpful next reads:</span> ${page.guides.map((g) => `<a href="${GUIDES[g].href}">${esc(GUIDES[g].label)}</a>`).join('<span aria-hidden="true"> · </span>')}</p>
        <div class="local-examples__action">
          <a href="${esc(page.action.href)}" class="btn btn--solid" data-keep-href>${esc(page.action.label)}</a>
        </div>
      </div>
    </section>
  </main>`;
}

// Drop FAQPage nodes from JSON-LD now that the page shows no FAQ.
function stripFaqSchema(html) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body) => {
    if (!/FAQPage/.test(body)) return whole;
    let data;
    try { data = JSON.parse(body); } catch (error) { throw new Error('Could not parse JSON-LD: ' + error.message); }
    if (Array.isArray(data['@graph'])) {
      data['@graph'] = data['@graph'].filter((node) => node['@type'] !== 'FAQPage');
      return '<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n  </script>';
    }
    if (data['@type'] === 'FAQPage') return '';
    return whole;
  });
}

function run() {
  PAGES.forEach((page) => {
    const file = path.join(root, page.slug + '.html');
    let html = fs.readFileSync(file, 'utf8');
    const start = html.indexOf('<main id="main-content"');
    const end = html.indexOf('</main>', start) + '</main>'.length;
    if (start < 0 || end < start) throw new Error('No <main> in ' + file);
    html = html.slice(0, start) + renderMain(page) + html.slice(end);
    html = stripFaqSchema(html);
    fs.writeFileSync(file, html);
    console.log('rendered', page.slug + '.html');
  });
}

run();
