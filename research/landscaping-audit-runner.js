#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium, devices } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = __dirname;
const SCREENSHOT_DIR = path.join(OUT_DIR, "screenshots");
const CANDIDATES_PATH = path.join(OUT_DIR, "landscaping-candidates.json");
const JSON_PATH = path.join(OUT_DIR, "landscaping-website-audit.json");
const PARTIAL_JSON_PATH = path.join(OUT_DIR, "landscaping-website-audit.partial.json");
const CSV_PATH = path.join(OUT_DIR, "landscaping-website-audit.csv");
const SUMMARY_PATH = path.join(OUT_DIR, "landscaping-research-summary.md");

const TARGET = Number(process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || 500);
const MAX_QUERIES = Number(process.argv.find((arg) => arg.startsWith("--max-queries="))?.split("=")[1] || 900);
const DISCOVER_ONLY = process.argv.includes("--discover-only");
const AUDIT_ONLY = process.argv.includes("--audit-only");
const USE_EXISTING = process.argv.includes("--use-existing");
const FINALIZE_PARTIAL = process.argv.includes("--finalize-partial");
const SUPPLEMENT_PARTIAL = process.argv.includes("--supplement-partial");
const MERGE_SUPPLEMENT = process.argv.includes("--merge-supplement");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const directoryHosts = [
  "angi.com", "angieslist.com", "bbb.org", "birdeye.com", "buildzoom.com", "chamberofcommerce.com",
  "clutch.co", "facebook.com", "foursquare.com", "groupon.com", "homeadvisor.com", "houzz.com",
  "instagram.com", "linkedin.com", "mapquest.com", "nextdoor.com", "porch.com", "provenexpert.com",
  "reddit.com", "thumbtack.com", "trustpilot.com", "twitter.com", "x.com", "yahoo.com", "yellowpages.com",
  "yelp.com", "youtube.com", "google.com", "bing.com", "apple.com", "manta.com", "expertise.com",
  "lawnstarter.com", "lawnlove.com", "findglocal.com", "alignable.com", "zillow.com", "indeed.com",
  "atom.com", "afternic.com", "domains.atom.com", "dan.com", "hugedomains.com", "godaddy.com",
  "sedo.com", "sav.com"
];

const landscapingKeywords = [
  "landscape", "landscaping", "lawn care", "lawn maintenance", "hardscape", "hardscaping",
  "irrigation", "outdoor living", "pavers", "patio", "turf", "xeriscape", "garden design",
  "yard", "tree service", "sod", "mulch", "planting", "retaining wall", "snow removal"
];

const conversionTerms = {
  cta: ["free estimate", "free quote", "request a quote", "request quote", "get a quote", "schedule", "book", "consultation", "contact us", "call now", "call today"],
  trust: ["review", "reviews", "stars", "licensed", "insured", "bonded", "certified", "award", "warranty", "guarantee", "years", "family owned", "locally owned", "bbb"],
  proof: ["before", "after", "gallery", "portfolio", "projects", "case study", "testimonials", "our work"],
  offer: ["landscape design", "lawn care", "maintenance", "hardscape", "irrigation", "outdoor living", "artificial turf", "pavers", "tree", "patio", "lighting"],
  local: ["service area", "serving", "near me", "city", "county", "areas served", "local"]
};

const cities = [
  "Phoenix AZ", "Scottsdale AZ", "Mesa AZ", "Chandler AZ", "Gilbert AZ", "Tempe AZ", "Tucson AZ",
  "Las Vegas NV", "Reno NV", "Los Angeles CA", "San Diego CA", "San Jose CA", "Sacramento CA",
  "Fresno CA", "Irvine CA", "Denver CO", "Colorado Springs CO", "Boulder CO", "Austin TX",
  "Dallas TX", "Fort Worth TX", "Houston TX", "San Antonio TX", "Plano TX", "Frisco TX",
  "Miami FL", "Orlando FL", "Tampa FL", "Jacksonville FL", "Naples FL", "Atlanta GA",
  "Charlotte NC", "Raleigh NC", "Nashville TN", "Knoxville TN", "Chicago IL", "Naperville IL",
  "Indianapolis IN", "Columbus OH", "Cincinnati OH", "Cleveland OH", "Detroit MI", "Grand Rapids MI",
  "Minneapolis MN", "St Paul MN", "Kansas City MO", "St Louis MO", "Omaha NE", "Seattle WA",
  "Tacoma WA", "Portland OR", "Bend OR", "Boise ID", "Salt Lake City UT", "Park City UT",
  "Albuquerque NM", "Santa Fe NM", "Boston MA", "Newton MA", "New York NY", "Long Island NY",
  "Westchester NY", "Philadelphia PA", "Pittsburgh PA", "Baltimore MD", "Washington DC",
  "Northern Virginia", "Richmond VA", "Virginia Beach VA", "Charleston SC", "Greenville SC",
  "Savannah GA", "New Orleans LA", "Baton Rouge LA", "Birmingham AL", "Huntsville AL",
  "Louisville KY", "Lexington KY", "Milwaukee WI", "Madison WI", "Des Moines IA",
  "Oklahoma City OK", "Tulsa OK", "Little Rock AR", "Memphis TN", "Cedar Rapids IA",
  "Providence RI", "Hartford CT", "New Haven CT", "Manchester NH", "Portland ME"
];

