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

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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
    ['serviceAreas', Array.isArray(config.serviceAreas) && config.serviceAreas.length],
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

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function loadServicesData() {
  const previousWindow = global.window;
  global.window = {};
  delete require.cache[require.resolve(path.join(root, 'services-data.js'))];
  require(path.join(root, 'services-data.js'));
  const services = Array.isArray(global.window.SERVICES_DATA) ? global.window.SERVICES_DATA : [];
  global.window = previousWindow;
  return services;
}

function listItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `- ${item}`)
    .join('\n');
}

function buildServiceConversionPlan(services, config) {
  const offerLabel = config.primaryOffer && config.primaryOffer.label
    ? config.primaryOffer.label
    : 'Request Free Quote';

  return `# ${config.businessName} Service Conversion Plan

Use this file before launch to make every service page feel specific to the landscaper's actual sales process. Replace any demo examples that do not match the client, especially project ranges, proof, photo captions, FAQs, and CTA language.

## Global Offer Check
- Primary CTA: ${offerLabel}
- Quote page: ${config.primaryOffer && config.primaryOffer.path ? config.primaryOffer.path : '/free-consultation'}
- Response promise: ${config.trustSignals && config.trustSignals.responsePromise ? config.trustSignals.responsePromise : 'Confirm with client before launch.'}
- Financing: ${config.financing && config.financing.enabled === false ? 'Disabled' : 'Enabled or available if approved by client'}

## Service Page Review
${services.map((service) => {
  const project = service.featuredProject || {};
  const resources = Array.isArray(service.resources) ? service.resources.map((item) => `${item.title} (${item.path})`) : [];

  return `### ${service.title}
- URL: ${service.path}
- Form value: ${service.formValue || service.title}
- Current planning range: ${service.typicalRange || 'Add a realistic planning range or remove the range block.'}
- Current hero: ${service.heroHeadline}

**Best-fit buyers to confirm**
${listItems(service.goodFit)}

**Price drivers to confirm**
${listItems(service.pricingDrivers || [
  'Scope, square footage, access, finish selections, and existing site conditions.',
  'Utility, drainage, grade, and demolition complexity.',
  'Whether the project should be phased or bundled with adjacent services.'
])}

**Quote-prep questions to ask**
${listItems(service.quotePrep || [
  'Photos from several angles.',
  'Rough measurements and intended use.',
  'Budget comfort, timing, HOA, access, utility, or maintenance constraints.'
])}

**Proof blurbs to replace with verified client proof**
${listItems(service.proofBlurbs)}

**Featured project story**
- Title: ${project.title || 'Add verified project story'}
- Location: ${project.location || 'Add city/neighborhood'}
- Scope: ${project.scope || 'Add project scope'}
- Timeline: ${project.timeline || 'Add timeline'}
- Outcome: ${project.outcome || 'Add measurable or specific homeowner outcome'}

**Related resources**
${listItems(resources)}

**Launch questions**
- Does this service deserve a dedicated page for this client, or should it be removed from nav?
- What is the CTA label homeowners should see for this service?
- What 3 real photos prove this service best?
- What objection keeps homeowners from requesting a quote for this service?
- What job size should the client accept, decline, or refer out?
`;
}).join('\n')}
`;
}

function buildServiceOverrideStarter(services) {
  const overrides = {};
  services.forEach((service) => {
    overrides[service.slug] = {
      enabled: true,
      ctaLabel: `Plan My ${service.title} Project`,
      typicalRange: service.typicalRange || '',
      goodFit: service.goodFit || [],
      planFor: service.planFor || [],
      pricingDrivers: service.pricingDrivers || [],
      quotePrep: service.quotePrep || [],
      proofBlurbs: service.proofBlurbs || [],
      featuredProject: service.featuredProject || {
        title: '',
        location: '',
        scope: '',
        timeline: '',
        outcome: ''
      },
      faqNotes: 'Replace generic FAQs with questions this client actually answers during sales calls.',
      photoNotes: 'Map final project photos to this service before launch.'
    };
  });

  return `${JSON.stringify({
    _note: 'Starter worksheet for service-level conversion copy. This file is generated for client onboarding; apply approved values to services-data.js before launch.',
    serviceContentOverrides: overrides
  }, null, 2)}\n`;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/generate-client-package.js <path-to-client-config.json> [output-dir]');
  process.exit(1);
}

const absoluteInputPath = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
const outputRoot = process.argv[3]
  ? (path.isAbsolute(process.argv[3]) ? process.argv[3] : path.join(root, process.argv[3]))
  : path.join(root, 'client-builds');

const incoming = JSON.parse(fs.readFileSync(absoluteInputPath, 'utf8'));
const mergedConfig = merge(loadSiteConfig(), incoming);
validate(mergedConfig);
const services = loadServicesData();

