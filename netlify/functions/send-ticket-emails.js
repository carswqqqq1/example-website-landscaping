const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

let SITE_CONFIG = {};

try {
  SITE_CONFIG = require(path.join(process.cwd(), 'site-config.js'));
} catch (error) {
  SITE_CONFIG = {};
}

const OWNER_EMAIL = process.env.OWNER_EMAIL || SITE_CONFIG.ownerEmail || SITE_CONFIG.email || '';
const FROM_EMAIL = process.env.FROM_EMAIL || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
const OWNER_EMAIL_PROVIDER = String(process.env.OWNER_EMAIL_PROVIDER || 'smtp').toLowerCase();

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || '465');
const SMTP_SECURE = String(process.env.SMTP_SECURE || (SMTP_PORT === 465 ? 'true' : 'false')).toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';
const GOOGLE_SHEETS_WEBHOOK_SECRET = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || '';
const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL || '';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const GOOGLE_SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'Owner Lead Dashboard';
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN || '';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || '';
const CRM_WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET || '';
const AIRTABLE_WEBHOOK_URL = process.env.AIRTABLE_WEBHOOK_URL || '';
const HUBSPOT_WEBHOOK_URL = process.env.HUBSPOT_WEBHOOK_URL || '';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 6);

const EMAIL_DIR = path.join(process.cwd(), 'emails');
const DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const processedKeys = new Map();
const rateLimitStore = new Map();
const dashboardFormatStore = new Map();
const DASHBOARD_FORMAT_TTL_MS = 6 * 60 * 60 * 1000;
const DIRECT_SHEET_HEADERS = [
  'timestamp',
  'status',
  'name',
  'phone',
  'email',
  'city',
  'service',
  'budget_range',
  'start_timeline',
  'lead_quality',
  'estimated_project_value',
  'next_action',
  'follow_up_due',
  'notes',
  'ticket_id',
  'lead_tags',
  'lead_source',
  'project_reference',
  'style_reference',
  'project_location',
  'contact_method',
  'submitted_local',
  'last_touched',
  'page_url',
  'utm_source',
  'utm_medium',
  'utm_campaign'
];
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'trashmail.com',
  'yopmail.com',
  'temp-mail.org',
  'fakeinbox.com',
  'sharklasers.com'
]);

let smtpTransporter;

function cleanupProcessedKeys(now = Date.now()) {
  for (const [key, timestamp] of processedKeys.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      processedKeys.delete(key);
    }
  }
}

function buildDedupeKeys(submission, normalized) {
  const keys = [];

  if (submission && submission.id) keys.push(`submission:${submission.id}`);
  if (submission && submission.number) keys.push(`submission-number:${submission.number}`);

  keys.push(`ticket:${normalized.ticket_id}:client:${normalized.email.toLowerCase()}`);
  return keys;
}

function shouldSkipDuplicate(keys) {
  const now = Date.now();
  cleanupProcessedKeys(now);

  if (keys.some((key) => processedKeys.has(key))) return true;
  keys.forEach((key) => processedKeys.set(key, now));
  return false;
}

function readTemplate(filename) {
  const fullPath = path.join(EMAIL_DIR, filename);
  return fs.readFileSync(fullPath, 'utf8');
}

function safeText(value, fallback = 'Not provided') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isInvalidTicketId(id) {
  const value = normalizeWhitespace(id);
  if (!value) return true;
  const lower = value.toLowerCase();
  if (lower.includes('__tid__')) return true;
  if (lower === 'undefined' || lower === 'null') return true;
  return value.length < 8;
}

function generateLiveTicketId() {
  const bytes = crypto.randomBytes(10);
  let digits = '';
  for (let i = 0; i < bytes.length; i += 1) {
    digits += String(bytes[i] % 10);
  }
  return `TG-LIVE-${digits.slice(0, 10)}`;
}

function resolveTicketId(data = {}, fallback = '') {
  const incoming = safeText(data.ticket_id, '');
  if (!isInvalidTicketId(incoming)) return incoming;
  if (!isInvalidTicketId(fallback)) return normalizeWhitespace(fallback);
  return generateLiveTicketId();
}

function normalizeDashes(value) {
  return String(value || '').replace(/[–—]/g, '-');
}

function parseMoneyToken(raw) {
  const value = normalizeWhitespace(String(raw || '').replace(/\$/g, ''));
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
  const match = normalized.match(/^(\d+(?:\.\d+)?)(k)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return Math.round(match[2] ? amount * 1000 : amount);
}

function formatUsdRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return 'Not provided';
  }
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return `$${low.toLocaleString('en-US')} - $${high.toLocaleString('en-US')}`;
}