const serviceQueries = [
  "landscaping company", "landscape design build", "hardscape contractor", "lawn care company",
  "outdoor living contractor", "irrigation company", "artificial turf installer", "garden design company"
];

const rankingQueries = [
  "best landscaping websites landscape company",
  "award winning landscaping company website",
  "top landscape design build companies",
  "best lawn care company website",
  "best hardscaping company website",
  "landscape contractor portfolio website",
  "outdoor living contractor portfolio landscaping",
  "high end landscaping company residential",
  "NALP award winning landscaping company",
  "Houzz best landscape architects designers company website",
  "multi location landscaping company lawn care",
  "franchise landscaping company lawn care"
];

const leadSheetPaths = [
  "/Users/carsonwesolowski/Downloads/Arroyo Marketing/05 CRM and Lead Lists/Arroyo Landscaping Lead List - Enriched.xlsx",
  "/Users/carsonwesolowski/Downloads/Arroyo Marketing/01 Owner/02 Sales/99 Lead Source Archive/all_scraped_leads_structured.xlsx"
];

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripHtml(html) {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function getTag(html, pattern) {
  const match = html.match(pattern);
  return normalizeWhitespace(match?.[1] || "");
}

function countMatches(text, terms) {
  const lower = text.toLowerCase();
  return terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
}

function clampScore(score) {
  return Math.max(1, Math.min(10, Math.round(score)));
}

function hostMatches(host, badHost) {
  return host === badHost || host.endsWith(`.${badHost}`);
}

function isBadHost(host) {
  return directoryHosts.some((bad) => hostMatches(host, bad));
}

function decodeBingUrl(rawUrl) {
  try {
    const cleaned = rawUrl.replace(/&amp;/g, "&");
    const url = new URL(cleaned);
    const encoded = url.searchParams.get("u");
    if (!encoded) return cleaned;
    let payload = encoded;
    if (payload.startsWith("a1")) payload = payload.slice(2);
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    return decoded || cleaned;
  } catch {
    return rawUrl;
  }
}

function decodeDuckDuckGoUrl(rawUrl) {
  try {
    let cleaned = rawUrl.replace(/&amp;/g, "&");
    if (cleaned.startsWith("//")) cleaned = `https:${cleaned}`;
    const url = new URL(cleaned);
    if (!/duckduckgo\.com$/i.test(url.hostname)) return cleaned;
    const encoded = url.searchParams.get("uddg");
    return encoded ? decodeURIComponent(encoded) : cleaned;
  } catch {
    return rawUrl;
  }
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  let value = decodeDuckDuckGoUrl(decodeBingUrl(rawUrl)).replace(/&amp;/g, "&").trim();
  if (value.startsWith("//")) value = `https:${value}`;
  if (value.startsWith("www.")) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    for (const param of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|msclkid|mc_)/i.test(param)) url.searchParams.delete(param);
    }
    return url.toString();
  } catch {
    return null;
  }
}