const slug = slugify(mergedConfig.shortName || mergedConfig.businessName || 'client-site');
const buildDir = path.join(outputRoot, slug);
const branchName = `codex/${slug}-site`;
const netlifySite = `${slug}-site`;
const serviceOverrideCommand = `node scripts/apply-service-content-overrides.js client-builds/${slug}/service-content-overrides-starter.json`;

// Pull agency meta if present (not merged into site config)
const agencyMeta = incoming._agencyMeta || {};
const primaryOffer = mergedConfig.primaryOffer || {};
const financing = mergedConfig.financing || {};
const trustSignals = mergedConfig.trustSignals || {};
const initialAmt = agencyMeta.initialPaymentAmount || 375;
const completionAmt = agencyMeta.completionPaymentAmount || 375;
const monthlyAmt = agencyMeta.monthlyUpkeepAmount || 250;
const firstMonthTotal = initialAmt + completionAmt + monthlyAmt;
const annualTotal = initialAmt + completionAmt + (monthlyAmt * 12);

const today = new Date().toISOString().slice(0, 10);

const summary = `# ${mergedConfig.businessName} Launch Package

Generated on ${today} from ${absoluteInputPath}

## Suggested Branch
- ${branchName}

## Suggested Netlify Site
- ${netlifySite}

## Client Snapshot
- Business name: ${mergedConfig.businessName}
- Short name: ${mergedConfig.shortName}
- Phone: ${mergedConfig.phone.display}
- Email: ${mergedConfig.email}
- Address: ${mergedConfig.address.line1}, ${mergedConfig.address.city}, ${mergedConfig.address.state} ${mergedConfig.address.zip}
- Service areas: ${mergedConfig.serviceAreas.join(', ')}
- Primary offer: ${primaryOffer.label || 'Request Free Quote'}
- Offer promise: ${primaryOffer.promise || 'No pressure follow-up within one business day.'}
- Financing: ${financing.enabled === false ? 'Disabled' : `${financing.label || 'Financing'} — ${financing.copy || 'Review with client before launch.'}`}
- Trust position: ${[
  trustSignals.licensed ? 'licensed' : '',
  trustSignals.bonded ? 'bonded' : '',
  trustSignals.insured ? 'insured' : ''
].filter(Boolean).join(', ') || 'verify before launch'}
- Reviews: ${mergedConfig.reviewRating} stars across ${mergedConfig.reviewCount} reviews on ${mergedConfig.reviewSource}
- Review snapshot: ${mergedConfig.reviewSnapshotDate}

## Project Pricing
- Initial payment (kickoff): $${initialAmt}
- Completion payment (at launch): $${completionAmt}
- Monthly upkeep: $${monthlyAmt}/month
- First-month total: $${firstMonthTotal}
- Annual value (12 months): $${annualTotal}

## Payment Milestones
- [ ] Initial invoice sent ($${initialAmt}) — date: ${agencyMeta.initialPaymentDate || '__________'}
- [ ] Initial payment received
- [ ] Completion invoice sent ($${completionAmt}) — date: ${agencyMeta.completionPaymentDate || '__________'}
- [ ] Completion payment received
- [ ] Monthly auto-invoice set up ($${monthlyAmt}/month starting ${agencyMeta.monthlyUpkeepStartDate || '__________'})

## Recommended Workflow
1. Create branch \`${branchName}\`.
2. Run \`node scripts/apply-client-config.js ${absoluteInputPath}\`.
3. Update review URLs, license verification URLs, and social profiles if needed.
4. Confirm the offer, financing language, service list, and city-specific quote guide match the client.
5. Fill out \`service-conversion-plan.md\`, update \`service-content-overrides-starter.json\`, then run \`${serviceOverrideCommand}\`.
6. Use \`competitor-positioning-checklist.md\` to confirm portfolio depth, process model, team proof, calculator ranges, financing, and local trust positioning.
7. Run \`npm run build:assets\`.
8. Run all release checks, including \`npm run check:client-package\`.
9. Collect completion payment before pointing DNS.
10. Link or create Netlify site \`${netlifySite}\`.
11. Deploy and do the manual accessibility checklist before final launch.
12. Set up monthly auto-invoice for $${monthlyAmt}/month.
`;

const envTemplate = `NETLIFY_AUTH_TOKEN=
EMAIL_TO=${mergedConfig.ownerEmail}
EMAIL_FROM=${mergedConfig.email}
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
GOOGLE_SHEETS_WEBHOOK_URL=
`;

