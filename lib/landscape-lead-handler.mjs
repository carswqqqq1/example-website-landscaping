export const MAX_BODY_BYTES = 64 * 1024;

const MIN_SUBMISSION_MS = 2500;
const MAX_SUBMISSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const FIELD_LIMITS = {
  ticket_id: 128,
  form_type: 32,
  full_name: 120,
  first_name: 80,
  last_name: 80,
  email: 254,
  email_visible: 254,
  phone: 32,
  city: 80,
  service: 120,
  selected_service: 120,
  message: 3000,
  vision: 3000,
  project_address: 240,
  property_address: 240,
  budget_range: 120,
  start_timeline: 120,
  estimated_timeline: 120,
  lead_source: 120,
  page_url: 1000,
  referrer: 1000,
  landing_path: 500,
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_content: 300,
  selected_style: 200,
  selected_image: 1000,
  selected_project_label: 300,
  owner_summary: 3000,
  owner_contact_card: 3000,
  owner_project_snapshot: 5000,
  owner_tracking: 5000
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "trashmail.com",
  "yopmail.com",
  "temp-mail.org",
  "fakeinbox.com",
  "sharklasers.com"
]);

class LeadRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function responseHeaders(extra = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extra
  };
}

export function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(extraHeaders)
  });
}

function cleanValue(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(value, fallback = "Not provided") {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function valueFrom(data, keys, fallback = "") {
  for (const key of keys) {
    const value = cleanValue(data && data[key]);
    if (value) return value;
  }
  return fallback;
}

function isConsentGiven(value) {
  return /^(1|true|yes|on|agree|agreed)$/i.test(cleanValue(value));
}

function isValidEmailAddress(value) {
  const email = cleanValue(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isDisposableEmail(value) {
  if (!isValidEmailAddress(value)) return false;
  const domain = cleanValue(value).toLowerCase().split("@")[1] || "";
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidPhone(value) {
  const digits = normalizePhone(value);
  return digits.length >= 10 && digits.length <= 15;
}

function isValidTicketId(value) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(cleanValue(value));
}

function validateScalarPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new LeadRequestError(422, "Please review the form and try again.");
  }

  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object") {
      throw new LeadRequestError(422, "Please review the form and try again.");
    }
    const text = String(value === undefined || value === null ? "" : value);
    const limit = FIELD_LIMITS[key] || 5000;
    if (text.length > limit) {
      throw new LeadRequestError(422, "One or more fields are too long.");
    }
  }
}

function validateLeadPayload(data, now = Date.now()) {
  validateScalarPayload(data);

  const ticketId = valueFrom(data, ["ticket_id"]);
  const fullName = valueFrom(data, ["full_name", "name"]);
  const service = valueFrom(data, ["service", "selected_service"]);
  const email = valueFrom(data, ["email", "email_visible"]);
  const phone = valueFrom(data, ["phone", "phone_number"]);
  const city = valueFrom(data, ["city", "project_city"]);
  const formType = valueFrom(data, ["form_type"], "project_request");
  const formStartedAt = Number(valueFrom(data, ["form_started_at"]));
  const elapsed = now - formStartedAt;

  if (formType !== "project_request" && formType !== "resource_gate") {
    throw new LeadRequestError(422, "Please review the form and try again.");
  }
  if (!isValidTicketId(ticketId)) {
    throw new LeadRequestError(422, "Please refresh the page and try again.");
  }
  if (fullName.length < 2 || fullName.length > FIELD_LIMITS.full_name) {
    throw new LeadRequestError(422, "Please enter your name.");
  }
  if (service.length < 2 || service.length > FIELD_LIMITS.service) {
    throw new LeadRequestError(422, "Please choose a project type.");
  }
  if (cleanValue(data.js_check) !== "1") {
    throw new LeadRequestError(422, "Submission could not be verified.");
  }
  if (!Number.isFinite(formStartedAt) || elapsed < MIN_SUBMISSION_MS || elapsed > MAX_SUBMISSION_AGE_MS) {
    throw new LeadRequestError(422, "Please take a moment to review the form before submitting.");
  }
  if (!isConsentGiven(data.contact_consent)) {
    throw new LeadRequestError(422, "Please confirm we can contact you about this request.");
  }
  if (email && !isValidEmailAddress(email)) {
    throw new LeadRequestError(422, "Please enter a valid email address.");
  }
  if (email && isDisposableEmail(email)) {
    throw new LeadRequestError(422, "Disposable email addresses are not accepted.");
  }

  if (formType === "resource_gate") {
    if (!isValidEmailAddress(email)) {
      throw new LeadRequestError(422, "Please enter a valid email address.");
    }
    if (service !== "Project Planning Checklist") {
      throw new LeadRequestError(422, "Please review the form and try again.");
    }
    if (phone && !isValidPhone(phone)) {
      throw new LeadRequestError(422, "Please enter a valid phone number.");
    }
  } else {
    if (!isValidPhone(phone)) {
      throw new LeadRequestError(422, "Please enter a valid phone number.");
    }
    if (city.length < 2 || city.length > FIELD_LIMITS.city) {
      throw new LeadRequestError(422, "Please enter your city.");
    }
  }

  return { ticketId, formType };
}