function parseBudgetRange(raw) {
  const source = normalizeDashes(raw);
  if (!source) return null;

  const rangeMatch = source.match(/([$]?\s*\d[\d,\s]*(?:\.\d+)?\s*[kK]?)\s*-\s*([$]?\s*\d[\d,\s]*(?:\.\d+)?\s*[kK]?)/);
  if (rangeMatch) {
    const low = parseMoneyToken(rangeMatch[1]);
    const high = parseMoneyToken(rangeMatch[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) return formatUsdRange(low, high);
  }

  const tierMatch = source.match(/(\d+(?:\.\d+)?\s*[kK])\s*-\s*(\d+(?:\.\d+)?\s*[kK])/);
  if (tierMatch) {
    const low = parseMoneyToken(tierMatch[1]);
    const high = parseMoneyToken(tierMatch[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) return formatUsdRange(low, high);
  }

  const plusMatch = source.match(/([$]?\s*\d[\d,\s]*(?:\.\d+)?\s*[kK]?)\s*\+/);
  if (plusMatch) {
    const low = parseMoneyToken(plusMatch[1]);
    if (Number.isFinite(low)) return formatUsdRange(low, low * 2.5);
  }

  return null;
}

function normalizeBudgetRange(rawData = {}) {
  const primaryInputs = [
    rawData.budget_range,
    rawData.budget,
    rawData.consultation_tier,
    rawData.lead_tier
  ];

  for (const value of primaryInputs) {
    const parsed = parseBudgetRange(value);
    if (parsed) return parsed;
  }
  return 'Not provided';
}

function extractBudgetNumbers(rangeLabel) {
  const matches = String(rangeLabel || '').match(/\$([\d,]+)/g) || [];
  return matches
    .map((entry) => Number(entry.replace(/[^0-9]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidEmailAddress(value) {
  if (!value || value === 'Not provided') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function isDisposableEmail(value) {
  if (!isValidEmailAddress(value)) return false;
  const domain = String(value).trim().toLowerCase().split('@')[1] || '';
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

function isValidPhone(value) {
  const digits = normalizePhone(value);
  return digits.length >= 10 && digits.length <= 15;
}

function cleanupRateLimitStore(now = Date.now()) {
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (!entry || now - entry.firstSeen > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }
}

function getClientIp(event, payload = {}) {
  const headers = event && event.headers ? event.headers : {};
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  const firstForwarded = String(forwarded).split(',').map((part) => part.trim()).filter(Boolean)[0];
  const nfIp = headers['x-nf-client-connection-ip'] || headers['X-Nf-Client-Connection-Ip'];
  return firstForwarded || nfIp || payload.ip || payload.client_ip || 'unknown';
}

function isRateLimited(ip) {
  const key = String(ip || 'unknown');
  const now = Date.now();
  cleanupRateLimitStore(now);
  const current = rateLimitStore.get(key);
  if (!current) {
    rateLimitStore.set(key, { count: 1, firstSeen: now });
    return false;
  }
  current.count += 1;
  rateLimitStore.set(key, current);
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

function isPlaceholderValue(value) {
  const text = String(value || '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase();
  if (!text) return true;
  const normalized = text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
  if (/^(not set|not provided|not selected|not specified|not discussed yet|to be discussed|to be discussed during consultation|unknown|none|null|undefined|n\/a|na)$/i.test(normalized)) {
    return true;
  }
  if (
    normalized.includes('not selected') ||
    normalized.includes('not provided') ||
    normalized.includes('to be discussed')
  ) {
    return true;
  }
  return (
    false
  );
}

function isMeaningfulValue(value) {
  return !isPlaceholderValue(value);
}

function normalizeOptionalField(value, fallback = '') {
  const cleaned = normalizeWhitespace(value);
  if (!cleaned || isPlaceholderValue(cleaned)) return fallback;
  return cleaned;
}

function isInternalVisionContent(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  if (!text) return false;
  const internalPatterns = [
    'qa',
    'test',
    'verification',
    'pipeline',
    'assistant',
    'codex',
    'browser path',
    'manual owner',
    'owner/client delivery',
    'final production verification'
  ];
  return internalPatterns.some((pattern) => text.includes(pattern));
}


function ownerSheetValue(value, fallback = '') {
  return isMeaningfulValue(value) ? safeText(value, fallback) : fallback;
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function splitFullName(fullName = '') {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return { first: '', last: '' };

  const parts = cleaned.split(' ');
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.shift(), last: parts.join(' ') };
}

function buildFullName(firstName, lastName) {
  const parts = [safeText(firstName, ''), safeText(lastName, '')].filter((part) => !isPlaceholderValue(part));
  return parts.length ? parts.join(' ') : '';
}

function buildProjectLocation(projectAddress, city) {
  const parts = [safeText(projectAddress, ''), safeText(city, '')].filter((part) => !isPlaceholderValue(part));
  return parts.length ? parts.join(', ') : '';
}

function cleanBudgetLabel(value) {
  const parsed = parseBudgetRange(value);
  return parsed || 'Not provided';
}

function getPriorityClass(priorityValue) {
  const priority = safeText(priorityValue, '').toLowerCase();
  if (priority.includes('high')) return 'p-high';
  if (priority.includes('medium')) return 'p-medium';
  return 'p-low';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPlainTextFromHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|section|header|footer|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function formatPhoenixDate(isoString) {
  try {
    const date = isoString ? new Date(isoString) : new Date();
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch {
    return safeText(isoString, 'Not provided');
  }
}

function hasSmtpCredentials() {
  return Boolean(SMTP_USER && SMTP_PASS);
}

function hasResendCredentials() {
  return Boolean(RESEND_API_KEY);
}

function isGmailAddress(fromValue) {
  return /@gmail\.com/i.test(String(fromValue || ''));
}

function getFromEmail(provider = 'auto') {
  if (provider === 'resend') {
    if (RESEND_FROM_EMAIL) return RESEND_FROM_EMAIL;
    if (FROM_EMAIL && !isGmailAddress(FROM_EMAIL)) return FROM_EMAIL;
    return 'Think Green <onboarding@resend.dev>';
  }

  if (FROM_EMAIL) return FROM_EMAIL;
  if (SMTP_USER) return `Think Green <${SMTP_USER}>`;
  return 'Think Green <no-reply@thinkgreen-az.com>';
}

function configuredProvider() {
  if (EMAIL_PROVIDER === 'smtp' || EMAIL_PROVIDER === 'resend' || EMAIL_PROVIDER === 'auto') {
    return EMAIL_PROVIDER;
  }
  return 'resend';
}

function resolveEmailProvider(preferredProvider = '') {
  const preferred = String(preferredProvider || '').toLowerCase();

  if (preferred === 'smtp') {
    if (hasSmtpCredentials()) return 'smtp';
    if (hasResendCredentials()) return 'resend';
    return 'none';
  }

  if (preferred === 'resend') {
    if (hasResendCredentials()) return 'resend';
    if (hasSmtpCredentials()) return 'smtp';
    return 'none';
  }

  const provider = configuredProvider();

  if (provider === 'auto') {
    if (hasResendCredentials()) return 'resend';
    if (hasSmtpCredentials()) return 'smtp';
    return 'none';
  }

  if (provider === 'resend') {
    if (hasResendCredentials()) return 'resend';
    if (hasSmtpCredentials()) return 'smtp';
    return 'none';
  }

  if (hasSmtpCredentials()) return 'smtp';
  if (hasResendCredentials()) return 'resend';
  return 'none';
}

function getSmtpTransporter() {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }

  return smtpTransporter;
}

function buildNormalizedData(rawData = {}, meta = {}) {
  const normalized = { ...rawData };
  const splitName = splitFullName(rawData.full_name || '');
  const fallbackFirst = safeText(splitName.first, '');
  const fallbackLast = safeText(splitName.last, '');

  normalized.first_name = normalizeOptionalField(rawData.first_name, fallbackFirst || 'there');
  normalized.last_name = safeText(rawData.last_name, fallbackLast);
  if (isPlaceholderValue(normalized.last_name)) normalized.last_name = '';
  normalized.full_name = buildFullName(normalized.first_name, normalized.last_name);
  if (!normalized.full_name) normalized.full_name = 'Website Lead';

  normalized.email = normalizeOptionalField(rawData.email || rawData.email_visible, '');
  normalized.phone = normalizeOptionalField(rawData.phone, '');
  normalized.project_address = normalizeOptionalField(rawData.project_address || rawData.property_address || rawData.address, '');
  normalized.city = normalizeOptionalField(rawData.city || rawData.project_city, '');
  normalized.project_location = buildProjectLocation(normalized.project_address, normalized.city);
  normalized.service = normalizeOptionalField(rawData.service || rawData.project_type || rawData.selected_service, 'Landscape Design & Build');
  normalized.selected_service = normalizeOptionalField(rawData.selected_service || normalized.service, normalized.service);
  normalized.consultation_tier = normalizeOptionalField(rawData.consultation_tier || rawData.lead_tier, '');
  normalized.lead_tier = normalized.consultation_tier;
  normalized.selected_style = normalizeOptionalField(rawData.selected_style || rawData.project_style, '');
  normalized.selected_image = normalizeOptionalField(rawData.selected_image || rawData.project_image, '');
  normalized.selected_project_label = normalizeOptionalField(rawData.selected_project_label || rawData.project_reference, '');
  normalized.lead_source = normalizeOptionalField(rawData.lead_source || rawData.source || rawData.utm_source, 'website');
  normalized.utm_source = normalizeOptionalField(rawData.utm_source, '');
  normalized.utm_medium = normalizeOptionalField(rawData.utm_medium, '');
  normalized.utm_campaign = normalizeOptionalField(rawData.utm_campaign, '');
  normalized.utm_content = normalizeOptionalField(rawData.utm_content, '');
  normalized.referrer = normalizeOptionalField(rawData.referrer, 'direct');
  normalized.landing_path = normalizeOptionalField(rawData.landing_path, '/');
  normalized.page_url = normalizeOptionalField(rawData.page_url || meta.page_url, '');

  normalized.budget = normalizeBudgetRange(rawData);
  normalized.budget_range = normalized.budget;
  normalized.estimated_timeline = normalizeOptionalField(rawData.estimated_timeline || rawData.timeline || rawData.start_timeline || rawData.start_window, '');
  normalized.start_timeline = normalizeOptionalField(rawData.start_timeline || rawData.timeline || rawData.estimated_timeline || rawData.start_window, '');
  normalized.contact_method = normalizeOptionalField(rawData.contact_method || rawData.preferred_contact_method || rawData.preferred_contact, '');
  normalized.preferred_contact = normalized.contact_method;
  normalized.vision = normalizeOptionalField(rawData.vision || rawData.message || rawData.details || rawData.project_details, '');

  normalized.timeline = normalized.start_timeline;
  normalized.preferred_contact_method = normalized.contact_method;
  normalized.message = normalized.vision;

  normalized.ticket_id = resolveTicketId(rawData, meta.ticket_id);
  normalized.submitted_local = safeText(rawData.submitted_local, meta.submitted_local || formatPhoenixDate());
  normalized.owner_summary = normalizeOptionalField(rawData.owner_summary, meta.owner_summary);
  normalized.owner_priority = normalizeOptionalField(rawData.owner_priority, meta.owner_priority);
  normalized.owner_priority_class = getPriorityClass(normalized.owner_priority);
  normalized.owner_lead_score = normalizeOptionalField(rawData.owner_lead_score, meta.owner_lead_score);
  normalized.owner_lead_tier = normalizeOptionalField(rawData.owner_lead_tier, meta.owner_lead_tier);
  normalized.owner_lead_tags = normalizeOptionalField(rawData.owner_lead_tags, meta.owner_lead_tags);
  normalized.lead_quality = normalizeOptionalField(rawData.lead_quality, meta.lead_quality);
  normalized.estimated_project_value = normalizeOptionalField(rawData.estimated_project_value, meta.estimated_project_value);
  normalized.sheet_status = normalizeOptionalField(meta.sheet_status || rawData.sheet_status, 'New');
  normalized.sheet_row_id = normalizeOptionalField(meta.sheet_row_id || rawData.sheet_row_id, '');
  normalized.sheet_row_url = normalizeOptionalField(meta.sheet_row_url || rawData.sheet_row_url, '');
  normalized.sheet_url = normalizeOptionalField(meta.sheet_url || GOOGLE_SHEET_URL, '');

  return normalized;
}

function buildOwnerSummary(data) {
  const pieces = [];
  if (isMeaningfulValue(data.service)) pieces.push(`Service: ${safeText(data.service)}`);
  if (isMeaningfulValue(data.lead_quality)) pieces.push(`Lead Quality: ${safeText(data.lead_quality, '')}`);
  if (isMeaningfulValue(data.estimated_project_value)) pieces.push(`Estimated Value: ${safeText(data.estimated_project_value, 'Varies by scope')}`);
  if (isMeaningfulValue(data.start_timeline || data.timeline || data.estimated_timeline)) pieces.push(`Timeline: ${safeText(data.start_timeline || data.timeline || data.estimated_timeline)}`);
  return pieces.join(' · ');
}

function determinePriority(data) {
  const timeline = safeText(data.start_timeline || data.timeline || data.estimated_timeline, '').toLowerCase();
  if (timeline.includes('asap') || timeline.includes('urgent') || timeline.includes('soon')) {
    return 'High';
  }
  if (timeline.includes('next month') || timeline.includes('month') || timeline.includes('few weeks')) {
    return 'Medium';
  }
  return 'Low';
}

function timelineToMonths(value) {
  const text = safeText(value, '').toLowerCase();
  if (!text) return null;
  if (text.includes('asap') || text.includes('within 30') || text.includes('few weeks')) return 1;
  const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)\s*month/);
  if (rangeMatch) return Number(rangeMatch[2]);
  const monthMatch = text.match(/(\d+)\s*month/);
  if (monthMatch) return Number(monthMatch[1]);
  if (text.includes('later') || text.includes('planning')) return 12;
  return null;
}

function estimateProjectValue(serviceValue, budgetRangeValue) {
  const service = safeText(serviceValue, '').toLowerCase();
  if (service.includes('outdoor kitchen')) return '$20k+';
  if (service.includes('hardscape') || service.includes('hardscaping') || service.includes('patio') || service.includes('paver')) return '$10k-$40k';
  if (service.includes('turf')) return '$5k-$15k';
  if (service.includes('design & build') || service.includes('landscape design') || service.includes('full yard')) return '$30k-$100k+';

  const budgetRange = cleanBudgetLabel(budgetRangeValue);
  if (budgetRange && budgetRange !== 'Not provided') {
    if (service.includes('irrigation')) return '$5k-$25k';
    return budgetRange;
  }
  return 'Varies by scope';
}

function determineLeadQuality(data) {
  const score = determineLeadScore(data);
  const budgetLabel = cleanBudgetLabel(data.budget || data.budget_range || normalizeBudgetRange(data));
  const budgetValues = extractBudgetNumbers(budgetLabel);
  const budgetMin = budgetValues.length ? Math.min(...budgetValues) : 0;
  const months = timelineToMonths(data.start_timeline || data.timeline || data.estimated_timeline);
  const phoneValid = isValidPhone(data.phone);
  const hasLocation = !isPlaceholderValue(data.project_location) ||
    !isPlaceholderValue(data.project_address) ||
    !isPlaceholderValue(data.city);
  const visionText = safeText(data.vision || data.message || '', '');
  const normalizedVision = visionText.toLowerCase();
  const vagueVision = !visionText || visionText.length < 20 ||
    normalizedVision.includes('not sure') ||
    normalizedVision.includes('to be discussed');
  const internalVision = isInternalVisionContent(visionText);

  if (!phoneValid || !hasLocation || vagueVision || internalVision) {
    return 'Low';
  }

  if (score >= 78 && budgetMin >= 25000 && months !== null && months <= 3) {
    return 'High';
  }

  if (score >= 58 && (budgetMin >= 5000 || (months !== null && months <= 6))) {
    return 'Medium';
  }

  return 'Low';
}

function reconcileLeadQuality(quality, score) {
  const normalized = String(quality || '').trim();
  if (score >= 90) return 'High';
  if (score <= 40) return 'Low';
  if (score >= 70 && normalized.toLowerCase() === 'low') return 'Medium';
  if (score >= 55 && !normalized) return 'Medium';
  return normalized || 'Low';
}

function determineLeadScore(data) {
  const budgetLabel = cleanBudgetLabel(data.budget || data.budget_range || normalizeBudgetRange(data));
  const budgetValues = extractBudgetNumbers(budgetLabel);
  const budgetMax = budgetValues.length ? Math.max(...budgetValues) : 0;
  const timeline = safeText(data.start_timeline || data.timeline || data.estimated_timeline, '').toLowerCase();
  const service = safeText(data.service || data.selected_service, '').toLowerCase();
  const phoneValid = isValidPhone(data.phone);
  const hasLocation = !isPlaceholderValue(data.project_location) ||
    !isPlaceholderValue(data.project_address) ||
    !isPlaceholderValue(data.city);
  const visionText = safeText(data.vision || data.message || '', '');
  const normalizedVision = visionText.toLowerCase();
  const vagueVision = !visionText || visionText.length < 20 ||
    normalizedVision.includes('not sure') ||
    normalizedVision.includes('to be discussed');
  const internalVision = isInternalVisionContent(visionText);
  const serviceMatched = service.includes('design & build') ||
    service.includes('hardscaping') ||
    service.includes('outdoor kitchen');

  let score = 35;
  if (budgetMax >= 25000) score += 30;
  if (timeline.includes('asap') || timeline.includes('within 30') || timeline.includes('1-3')) score += 15;
  if (phoneValid) score += 10;
  if (serviceMatched) score += 10;
  if (!phoneValid) score -= 10;
  if (!hasLocation) score -= 10;
  if (vagueVision || internalVision) score -= 25;
  if (!phoneValid && !hasLocation) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function determineLeadTier(score) {
  if (score >= 78) return 'Hot';
  if (score >= 58) return 'Warm';
  return 'Nurture';
}

function buildLeadTags(data, score, options = {}) {
  const budgetLabel = cleanBudgetLabel(data.budget || data.budget_range || normalizeBudgetRange(data));
  const budgetValues = extractBudgetNumbers(budgetLabel);
  const budgetMax = budgetValues.length ? Math.max(...budgetValues) : 0;
  const timeline = safeText(data.start_timeline || data.timeline || data.estimated_timeline, '').toLowerCase();
  const service = safeText(data.service || data.selected_service, '').toLowerCase();
  const selectedStyle = safeText(data.selected_style, '').toLowerCase();
  const phoneValid = isValidPhone(data.phone);

  const highIntent = score >= 75 ||
    timeline.includes('asap') ||
    timeline.includes('within 30');

  const budgetFit = budgetMax >= 25000;

  const serviceMatch = service.includes('design & build') ||
    service.includes('hardscaping') ||
    service.includes('outdoor kitchen') ||
    (!!selectedStyle && selectedStyle !== 'all' && selectedStyle !== 'not selected');

  const tags = [];
  if (highIntent) tags.push('high_intent');
  if (budgetFit) tags.push('budget_fit');
  if (serviceMatch) tags.push('service_match');
  if (!phoneValid) tags.push('missing_phone');
  if (options.duplicate) tags.push('duplicate');
  if (options.spam) tags.push('spam_suspected');

  return {
    high_intent: highIntent ? 'yes' : 'no',
    budget_fit: budgetFit ? 'yes' : 'no',
    service_match: serviceMatch ? 'yes' : 'no',
    tags: tags.length ? tags : ['standard_intake']
  };
}

function fillTemplate(template, context) {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, token) => {
    const pathParts = token.split('.').map((part) => part.trim());
    let current = context;

    for (const part of pathParts) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }
    if (token.endsWith('_html')) {
      return String(current || '');
    }
    return escapeHtml(safeText(current, ''));
  });
}

function buildDataRow(label, value, options = {}) {
  const normalizedValue = normalizeOptionalField(value, '');
  if (!normalizedValue) return '';
  const escapedLabel = escapeHtml(label);
  const escapedValue = escapeHtml(String(normalizedValue));
  if (options.link === 'email' && isValidEmailAddress(normalizedValue)) {
    return `<tr><th>${escapedLabel}</th><td><a class="summary-link" href="mailto:${escapeAttribute(normalizedValue)}">${escapedValue}</a></td></tr>`;
  }
  if (options.link === 'phone' && isValidPhone(normalizedValue)) {
    return `<tr><th>${escapedLabel}</th><td><a class="summary-link" href="tel:${escapeAttribute(normalizePhone(normalizedValue))}">${escapedValue}</a></td></tr>`;
  }
  return `<tr><th>${escapedLabel}</th><td>${escapedValue}</td></tr>`;
}

function buildClientSummaryTables(data) {
  const contactRows = [
    buildDataRow('Name', data.full_name),
    buildDataRow('Email', data.email, { link: 'email' }),
    buildDataRow('Phone', data.phone, { link: 'phone' }),
    buildDataRow('Contact Method', data.contact_method),
    buildDataRow('Project Location', data.project_location)
  ].filter(Boolean).join('');

  const projectRows = [
    buildDataRow('Service', data.service),
    buildDataRow('Budget', data.budget_range),
    buildDataRow('Start Timeline', data.start_timeline),
    buildDataRow(
      'Estimated Timeline',
      data.estimated_timeline !== data.start_timeline ? data.estimated_timeline : ''
    ),
    buildDataRow('Requested Style', data.selected_style)
  ].filter(Boolean).join('');

  return {
    client_contact_rows_html: contactRows,
    client_project_rows_html: projectRows,
    client_request_section_html: '<tr class="summary-group"><td colspan="2">Request Details</td></tr><tr><th>Expected Response</th><td>Within 1-2 business days</td></tr>',
    client_contact_section_html: contactRows ? `<tr class="summary-group"><td colspan="2">Contact Details</td></tr>${contactRows}` : '',
    client_project_section_html: projectRows ? `<tr class="summary-group"><td colspan="2">Project Details</td></tr>${projectRows}` : '',
    client_vision_html: isMeaningfulValue(data.vision) && !isInternalVisionContent(data.vision)
      ? `<div class="vision"><div class="vision-label">Your Vision</div><div class="vision-quote">"${escapeHtml(data.vision)}"</div></div>`
      : ''
  };
}

function buildOwnerTables(data) {
  const detailRows = [
    buildDataRow('Service', data.service),
    buildDataRow('Budget Range', data.budget_range),
    buildDataRow('Start Timeline', data.start_timeline),
    buildDataRow(
      'Estimated Timeline',
      data.estimated_timeline !== data.start_timeline ? data.estimated_timeline : ''
    ),
    buildDataRow('Contact Method', data.contact_method),
    buildDataRow('Project Reference', data.selected_project_label),
    buildDataRow('Style Reference', data.selected_style),
    buildDataRow('Project Location', data.project_location)
  ].filter(Boolean).join('');

  const intelRows = [
    buildDataRow('Priority', data.owner_priority),
    buildDataRow('Lead Score', isMeaningfulValue(data.owner_lead_score) ? `${data.owner_lead_score} / 100 (${safeText(data.owner_lead_tier, 'Nurture')})` : ''),
    buildDataRow('Lead Quality', data.lead_quality),
    buildDataRow('Estimated Value', data.estimated_project_value),
    buildDataRow('Lead Tags', data.owner_lead_tags),
    buildDataRow('Status', data.sheet_status),
    buildDataRow('Submitted', data.submitted_local),
    buildDataRow('Urgency', data.start_timeline)
  ].filter(Boolean)
    .map((row) => row.replace('<th>', '<td class="k">').replace('</th>', '</td>').replace('<td>', '<td class="v">'))
    .join('');

  return {
    owner_detail_rows_html: detailRows,
    owner_intel_rows_html: intelRows,
    owner_dashboard_action_html: isMeaningfulValue(data.sheet_row_url)
      ? `<a href="${escapeAttribute(data.sheet_row_url)}" class="action-btn action-secondary">Open Lead Dashboard</a>`
      : '',
    owner_vision_html: isMeaningfulValue(data.vision) && !isInternalVisionContent(data.vision)
      ? `<div class="section vision"><div class="section-head">Client Vision</div><div class="vision-quote">"${escapeHtml(data.vision)}"</div></div>`
      : ''
  };
}

async function sendViaSmtp({ to, subject, html, replyTo }) {
  if (!hasSmtpCredentials()) {
    return { skipped: true, reason: 'missing_smtp_credentials', to };
  }

  const transporter = getSmtpTransporter();
  const text = buildPlainTextFromHtml(html);
  const info = await transporter.sendMail({
    from: getFromEmail('smtp'),
    to,
    subject,
    html,
    text,
    replyTo
  });

  return {
    provider: 'smtp',
    to,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  };
}

async function sendViaResend({ to, subject, html, replyTo }) {
  if (!RESEND_API_KEY) {
    return { skipped: true, reason: 'missing_resend_api_key', to };
  }

  const text = buildPlainTextFromHtml(html);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: getFromEmail('resend'),
      to,
      subject,
      html,
      text,
      reply_to: replyTo
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${response.status} ${text}`);
  }

  const payload = await response.json();
  return { provider: 'resend', to, ...payload };
}

async function sendEmail(args) {
  const provider = resolveEmailProvider(args.preferredProvider);

  if (provider === 'resend') {
    try {
      return await sendViaResend(args);
    } catch (err) {
      if (hasSmtpCredentials()) {
        const smtpResult = await sendViaSmtp(args);
        return {
          ...smtpResult,
          fallback_from: 'resend',
          fallback_reason: String(err && err.message ? err.message : err)
        };
      }
      throw err;
    }
  }

  if (provider === 'smtp') {
    try {
      return await sendViaSmtp(args);
    } catch (err) {
      if (hasResendCredentials()) {
        const resendResult = await sendViaResend(args);
        return {
          ...resendResult,
          fallback_from: 'smtp',
          fallback_reason: String(err && err.message ? err.message : err)
        };
      }
      throw err;
    }
  }

  return {
    skipped: true,
    reason: 'missing_email_credentials',
    to: args.to
  };
}

function resolveGoogleSheetId() {
  const raw = String(GOOGLE_SHEET_ID || GOOGLE_SHEET_URL || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;
  return '';
}

function buildGoogleSheetUrl(sheetId) {
  const id = String(sheetId || '').trim();
  if (!id) return safeText(GOOGLE_SHEET_URL, '');
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

function columnIndexToA1(columnIndex) {
  let index = Number(columnIndex || 0);
  let result = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    index = Math.floor((index - 1) / 26);
  }
  return result || 'A';
}

async function getGoogleAccessToken() {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new Error('Missing Google OAuth credentials for direct Sheets write');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    }).toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google OAuth token error: ${response.status} ${text}`);
  }

  const payload = await response.json();
  return safeText(payload.access_token, '');
}

async function ensureGoogleSheetTab(accessToken, spreadsheetId, title) {
  const metaResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetUrl,sheets(properties(sheetId,title,gridProperties(columnCount)),conditionalFormats)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!metaResponse.ok) {
    const text = await metaResponse.text();
    throw new Error(`Google Sheets metadata error: ${metaResponse.status} ${text}`);
  }

  const meta = await metaResponse.json();
  const existing = (meta.sheets || []).find((sheet) => safeText(sheet && sheet.properties && sheet.properties.title, '') === title);
  if (existing && existing.properties) {
    return {
      sheetId: Number(existing.properties.sheetId || 0),
      conditionalFormatCount: Array.isArray(existing.conditionalFormats) ? existing.conditionalFormats.length : 0,
      columnCount: Number(existing.properties.gridProperties && existing.properties.gridProperties.columnCount) || 30,
      spreadsheetUrl: safeText(meta.spreadsheetUrl, buildGoogleSheetUrl(spreadsheetId))
    };
  }

  const addResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title,
              gridProperties: { rowCount: 2000, columnCount: 30 }
            }
          }
        }
      ]
    })
  });

  if (!addResponse.ok) {
    const text = await addResponse.text();
    throw new Error(`Google Sheets add-sheet error: ${addResponse.status} ${text}`);
  }

  const addPayload = await addResponse.json();
  const added = (((addPayload || {}).replies || [])[0] || {}).addSheet || {};
  const properties = added.properties || {};
  return {
    sheetId: Number(properties.sheetId || 0),
    conditionalFormatCount: 0,
    columnCount: Number(properties.gridProperties && properties.gridProperties.columnCount) || 30,
    spreadsheetUrl: safeText(meta.spreadsheetUrl, buildGoogleSheetUrl(spreadsheetId))
  };
}