const checklist = `# ${mergedConfig.shortName} Release Checklist

## Pre-Build
- [ ] Initial payment collected ($${initialAmt})
- [ ] Client config JSON complete
- [ ] Apply client config: \`node scripts/apply-client-config.js <config>\`
- [ ] Replace logo assets if needed

## Content & Trust
- [ ] Confirm license, bond, and insurance proof
- [ ] Confirm review rating, count, and review source URL
- [ ] Confirm all service areas and location pages
- [ ] Confirm primary offer label and promise
- [ ] Confirm financing is enabled, disabled, or rewritten for this client
- [ ] Complete \`service-conversion-plan.md\`: service CTAs, price drivers, quote-prep questions, project stories, proof blurbs, FAQs, and accepted job sizes
- [ ] Apply approved service edits with \`${serviceOverrideCommand}\`
- [ ] Complete \`competitor-positioning-checklist.md\`: real project photos, process model, team proof, budget calculator ranges, financing language, and local trust proof
- [ ] Confirm page conversion guide language matches the client sales process
- [ ] Sweep for any remaining demo/template brand residue

## Build & QA
- [ ] Build minified assets: \`npm run build:assets\`
- [ ] \`npm run check:js\`
- [ ] \`npm run check:a11y\`
- [ ] \`npm run check:site\`
- [ ] \`npm run check:speed\`
- [ ] \`npm run check:client-package\`
- [ ] Run manual accessibility/device audit
- [ ] Test contact form (client email + owner email both arrive)
- [ ] Test sticky mobile CTA and consultation drawer
- [ ] Verify portfolio lightbox and FAQ toggles

## Launch
- [ ] Collect completion payment ($${completionAmt})
- [ ] Deploy to Netlify production
- [ ] Point DNS to new site
- [ ] Verify all production routes return 200
- [ ] Verify lead form submits to Google Sheet
- [ ] Set up monthly auto-invoice ($${monthlyAmt}/month)

## Handoff
- [ ] Send client walkthrough (how to submit updates, how to read lead sheet)
- [ ] Deliver login credentials and handoff doc
- [ ] Archive client config JSON in \`client-builds/${slug}/\`
`;

const competitorChecklist = `# ${mergedConfig.shortName} Competitor Positioning Checklist

This launch checklist is based on current Arizona landscaping competitors that emphasize portfolio depth, clear process, budget confidence, team proof, financing, and visible licensing. Use it to make this clone feel like a real local company, not a filled-in template.

## 1. Portfolio Depth
- [ ] Add at least 8-12 real project photos before launch.
- [ ] Map each strongest photo to a service page or portfolio filter.
- [ ] Replace any demo photo that does not match the client's actual work quality, market, or services.
- [ ] Add captions that explain scope, location, material, or outcome.

## 2. Process Model
- [ ] Confirm how the client sells: free quote, paid design, design deposit, phased estimate, or maintenance-first relationship.
- [ ] Rewrite homepage/process copy around that real model.
- [ ] Confirm what happens after form submission and how fast the client actually follows up.

## 3. Budget Confidence
- [ ] Confirm every public planning range on service pages and \`/cost-calculator\`.
- [ ] Remove or rewrite ranges the client cannot stand behind.
- [ ] Add "what changes price" bullets for services where final scope varies heavily.

## 4. Human and Trust Proof
- [ ] Add owner/team names or photos if the client approves.
- [ ] Verify review rating, review count, and source URL.
- [ ] Verify license, bond, insurance, warranty, and any award claims.
- [ ] Do not invent years in business, project counts, awards, or review quotes.

## 5. Financing and Large-Project Fit
- [ ] Confirm whether financing should be shown.
- [ ] Confirm provider, eligibility language, and compliance wording before launch.
- [ ] Pair financing copy with scope clarity so it supports confidence instead of pressure.

## 6. Local Market Position
- [ ] List the client's top 3 local competitors and URLs.
- [ ] Identify one thing the client can credibly say better: faster communication, better design, better clean-up, luxury portfolio, water-wise expertise, warranty clarity, or transparent pricing.
- [ ] Make sure the homepage hero, service pages, and quote drawer all reinforce that same position.
`;

writeFile(path.join(buildDir, 'client-summary.md'), summary);
writeFile(path.join(buildDir, 'netlify-env-template.txt'), envTemplate);
writeFile(path.join(buildDir, 'launch-checklist.md'), checklist);
writeFile(path.join(buildDir, 'competitor-positioning-checklist.md'), competitorChecklist);
writeFile(path.join(buildDir, 'merged-site-config-preview.json'), `${JSON.stringify(mergedConfig, null, 2)}\n`);
writeFile(path.join(buildDir, 'service-conversion-plan.md'), buildServiceConversionPlan(services, mergedConfig));
writeFile(path.join(buildDir, 'service-content-overrides-starter.json'), buildServiceOverrideStarter(services));

console.log(`Generated client package in ${buildDir}`);
console.log(`  Branch:       ${branchName}`);
console.log(`  Netlify site: ${netlifySite}`);
console.log(`  Pricing:      $${initialAmt} initial / $${completionAmt} completion / $${monthlyAmt}/month`);