async function readBoundedBody(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new LeadRequestError(413, "Request is too large.");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw new LeadRequestError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseRequestBody(text, contentType) {
  if (contentType === "application/json") {
    try {
      return JSON.parse(text || "{}");
    } catch {
      throw new LeadRequestError(400, "Request body is not valid JSON.");
    }
  }

  if (contentType === "application/x-www-form-urlencoded") {
    const payload = Object.create(null);
    const params = new URLSearchParams(text || "");
    for (const [key, value] of params.entries()) payload[key] = value;
    return payload;
  }

  throw new LeadRequestError(415, "Unsupported request format.");
}

function normalizeDashes(value) {
  return String(value || "").replace(/[–—]/g, "-");
}

function parseMoneyToken(raw) {
  const value = normalizeWhitespace(String(raw || "").replace(/\$/g, ""));
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?)(k)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return Math.round(match[2] ? amount * 1000 : amount);
}

function formatUsdRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return "Not provided";
  }
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return `$${low.toLocaleString("en-US")} - $${high.toLocaleString("en-US")}`;
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
  return "Not provided";
}

function extractBudgetNumbers(rangeLabel) {
  const matches = String(rangeLabel || "").match(/\$([\d,]+)/g) || [];
  return matches
    .map((entry) => Number(entry.replace(/[^0-9]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function isPlaceholderValue(value) {
  const text = String(value || "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return true;
  const normalized = text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
  if (/^(not set|not provided|not selected|not specified|not discussed yet|to be discussed|to be discussed during consultation|to be discussed during project review|unknown|none|null|undefined|n\/a|na)$/i.test(normalized)) {
    return true;
  }
  return normalized.includes("not selected") ||
    normalized.includes("not provided") ||
    normalized.includes("to be discussed");
}

function isMeaningfulValue(value) {
  return !isPlaceholderValue(value);
}

function normalizeOptionalField(value, fallback = "") {
  const cleaned = normalizeWhitespace(value);
  if (!cleaned || isPlaceholderValue(cleaned)) return fallback;
  return cleaned;
}

function isInternalVisionContent(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  if (!text) return false;
  const internalPatterns = [
    "qa",
    "test",
    "verification",
    "pipeline",
    "assistant",
    "codex",
    "browser path",
    "manual owner",
    "owner/client delivery",
    "final production verification"
  ];
  return internalPatterns.some((pattern) => text.includes(pattern));
}

function ownerSheetValue(value, fallback = "") {
  return isMeaningfulValue(value) ? safeText(value, fallback) : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function splitFullName(fullName = "") {
  const cleaned = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return { first: "", last: "" };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.shift(), last: parts.join(" ") };
}

function buildFullName(firstName, lastName) {
  const parts = [safeText(firstName, ""), safeText(lastName, "")].filter((part) => !isPlaceholderValue(part));
  return parts.length ? parts.join(" ") : "";
}

function buildProjectLocation(projectAddress, city) {
  const parts = [safeText(projectAddress, ""), safeText(city, "")].filter((part) => !isPlaceholderValue(part));
  return parts.length ? parts.join(", ") : "";
}

function cleanBudgetLabel(value) {
  const parsed = parseBudgetRange(value);
  return parsed || "Not provided";
}

function getPriorityClass(priorityValue) {
  const priority = safeText(priorityValue, "").toLowerCase();
  if (priority.includes("high")) return "p-high";
  if (priority.includes("medium")) return "p-medium";
  return "p-low";
}

function buildPlainTextFromHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|section|header|footer|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatPhoenixDate(value) {
  try {
    const date = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  } catch {
    return safeText(value, "Not provided");
  }
}

function buildNormalizedData(rawData = {}, meta = {}) {
  const normalized = { ...rawData };
  const splitName = splitFullName(rawData.full_name || "");
  const fallbackFirst = safeText(splitName.first, "");
  const fallbackLast = safeText(splitName.last, "");

  normalized.first_name = normalizeOptionalField(rawData.first_name, fallbackFirst || "there");
  normalized.last_name = safeText(rawData.last_name, fallbackLast);
  if (isPlaceholderValue(normalized.last_name)) normalized.last_name = "";
  normalized.full_name = buildFullName(normalized.first_name, normalized.last_name) || "Website Lead";
  normalized.email = normalizeOptionalField(rawData.email || rawData.email_visible, "");
  normalized.phone = normalizeOptionalField(rawData.phone, "");
  normalized.project_address = normalizeOptionalField(rawData.project_address || rawData.property_address || rawData.address, "");
  normalized.city = normalizeOptionalField(rawData.city || rawData.project_city, "");
  normalized.project_location = buildProjectLocation(normalized.project_address, normalized.city);
  normalized.service = normalizeOptionalField(rawData.service || rawData.project_type || rawData.selected_service, "Landscape Design & Build");
  normalized.selected_service = normalizeOptionalField(rawData.selected_service || normalized.service, normalized.service);
  normalized.consultation_tier = normalizeOptionalField(rawData.consultation_tier || rawData.lead_tier, "");
  normalized.lead_tier = normalized.consultation_tier;
  normalized.selected_style = normalizeOptionalField(rawData.selected_style || rawData.project_style, "");
  normalized.selected_image = normalizeOptionalField(rawData.selected_image || rawData.project_image, "");
  normalized.selected_project_label = normalizeOptionalField(rawData.selected_project_label || rawData.project_reference, "");
  normalized.lead_source = normalizeOptionalField(rawData.lead_source || rawData.source || rawData.utm_source, "website");
  normalized.utm_source = normalizeOptionalField(rawData.utm_source, "");
  normalized.utm_medium = normalizeOptionalField(rawData.utm_medium, "");
  normalized.utm_campaign = normalizeOptionalField(rawData.utm_campaign, "");
  normalized.utm_content = normalizeOptionalField(rawData.utm_content, "");
  normalized.referrer = normalizeOptionalField(rawData.referrer, "direct");
  normalized.landing_path = normalizeOptionalField(rawData.landing_path, "/");
  normalized.page_url = normalizeOptionalField(rawData.page_url || meta.page_url, "");
  normalized.budget = normalizeBudgetRange(rawData);
  normalized.budget_range = normalized.budget;
  normalized.estimated_timeline = normalizeOptionalField(rawData.estimated_timeline || rawData.timeline || rawData.start_timeline || rawData.start_window, "");
  normalized.start_timeline = normalizeOptionalField(rawData.start_timeline || rawData.timeline || rawData.estimated_timeline || rawData.start_window, "");
  normalized.contact_method = normalizeOptionalField(rawData.contact_method || rawData.preferred_contact_method || rawData.preferred_contact, "");
  normalized.preferred_contact = normalized.contact_method;
  normalized.vision = normalizeOptionalField(rawData.vision || rawData.message || rawData.details || rawData.project_details, "");
  normalized.timeline = normalized.start_timeline;
  normalized.preferred_contact_method = normalized.contact_method;
  normalized.message = normalized.vision;
  normalized.ticket_id = normalizeWhitespace(rawData.ticket_id || meta.ticket_id);
  normalized.submitted_local = safeText(rawData.submitted_local, meta.submitted_local || formatPhoenixDate());
  normalized.owner_summary = normalizeOptionalField(rawData.owner_summary, meta.owner_summary);
  normalized.owner_priority = normalizeOptionalField(rawData.owner_priority, meta.owner_priority);
  normalized.owner_priority_class = getPriorityClass(normalized.owner_priority);
  normalized.owner_lead_score = normalizeOptionalField(rawData.owner_lead_score, meta.owner_lead_score);
  normalized.owner_lead_tier = normalizeOptionalField(rawData.owner_lead_tier, meta.owner_lead_tier);
  normalized.owner_lead_tags = normalizeOptionalField(rawData.owner_lead_tags, meta.owner_lead_tags);
  normalized.lead_quality = normalizeOptionalField(rawData.lead_quality, meta.lead_quality);
  normalized.estimated_project_value = normalizeOptionalField(rawData.estimated_project_value, meta.estimated_project_value);
  normalized.sheet_status = normalizeOptionalField(meta.sheet_status || rawData.sheet_status, "New");
  normalized.sheet_row_id = normalizeOptionalField(meta.sheet_row_id || rawData.sheet_row_id, "");
  normalized.sheet_row_url = normalizeOptionalField(meta.sheet_row_url || rawData.sheet_row_url, "");
  normalized.sheet_url = normalizeOptionalField(meta.sheet_url || rawData.sheet_url, "");
  return normalized;
}

function buildOwnerSummary(data) {
  const pieces = [];
  if (isMeaningfulValue(data.service)) pieces.push(`Service: ${safeText(data.service)}`);
  if (isMeaningfulValue(data.lead_quality)) pieces.push(`Lead Quality: ${safeText(data.lead_quality, "")}`);
  if (isMeaningfulValue(data.estimated_project_value)) pieces.push(`Estimated Value: ${safeText(data.estimated_project_value, "Varies by scope")}`);
  if (isMeaningfulValue(data.start_timeline || data.timeline || data.estimated_timeline)) {
    pieces.push(`Timeline: ${safeText(data.start_timeline || data.timeline || data.estimated_timeline)}`);
  }
  return pieces.join(" · ");
}

function determinePriority(data) {
  const timeline = safeText(data.start_timeline || data.timeline || data.estimated_timeline, "").toLowerCase();
  if (timeline.includes("asap") || timeline.includes("urgent") || timeline.includes("soon")) return "High";
  if (timeline.includes("next month") || timeline.includes("month") || timeline.includes("few weeks")) return "Medium";
  return "Low";
}

function timelineToMonths(value) {
  const text = safeText(value, "").toLowerCase();
  if (!text) return null;
  if (text.includes("asap") || text.includes("within 30") || text.includes("few weeks")) return 1;
  const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)\s*month/);
  if (rangeMatch) return Number(rangeMatch[2]);
  const monthMatch = text.match(/(\d+)\s*month/);
  if (monthMatch) return Number(monthMatch[1]);
  if (text.includes("later") || text.includes("planning")) return 12;
  return null;
}

function estimateProjectValue(serviceValue, budgetRangeValue) {
  const service = safeText(serviceValue, "").toLowerCase();
  if (service.includes("outdoor kitchen")) return "$20k+";
  if (service.includes("hardscape") || service.includes("hardscaping") || service.includes("patio") || service.includes("paver")) return "$10k-$40k";
  if (service.includes("turf")) return "$5k-$15k";
  if (service.includes("design & build") || service.includes("landscape design") || service.includes("full yard")) return "$30k-$100k+";
  const budgetRange = cleanBudgetLabel(budgetRangeValue);
  if (budgetRange && budgetRange !== "Not provided") {
    if (service.includes("irrigation")) return "$5k-$25k";
    return budgetRange;
  }
  return "Varies by scope";
}

function determineLeadScore(data) {
  const budgetLabel = cleanBudgetLabel(data.budget || data.budget_range || normalizeBudgetRange(data));
  const budgetValues = extractBudgetNumbers(budgetLabel);
  const budgetMax = budgetValues.length ? Math.max(...budgetValues) : 0;
  const timeline = safeText(data.start_timeline || data.timeline || data.estimated_timeline, "").toLowerCase();
  const service = safeText(data.service || data.selected_service, "").toLowerCase();
  const phoneValid = isValidPhone(data.phone);
  const hasLocation = !isPlaceholderValue(data.project_location) || !isPlaceholderValue(data.project_address) || !isPlaceholderValue(data.city);
  const visionText = safeText(data.vision || data.message || "", "");
  const normalizedVision = visionText.toLowerCase();
  const vagueVision = !visionText || visionText.length < 20 || normalizedVision.includes("not sure") || normalizedVision.includes("to be discussed");
  const internalVision = isInternalVisionContent(visionText);
  const serviceMatched = service.includes("design & build") || service.includes("hardscaping") || service.includes("outdoor kitchen");
  let score = 35;
  if (budgetMax >= 25000) score += 30;
  if (timeline.includes("asap") || timeline.includes("within 30") || timeline.includes("1-3")) score += 15;
  if (phoneValid) score += 10;
  if (serviceMatched) score += 10;
  if (!phoneValid) score -= 10;
  if (!hasLocation) score -= 10;
  if (vagueVision || internalVision) score -= 25;
  if (!phoneValid && !hasLocation) score -= 20;
  return Math.max(0, Math.min(100, score));
}

function determineLeadQuality(data) {
  const score = determineLeadScore(data);
  const budgetLabel = cleanBudgetLabel(data.budget || data.budget_range || normalizeBudgetRange(data));
  const budgetValues = extractBudgetNumbers(budgetLabel);
  const budgetMin = budgetValues.length ? Math.min(...budgetValues) : 0;
  const months = timelineToMonths(data.start_timeline || data.timeline || data.estimated_timeline);
  const phoneValid = isValidPhone(data.phone);
  const hasLocation = !isPlaceholderValue(data.project_location) || !isPlaceholderValue(data.project_address) || !isPlaceholderValue(data.city);
  const visionText = safeText(data.vision || data.message || "", "");
  const normalizedVision = visionText.toLowerCase();
  const vagueVision = !visionText || visionText.length < 20 || normalizedVision.includes("not sure") || normalizedVision.includes("to be discussed");
  const internalVision = isInternalVisionContent(visionText);
  if (!phoneValid || !hasLocation || vagueVision || internalVision) return "Low";
  if (score >= 78 && budgetMin >= 25000 && months !== null && months <= 3) return "High";
  if (score >= 58 && (budgetMin >= 5000 || (months !== null && months <= 6))) return "Medium";
  return "Low";
}

function reconcileLeadQuality(quality, score) {
  const normalized = String(quality || "").trim();
  if (score >= 90) return "High";
  if (score <= 40) return "Low";
  if (score >= 70 && normalized.toLowerCase() === "low") return "Medium";
  if (score >= 55 && !normalized) return "Medium";
  return normalized || "Low";
}

function determineLeadTier(score) {
  if (score >= 78) return "Hot";
  if (score >= 58) return "Warm";
  return "Nurture";
}

function buildLeadTags(data, score, options = {}) {
  const budgetLabel = cleanBudgetLabel(data.budget || data.budget_range || normalizeBudgetRange(data));
  const budgetValues = extractBudgetNumbers(budgetLabel);
  const budgetMax = budgetValues.length ? Math.max(...budgetValues) : 0;
  const timeline = safeText(data.start_timeline || data.timeline || data.estimated_timeline, "").toLowerCase();
  const service = safeText(data.service || data.selected_service, "").toLowerCase();
  const selectedStyle = safeText(data.selected_style, "").toLowerCase();
  const phoneValid = isValidPhone(data.phone);
  const highIntent = score >= 75 || timeline.includes("asap") || timeline.includes("within 30");
  const budgetFit = budgetMax >= 25000;
  const serviceMatch = service.includes("design & build") || service.includes("hardscaping") || service.includes("outdoor kitchen") ||
    (!!selectedStyle && selectedStyle !== "all" && selectedStyle !== "not selected");
  const tags = [];
  if (highIntent) tags.push("high_intent");
  if (budgetFit) tags.push("budget_fit");
  if (serviceMatch) tags.push("service_match");
  if (!phoneValid) tags.push("missing_phone");
  if (options.duplicate) tags.push("duplicate");
  return {
    high_intent: highIntent ? "yes" : "no",
    budget_fit: budgetFit ? "yes" : "no",
    service_match: serviceMatch ? "yes" : "no",
    tags: tags.length ? tags : ["standard_intake"]
  };
}

function fillTemplate(template, context) {
  return String(template || "").replace(/{{\s*([^}]+)\s*}}/g, (_, rawToken) => {
    const token = rawToken.trim();
    const pathParts = token.split(".").map((part) => part.trim());
    let current = context;
    for (const part of pathParts) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }
    if (token.endsWith("_html")) return String(current || "");
    return escapeHtml(safeText(current, ""));
  });
}

function buildDataRow(label, value, options = {}) {
  const normalizedValue = normalizeOptionalField(value, "");
  if (!normalizedValue) return "";
  const escapedLabel = escapeHtml(label);
  const escapedValue = escapeHtml(String(normalizedValue));
  if (options.link === "email" && isValidEmailAddress(normalizedValue)) {
    return `<tr><th>${escapedLabel}</th><td><a class="summary-link" href="mailto:${escapeAttribute(normalizedValue)}">${escapedValue}</a></td></tr>`;
  }
  if (options.link === "phone" && isValidPhone(normalizedValue)) {
    return `<tr><th>${escapedLabel}</th><td><a class="summary-link" href="tel:${escapeAttribute(normalizePhone(normalizedValue))}">${escapedValue}</a></td></tr>`;
  }
  return `<tr><th>${escapedLabel}</th><td>${escapedValue}</td></tr>`;
}

function buildClientSummaryTables(data) {
  const contactRows = [
    buildDataRow("Name", data.full_name),
    buildDataRow("Email", data.email, { link: "email" }),
    buildDataRow("Phone", data.phone, { link: "phone" }),
    buildDataRow("Contact Method", data.contact_method),
    buildDataRow("Project Location", data.project_location)
  ].filter(Boolean).join("");
  const projectRows = [
    buildDataRow("Service", data.service),
    buildDataRow("Budget", data.budget_range),
    buildDataRow("Start Timeline", data.start_timeline),
    buildDataRow("Estimated Timeline", data.estimated_timeline !== data.start_timeline ? data.estimated_timeline : ""),
    buildDataRow("Requested Style", data.selected_style)
  ].filter(Boolean).join("");
  return {
    client_contact_rows_html: contactRows,
    client_project_rows_html: projectRows,
    client_request_section_html: '<tr class="summary-group"><td colspan="2">Request Details</td></tr><tr><th>Expected Response</th><td>Within 1-2 business days</td></tr>',
    client_contact_section_html: contactRows ? `<tr class="summary-group"><td colspan="2">Contact Details</td></tr>${contactRows}` : "",
    client_project_section_html: projectRows ? `<tr class="summary-group"><td colspan="2">Project Details</td></tr>${projectRows}` : "",
    client_vision_html: isMeaningfulValue(data.vision) && !isInternalVisionContent(data.vision)
      ? `<div class="vision"><div class="vision-label">Your Vision</div><div class="vision-quote">"${escapeHtml(data.vision)}"</div></div>`
      : ""
  };
}

function buildOwnerTables(data) {
  const detailRows = [
    buildDataRow("Service", data.service),
    buildDataRow("Budget Range", data.budget_range),
    buildDataRow("Start Timeline", data.start_timeline),
    buildDataRow("Estimated Timeline", data.estimated_timeline !== data.start_timeline ? data.estimated_timeline : ""),
    buildDataRow("Contact Method", data.contact_method),
    buildDataRow("Project Reference", data.selected_project_label),
    buildDataRow("Style Reference", data.selected_style),
    buildDataRow("Project Location", data.project_location)
  ].filter(Boolean).join("");
  const intelRows = [
    buildDataRow("Priority", data.owner_priority),
    buildDataRow("Lead Score", isMeaningfulValue(data.owner_lead_score) ? `${data.owner_lead_score} / 100 (${safeText(data.owner_lead_tier, "Nurture")})` : ""),
    buildDataRow("Lead Quality", data.lead_quality),
    buildDataRow("Estimated Value", data.estimated_project_value),
    buildDataRow("Lead Tags", data.owner_lead_tags),
    buildDataRow("Status", data.sheet_status),
    buildDataRow("Submitted", data.submitted_local),
    buildDataRow("Urgency", data.start_timeline)
  ].filter(Boolean)
    .map((row) => row.replace("<th>", '<td class="k">').replace("</th>", "</td>").replace("<td>", '<td class="v">'))
    .join("");
  return {
    owner_detail_rows_html: detailRows,
    owner_intel_rows_html: intelRows,
    owner_dashboard_action_html: isMeaningfulValue(data.sheet_row_url)
      ? `<a href="${escapeAttribute(data.sheet_row_url)}" class="action-btn action-secondary">Open Lead Dashboard</a>`
      : "",
    owner_vision_html: isMeaningfulValue(data.vision) && !isInternalVisionContent(data.vision)
      ? `<div class="section vision"><div class="section-head">Client Vision</div><div class="vision-quote">"${escapeHtml(data.vision)}"</div></div>`
      : ""
  };
}

function buildEmailIdempotencyKey(ticketId, audience) {
  const ticket = normalizeWhitespace(ticketId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
  const role = normalizeWhitespace(audience).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || "recipient";
  return `lead_${role}_${ticket}`.slice(0, 256);
}

function deliverySucceeded(result) {
  return Boolean(result && result.ok === true && result.skipped !== true);
}

function configValue(env, key) {
  return cleanValue(env && env[key]);
}

function resolveSiteUrl(env, requestUrl) {
  const candidates = [configValue(env, "SITE_URL")];
  try {
    candidates.push(new URL(requestUrl).origin);
  } catch {}
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href.replace(/\/+$/, "");
    } catch {}
  }
  return "";
}

