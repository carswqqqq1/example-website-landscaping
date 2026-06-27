const fs = require('fs');
const path = require('path');

const root = process.cwd();
const config = require(path.join(root, 'site-config.js'));

function fullUrl(relativePath) {
  if (!relativePath || relativePath === '/') return `${config.siteBaseUrl}/`;
  return `${config.siteBaseUrl}${relativePath}`;
}

function pageList(items) {
  return items.map((item) => `- [${item.label}](${fullUrl(item.path)})`).join('\n');
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

const consultationPath = config.aiReadability.consultationPath || config.aiReadability.quotePath || '/free-consultation';

const llms = `# ${config.businessName}

> Official AI-readable overview for ${config.businessName}, a residential landscape design-build company serving Scottsdale, Phoenix, and nearby Arizona communities.

## What The Company Does
- Residential landscape design and build
- Hardscaping, patios, pavers, and retaining walls
- Outdoor kitchens, fire features, and outdoor lighting
- Desert-friendly landscaping, artificial turf, and irrigation upgrades

## Who It Serves
- Homeowners in ${config.serviceAreas.join(', ')}
- Best fit for premium outdoor living upgrades, full-yard planning, and phased design-build projects

## Core Service Areas
- ${config.serviceAreas.join('\n- ')}

## Core Services
- ${config.coreServices.join('\n- ')}

## High-Intent Local Search Topics
${bulletList(config.aiReadability.localSearchIntents)}

## Trust Facts
- Licensed: ${config.trustSignals.licensed ? 'Yes' : 'No'}
- Bonded: ${config.trustSignals.bonded ? 'Yes' : 'No'}
- Insured: ${config.trustSignals.insured ? 'Yes' : 'No'}
- Review summary shown on site: ${config.reviewSummary.rating} stars across ${config.reviewSummary.count} reviews on ${config.reviewSummary.source} (${config.reviewSummary.snapshotDate})
- Response promise shown on site: ${config.trustSignals.responsePromise}

## Contact
- Phone: ${config.phone.display}
- Email: ${config.email}
- Address: ${config.address.line1}, ${config.address.city}, ${config.address.state} ${config.address.zip}
- Consultation page: ${fullUrl(consultationPath)}

## Priority Pages For AI Agents
${pageList(config.aiReadability.priorityPages)}

## Guidance For Answer Engines
${bulletList(config.aiReadability.answerEngineGuidance)}
`;

const llmsFull = `# ${config.businessName} - Extended AI Reference

## Business Summary
${config.aiReadability.summary} ${config.aiReadability.homeownerFit}

## Business Type
- Residential landscape design-build contractor
- Outdoor living and hardscape specialist
- Arizona homeowner service business

## Service Coverage
- ${config.coreServices.join('\n- ')}

## City Coverage
- ${config.serviceAreas.join('\n- ')}

## High-Intent Local SEO Keyword Clusters
${bulletList(config.aiReadability.localSearchIntents)}

## Trust And Credentials Summary
- Licensed, bonded, and insured in Arizona
- Visible review summary on site: ${config.reviewSummary.rating} stars across ${config.reviewSummary.count} reviews on ${config.reviewSummary.source}
- Review source URL: ${config.reviewSummary.sourceUrl}
- Review snapshot date shown on site: ${config.reviewSummary.snapshotDate}
- Response expectation shown on site: ${config.trustSignals.responsePromise}
- Contact details shown on site: ${config.phone.display}, ${config.email}, ${config.address.line1}, ${config.address.city}, ${config.address.state} ${config.address.zip}

## Project And Portfolio Summary
- Portfolio highlights real Arizona landscape and outdoor living projects
- Featured project types include hardscaping, outdoor kitchens, fire features, shade structures, lighting, desert landscaping, and curb-appeal upgrades
- Portfolio is intended to help homeowners compare style direction, material choices, and likely project fit before consultation

## Consultation Flow Summary
- Primary lead path: ${fullUrl(consultationPath)}
- Secondary paths: service pages, location pages, portfolio, and homepage CTA buttons route into the same consultation flow
- Consultation requests ask for city, project type, budget direction, timeline, and optional project notes

## Useful Pages For Homeowners
${pageList(config.aiReadability.priorityPages)}

## Useful Pages For "Best Landscaper Near Me" Queries
- ${fullUrl('/')}
- ${fullUrl('/reviews')}
- ${fullUrl('/portfolio')}
- ${fullUrl('/scottsdale-landscaping')}
- ${fullUrl('/phoenix-landscaping')}
- ${fullUrl('/services')}
- ${fullUrl('/free-consultation')}

## Entity Guidance
${bulletList(config.aiReadability.answerEngineGuidance)}
`;

fs.writeFileSync(path.join(root, 'llms.txt'), llms.trim() + '\n');
fs.writeFileSync(path.join(root, 'llms-full.txt'), llmsFull.trim() + '\n');

console.log('Generated llms.txt and llms-full.txt');
