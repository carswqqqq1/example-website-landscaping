/**
 * Think Green lead webhook for Google Sheets.
 *
 * Deploy this script as a Web App:
 * 1) https://script.new
 * 2) Paste this file.
 * 3) Set WEBHOOK_SECRET below.
 * 4) Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5) Copy the Web app URL to Netlify env var GOOGLE_SHEETS_WEBHOOK_URL.
 */
const SHEET_NAME = 'Owner Lead Dashboard';
const SPREADSHEET_TITLE = 'Think Green Lead Dashboard';
const TARGET_SPREADSHEET_ID = ''; // Optional: set to existing sheet ID
const WEBHOOK_SECRET = 'replace-with-long-random-secret';
const SPREADSHEET_ID_KEY = 'THINKGREEN_SPREADSHEET_ID';
const DEDUPE_WINDOW_DAYS = 7;

const HEADERS = [
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

function setup() {
  const meta = getOrCreateSheet_();
  Logger.log('Spreadsheet URL: ' + meta.spreadsheet.getUrl());
}

function doGet() {
  const meta = getOrCreateSheet_();
  return json_({
    ok: true,
    spreadsheet_id: meta.spreadsheet.getId(),
    spreadsheet_url: meta.spreadsheet.getUrl(),
    sheet_name: SHEET_NAME
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const secret = String(body.secret || '').trim();

    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    const row = body.row || {};
    const meta = getOrCreateSheet_();
    applyOwnerDashboardLayout_(meta.sheet);
    const now = new Date();
    const normalizedEmail = normalizeEmail_(row.email || '');
    const normalizedPhone = normalizePhone_(row.phone || '');

    const duplicate = findRecentDuplicate_(meta.sheet, normalizedEmail, normalizedPhone, now);
    const status = duplicate ? 'Duplicate' : (String(row.status || '').trim() || 'New');
    const followUpDue = status === 'New' ? formatPhoenixDate_(new Date(now.getTime() + 24 * 60 * 60 * 1000)) : '';
    const nextAction = status === 'New' ? 'Call' : '';

    const tags = normalizeTags_(row.lead_tags || row.owner_lead_tags || '');
    if (duplicate && tags.indexOf('duplicate') === -1) tags.push('duplicate');

    const values = {
      timestamp: sanitizeField_(row.timestamp || formatPhoenixDate_(now)),
      status: status,
      name: sanitizeField_(row.name || [row.first_name || '', row.last_name || ''].join(' ').trim()),
      phone: sanitizeField_(row.phone),
      email: sanitizeField_(row.email),
      city: sanitizeField_(row.city),
      service: sanitizeField_(row.service || row.selected_service),
      budget_range: sanitizeField_(row.budget_range),
      start_timeline: sanitizeField_(row.start_timeline || row.timeline || row.estimated_timeline),
      lead_quality: sanitizeField_(row.lead_quality),
      estimated_project_value: sanitizeField_(row.estimated_project_value || 'Varies by scope'),
      next_action: sanitizeField_(row.next_action || nextAction),
      follow_up_due: followUpDue,
      notes: sanitizeField_(row.notes),
      ticket_id: sanitizeField_(row.ticket_id),
      lead_tags: tags.join(', '),
      lead_source: sanitizeField_(row.lead_source),
      project_reference: sanitizeField_(row.selected_project_label || row.project_reference),
      style_reference: sanitizeField_(row.selected_style || row.style_reference),
      project_location: sanitizeField_(row.project_location || row.project_address),
      contact_method: sanitizeField_(row.contact_method || row.preferred_contact_method),
      submitted_local: sanitizeField_(row.submitted_local),
      last_touched: formatPhoenixDate_(now),
      page_url: sanitizeField_(row.page_url),
      utm_source: sanitizeField_(row.utm_source),
      utm_medium: sanitizeField_(row.utm_medium),
      utm_campaign: sanitizeField_(row.utm_campaign)
    };

    meta.sheet.appendRow(HEADERS.map(function (key) { return values[key]; }));

    const rowId = meta.sheet.getLastRow();
    const rowUrl = buildRowUrl_(meta.spreadsheet, meta.sheet, rowId);

    return json_({
      ok: true,
      row_id: rowId,
      row_url: rowUrl,
      status: status,
      spreadsheet_id: meta.spreadsheet.getId(),
      spreadsheet_url: meta.spreadsheet.getUrl(),
      sheet_name: SHEET_NAME
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() !== SHEET_NAME) return;

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const statusCol = header.indexOf('status') + 1;
    const lastTouchedCol = header.indexOf('last_touched') + 1;
    if (!statusCol || !lastTouchedCol) return;

    if (e.range.getColumn() === statusCol && e.range.getRow() > 1) {
      sheet.getRange(e.range.getRow(), lastTouchedCol).setValue(new Date());
    }
  } catch (err) {
    Logger.log('onEdit error: ' + err);
  }
}

function findRecentDuplicate_(sheet, email, phone, now) {
  if (!email && !phone) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  const tsIndex = header.indexOf('timestamp');
  const emailIndex = header.indexOf('email');
  const phoneIndex = header.indexOf('phone');
  if (tsIndex < 0 || emailIndex < 0 || phoneIndex < 0) return false;

  const cutoff = new Date(now.getTime() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const existingTsRaw = rows[i][tsIndex];
    const existingTs = existingTsRaw ? new Date(existingTsRaw) : null;
    if (!existingTs || isNaN(existingTs.getTime()) || existingTs < cutoff) continue;

    const existingEmail = normalizeEmail_(rows[i][emailIndex]);
    const existingPhone = normalizePhone_(rows[i][phoneIndex]);

    if ((email && existingEmail && email === existingEmail) || (phone && existingPhone && phone === existingPhone)) {
      return true;
    }
  }

  return false;
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone_(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeTags_(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  return text
    .split(',')
    .map(function (tag) { return String(tag || '').trim(); })
    .filter(Boolean);
}

function sanitizeField_(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  var normalized = text.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (
    normalized === 'not provided' ||
    normalized === 'not selected' ||
    normalized === 'not specified' ||
    normalized === 'not set' ||
    normalized === 'undefined' ||
    normalized === 'null' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'none'
  ) {
    return '';
  }
  return text;
}

function formatPhoenixDate_(value) {
  var date = value instanceof Date ? value : new Date(value || new Date());
  return Utilities.formatDate(date, 'America/Phoenix', 'MMM d, yyyy, h:mm a');
}

function buildRowUrl_(spreadsheet, sheet, row) {
  return spreadsheet.getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + row;
}

function getOrCreateSheet_() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = TARGET_SPREADSHEET_ID || props.getProperty(SPREADSHEET_ID_KEY);
  let spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create(SPREADSHEET_TITLE);
    spreadsheetId = spreadsheet.getId();
    props.setProperty(SPREADSHEET_ID_KEY, spreadsheetId);
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeader_(sheet);
  applyOwnerDashboardLayout_(sheet);

  return { spreadsheet, sheet };
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }
  var current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var mismatch = false;
  for (var i = 0; i < HEADERS.length; i += 1) {
    if (String(current[i] || '').trim() !== HEADERS[i]) {
      mismatch = true;
      break;
    }
  }
  if (mismatch) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function applyOwnerDashboardLayout_(sheet) {
  if (!sheet) return;
  var requiredColumns = HEADERS.length;
  var maxColumns = sheet.getMaxColumns();
  if (maxColumns < requiredColumns) {
    sheet.insertColumnsAfter(maxColumns, requiredColumns - maxColumns);
    maxColumns = sheet.getMaxColumns();
  }

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(6);
  sheet.showColumns(1, maxColumns);

  var widths = [
    188, // timestamp
    116, // status
    190, // name
    140, // phone
    230, // email
    130, // city
    170, // service
    160, // budget_range
    140, // start_timeline
    120, // lead_quality
    170, // estimated_project_value
    140, // next_action
    150, // follow_up_due
    240, // notes
    170, // ticket_id
    220, // lead_tags
    130, // lead_source
    180, // project_reference
    170, // style_reference
    220, // project_location
    140, // contact_method
    180, // submitted_local
    170, // last_touched
    280, // page_url
    130, // utm_source
    130, // utm_medium
    150  // utm_campaign
  ];

  for (var i = 0; i < widths.length; i += 1) {
    sheet.setColumnWidth(i + 1, widths[i]);
  }

  [15, 16, 17, 19, 24, 25, 26, 27].forEach(function (columnNumber) {
    sheet.hideColumns(columnNumber);
  });
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