function safeLogError(error) {
  return String(error && error.message ? error.message : error || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 500);
}

function logLeadFailure(reason, normalized = {}, meta = {}) {
  console.error(JSON.stringify({
    message: "landscape lead delivery failure",
    timestamp: new Date().toISOString(),
    reason: safeLogError(reason),
    ticket_id: safeText(normalized.ticket_id || meta.ticket_id, ""),
    lead_source: safeText(normalized.lead_source, ""),
    service: safeText(normalized.service || normalized.selected_service, ""),
    city: safeText(normalized.city, ""),
    page_path: safeText(meta.page_url, "").replace(/^https?:\/\/[^/]+/i, "") || "",
    sheets_ok: Boolean(meta.sheets_ok),
    crm_ok: Boolean(meta.crm_ok),
    error: safeLogError(meta.error)
  }));
}

async function sendViaResend({ env, to, subject, html, replyTo, idempotencyKey, fetchImpl }) {
  const apiKey = configValue(env, "RESEND_API_KEY");
  const from = configValue(env, "RESEND_FROM_EMAIL") || configValue(env, "FROM_EMAIL");
  if (!isValidEmailAddress(to)) return { ok: false, skipped: true, reason: "invalid_recipient", to };
  if (!apiKey || !from) return { ok: false, skipped: true, reason: "missing_resend_configuration", to };

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text: buildPlainTextFromHtml(html),
      reply_to: replyTo
    })
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Resend error: ${response.status} ${responseText.slice(0, 500)}`);
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {}
  return { ok: true, provider: "resend", to, id: safeText(payload.id, "") };
}

function buildSheetRow(normalized, meta = {}) {
  const sheetValue = (value, fallback = "") => ownerSheetValue(value, fallback);
  return {
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
    estimated_project_value: sheetValue(normalized.estimated_project_value, "Varies by scope"),
    selected_style: sheetValue(normalized.selected_style),
    selected_image: sheetValue(normalized.selected_image),
    selected_project_label: sheetValue(normalized.selected_project_label),
    lead_source: sheetValue(normalized.lead_source, "website"),
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
    status: sheetValue(normalized.sheet_status, "New"),
    owner_summary: sheetValue(normalized.owner_summary),
    page_url: sheetValue(meta.page_url)
  };
}

async function sendToGoogleSheets(normalized, env, meta, fetchImpl) {
  const endpoint = configValue(env, "GOOGLE_SHEETS_WEBHOOK_URL");
  const secret = configValue(env, "GOOGLE_SHEETS_WEBHOOK_SECRET");
  if (!endpoint || !secret) {
    return { ok: false, skipped: true, reason: "missing_google_sheets_webhook_configuration" };
  }
  let parsedEndpoint;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    return { ok: false, skipped: true, reason: "invalid_google_sheets_webhook_url" };
  }
  if (parsedEndpoint.protocol !== "https:") {
    return { ok: false, skipped: true, reason: "invalid_google_sheets_webhook_url" };
  }

  const response = await fetchImpl(parsedEndpoint.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": secret
    },
    body: JSON.stringify({
      source: "thinkgreen-ticket",
      secret,
      row: buildSheetRow(normalized, meta)
    })
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Google Sheets webhook error: ${response.status} ${responseText.slice(0, 500)}`);
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error("Google Sheets webhook returned invalid JSON");
  }
  if (payload && payload.ok === false) {
    throw new Error(`Google Sheets webhook error: ${safeText(payload.error, "unknown webhook failure")}`);
  }
  return {
    ok: true,
    idempotent_replay: payload.idempotent_replay === true,
    row_id: safeText(payload.row_id, ""),
    row_url: safeText(payload.row_url || payload.sheet_row_url, ""),
    status: safeText(payload.status, "New"),
    spreadsheet_url: safeText(payload.spreadsheet_url, "")
  };
}