function domainOf(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function homepageOf(rawUrl) {
  const url = new URL(rawUrl);
  return `${url.protocol}//${url.hostname}/`;
}

function slugForDomain(domain) {
  return domain.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function buildQueries() {
  const queries = [...rankingQueries];
  for (const city of cities) {
    for (const service of serviceQueries) {
      queries.push(`${service} ${city}`);
      queries.push(`${service} ${city} official website`);
    }
  }
  for (const name of readLeadSheetBusinessNames().slice(0, 520)) {
    queries.push(`${name} landscaping website`);
    queries.push(`${name} official website`);
  }
  return queries.slice(0, MAX_QUERIES);
}

function readLeadSheetBusinessNames() {
  const names = new Set();
  for (const file of leadSheetPaths) {
    if (!fs.existsSync(file)) continue;
    try {
      const xml = execFileSync("unzip", ["-p", file, "xl/sharedStrings.xml"], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
      for (const match of xml.matchAll(/(?:maps\/place\/|[?&]q=)([^/<>&]+)/gi)) {
        const raw = decodeURIComponent(match[1].replace(/\+/g, " "));
        const name = normalizeWhitespace(raw)
          .replace(/\s+(data|@).*$/i, "")
          .replace(/\s+\([0-9). -]+\).*$/i, "")
          .replace(/\s+in\s+[A-Z][A-Za-z ]+,\s+[A-Z]{2}.*$/i, "")
          .replace(/\s+-\s+.*$/i, "");
        if (
          name.length >= 4 &&
          name.length <= 70 &&
          !/^(http|schemas|google|maps|search|landscaping service|tree removal and landscaping services)$/i.test(name) &&
          /(landscap|lawn|turf|irrigation|hardscape|outdoor|garden|paver|yard|scapes|green|desert|tree|sprinkler)/i.test(name)
        ) {
          names.add(name);
        }
      }
    } catch {
      // Supplemental lead sheets are optional discovery inputs.
    }
  }
  return [...names];
}

function domainGuessesFromBusinessNames() {
  const guesses = [];
  for (const name of readLeadSheetBusinessNames()) {
    const compact = name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/\b(llc|inc|co|company|services?|service|landscaping|landscape|lawn|care|design|designs|and|the)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .join("");
    const full = name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/\b(llc|inc|co|company|the)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .join("");
    const variants = new Set([full, compact]);
    if (compact) {
      variants.add(`${compact}landscaping`);
      variants.add(`${compact}landscape`);
      variants.add(`${compact}az`);
      variants.add(`${compact}outdoors`);
    }
    for (const variant of variants) {
      if (variant.length >= 5 && variant.length <= 42) {
        guesses.push({
          domain: `${variant}.com`,
          url: `https://${variant}.com/`,
          foundUrl: `https://${variant}.com/`,
          discoveryQuery: name,
          discoveryPath: "lead-sheet/domain-guess"
        });
      }
    }
  }
  return guesses;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function searchBing(query, page = 0) {
  const first = page * 10 + 1;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&first=${first}&cc=us&setmkt=en-US`;
  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) return [];
  const html = await res.text();
  const hrefs = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map((m) => normalizeUrl(m[1])).filter(Boolean);
  return hrefs;
}

async function searchDuckDuckGo(query, page = 0) {
  const offset = page * 30;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${offset}`;
  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) return [];
  const html = await res.text();
  return [...html.matchAll(/result__a[^>]+href=["']([^"']+)["']/gi)]
    .map((m) => normalizeUrl(m[1]))
    .filter(Boolean);
}

async function discoverCandidates() {
  const queries = buildQueries();
  const byDomain = new Map();
  let duckFailures = 0;
  let duckDisabled = false;
  for (const guess of domainGuessesFromBusinessNames()) {
    if (!isBadHost(guess.domain) && !byDomain.has(guess.domain)) byDomain.set(guess.domain, guess);
  }
  console.log(`seeded ${byDomain.size} candidate domains from lead-sheet domain guesses`);
  for (let i = 0; i < queries.length; i += 1) {
    const query = queries[i];
    for (let page = 0; page < 3; page += 1) {
      let urls = [];
      const [bingResult, duckResult] = await Promise.allSettled([
        searchBing(query, page),
        duckDisabled ? Promise.resolve([]) : searchDuckDuckGo(query, page)
      ]);
      if (bingResult.status === "fulfilled") urls.push(...bingResult.value);
      else console.warn(`bing failed: ${query} page ${page + 1}: ${bingResult.reason.message}`);
      if (duckResult.status === "fulfilled") urls.unshift(...duckResult.value);
      else {
        duckFailures += 1;
        console.warn(`duckduckgo failed: ${query} page ${page + 1}: ${duckResult.reason.message}`);
        if (duckFailures >= 18) {
          duckDisabled = true;
          console.warn("duckduckgo disabled for the rest of discovery after repeated fetch failures");
        }
      }
      for (const foundUrl of urls) {
        const domain = domainOf(foundUrl);
        if (!domain || isBadHost(domain) || /\.(pdf|jpg|jpeg|png|webp|gif)$/i.test(foundUrl)) continue;
        if (!byDomain.has(domain)) {
          byDomain.set(domain, {
            domain,
            url: homepageOf(foundUrl),
            foundUrl,
            discoveryQuery: query,
            discoveryPath: rankingQueries.includes(query) ? "ranking/list/search" : "local/service/search"
          });
        }
      }
    }
    if ((i + 1) % 25 === 0) {
      console.log(`discovery progress: ${i + 1}/${queries.length} queries, ${byDomain.size} candidate domains`);
    }
    if (byDomain.size > TARGET * 8 && i > 140) break;
    await sleep(150);
  }
  const candidates = [...byDomain.values()];
  fs.writeFileSync(CANDIDATES_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));
  console.log(`wrote ${candidates.length} candidates to ${path.relative(ROOT, CANDIDATES_PATH)}`);
  return candidates;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function categoryFromText(text) {
  const lower = text.toLowerCase();
  const categories = [];
  if (/lawn (care|maintenance|mowing)/.test(lower)) categories.push("lawn care");
  if (/hardscape|paver|patio|retaining wall/.test(lower)) categories.push("hardscaping");
  if (/irrigation|sprinkler|drip/.test(lower)) categories.push("irrigation");
  if (/outdoor (living|kitchen)|fire pit|fireplace|pergola|pool/.test(lower)) categories.push("outdoor living");
  if (/turf|synthetic grass|artificial grass/.test(lower)) categories.push("artificial turf");
  if (/garden design|landscape architect|design-build|landscape design/.test(lower)) categories.push("landscape design-build");
  if (/commercial/.test(lower)) categories.push("commercial landscaping");
  if (/tree service|tree care|arbor/.test(lower)) categories.push("tree care");
  return categories.length ? [...new Set(categories)].join("; ") : "landscaping";
}

function locationFromText(text, fallbackQuery) {
  const states = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
  const cityState = text.match(new RegExp(`([A-Z][A-Za-z .'-]{2,40}),\\s*(${states})\\b`));
  if (cityState) return `${normalizeWhitespace(cityState[1])}, ${cityState[2]}`;
  const queryMatch = fallbackQuery.match(/([A-Za-z .'-]+) ([A-Z]{2}|DC)$/);
  return queryMatch ? `${normalizeWhitespace(queryMatch[1])}, ${queryMatch[2]}` : "";
}

function businessNameFrom(html, title, domain) {
  const og = getTag(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  const app = getTag(html, /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i);
  const h1 = getTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const value = og || app || title.split(/[|–—-]/)[0] || h1 || domain;
  return normalizeWhitespace(value.replace(/\b(home|homepage)\b/ig, "")).slice(0, 90) || domain;
}

function scoreFromEvidence(evidence) {
  const text = evidence.text.toLowerCase();
  const ctaCount = countMatches(text, conversionTerms.cta);
  const trustCount = countMatches(text, conversionTerms.trust);
  const proofCount = countMatches(text, conversionTerms.proof);
  const offerCount = countMatches(text, conversionTerms.offer);
  const localCount = countMatches(text, conversionTerms.local);
  const phone = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(evidence.text);
  const form = /<form\b/i.test(evidence.html);
  const imageCount = (evidence.html.match(/<img\b/gi) || []).length;
  const headingClear = evidence.h1 && countMatches(evidence.h1, landscapingKeywords) > 0;
  return {
    firstImpressionScore: clampScore(4 + (headingClear ? 2 : 0) + Math.min(2, ctaCount) + Math.min(2, imageCount / 4)),
    visualQualityScore: clampScore(3 + Math.min(3, imageCount / 3) + Math.min(2, proofCount) + Math.min(2, trustCount / 2)),
    mobileConversionScore: clampScore(3 + Math.min(3, ctaCount) + (phone ? 2 : 0) + (form ? 1 : 0) + (evidence.mobileSticky ? 1 : 0)),
    ctaClarityScore: clampScore(3 + Math.min(4, ctaCount) + (phone ? 2 : 0) + (form ? 1 : 0)),
    trustSignalScore: clampScore(2 + Math.min(5, trustCount) + Math.min(2, proofCount) + (phone ? 1 : 0)),
    offerClarityScore: clampScore(3 + Math.min(5, offerCount) + (headingClear ? 2 : 0)),
    formFrictionScore: clampScore(form ? 7 : 4 + Math.min(2, ctaCount)),
    localSeoScore: clampScore(2 + Math.min(4, localCount) + (evidence.location ? 2 : 0) + (evidence.hasSchema ? 2 : 0))
  };
}

function notesFromEvidence(evidence, scores) {
  const text = evidence.text.toLowerCase();
  const ideas = [];
  const weaknesses = [];
  if (scores.ctaClarityScore >= 8) ideas.push("Primary quote/call CTA is easy to find.");
  if (scores.trustSignalScore >= 8) ideas.push("Uses reviews, licensing, guarantees, awards, or years-in-business proof.");
  if (text.includes("before") && text.includes("after")) ideas.push("Before/after proof supports homeowner confidence.");
  if (text.includes("portfolio") || text.includes("gallery")) ideas.push("Portfolio/gallery helps prove finished-work quality.");
  if (text.includes("service area") || text.includes("serving")) ideas.push("Service area language supports local intent.");
  if (evidence.mobileSticky) ideas.push("Mobile viewport includes sticky or fixed conversion action.");
  if (scores.ctaClarityScore < 6) weaknesses.push("CTA language is weak or hard to locate.");
  if (scores.trustSignalScore < 6) weaknesses.push("Trust proof is thin above the main homepage content.");
  if (scores.offerClarityScore < 6) weaknesses.push("Services/offers are not immediately clear.");
  if (!evidence.phoneVisible) weaknesses.push("Phone number is not obvious in captured homepage text.");
  if (!evidence.hasForm) weaknesses.push("No homepage form detected; conversion path may require extra clicks.");
  if (!ideas.length) ideas.push("Basic landscaping service presentation with limited standout conversion pattern.");
  if (!weaknesses.length) weaknesses.push("Maintain proof density and avoid burying quote path below decorative content.");
  return { ideas, weaknesses };
}

async function validateCandidate(candidate) {
  const attempts = [candidate.url];
  if (candidate.url.startsWith("http://")) attempts.push(candidate.url.replace(/^http:/, "https:"));
  if (candidate.url.startsWith("https://")) attempts.push(candidate.url.replace(/^https:/, "http:"));
  for (const attempt of attempts) {
    try {
      const res = await fetchWithTimeout(attempt, {}, 14000);
      const finalUrl = res.url || attempt;
      const domain = domainOf(finalUrl);
      if (!res.ok || isBadHost(domain)) continue;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) continue;
      const html = await res.text();
      const text = stripHtml(html);
      const lower = text.toLowerCase();
      const keywordCount = countMatches(lower, landscapingKeywords);
      const parked = /domain is for sale|buy this domain|parked free|sedo parking|godaddy.com\/forsale|available for acquisition|this domain may be for sale|coming soon/i.test(text);
      if (parked || text.length < 400 || keywordCount < 1) continue;
      const title = getTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
      const h1 = getTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
      return {
        ...candidate,
        url: homepageOf(finalUrl),
        finalUrl,
        loadedSuccessfully: true,
        httpStatus: res.status,
        html,
        text,
        title,
        h1,
        businessName: businessNameFrom(html, title, domain),
        category: categoryFromText(text),
        location: locationFromText(text, candidate.discoveryQuery),
        hasSchema: /application\/ld\+json|schema\.org/i.test(html),
        hasForm: /<form\b/i.test(html),
        phoneVisible: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(text)
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function validateCandidates(candidates) {
  console.log(`validating ${candidates.length} candidate domains`);
  let completed = 0;
  const valid = [];
  await mapLimit(candidates, 24, async (candidate) => {
    const result = await validateCandidate(candidate);
    completed += 1;
    if (result) valid.push(result);
    if (completed % 100 === 0) console.log(`validation progress: ${completed}/${candidates.length}, valid=${valid.length}`);
  });
  return valid;
}

async function auditWithBrowser(validated, target = TARGET, seedDomains = new Set()) {
  mkdirp(SCREENSHOT_DIR);
  const browser = await chromium.launch({ headless: true });
  const desktopContext = await browser.newContext({ viewport: { width: 1365, height: 768 }, userAgent: USER_AGENT });
  const mobileContext = await browser.newContext({ ...devices["iPhone 13"], userAgent: USER_AGENT });
  const results = [];
  const finalDomains = new Set(seedDomains);
  const stop = { value: false };
  let completed = 0;

  await mapLimit(validated, 4, async (site) => {
    if (stop.value || results.length >= target) {
      stop.value = true;
      return;
    }
    const page = await desktopContext.newPage();
    const mobilePage = await mobileContext.newPage();
    try {
      await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 18000 });
      await page.waitForTimeout(1200);
      const finalUrl = page.url();
      const finalDomain = domainOf(finalUrl);
      if (!finalDomain || isBadHost(finalDomain) || finalDomains.has(finalDomain)) return;
      finalDomains.add(finalDomain);
      const screenshotPath = path.join(SCREENSHOT_DIR, `${String(results.length + 1).padStart(3, "0")}-${slugForDomain(site.domain)}.jpg`);
      await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 48, fullPage: false });
      const evidence = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        const h1 = document.querySelector("h1")?.innerText || "";
        const buttons = [...document.querySelectorAll("a,button,input[type='submit']")].map((el) => el.innerText || el.value || el.getAttribute("aria-label") || "").filter(Boolean);
        const forms = [...document.querySelectorAll("form")].map((form) => form.querySelectorAll("input,select,textarea").length);
        const fixed = [...document.querySelectorAll("a,button,[role='button']")].filter((el) => {
          const style = window.getComputedStyle(el);
          return ["fixed", "sticky"].includes(style.position);
        }).map((el) => el.innerText || el.getAttribute("aria-label") || "");
        const heroText = document.elementFromPoint(window.innerWidth / 2, Math.min(260, window.innerHeight / 2))?.innerText || "";
        return { text, h1, buttons, forms, fixed, heroText };
      });
      await mobilePage.goto(site.url, { waitUntil: "domcontentloaded", timeout: 18000 });
      await mobilePage.waitForTimeout(700);
      const mobileEvidence = await mobilePage.evaluate(() => {
        const fixed = [...document.querySelectorAll("a,button,[role='button']")].filter((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return ["fixed", "sticky"].includes(style.position) && rect.width > 30 && rect.height > 20;
        }).map((el) => el.innerText || el.getAttribute("aria-label") || "");
        const visibleActions = [...document.querySelectorAll("a,button,input[type='submit']")].filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.top >= 0 && rect.top < window.innerHeight && rect.width > 20 && rect.height > 20;
        }).map((el) => el.innerText || el.value || el.getAttribute("aria-label") || "");
        return { fixed, visibleActions };
      });
      const combinedText = `${site.text} ${evidence.text} ${evidence.buttons.join(" ")} ${mobileEvidence.visibleActions.join(" ")}`;
      if (/domain is for sale|buy this domain|parked free|sedo parking|godaddy.com\/forsale|available for acquisition|this domain may be for sale/i.test(combinedText)) return;
      const enriched = {
        ...site,
        finalUrl,
        text: combinedText,
        h1: evidence.h1 || site.h1,
        mobileSticky: mobileEvidence.fixed.some((value) => /call|quote|estimate|contact|book/i.test(value)),
        screenshotPath: path.relative(ROOT, screenshotPath)
      };
      const scores = scoreFromEvidence(enriched);
      const notes = notesFromEvidence(enriched, scores);
      const row = {
        businessName: enriched.businessName,
        url: enriched.finalUrl,
        category: enriched.category,
        location: enriched.location,
        loadedSuccessfully: true,
        firstImpressionScore: scores.firstImpressionScore,
        visualQualityScore: scores.visualQualityScore,
        mobileConversionScore: scores.mobileConversionScore,
        ctaClarityScore: scores.ctaClarityScore,
        trustSignalScore: scores.trustSignalScore,
        offerClarityScore: scores.offerClarityScore,
        formFrictionScore: scores.formFrictionScore,
        speedPerformanceNotes: "Browser loaded homepage DOM and captured first viewport; perceived speed risk rises if heavy media delayed the 18s audit timeout.",
        seoLocalSeoNotes: `Title: ${enriched.title || "not detected"}. H1: ${enriched.h1 || "not detected"}. ${enriched.hasSchema ? "Schema detected." : "No schema detected in homepage HTML."} ${enriched.location ? `Location signal: ${enriched.location}.` : "Location signal not obvious from homepage text."}`,
        standoutDesignConversionIdeas: notes.ideas.join(" "),
        weaknessesToAvoid: notes.weaknesses.join(" "),
        screenshotPath: enriched.screenshotPath,
        discoveryPath: enriched.discoveryPath,
        discoveryQuery: enriched.discoveryQuery,
        reviewedAt: new Date().toISOString()
      };
      results.push(row);
      if (results.length % 25 === 0 || results.length >= target) {
        fs.writeFileSync(PARTIAL_JSON_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), validReviewedCount: results.length, rows: results }, null, 2));
      }
      if (results.length >= target) stop.value = true;
    } catch (error) {
      // Browser failures are intentionally not counted.
    } finally {
      await page.close().catch(() => {});
      await mobilePage.close().catch(() => {});
      completed += 1;
      if (completed % 25 === 0 || results.length === target) {
        console.log(`browser audit progress: inspected=${completed}, counted=${results.length}/${target}`);
      }
    }
  });
  await browser.close();
  return results.slice(0, TARGET);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeOutputs(rows) {
  fs.writeFileSync(JSON_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), validReviewedCount: rows.length, rows }, null, 2));
  const headers = [
    "Business name", "URL", "Category/type", "Location", "Loaded successfully", "First impression score",
    "Visual quality score", "Mobile conversion score", "CTA clarity score", "Trust signal score", "Offer clarity score",
    "Form/friction score", "Speed/performance notes", "SEO/local SEO notes", "Standout design/conversion ideas",
    "Weaknesses to avoid", "Screenshot path", "Discovery path", "Discovery query", "Reviewed at"
  ];
  const fields = [
    "businessName", "url", "category", "location", "loadedSuccessfully", "firstImpressionScore",
    "visualQualityScore", "mobileConversionScore", "ctaClarityScore", "trustSignalScore", "offerClarityScore",
    "formFrictionScore", "speedPerformanceNotes", "seoLocalSeoNotes", "standoutDesignConversionIdeas",
    "weaknessesToAvoid", "screenshotPath", "discoveryPath", "discoveryQuery", "reviewedAt"
  ];
  const csv = [headers.map(csvEscape).join(",")]
    .concat(rows.map((row) => fields.map((field) => csvEscape(row[field])).join(",")))
    .join("\n");
  fs.writeFileSync(CSV_PATH, `${csv}\n`);

  const avg = (field) => (rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length).toFixed(1);
  const ideaCounts = new Map();
  for (const row of rows) {
    for (const sentence of row.standoutDesignConversionIdeas.split(".").map((s) => s.trim()).filter(Boolean)) {
      ideaCounts.set(sentence, (ideaCounts.get(sentence) || 0) + 1);
    }
  }
  const topIdeas = [...ideaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topSites = [...rows]
    .sort((a, b) => (b.firstImpressionScore + b.ctaClarityScore + b.trustSignalScore + b.visualQualityScore) - (a.firstImpressionScore + a.ctaClarityScore + a.trustSignalScore + a.visualQualityScore))
    .slice(0, 20);

  const summary = `# Landscaping Website Research Summary

Generated: ${new Date().toISOString()}

## Method

- Discovery combined search-result extraction from "best/award-winning landscaping website" queries, landscaping company rankings, local landscaping searches across major U.S. cities, service-specific searches, outdoor living/hardscape/lawn-care queries, and franchise/multi-location landscaping queries.
- Counted sites were deduplicated by domain, filtered to exclude social profiles, directories, marketplaces, parked domains, broken pages, and pages without meaningful landscaping/home-service evidence.
- Every counted site loaded in a Chromium browser, produced a first-viewport screenshot, and received desktop plus mobile conversion checks.
- Screenshots were generated locally under \`research/screenshots/\` and intentionally ignored by git to avoid adding a large binary screenshot folder to the template repository.

## Count

- Valid live landscaping/home-service websites reviewed: ${rows.length}
- Candidate domains discovered before validation: ${fs.existsSync(CANDIDATES_PATH) ? JSON.parse(fs.readFileSync(CANDIDATES_PATH, "utf8")).candidates.length : "not recorded"}

## Average Scores

- First impression: ${avg("firstImpressionScore")}/10
- Visual quality: ${avg("visualQualityScore")}/10
- Mobile conversion: ${avg("mobileConversionScore")}/10
- CTA clarity: ${avg("ctaClarityScore")}/10
- Trust signals: ${avg("trustSignalScore")}/10
- Offer clarity: ${avg("offerClarityScore")}/10
- Form/friction: ${avg("formFrictionScore")}/10

## Strongest Conversion Patterns

${topIdeas.map(([idea, count]) => `- ${idea}. Observed on ${count} reviewed sites.`).join("\n")}

## Practical Design Implications For The Template

- The hero must answer service, location, trust, and next step without making homeowners scroll.
- The primary CTA should use direct homeowner language such as "Get a Free Landscaping Estimate" and pair with a tap-to-call option.
- Trust proof works best when it is not hidden: reviews, licenses/insurance, local ownership, warranties, and response-time expectations should sit near the first conversion action.
- Proof of work needs to be visual and specific: before/after, project location, scope, timeline, and project type outperform generic gallery thumbnails.
- Mobile conversion should assume urgency: sticky call/estimate actions, short forms, and visible phone numbers reduce friction.
- Local SEO sections should name service areas, services, and project types in natural language instead of generic brand copy.

## Highest-Scoring Reference Sites

${topSites.map((row, index) => `${index + 1}. ${row.businessName} — ${row.url} — scores: first ${row.firstImpressionScore}, visual ${row.visualQualityScore}, CTA ${row.ctaClarityScore}, trust ${row.trustSignalScore}`).join("\n")}

## Original Template Weaknesses Identified Before Redesign

- The existing first viewport was visually polished but too editorial: the headline did not immediately say "landscaping estimate" or name the core services.
- The CTA used "Request Free Quote," but the page did not maximize urgent homeowner paths like a paired phone/estimate choice and short proof line.
- The page had many useful sections, but too many were spread out and repeated similar proof/process ideas, which diluted the conversion path.
- Trust signals existed, including reviews and licensing, but the strongest proof needed a tighter above-the-fold trust bar and clearer homeowner reassurance.
- The design leaned premium but slightly template-like in section rhythm; the redesign should create a more decisive lead-generation homepage with clearer offer hierarchy.
`;
  fs.writeFileSync(SUMMARY_PATH, summary);
  console.log(`wrote ${rows.length} rows`);
  console.log(`- ${path.relative(ROOT, CSV_PATH)}`);
  console.log(`- ${path.relative(ROOT, JSON_PATH)}`);
  console.log(`- ${path.relative(ROOT, SUMMARY_PATH)}`);
}