async function ensureGoogleSheetHeaders(accessToken, spreadsheetId, tabName) {
  const encodedRange = encodeURIComponent(`${tabName}!1:1`);
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!getResponse.ok) {
    const text = await getResponse.text();
    throw new Error(`Google Sheets header-read error: ${getResponse.status} ${text}`);
  }

  const payload = await getResponse.json();
  const current = ((payload.values || [])[0] || []).map((value) => safeText(value, ''));
  const needsHeader = DIRECT_SHEET_HEADERS.some((header, index) => current[index] !== header);
  if (!needsHeader) return;

  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${tabName}!1:1`,
        majorDimension: 'ROWS',
        values: [DIRECT_SHEET_HEADERS]
      })
    }
  );

  if (!updateResponse.ok) {
    const text = await updateResponse.text();
    throw new Error(`Google Sheets header-write error: ${updateResponse.status} ${text}`);
  }
}

function colorValue(red, green, blue) {
  return { red, green, blue };
}

async function ensureGoogleSheetDashboardFormatting(
  accessToken,
  spreadsheetId,
  tabName,
  sheetId,
  existingConditionalCount = 0,
  sheetColumnCount = 30
) {
  const key = `${spreadsheetId}:${tabName}`;
  const now = Date.now();
  const lastFormattedAt = Number(dashboardFormatStore.get(key) || 0);
  if (lastFormattedAt && now - lastFormattedAt < DASHBOARD_FORMAT_TTL_MS) {
    return;
  }

  const statusColumn = DIRECT_SHEET_HEADERS.indexOf('status');
  const nextActionColumn = DIRECT_SHEET_HEADERS.indexOf('next_action');
  const totalColumns = DIRECT_SHEET_HEADERS.length;
  const hiddenColumns = [14, 15, 16, 18, 23, 24, 25, 26];

  const requests = [];
  for (let index = Number(existingConditionalCount || 0) - 1; index >= 0; index -= 1) {
    requests.push({
      deleteConditionalFormatRule: {
        sheetId,
        index
      }
    });
  }

  requests.push(
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1,
            frozenColumnCount: 6
          }
        },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
      }
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: totalColumns
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: colorValue(0.11, 0.28, 0.16),
            textFormat: {
              foregroundColor: colorValue(1, 1, 1),
              bold: true,
              fontSize: 10
            },
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 0,
            startColumnIndex: 0,
            endColumnIndex: totalColumns
          }
        }
      }
    },
    {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: statusColumn,
          endColumnIndex: statusColumn + 1
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'New' },
              { userEnteredValue: 'Contacted' },
              { userEnteredValue: 'Booked' },
              { userEnteredValue: 'Won' },
              { userEnteredValue: 'Lost' },
              { userEnteredValue: 'Duplicate' },
              { userEnteredValue: 'Spam' }
            ]
          },
          showCustomUi: true,
          strict: true,
          inputMessage: 'Lead status'
        }
      }
    },
    {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: nextActionColumn,
          endColumnIndex: nextActionColumn + 1
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Call' },
              { userEnteredValue: 'Text' },
              { userEnteredValue: 'Email' },
              { userEnteredValue: 'Quote' },
              { userEnteredValue: 'Site visit' },
              { userEnteredValue: 'Review Duplicate' }
            ]
          },
          showCustomUi: true,
          strict: true,
          inputMessage: 'Next action'
        }
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: totalColumns
        },
        properties: {
          pixelSize: 150
        },
        fields: 'pixelSize'
      }
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 14,
          endColumnIndex: totalColumns
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: colorValue(0.97, 0.96, 0.94),
            textFormat: {
              foregroundColor: colorValue(0.38, 0.38, 0.38),
              fontSize: 10
            }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    }
  );

  const columnWidths = [
    [0, 168], [1, 118], [2, 170], [3, 145], [4, 220], [5, 130], [6, 180], [7, 150],
    [8, 134], [9, 124], [10, 172], [11, 136], [12, 150], [13, 240], [14, 150], [15, 220],
    [16, 132], [17, 172], [18, 168], [19, 220], [20, 140], [21, 172], [22, 140], [23, 260],
    [24, 132], [25, 132], [26, 140]
  ];

  columnWidths.forEach(([column, width]) => {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: column,
          endIndex: column + 1
        },
        properties: {
          pixelSize: width
        },
        fields: 'pixelSize'
      }
    });
  });

  requests.push({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'COLUMNS',
        startIndex: 0,
        endIndex: Math.max(sheetColumnCount, totalColumns)
      },
      properties: {
        hiddenByUser: false
      },
      fields: 'hiddenByUser'
    }
  });

  hiddenColumns.forEach((column) => {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: column,
          endIndex: column + 1
        },
        properties: {
          hiddenByUser: true
        },
        fields: 'hiddenByUser'
      }
    });
  });

  const statusRules = [
    ['New', colorValue(0.87, 0.95, 0.89), colorValue(0.11, 0.35, 0.16)],
    ['Contacted', colorValue(1.0, 0.96, 0.8), colorValue(0.45, 0.35, 0.0)],
    ['Booked', colorValue(0.84, 0.91, 0.98), colorValue(0.06, 0.26, 0.5)],
    ['Won', colorValue(0.92, 0.87, 0.98), colorValue(0.33, 0.18, 0.56)],
    ['Lost', colorValue(0.98, 0.86, 0.86), colorValue(0.56, 0.13, 0.13)],
    ['Duplicate', colorValue(0.93, 0.93, 0.93), colorValue(0.29, 0.29, 0.29)],
    ['Spam', colorValue(0.82, 0.82, 0.82), colorValue(0.12, 0.12, 0.12)]
  ];

  statusRules.forEach(([statusValue, backgroundColor, textColor]) => {
    requests.push({
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [
            {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: statusColumn,
              endColumnIndex: statusColumn + 1
            }
          ],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: statusValue }]
            },
            format: {
              backgroundColor,
              textFormat: {
                foregroundColor: textColor,
                bold: true
              }
            }
          }
        }
      }
    });
  });

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets format error: ${response.status} ${text}`);
  }

  dashboardFormatStore.set(key, now);
}

