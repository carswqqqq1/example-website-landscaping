/*
 * Lead service types shared by the Cloudflare Pages Function (lib/landscape-lead-handler.mjs)
 * and the Netlify function (netlify/functions/send-ticket-emails.js).
 *
 * Three request types:
 *   maintenance  Regular maintenance (weekly / biweekly yard care)
 *   one_time     One-time cleanup or repair
 *   project      New project or redesign (the original design-build flow)
 *
 * Plain UMD so it works from ESM (Cloudflare bundler) and CommonJS (Netlify) without
 * Node-only APIs. Brand values come from site-config.js (the one config spot).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LEAD_SERVICE_TYPES = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TYPES = {
    maintenance: {
      key: 'maintenance',
      tag: '[MAINTENANCE]',
      label: 'Regular Maintenance',
      service: 'Regular Maintenance',
      ownerTitle: 'Maintenance Quote Request',
      ownerHeading: 'Service Details'
    },
    one_time: {
      key: 'one_time',
      tag: '[ONE-TIME]',
      label: 'One-Time Cleanup or Repair',
      service: 'One-Time Cleanup or Repair',
      ownerTitle: 'One-Time Job Request',
      ownerHeading: 'Job Details'
    },
    project: {
      key: 'project',
      tag: '[PROJECT]',
      label: 'New Project or Redesign',
      service: '',
      ownerTitle: 'Project Request Received',
      ownerHeading: 'Project Details'
    }
  };

  var ALIASES = {
    maintenance: 'maintenance',
    regular_maintenance: 'maintenance',
    recurring: 'maintenance',
    one_time: 'one_time',
    'one-time': 'one_time',
    onetime: 'one_time',
    cleanup: 'one_time',
    repair: 'one_time',
    project: 'project',
    new_project: 'project',
    redesign: 'project'
  };

  var FIELD_LIMITS = {
    service_type: 24,
    service_address: 240,
    yard_size: 40,
    service_frequency: 40,
    preferred_start_date: 40,
    job_description: 2000,
    job_timing: 80
  };

  function clean(value) {
    return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  // Returns 'maintenance' | 'one_time' | 'project', or null when the value is not allowed.
  // A missing value means the original project flow.
  function normalizeServiceType(value) {
    var raw = clean(value).toLowerCase();
    if (!raw) return 'project';
    return Object.prototype.hasOwnProperty.call(ALIASES, raw) ? ALIASES[raw] : null;
  }

  function typeInfo(type) {
    return TYPES[type] || TYPES.project;
  }

  // Fills fields the server needs when the visitor picked maintenance or one-time.
  // Mutates and returns data.
  function applyServiceTypeDefaults(data) {
    if (!data || typeof data !== 'object') return data;
    var type = normalizeServiceType(data.service_type);
    if (!type) return data;
    data.service_type = type;
    var info = typeInfo(type);
    if (type !== 'project' && !clean(data.service)) data.service = info.service;
    if (!clean(data.project_address) && clean(data.service_address)) data.project_address = clean(data.service_address);
    return data;
  }

  // Extra validation for the short forms. Returns an error string or ''.
  function validateServiceTypeFields(data, formType) {
    var type = normalizeServiceType(data && data.service_type);
    if (!type) return 'Please choose what you need.';
    if (formType === 'resource_gate' || type === 'project') return '';
    if (type === 'maintenance' && !clean(data.service_frequency)) return 'Please choose how often you need service.';
    if (type === 'one_time' && clean(data.job_description).length < 3) return 'Please tell us what needs doing.';
    return '';
  }

  function brandFrom(config) {
    var c = config || {};
    var phone = c.phone || {};
    var raw = String(phone.raw || '').replace(/\D/g, '');
    var address = c.address || {};
    var brand = c.brand || {};
    return {
      name: c.businessName || 'Landscape Company',
      short: c.shortName || c.businessName || 'Landscape Company',
      phoneDisplay: phone.display || '',
      phoneTel: raw.length === 10 ? '+1' + raw : raw,
      cityLine: [address.city, address.state].filter(Boolean).join(', '),
      sampleLabel: brand.sampleLabel || ''
    };
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function formatDateValue(value) {
    var match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return clean(value);
    var month = MONTHS[Number(match[2]) - 1];
    return month ? month + ' ' + Number(match[3]) + ', ' + match[1] : clean(value);
  }

  function rowsFor(type, data, buildDataRow) {
    var row = function (label, value, options) { return buildDataRow(label, value, options); };
    if (type === 'maintenance') {
      return [
        row('Yard Size', data.yard_size),
        row('Frequency', data.service_frequency),
        row('Preferred Start', formatDateValue(data.preferred_start_date))
      ].filter(Boolean).join('');
    }
    if (type === 'one_time') {
      return [
        row('What Needs Doing', data.job_description),
        row('Timing', data.job_timing)
      ].filter(Boolean).join('');
    }
    return '';
  }

  /*
   * Template tokens for the owner and client emails.
   * helpers: { escapeHtml, buildDataRow, phoneDisplay, phoneTel }
   * Project requests keep the original copy. Maintenance and one-time get the short quote flow.
   */
  function buildEmailContext(data, config, helpers) {
    var type = normalizeServiceType(data.service_type) || 'project';
    var info = typeInfo(type);
    var brand = brandFrom(config);
    var esc = helpers.escapeHtml;
    var isGate = clean(data.form_type) === 'resource_gate';
    var isQuote = type !== 'project' && !isGate;
    var ctx = {
      service_type: type,
      service_type_label: info.label,
      service_type_tag: info.tag,
      BRAND_NAME: brand.name,
      BRAND_SHORT: brand.short,
      BRAND_PHONE_DISPLAY: brand.phoneDisplay,
      BRAND_PHONE_TEL: brand.phoneTel,
      BRAND_CITY_LINE: brand.cityLine,
      BRAND_SAMPLE_LABEL: brand.sampleLabel,
      owner_type_tag: info.tag,
      owner_header_title: isGate ? 'Checklist Download' : info.ownerTitle,
      owner_details_heading: info.ownerHeading,
      owner_preheader: info.tag + ' New ' + brand.short + ' request from ' + clean(data.full_name) + '.',
      owner_subject: info.tag + ' New ' + brand.short + ' request from ' + clean(data.full_name),
      client_subject: isQuote
        ? brand.short + ' received your quote request'
        : brand.short + ' received your project request'
    };

    if (!isQuote) {
      ctx.client_preheader = 'Your ' + brand.short + ' project request has been received. We will contact you within 1-2 business days.';
      ctx.client_header_tag = 'Project Request Received';
      ctx.client_header_title = 'Your Project Request Is In Review.';
      ctx.client_intro_html = 'Thank you for reaching out to ' + esc(brand.short) + '. Your project request has been received and is now being reviewed. We will contact you using your preferred method within <strong>1-2 business days</strong> to discuss next steps and schedule your project review.';
      ctx.client_confirm_copy = 'Our team will review your details and follow up with the next step.';
      ctx.client_steps = [
        ['Team Review', 'We review your request details and confirm service fit, timeline, and project goals.'],
        ['We Reach Out', 'A team member contacts you ' + esc(helpers.contactVia) + ' within 1-2 business days.'],
        ['Project Review Scheduled', 'We plan your on-site walkthrough and map the best next move for your landscape.']
      ];
      ctx.client_cta_msg = 'While we review your request, you can explore recent project work for layout and material inspiration.';
      ctx.client_cta_label = 'Explore Our Work';
      ctx.client_cta_path = '/portfolio';
      ctx.client_expected_response = 'Within 1-2 business days';
      ctx.client_footer_reason = 'You are receiving this because you submitted a project request.';
    } else {
      var maintenance = type === 'maintenance';
      ctx.client_preheader = 'Your ' + brand.short + ' quote request is in. Expect a call within 24 hours.';
      ctx.client_header_tag = 'Quote Request Received';
      ctx.client_header_title = 'Your Quote Request Is In.';
      ctx.client_intro_html = 'Thanks for reaching out to ' + esc(brand.short) + '. We have your ' + (maintenance ? 'yard care' : 'job') + ' details, and a team member will call you within <strong>24 hours</strong> (business days) with pricing' + (maintenance ? ' and the next open start date.' : ' and the soonest time we can get out there.');
      ctx.client_confirm_copy = maintenance
        ? 'No contract needed to get a price. We confirm your yard size and visit schedule on the call.'
        : 'Have photos of the problem? Reply to this email with them and we will look before we call.';
      ctx.client_steps = maintenance
        ? [
            ['We Check Your Details', 'We look at your address, yard size and the schedule you picked.'],
            ['Call Within 24 Hours', 'We reach out ' + esc(helpers.contactVia) + ' with a price per visit and the next open start date.'],
            ['First Visit Booked', 'Pick a start day that works. The same crew handles each visit.']
          ]
        : [
            ['We Review the Job', 'We look over what needs doing and the timing you picked.'],
            ['Call Within 24 Hours', 'We reach out ' + esc(helpers.contactVia) + ' with a price, or set up a quick on-site check if we need to see it.'],
            ['Job Scheduled', 'We book the work at a time that suits you and confirm it by text.']
          ];
      ctx.client_cta_msg = maintenance
        ? 'See what is included in each visit.'
        : 'Need it sooner? Call us and we will see what we can move.';
      ctx.client_cta_label = maintenance ? 'Yard Care Plans' : 'Our Services';
      ctx.client_cta_path = maintenance ? '/yard-maintenance' : '/services';
      ctx.client_expected_response = 'Within 24 hours (business days)';
      ctx.client_footer_reason = 'You are receiving this because you requested a quote.';
    }

    ctx.client_steps_html = ctx.client_steps.map(function (step, index) {
      return '<tr class="step-row"><td class="step-index"><span class="step-num">' + (index + 1) + '</span></td>' +
        '<td><span class="step-title">' + esc(step[0]) + '</span><div class="step-copy">' + step[1] + '</div></td></tr>';
    }).join('');
    delete ctx.client_steps;

    if (isQuote) {
      var detailRows = rowsFor(type, data, helpers.buildDataRow);
      var contactRows = [
        helpers.buildDataRow('Name', data.full_name),
        helpers.buildDataRow('Email', data.email, { link: 'email' }),
        helpers.buildDataRow('Phone', data.phone, { link: 'phone' }),
        helpers.buildDataRow('Contact Method', data.contact_method),
        helpers.buildDataRow('Service Address', data.project_location)
      ].filter(Boolean).join('');
      ctx.override = {
        client_contact_section_html: contactRows
          ? '<tr class="summary-group"><td colspan="2">Contact Details</td></tr>' + contactRows
          : '',
        client_project_section_html: detailRows
          ? '<tr class="summary-group"><td colspan="2">' + esc(info.ownerHeading) + '</td></tr>' + detailRows
          : '',
        client_vision_html: '',
        owner_detail_rows_html: [
          detailRows,
          helpers.buildDataRow('Service Address', data.project_location),
          helpers.buildDataRow('Contact Method', data.contact_method)
        ].filter(Boolean).join(''),
        owner_vision_html: '',
        owner_intel_rows_html: [
          helpers.buildDataRow('Frequency', type === 'maintenance' ? data.service_frequency : ''),
          helpers.buildDataRow('Timing', type === 'one_time' ? data.job_timing : ''),
          helpers.buildDataRow('Status', data.sheet_status),
          helpers.buildDataRow('Submitted', data.submitted_local)
        ].filter(Boolean)
          .map(function (row) { return row.replace('<th>', '<td class="k">').replace('</th>', '</td>').replace('<td>', '<td class="v">'); })
          .join(''),
        normalized_patch_summary: type === 'maintenance'
          ? [info.label, clean(data.service_frequency), clean(data.yard_size) ? 'Yard: ' + clean(data.yard_size) : '', clean(data.preferred_start_date) ? 'Start: ' + formatDateValue(data.preferred_start_date) : ''].filter(Boolean).join(' · ')
          : [info.label, clean(data.job_timing) ? 'Timing: ' + clean(data.job_timing) : ''].filter(Boolean).join(' · ')
      };
      ctx.normalizedPatch = {
        owner_summary: ctx.override.normalized_patch_summary,
        owner_priority: 'Call within 24h'
      };
      delete ctx.override.normalized_patch_summary;
    }
    ctx.override = ctx.override || {};
    ctx.override.client_request_section_html = '<tr class="summary-group"><td colspan="2">Request Details</td></tr>' +
      '<tr><th>Request Type</th><td>' + esc(info.label) + '</td></tr>' +
      '<tr><th>Expected Response</th><td>' + esc(ctx.client_expected_response) + '</td></tr>';
    return ctx;
  }

  return {
    TYPES: TYPES,
    FIELD_LIMITS: FIELD_LIMITS,
    normalizeServiceType: normalizeServiceType,
    typeInfo: typeInfo,
    applyServiceTypeDefaults: applyServiceTypeDefaults,
    validateServiceTypeFields: validateServiceTypeFields,
    brandFrom: brandFrom,
    buildEmailContext: buildEmailContext
  };
});