async function main() {
  mkdirp(OUT_DIR);
  if (FINALIZE_PARTIAL) {
    const partial = JSON.parse(fs.readFileSync(PARTIAL_JSON_PATH, "utf8"));
    writeOutputs(partial.rows.slice(0, TARGET));
    return;
  }
  if (MERGE_SUPPLEMENT) {
    const base = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "landscaping-website-audit.base-450.json"), "utf8")).rows;
    const supplement = JSON.parse(fs.readFileSync(PARTIAL_JSON_PATH, "utf8")).rows;
    const seen = new Set();
    const merged = [];
    for (const row of [...base, ...supplement]) {
      const domain = domainOf(row.url);
      if (!domain || seen.has(domain) || isBadHost(domain)) continue;
      seen.add(domain);
      merged.push(row);
      if (merged.length >= TARGET) break;
    }
    writeOutputs(merged);
    return;
  }
  if (SUPPLEMENT_PARTIAL) {
    const base = JSON.parse(fs.readFileSync(PARTIAL_JSON_PATH, "utf8")).rows;
    const existingDomains = new Set(base.map((row) => domainOf(row.url)));
    const candidates = JSON.parse(fs.readFileSync(CANDIDATES_PATH, "utf8")).candidates;
    const validated = (await validateCandidates(candidates)).filter((site) => !existingDomains.has(domainOf(site.finalUrl || site.url)));
    const needed = Math.max(0, TARGET - existingDomains.size);
    console.log(`supplement needs ${needed} new unique domains after ${existingDomains.size} base rows`);
    const supplement = needed ? await auditWithBrowser(validated, needed, existingDomains) : [];
    writeOutputs([...base, ...supplement].slice(0, TARGET));
    return;
  }
  let candidates = [];
  if (!AUDIT_ONLY && (!USE_EXISTING || !fs.existsSync(CANDIDATES_PATH))) {
    candidates = await discoverCandidates();
  } else {
    candidates = JSON.parse(fs.readFileSync(CANDIDATES_PATH, "utf8")).candidates;
  }
  if (DISCOVER_ONLY) return;
  const validated = await validateCandidates(candidates);
  if (validated.length < TARGET) {
    console.warn(`only ${validated.length} validated sites available before browser audit; target is ${TARGET}`);
  }
  const reviewed = await auditWithBrowser(validated);
  if (reviewed.length < TARGET) {
    console.warn(`browser-reviewed count ${reviewed.length} is below requested target ${TARGET}`);
  }
  writeOutputs(reviewed);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