async function detectGoogleSheetDuplicate(accessToken, spreadsheetId, tabName, email, phone) {
  const hasEmail = isValidEmailAddress(email);
  const normalizedPhone = normalizePhone(phone);
  const hasPhone = normalizedPhone.length > 0;
  if (!hasEmail && !hasPhone) return false;

  const lastColumn = columnIndexToA1(DIRECT_SHEET_HEADERS.length);
  const encodedRange = encodeURIComponent(`${tabName}!A2:${lastColumn}`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) return false;
  const payload = await response.json();
  const rows = payload.values || [];
  const now = Date.now();
  const targetEmail = String(email || '').trim().toLowerCase();

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const timestamp = Date.parse(row[0] || '');
    if (Number.isFinite(timestamp) && now - timestamp > SEVEN_DAYS_MS) {
      break;
    }
    const rowPhone = normalizePhone(row[3] || '');
    const rowEmail = String(row[4] || '').trim().toLowerCase();
    if ((hasEmail && rowEmail && rowEmail === targetEmail) || (hasPhone && rowPhone && rowPhone === normalizedPhone)) {
      return true;
    }
  }

  return false;
}

async function appendGoogleSheetRow(accessToken, spreadsheetId, tabName, rowValues) {
  const appendRange = encodeURIComponent(`${tabName}!A1`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${tabName}!A1`,
        majorDimension: 'ROWS',
        values: [rowValues]
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets append error: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const updatedRange = safeText((((payload || {}).updates || {}).updatedRange), '');
  const rangeMatch = updatedRange.match(/!A(\d+):/);
  return {
    updatedRange,
    rowNumber: rangeMatch ? Number(rangeMatch[1]) : 0
  };
}

async function sendToGoogleSheetsDirect(row) {
  const spreadsheetId = resolveGoogleSheetId();
  if (!spreadsheetId) {
    return { skipped: true, reason: 'missing_google_sheet_id' };
  }
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
    return { skipped: true, reason: 'missing_google_oauth_credentials' };
  }

  const accessToken = await getGoogleAccessToken();
  const tabName = safeText(GOOGLE_SHEET_TAB, 'Owner Lead Dashboard');
  const sheetMeta = await ensureGoogleSheetTab(accessToken, spreadsheetId, tabName);
  await ensureGoogleSheetHeaders(accessToken, spreadsheetId, tabName);
  await ensureGoogleSheetDashboardFormatting(
    accessToken,
    spreadsheetId,
    tabName,
    Number(sheetMeta.sheetId || 0),
    Number(sheetMeta.conditionalFormatCount || 0),
    Number(sheetMeta.columnCount || 30)
  );

  const isDuplicate = await detectGoogleSheetDuplicate(accessToken, spreadsheetId, tabName, row.email, row.phone);
  const tags = new Set(
    String(row.lead_tags || '')
      .split(',')
      .map((entry) => normalizeWhitespace(entry))
      .filter(Boolean)
  );
  if (isDuplicate) tags.add('duplicate');

  const status = isDuplicate ? 'Duplicate' : 'New';
  const timestamp = formatPhoenixDate(row.timestamp || new Date().toISOString());
  const followUpDue = isDuplicate ? '' : formatPhoenixDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  const lastTouched = formatPhoenixDate(new Date().toISOString());
  const rowValues = [
    timestamp,
    status,
    ownerSheetValue(row.name),
    ownerSheetValue(row.phone),
    ownerSheetValue(row.email),
    ownerSheetValue(row.city),
    ownerSheetValue(row.service),
    ownerSheetValue(row.budget_range),
    ownerSheetValue(row.start_timeline),
    ownerSheetValue(row.lead_quality, 'Low'),
    ownerSheetValue(row.estimated_project_value, 'Varies by scope'),
    isDuplicate ? 'Review Duplicate' : 'Call',
    followUpDue,
    '',
    safeText(row.ticket_id, ''),
    Array.from(tags).join(', '),
    ownerSheetValue(row.lead_source),
    ownerSheetValue(row.selected_project_label),
    ownerSheetValue(row.selected_style),
    ownerSheetValue(row.project_location),
    ownerSheetValue(row.contact_method),
    ownerSheetValue(row.submitted_local),
    lastTouched,
    ownerSheetValue(row.page_url),
    ownerSheetValue(row.utm_source),
    ownerSheetValue(row.utm_medium),
    ownerSheetValue(row.utm_campaign)
  ];

  const appendResult = await appendGoogleSheetRow(accessToken, spreadsheetId, tabName, rowValues);
  const spreadsheetUrl = safeText(sheetMeta.spreadsheetUrl, buildGoogleSheetUrl(spreadsheetId));
  const lastColumn = columnIndexToA1(DIRECT_SHEET_HEADERS.length);
  const rowUrl = appendResult.rowNumber
    ? `${spreadsheetUrl}#gid=${Number(sheetMeta.sheetId || 0)}&range=${encodeURIComponent(`A${appendResult.rowNumber}:${lastColumn}${appendResult.rowNumber}`)}`
    : spreadsheetUrl;

  return {
    ok: true,
    row_id: appendResult.rowNumber ? String(appendResult.rowNumber) : '',
    row_url: rowUrl,
    status,
    spreadsheet_url: spreadsheetUrl
  };
}

async function sendToGoogleSheets(normalized, meta = {}) {
  const sheetValue = (value, fallback = '') => ownerSheetValue(value, fallback);
  const row = {
    timestamp: meta.created_at || new Date().toISOString(),
    ticket_id: sheetValue(normalized.ticket_id),
    submitted_local: sheetValue(normalized.submitted_local),
    submitted_at_iso: meta.created_at || new Date().toISOString(),
    name: sheetValue(normalized.full_name),
    first_name: sheetValue(normalized.first_name),
    last_name: sheetValue(normalized.last_name),
    email: sheetValue(normalized.email),
    phone: sheetValue(normalized.phone),
    project_location: sheetValue(normalized.project_location),
    project_address: sheetValue(normalized.project_address),
    city: sheetValue(normalized.city),
    service: sheetValue(normalized.service),
    selected_service: sheetValue(normalized.selected_service),
    consultation_tier: sheetValue(normalized.consultation_tier),
    lead_quality: sheetValue(normalized.lead_quality),
    estimated_project_value: sheetValue(normalized.estimated_project_value, 'Varies by scope'),
    selected_style: sheetValue(normalized.selected_style),
    selected_image: sheetValue(normalized.selected_image),
    selected_project_label: sheetValue(normalized.selected_project_label),
    lead_source: sheetValue(normalized.lead_source, 'website'),
    lead_tier: sheetValue(normalized.consultation_tier),
    budget_range: sheetValue(normalized.budget_range),
    start_timeline: sheetValue(normalized.start_timeline),
    timeline: sheetValue(normalized.start_timeline),
    estimated_timeline: sheetValue(normalized.estimated_timeline),
    contact_method: sheetValue(normalized.contact_method),
    preferred_contact_method: sheetValue(normalized.contact_method),
    utm_source: sheetValue(normalized.utm_source),
    utm_medium: sheetValue(normalized.utm_medium),
    utm_campaign: sheetValue(normalized.utm_campaign),
    utm_content: sheetValue(normalized.utm_content),
    referrer: sheetValue(normalized.referrer),
    landing_path: sheetValue(normalized.landing_path),
    message: sheetValue(normalized.vision),
    owner_priority: sheetValue(normalized.owner_priority),
    lead_score: sheetValue(normalized.owner_lead_score),
    owner_lead_score: sheetValue(normalized.owner_lead_score),
    owner_lead_tier: sheetValue(normalized.owner_lead_tier),
    lead_tags: sheetValue(normalized.owner_lead_tags),
    owner_lead_tags: sheetValue(normalized.owner_lead_tags),
    high_intent: sheetValue(normalized.high_intent),
    budget_fit: sheetValue(normalized.budget_fit),
    service_match: sheetValue(normalized.service_match),
    status: sheetValue(normalized.sheet_status, 'New'),
    owner_summary: sheetValue(normalized.owner_summary),
    page_url: sheetValue(meta.page_url)
  };

  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    return sendToGoogleSheetsDirect(row);
  }

  const headers = {
    'Content-Type': 'application/json'
  };
  if (GOOGLE_SHEETS_WEBHOOK_SECRET) {
    headers['x-webhook-secret'] = GOOGLE_SHEETS_WEBHOOK_SECRET;
  }

  const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source: 'thinkgreen-ticket',
      secret: GOOGLE_SHEETS_WEBHOOK_SECRET || '',
      row
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets webhook error: ${response.status} ${text}`);
  }

  const payload = await response.json().catch(() => ({}));
  return {
    ok: true,
    row_id: safeText(payload.row_id, ''),
    row_url: safeText(payload.row_url || payload.sheet_row_url, ''),
    status: safeText(payload.status, 'New'),
    spreadsheet_url: safeText(payload.spreadsheet_url, '')
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJsonWithRetry(url, body, options = {}) {
  const endpoint = String(url || '').trim();
  if (!endpoint) return { skipped: true, reason: 'missing_url' };

  const retries = Number(options.retries || 2);
  const label = options.label || 'webhook';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${label} webhook error: ${response.status} ${text}`);
      }

      return { ok: true, endpoint: label, attempt };
    } catch (err) {
      lastError = err;
      if (attempt < retries) await wait(350 * (attempt + 1));
    }
  }

  return {
    ok: false,
    endpoint: label,
    error: String(lastError && lastError.message ? lastError.message : lastError)
  };
}