async function postJsonOnce(url, body, options, fetchImpl) {
  const endpoint = cleanValue(url);
  if (!endpoint) return { ok: false, skipped: true, reason: "missing_url" };
  const label = options.label || "webhook";
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:") throw new Error("webhook URL must use HTTPS");
    const response = await fetchImpl(parsed.href, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${label} webhook error: ${response.status} ${text.slice(0, 500)}`);
    }
    return { ok: true, endpoint: label };
  } catch (error) {
    return { ok: false, endpoint: label, error: safeLogError(error) };
  }
}

async function fanOutCrmWebhooks(normalized, env, meta, fetchImpl) {
  const payload = {
    source: "thinkgreen-ticket",
    ticket_id: normalized.ticket_id,
    submitted_local: normalized.submitted_local,
    submitted_at_iso: meta.created_at,
    page_url: safeText(meta.page_url, ""),
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
  const crmSecret = configValue(env, "CRM_WEBHOOK_SECRET");
  const targets = [
    { label: "crm", url: configValue(env, "CRM_WEBHOOK_URL"), headers: crmSecret ? { "x-webhook-secret": crmSecret } : {} },
    { label: "slack", url: configValue(env, "SLACK_WEBHOOK_URL"), headers: {} },
    { label: "airtable", url: configValue(env, "AIRTABLE_WEBHOOK_URL"), headers: {} },
    { label: "hubspot", url: configValue(env, "HUBSPOT_WEBHOOK_URL"), headers: {} }
  ].filter((target) => target.url);
  if (!targets.length) return { ok: false, skipped: true, reason: "no_crm_webhooks_configured" };
  const idempotencyKey = buildEmailIdempotencyKey(normalized.ticket_id, "crm");
  const results = await Promise.all(targets.map((target) => postJsonOnce(
    target.url,
    payload,
    {
      label: target.label,
      headers: { ...target.headers, "x-idempotency-key": idempotencyKey }
    },
    fetchImpl
  )));
  return { ok: results.some((entry) => entry.ok), results };
}

async function deliverLead({ data, env, ownerTemplate, clientTemplate, requestUrl, fetchImpl, now }) {
  const createdAt = new Date(now).toISOString();
  const pageUrl = valueFrom(data, ["page_url"], requestUrl);
  const siteUrl = resolveSiteUrl(env, requestUrl);
  const ticketId = valueFrom(data, ["ticket_id"]);
  const normalized = buildNormalizedData({ ...data, ticket_id: ticketId }, {
    ticket_id: ticketId,
    submitted_local: formatPhoenixDate(createdAt),
    sheet_url: configValue(env, "GOOGLE_SHEET_URL"),
    page_url: pageUrl
  });
  const leadScore = determineLeadScore(normalized);
  const leadTier = determineLeadTier(leadScore);
  let leadTagData = buildLeadTags(normalized, leadScore);
  normalized.owner_priority = safeText(data.owner_priority, determinePriority(normalized));
  normalized.owner_priority_class = getPriorityClass(normalized.owner_priority);
  normalized.owner_lead_score = String(leadScore);
  normalized.owner_lead_tier = leadTier;
  normalized.owner_lead_tags = leadTagData.tags.join(", ");
  normalized.lead_quality = reconcileLeadQuality(determineLeadQuality(normalized), leadScore);
  normalized.estimated_project_value = estimateProjectValue(normalized.service, normalized.budget_range);
  normalized.high_intent = leadTagData.high_intent;
  normalized.budget_fit = leadTagData.budget_fit;
  normalized.service_match = leadTagData.service_match;
  normalized.sheet_status = "New";
  normalized.sheet_row_url = "";
  normalized.sheet_row_id = "";
  normalized.sheet_url = configValue(env, "GOOGLE_SHEET_URL");
  normalized.owner_summary = buildOwnerSummary(normalized);

  const sheetsResult = await sendToGoogleSheets(normalized, env, {
    created_at: createdAt,
    page_url: pageUrl
  }, fetchImpl).catch((error) => ({ ok: false, error: safeLogError(error) }));

  if (!sheetsResult || !sheetsResult.ok) {
    logLeadFailure("google_sheet_delivery_failed", normalized, {
      page_url: pageUrl,
      ticket_id: ticketId,
      error: sheetsResult && (sheetsResult.error || sheetsResult.reason)
    });
    return jsonResponse(503, {
      ok: false,
      status: "unavailable",
      ticket_id: normalized.ticket_id,
      error: "Lead routing is temporarily unavailable. Please call us directly."
    });
  }

  normalized.sheet_status = safeText(sheetsResult.status, "New");
  normalized.sheet_row_id = safeText(sheetsResult.row_id, "");
  normalized.sheet_row_url = safeText(sheetsResult.row_url, "");
  normalized.sheet_url = safeText(sheetsResult.spreadsheet_url, normalized.sheet_url);
  if (!normalized.sheet_row_url || normalized.sheet_row_url === "Not provided") normalized.sheet_row_url = normalized.sheet_url;
  const duplicate = normalized.sheet_status.toLowerCase() === "duplicate";
  leadTagData = buildLeadTags(normalized, leadScore, { duplicate });
  normalized.owner_lead_tags = leadTagData.tags.join(", ");
  normalized.high_intent = leadTagData.high_intent;
  normalized.budget_fit = leadTagData.budget_fit;
  normalized.service_match = leadTagData.service_match;
  normalized.lead_quality = reconcileLeadQuality(determineLeadQuality(normalized), leadScore);
  normalized.estimated_project_value = estimateProjectValue(normalized.service, normalized.budget_range);
  normalized.owner_summary = buildOwnerSummary(normalized);

  if (sheetsResult.idempotent_replay === true) {
    console.log(JSON.stringify({
      message: "lead replay resolved from durable ticket record",
      ticket_id: ticketId,
      sheet_row_id: normalized.sheet_row_id
    }));
    return jsonResponse(200, { ok: true, status: "accepted", ticket_id: normalized.ticket_id });
  }

  const context = {
    SITE_URL: siteUrl,
    submission: { data: normalized },
    ...normalized,
    ...buildClientSummaryTables(normalized),
    ...buildOwnerTables(normalized)
  };
  const ownerHtml = fillTemplate(ownerTemplate, context);
  const clientHtml = fillTemplate(clientTemplate, context);
  const ownerEmail = configValue(env, "OWNER_EMAIL");
  const emailTasks = [sendViaResend({
    env,
    to: ownerEmail,
    subject: `New Think Green inquiry from ${normalized.full_name}`,
    html: ownerHtml,
    replyTo: isValidEmailAddress(normalized.email) ? normalized.email : undefined,
    idempotencyKey: buildEmailIdempotencyKey(ticketId, "owner"),
    fetchImpl
  })];
  const clientEmailExpected = Boolean(normalized.email && isValidEmailAddress(normalized.email));
  if (clientEmailExpected) {
    emailTasks.push(sendViaResend({
      env,
      to: normalized.email,
      subject: "Think Green received your project request",
      html: clientHtml,
      replyTo: ownerEmail,
      idempotencyKey: buildEmailIdempotencyKey(ticketId, "client"),
      fetchImpl
    }));
  }

  const [emailResults, crmResult] = await Promise.all([
    Promise.all(emailTasks.map((task) => task.catch((error) => ({ ok: false, error: safeLogError(error) })))),
    fanOutCrmWebhooks(normalized, env, { created_at: createdAt, page_url: pageUrl }, fetchImpl)
      .catch((error) => ({ ok: false, error: safeLogError(error) }))
  ]);
  const ownerResult = emailResults[0] || { ok: false, skipped: true, reason: "missing_owner_result" };
  const clientResult = clientEmailExpected
    ? (emailResults[1] || { ok: false, skipped: true, reason: "missing_client_result" })
    : null;
  const ownerEmailOk = deliverySucceeded(ownerResult);
  const clientEmailOk = !clientEmailExpected || deliverySucceeded(clientResult);
  const crmOk = deliverySucceeded(crmResult);
  if (!ownerEmailOk || !clientEmailOk) {
    const errors = emailResults
      .filter((result) => !deliverySucceeded(result))
      .map((result) => result && (result.error || result.reason))
      .filter(Boolean)
      .join(" | ");
    logLeadFailure("email_delivery_failed", normalized, {
      page_url: pageUrl,
      ticket_id: ticketId,
      sheets_ok: true,
      crm_ok: crmOk,
      error: errors
    });
  }
  const fullyAccepted = ownerEmailOk && clientEmailOk;
  return jsonResponse(fullyAccepted ? 200 : 202, {
    ok: true,
    status: fullyAccepted ? "accepted" : "accepted_with_warning",
    ticket_id: normalized.ticket_id
  });
}

export async function handleLeadRequest({
  request,
  env = {},
  ownerTemplate = "",
  clientTemplate = "",
  fetchImpl = fetch,
  now = Date.now()
}) {
  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed." }, { allow: "POST" });
  }

  const requestUrl = new URL(request.url);
  const origin = cleanValue(request.headers.get("origin"));
  if (!origin || origin !== requestUrl.origin) {
    return jsonResponse(403, { ok: false, error: "Request origin is not allowed." });
  }

  const contentType = cleanValue(request.headers.get("content-type")).split(";")[0].toLowerCase();
  if (contentType !== "application/json" && contentType !== "application/x-www-form-urlencoded") {
    return jsonResponse(415, { ok: false, error: "Unsupported request format." });
  }

  try {
    const text = await readBoundedBody(request);
    const data = parseRequestBody(text, contentType);
    if (cleanValue(data["bot-field"] || data.bot_field)) {
      return jsonResponse(200, {
        ok: true,
        status: "accepted",
        ticket_id: valueFrom(data, ["ticket_id"])
      });
    }
    validateLeadPayload(data, now);
    return await deliverLead({
      data,
      env,
      ownerTemplate,
      clientTemplate,
      requestUrl: requestUrl.href,
      fetchImpl,
      now
    });
  } catch (error) {
    if (error instanceof LeadRequestError) {
      return jsonResponse(error.status, { ok: false, error: error.message });
    }
    logLeadFailure("handler_error", {}, { page_url: requestUrl.href, error });
    return jsonResponse(503, {
      ok: false,
      status: "unavailable",
      ticket_id: "",
      error: "Lead routing is temporarily unavailable. Please call us directly."
    });
  }
}