async function fanOutCrmWebhooks(normalized, meta = {}) {
  const payload = {
    source: 'thinkgreen-ticket',
    ticket_id: normalized.ticket_id,
    submitted_local: normalized.submitted_local,
    submitted_at_iso: meta.created_at || new Date().toISOString(),
    page_url: safeText(meta.page_url, ''),
    first_name: normalized.first_name,
    last_name: normalized.last_name,
    full_name: normalized.full_name,
    email: normalized.email,
    phone: normalized.phone,
    city: normalized.city,
    project_address: normalized.project_address,
    project_location: normalized.project_location,
    service: normalized.service,
    selected_service: normalized.selected_service,
    selected_style: normalized.selected_style,
    selected_image: normalized.selected_image,
    selected_project_label: normalized.selected_project_label,
    lead_source: normalized.lead_source,
    consultation_tier: normalized.consultation_tier,
    lead_tier: normalized.consultation_tier,
    budget_range: normalized.budget_range,
    lead_quality: normalized.lead_quality,
    estimated_project_value: normalized.estimated_project_value,
    start_timeline: normalized.start_timeline,
    timeline: normalized.start_timeline,
    estimated_timeline: normalized.estimated_timeline,
    contact_method: normalized.contact_method,
    preferred_contact_method: normalized.contact_method,
    utm_source: normalized.utm_source,
    utm_medium: normalized.utm_medium,
    utm_campaign: normalized.utm_campaign,
    utm_content: normalized.utm_content,
    referrer: normalized.referrer,
    landing_path: normalized.landing_path,
    message: normalized.vision,
    sheet_status: normalized.sheet_status,
    sheet_row_id: normalized.sheet_row_id,
    sheet_row_url: normalized.sheet_row_url,
    owner_priority: normalized.owner_priority,
    owner_lead_score: normalized.owner_lead_score,
    owner_lead_tier: normalized.owner_lead_tier,
    owner_lead_tags: normalized.owner_lead_tags,
    high_intent: normalized.high_intent,
    budget_fit: normalized.budget_fit,
    service_match: normalized.service_match
  };

  const targets = [
    {
      label: 'crm',
      url: CRM_WEBHOOK_URL,
      headers: CRM_WEBHOOK_SECRET ? { 'x-webhook-secret': CRM_WEBHOOK_SECRET } : {}
    },
    {
      label: 'slack',
      url: SLACK_WEBHOOK_URL
    },
    {
      label: 'airtable',
      url: AIRTABLE_WEBHOOK_URL
    },
    {
      label: 'hubspot',
      url: HUBSPOT_WEBHOOK_URL
    }
  ];

  const activeTargets = targets.filter((item) => String(item.url || '').trim());
  if (!activeTargets.length) {
    return { skipped: true, reason: 'no_crm_webhooks_configured' };
  }

  const results = await Promise.all(activeTargets.map((target) => postJsonWithRetry(
    target.url,
    payload,
    {
      label: target.label,
      headers: target.headers
    }
  )));

  return { ok: results.some((entry) => entry.ok), results };
}

function parseRequestBody(event) {
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '{}';

  try {
    return JSON.parse(rawBody || '{}');
  } catch {
    const parsed = {};
    const params = new URLSearchParams(rawBody || '');
    for (const [key, value] of params.entries()) {
      parsed[key] = value;
    }
    return parsed;
  }
}

exports.handler = async (event) => {
  try {
    const body = parseRequestBody(event);
    const payload = body.payload || body;
    const submission = payload.submission || payload;
    const data = submission.data || payload.data || submission || payload || {};
    const clientIp = getClientIp(event, payload);

    if (isRateLimited(clientIp)) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          ok: false,
          rate_limited: true,
          error: 'Too many submissions. Please wait a few minutes and try again.'
        })
      };
    }

    const honeypotValue = normalizeWhitespace(
      data['bot-field'] || data.bot_field || payload['bot-field'] || payload.bot_field || ''
    );
    if (honeypotValue) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          spam_blocked: true,
          lead_tags: { tags: ['spam_suspected'] }
        })
      };
    }

    const createdAt = submission.created_at || payload.created_at || new Date().toISOString();
    const pageUrl = payload.page_url || payload.url || submission.url || '';
    const submittedLocal = formatPhoenixDate(createdAt);
    const ticketId = resolveTicketId(data, payload.ticket_id || submission.ticket_id || '');
    const normalized = buildNormalizedData({ ...data, ticket_id: ticketId }, {
      ticket_id: ticketId,
      submitted_local: submittedLocal,
      sheet_url: GOOGLE_SHEET_URL,
      page_url: pageUrl
    });

    const incomingEmail = normalizeWhitespace(data.email || data.email_visible || '');
    const hasEmail = incomingEmail.length > 0;
    if (hasEmail && !isValidEmailAddress(incomingEmail)) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          ok: false,
          spam_blocked: true,
          error: 'Please provide a valid email address.',
          lead_tags: { tags: ['spam_suspected'] }
        })
      };
    }
    if (hasEmail && isDisposableEmail(incomingEmail)) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          ok: false,
          spam_blocked: true,
          error: 'Disposable email addresses are not accepted.',
          lead_tags: { tags: ['spam_suspected'] }
        })
      };
    }

    const normalizedPhone = normalizePhone(normalized.phone);
    if (normalizedPhone && !isValidPhone(normalized.phone)) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          ok: false,
          spam_blocked: true,
          error: 'Please provide a valid phone number.',
          lead_tags: { tags: ['spam_suspected'] }
        })
      };
    }

    const dedupeKeys = buildDedupeKeys(submission, normalized);
    if (shouldSkipDuplicate(dedupeKeys)) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          ticket_id: ticketId,
          duplicate_skipped: true
        })
      };
    }

    const leadScore = determineLeadScore(normalized);
    const leadTier = determineLeadTier(leadScore);
    let leadTagData = buildLeadTags(normalized, leadScore);

    normalized.owner_priority = safeText(data.owner_priority, determinePriority(normalized));
    normalized.owner_priority_class = getPriorityClass(normalized.owner_priority);
    normalized.owner_lead_score = String(leadScore);
    normalized.owner_lead_tier = leadTier;
    normalized.owner_lead_tags = leadTagData.tags.join(', ');
    normalized.lead_quality = reconcileLeadQuality(determineLeadQuality(normalized), leadScore);
    normalized.estimated_project_value = estimateProjectValue(normalized.service, normalized.budget_range);
    normalized.high_intent = leadTagData.high_intent;
    normalized.budget_fit = leadTagData.budget_fit;
    normalized.service_match = leadTagData.service_match;
    normalized.sheet_status = 'New';
    normalized.sheet_row_url = '';
    normalized.sheet_row_id = '';
    normalized.sheet_url = safeText(normalized.sheet_url, GOOGLE_SHEET_URL);
    normalized.owner_summary = buildOwnerSummary(normalized);

    const sheetsResult = await sendToGoogleSheets(normalized, {
      created_at: createdAt,
      page_url: pageUrl
    }).catch((err) => ({ ok: false, error: err.message }));

    if (sheetsResult && sheetsResult.ok) {
      normalized.sheet_status = safeText(sheetsResult.status, 'New');
      normalized.sheet_row_id = safeText(sheetsResult.row_id, '');
      normalized.sheet_row_url = safeText(sheetsResult.row_url, '');
      normalized.sheet_url = safeText(sheetsResult.spreadsheet_url, normalized.sheet_url || GOOGLE_SHEET_URL);
      if (!normalized.sheet_row_url || normalized.sheet_row_url === 'Not provided') {
        normalized.sheet_row_url = normalized.sheet_url;
      }
      const isDuplicate = normalized.sheet_status.toLowerCase() === 'duplicate';
      leadTagData = buildLeadTags(normalized, leadScore, { duplicate: isDuplicate });
      normalized.owner_lead_tags = leadTagData.tags.join(', ');
      normalized.high_intent = leadTagData.high_intent;
      normalized.budget_fit = leadTagData.budget_fit;
      normalized.service_match = leadTagData.service_match;
      normalized.lead_quality = reconcileLeadQuality(determineLeadQuality(normalized), leadScore);
      normalized.estimated_project_value = estimateProjectValue(normalized.service, normalized.budget_range);
      normalized.owner_summary = buildOwnerSummary(normalized);
    }
    if (!normalized.sheet_row_url || normalized.sheet_row_url === 'Not provided') {
      normalized.sheet_row_url = safeText(normalized.sheet_url, '');
    }

    const context = {
      submission: {
        data: normalized
      },
      ...normalized,
      ...buildClientSummaryTables(normalized),
      ...buildOwnerTables(normalized)
    };

    const ownerTemplate = readTemplate('thinkgreen-owner-email.html');
    const clientTemplate = readTemplate('thinkgreen-client-email.html');

    const ownerHtml = fillTemplate(ownerTemplate, context);
    const clientHtml = fillTemplate(clientTemplate, context);

    const ownerSubject = `New Think Green inquiry from ${normalized.full_name}`;
    const clientSubject = `Think Green received your project request`;

    const emailTasks = [
      sendEmail({
        to: OWNER_EMAIL,
        subject: ownerSubject,
        html: ownerHtml,
        replyTo: isValidEmailAddress(normalized.email) ? normalized.email : undefined,
        preferredProvider: OWNER_EMAIL_PROVIDER
      })
    ];

    if (normalized.email && isValidEmailAddress(normalized.email)) {
      emailTasks.push(
        sendEmail({
          to: normalized.email,
          subject: clientSubject,
          html: clientHtml,
          replyTo: OWNER_EMAIL
        })
      );
    }

    const [emailResults, crmResult] = await Promise.all([
      Promise.all(
        emailTasks.map((task) => task.catch((err) => ({
          ok: false,
          error: String(err && err.message ? err.message : err)
        })))
      ),
      fanOutCrmWebhooks(normalized, {
        created_at: createdAt,
        page_url: pageUrl
      }).catch((err) => ({ ok: false, error: err.message }))
    ]);

    const emailFailures = emailResults.filter((result) => result && result.ok === false);
    if (emailFailures.length === emailResults.length) {
      throw new Error(emailFailures.map((result) => result.error).join(' | '));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        ticket_id: normalized.ticket_id,
        provider: emailResults.find((result) => result && result.provider)?.provider || resolveEmailProvider(),
        provider_config: configuredProvider(),
        owner_provider_preference: OWNER_EMAIL_PROVIDER,
        from_email_used: getFromEmail(resolveEmailProvider()),
        email_results: emailResults,
        sheets_result: sheetsResult,
        crm_result: crmResult,
        lead_tags: leadTagData,
        sheet_row_url: normalized.sheet_row_url,
        sheet_status: normalized.sheet_status,
        normalized_budget_range: normalized.budget_range,
        consultation_tier: normalized.consultation_tier,
        lead_quality: normalized.lead_quality,
        estimated_project_value: normalized.estimated_project_value,
        start_timeline: normalized.start_timeline,
        contact_method: normalized.contact_method
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message
      })
    };
  }
};
