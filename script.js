/* ============================================================
   Config-driven site script
   ============================================================ */
(function () {
  'use strict';

  var SITE_CONFIG = window.SITE_CONFIG || {};
  var BRAND = SITE_CONFIG.brand || {};
  var ADDRESS = SITE_CONFIG.address || {};
  var PHONE = SITE_CONFIG.phone || {};
  var PHONE_TRACKING = SITE_CONFIG.phoneTracking || {};
  var REVIEW_SUMMARY = SITE_CONFIG.reviewSummary || {};
  var GOOGLE_REVIEWS = SITE_CONFIG.googleReviews || {};
  var SERVICE_AREAS = Array.isArray(SITE_CONFIG.serviceAreas) ? SITE_CONFIG.serviceAreas : [];
  var TRUST_ASSETS = SITE_CONFIG.trustAssets || {};
  var LOCATION_PAGES = SITE_CONFIG.locationPages || {};
  var PAGE_CONVERSION_GUIDES = SITE_CONFIG.pageConversionGuides || {};
  var FINANCING = SITE_CONFIG.financing || {};
  var ANALYTICS = SITE_CONFIG.analytics || {};
  var PRIMARY_OFFER = SITE_CONFIG.primaryOffer || {};
  var REVIEW_FEED_ENDPOINT = String(GOOGLE_REVIEWS.feedEndpoint || '').trim();
  var URL_PARAMS = new URLSearchParams(window.location.search);
  var LEAD_SUBMISSION_ENDPOINT = String(SITE_CONFIG.leadEndpoint || '').trim() || '/api/lead';
  var TURNSTILE_CONFIG = SITE_CONFIG.turnstile || {};
  var TURNSTILE_SITE_KEY = String(TURNSTILE_CONFIG.siteKey || '0x4AAAAAADz87LUSWTNh1x7k').trim();
  var TURNSTILE_API_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var turnstileApiPromise = null;
  var turnstileWidgets = new WeakMap();

  var SITE_NAME = SITE_CONFIG.businessName || 'Think Green Design | Build Landscape';
  var SITE_PHONE_RAW = String(PHONE.raw || '4809229497').replace(/\D/g, '');
  var SITE_PHONE_DISPLAY = PHONE.display || '(480) 922-9497';
  var DETECTED_LEAD_SOURCE = 'website';
  var SITE_EMAIL = SITE_CONFIG.email || 'carson.elevatemarketing@gmail.com';
  var SITE_ADDRESS_LINE1 = ADDRESS.line1 || '7730 E. Gelding Dr. Ste 1';
  var SITE_CITY = ADDRESS.city || 'Scottsdale';
  var SITE_STATE = ADDRESS.state || 'AZ';
  var SITE_ZIP = ADDRESS.zip || '85260';
  var REVIEW_RATING = String(REVIEW_SUMMARY.rating || SITE_CONFIG.reviewRating || GOOGLE_REVIEWS.rating || '').trim();
  var REVIEW_COUNT = String(REVIEW_SUMMARY.count || SITE_CONFIG.reviewCount || GOOGLE_REVIEWS.count || '').trim();
  var REVIEW_SOURCE = String(REVIEW_SUMMARY.source || SITE_CONFIG.reviewSource || GOOGLE_REVIEWS.platform || 'Google').trim();
  var REVIEW_SOURCE_URL = String(REVIEW_SUMMARY.sourceUrl || SITE_CONFIG.reviewSourceUrl || GOOGLE_REVIEWS.profileUrl || '').trim();
  var REVIEW_SNAPSHOT_DATE = String(REVIEW_SUMMARY.snapshotDate || SITE_CONFIG.reviewSnapshotDate || GOOGLE_REVIEWS.snapshotDate || '').trim();
  var BUSINESS_YEARS = String(SITE_CONFIG.businessYears || '').trim();
  var SOCIAL_PROFILES = Array.isArray(SITE_CONFIG.socialProfiles) ? SITE_CONFIG.socialProfiles : [];
  var REVIEW_STATE = {
    rating: REVIEW_RATING,
    count: REVIEW_COUNT,
    source: REVIEW_SOURCE || 'Google',
    sourceUrl: REVIEW_SOURCE_URL,
    snapshotDate: REVIEW_SNAPSHOT_DATE,
    live: false
  };
  var OFFER_LABEL = String(PRIMARY_OFFER.label || 'Start Project Review').trim();
  var OFFER_SHORT_LABEL = String(PRIMARY_OFFER.shortLabel || 'Project Review').trim();
  var OFFER_FORM_TITLE = String(PRIMARY_OFFER.formTitle || 'Start Your Project Review').trim();
  var OFFER_SUBMIT_LABEL = String(PRIMARY_OFFER.submitLabel || 'Send My Project Review').trim();
  var OFFER_PROMISE = String(PRIMARY_OFFER.promise || 'No pressure, no obligation, and a local team member follows up within one business day.').trim();

  function getLeadSubmissionEndpoint() {
    return LEAD_SUBMISSION_ENDPOINT;
  }

  function setFieldValidationState(field, isValid) {
    if (!field) return;
    var fieldId = String(field.id || '').trim();
    var errorId = fieldId ? fieldId + '-error' : '';
    var fieldWrap = field.closest ? field.closest('.form-field, .form-consent') : null;
    var error = errorId ? document.getElementById(errorId) : null;

    if (!error && fieldId) {
      error = document.createElement('p');
      error.id = errorId;
      error.className = 'field-error';
      error.setAttribute('role', 'status');
      error.setAttribute('aria-live', 'polite');
      if (fieldWrap && fieldWrap.parentNode) {
        fieldWrap.insertAdjacentElement('afterend', error);
      } else if (field.parentNode) {
        field.insertAdjacentElement('afterend', error);
      }
    }

    field.setAttribute('aria-invalid', isValid ? 'false' : 'true');
    field.style.borderColor = isValid ? '' : '#a82a22';
    if (fieldWrap) fieldWrap.classList.toggle('has-error', !isValid);
    if (error) {
      error.textContent = isValid ? '' : 'This field is required.';
      error.hidden = isValid;
      if (!isValid && fieldId) {
        var describedBy = String(field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (describedBy.indexOf(errorId) < 0) describedBy.push(errorId);
        field.setAttribute('aria-describedby', describedBy.join(' '));
      }
    }
  }

  function validateRequiredFields(fields, summary, summaryMessage) {
    var firstInvalid = null;
    (fields || []).forEach(function (field) {
      if (!field || field.disabled) return;
      var isValid = field.type === 'checkbox'
        ? field.checked
        : String(field.value || '').trim() !== '';
      setFieldValidationState(field, isValid);
      if (!isValid && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) {
      if (summary) {
        summary.textContent = summaryMessage || 'Please complete the required fields and try again.';
        summary.hidden = false;
      }
      window.setTimeout(function () {
        firstInvalid.focus();
      }, 0);
      return false;
    }
    if (summary) {
      summary.textContent = '';
      summary.hidden = true;
    }
    return true;
  }

  function setTurnstileStatus(form, message, isError) {
    var status = form && form.querySelector('[data-turnstile-status]');
    if (!status) return;
    status.textContent = String(message || '');
    status.classList.toggle('is-error', Boolean(isError && message));
  }

  function loadTurnstileApi() {
    if (window.turnstile && typeof window.turnstile.render === 'function') {
      return Promise.resolve(window.turnstile);
    }
    if (turnstileApiPromise) return turnstileApiPromise;

    turnstileApiPromise = new Promise(function (resolve, reject) {
      var script = document.querySelector('script[data-turnstile-api]');
      var timeoutId = window.setTimeout(function () {
        reject(new Error('Turnstile API timed out'));
      }, 15000);

      function finish() {
        window.clearTimeout(timeoutId);
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          resolve(window.turnstile);
        } else {
          reject(new Error('Turnstile API unavailable'));
        }
      }

      function fail() {
        window.clearTimeout(timeoutId);
        reject(new Error('Turnstile API failed to load'));
      }

      if (script) {
        script.addEventListener('load', finish, { once: true });
        script.addEventListener('error', fail, { once: true });
        return;
      }

      script = document.createElement('script');
      script.src = TURNSTILE_API_URL;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileApi = 'true';
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', fail, { once: true });
      document.head.appendChild(script);
    });

    return turnstileApiPromise;
  }

  function setupTurnstileForm(form, action) {
    if (!form) return Promise.resolve(null);
    var existingState = turnstileWidgets.get(form);
    if (existingState) return existingState.loadPromise;

    var container = form.querySelector('[data-turnstile-container]');
    if (!container) {
      container = document.createElement('div');
      container.className = 'turnstile-field';
      container.setAttribute('data-turnstile-container', '');
      var submit = form.querySelector('[type="submit"]');
      if (submit && submit.parentNode) submit.parentNode.insertBefore(container, submit);
      else form.appendChild(container);
    }

    var state = {
      action: String(action || ''),
      loadError: false,
      loadPromise: null,
      ready: false,
      token: '',
      widgetId: null
    };
    turnstileWidgets.set(form, state);
    container.setAttribute('data-turnstile-action', state.action);
    setTurnstileStatus(form, 'Loading security check…', false);

    state.loadPromise = loadTurnstileApi()
      .then(function (api) {
        if (!document.contains(form)) return null;
        state.widgetId = api.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          action: state.action,
          size: window.matchMedia && window.matchMedia('(max-width: 360px)').matches ? 'compact' : 'flexible',
          theme: 'auto',
          'response-field': false,
          callback: function (token) {
            state.token = String(token || '');
            setTurnstileStatus(form, '', false);
          },
          'error-callback': function () {
            state.token = '';
            setTurnstileStatus(form, 'The security check could not be completed. Please try again.', true);
          },
          'expired-callback': function () {
            state.token = '';
            setTurnstileStatus(form, 'The security check expired. Please complete it again.', true);
          },
          'timeout-callback': function () {
            state.token = '';
            setTurnstileStatus(form, 'The security check timed out. Please complete it again.', true);
          }
        });
        if (state.widgetId === null || state.widgetId === undefined) {
          throw new Error('Turnstile widget failed to render');
        }
        state.ready = true;
        setTurnstileStatus(form, '', false);
        return state.widgetId;
      })
      .catch(function () {
        state.loadError = true;
        state.token = '';
        setTurnstileStatus(form, 'The security check could not load. Please refresh the page or call us.', true);
        return null;
      });

    return state.loadPromise;
  }

  function getTurnstileToken(form) {
    var state = form && turnstileWidgets.get(form);
    return state ? String(state.token || '') : '';
  }

  function getTurnstileRequiredMessage(form) {
    var state = form && turnstileWidgets.get(form);
    if (!state || (!state.ready && !state.loadError)) return 'The security check is still loading. Please wait a moment and try again.';
    if (state.loadError) return 'The security check could not load. Please refresh the page or call us.';
    return 'Please complete the security check before submitting.';
  }

  function safeResetTurnstile(form) {
    var state = form && turnstileWidgets.get(form);
    if (!state) return;
    state.token = '';
    setTurnstileStatus(form, '', false);
    if (
      state.widgetId === null ||
      state.widgetId === undefined ||
      !window.turnstile ||
      typeof window.turnstile.reset !== 'function'
    ) return;
    try {
      window.turnstile.reset(state.widgetId);
    } catch (error) {
      state.loadError = true;
      setTurnstileStatus(form, 'The security check could not reset. Please refresh the page or call us.', true);
    }
  }

  var DEFAULT_PAGE_CONVERSION_GUIDES = {
    '/ahwatukee-landscape-design': {
      eyebrow: 'Design Quote Fit',
      title: 'Use This Page When the Yard Needs a Plan Before a Price',
      intro: 'Ahwatukee homeowners usually get the most value when the first conversation sorts layout, shade, and phasing before construction numbers are treated as final.',
      bullets: ['You are comparing ideas but do not yet know which backyard zone should happen first.', 'The yard needs patios, shade, planting, lighting, or turf to feel connected instead of patched together.', 'You want a quote path that can separate design scope from build-ready work.'],
      questions: ['Photos of the yard from the house, patio, side gate, and any problem corners.', 'A rough must-have list, even if the finish style is still undecided.', 'Any HOA, drainage, access, or timing constraints that could affect build sequencing.'],
      nextSteps: ['Whether the first step is a design plan, a focused quote, or a phased project roadmap.', 'Which features should be priced now and which should stay in a later phase.', 'What information is still needed before a realistic construction range can be given.'],
      ctaHref: '/free-consultation?city=Ahwatukee&service=landscape-design&source=conversion_guide&autostart=1'
    },
    '/chandler-landscaping': {
      eyebrow: 'Chandler Quote Fit',
      title: 'Make the First Quote About the Backyard You Actually Use',
      intro: 'For Chandler yards, the strongest first quote usually connects entertaining space, shade, kitchen or grill plans, and everyday maintenance instead of pricing one isolated feature.',
      bullets: ['You want a patio, outdoor kitchen, turf, or lighting plan that works together.', 'The yard is usable now but feels unfinished, hot, or awkward for hosting.', 'You need help deciding whether the first phase should be hardscape, shade, or utilities.'],
      questions: ['How many people the yard needs to handle on a normal weekend.', 'Whether gas, electric, water, or drainage already exists near the project area.', 'Which part of the yard feels most annoying or underused today.'],
      nextSteps: ['A clear first-phase recommendation for the highest-use area.', 'Whether kitchen, patio, shade, or lighting decisions should be bundled.', 'Budget direction before appliance or finish choices create false expectations.'],
      ctaHref: '/free-consultation?city=Chandler&source=conversion_guide&autostart=1'
    },
    '/mesa-landscaping': {
      eyebrow: 'Mesa Quote Fit',
      title: 'Start With the Practical Upgrade That Changes Daily Use',
      intro: 'Mesa projects often convert from scattered maintenance problems into cleaner family-use spaces. The quote should identify the most useful first phase before chasing every cosmetic idea.',
      bullets: ['You want lower maintenance without making the yard feel empty.', 'Turf, pavers, irrigation, or lighting all touch the same area.', 'You need a budget-conscious first phase that still supports a long-term plan.'],
      questions: ['Which areas get used by kids, pets, guests, or no one at all.', 'Current irrigation, drainage, grass, rock, or concrete problems.', 'The rough budget range you are comfortable exploring first.'],
      nextSteps: ['Whether turf, pavers, irrigation, or planting should lead the scope.', 'Which items are must-fix function problems versus later visual upgrades.', 'How to phase work without rebuilding the same area twice.'],
      ctaHref: '/free-consultation?city=Mesa&source=conversion_guide&autostart=1'
    },
    '/glendale-hardscaping': {
      eyebrow: 'Hardscape Quote Fit',
      title: 'Price the Patio Around Use, Drainage, and Edge Details',
      intro: 'A useful hardscape quote should clarify base prep, drainage, access, borders, steps, and how the new surface meets the rest of the yard.',
      bullets: ['You are comparing pavers, concrete, or patio expansion options.', 'The current patio is too small, cracked, poorly drained, or disconnected from seating areas.', 'You want a durable layout that supports shade, fire, lighting, or kitchen upgrades later.'],
      questions: ['Approximate patio size and whether demolition is needed.', 'Photos showing slope, gates, existing concrete, steps, and drainage trouble spots.', 'Whether the patio needs to support furniture, cooking, fire, or a future cover.'],
      nextSteps: ['A realistic hardscape range based on prep and finish level.', 'Which details affect durability: base depth, edge restraint, drainage, and transitions.', 'Whether the project should include lighting, seating walls, or future utility planning.'],
      ctaHref: '/free-consultation?city=Glendale&service=hardscaping&source=conversion_guide&autostart=1'
    },
    '/north-phoenix-outdoor-lighting': {
      eyebrow: 'Lighting Quote Fit',
      title: 'Quote Lighting Around Safety, Curb Appeal, and Night Use',
      intro: 'Good lighting is not just fixture count. The first quote should separate path safety, accent lighting, patio comfort, wiring access, and the zones that matter after sunset.',
      bullets: ['The yard looks unfinished or unsafe at night.', 'You want path, patio, tree, wall, or architecture lighting to feel coordinated.', 'Existing lighting is dim, random, over-bright, or hard to maintain.'],
      questions: ['Night photos or a short list of areas that feel too dark.', 'Whether existing low-voltage wiring, transformer, or timers are already installed.', 'Which zones matter most: entry, path, patio, pool-adjacent area, or feature plants.'],
      nextSteps: ['Which fixtures and zones should be included in the first phase.', 'Whether wiring access or transformer capacity affects price.', 'How lighting can support future planting, patio, or hardscape upgrades.'],
      ctaHref: '/free-consultation?city=North%20Phoenix&service=outdoor-lighting&source=conversion_guide&autostart=1'
    },
    '/outdoor-kitchen-planning-arizona': {
      eyebrow: 'Kitchen Quote Fit',
      title: 'Avoid Pricing an Outdoor Kitchen Before the Layout Works',
      intro: 'Outdoor kitchen quotes vary fast because utility routing, shade, counters, appliances, and seating flow all change the scope.',
      bullets: ['You know you want a grill area but not the exact layout or appliance package.', 'The kitchen needs to connect to shade, seating, patio traffic, or a pool area.', 'You want to avoid buying appliances before the build plan is clear.'],
      questions: ['Preferred cooking style: quick grilling, hosting, prep space, bar seating, or full kitchen.', 'Photos of nearby utilities, patio surface, shade, and access path.', 'Appliance must-haves versus nice-to-haves.'],
      nextSteps: ['Whether the first quote should include utilities, shade, patio changes, or just the kitchen island.', 'Which appliance and counter choices drive the budget most.', 'Whether the kitchen should be phased with hardscape, lighting, or fire features.'],
      ctaHref: '/free-consultation?service=outdoor-kitchens&source=conversion_guide&autostart=1'
    },
    '/pavers-vs-concrete-arizona': {
      eyebrow: 'Material Quote Fit',
      title: 'Choose the Surface After You Understand the Tradeoffs',
      intro: 'This comparison should lead to a better quote conversation: not just pavers versus concrete, but how each option handles cracking, repair, drainage, heat, and finish level.',
      bullets: ['You are replacing or expanding a patio, walkway, driveway edge, or gathering area.', 'You care about repair flexibility, premium finish, or long-term appearance.', 'You need to understand whether concrete savings are worth the visual and repair tradeoffs.'],
      questions: ['Photos of the existing surface, edges, cracks, grade, and nearby walls or steps.', 'Approximate square footage and how the area will be used.', 'Whether the surface needs to tie into fire, seating, lighting, kitchen, or planting zones.'],
      nextSteps: ['A recommendation based on use, finish expectations, and repair tolerance.', 'Which prep items matter before any square-foot price is meaningful.', 'Whether the patio should be quoted alone or with surrounding outdoor-living features.'],
      ctaHref: '/free-consultation?service=hardscaping&source=conversion_guide&autostart=1'
    },
    '/peoria-artificial-turf': {
      eyebrow: 'Turf Quote Fit',
      title: 'Make the Turf Quote About Prep, Drainage, and Real Use',
      intro: 'Artificial turf pricing depends on more than square footage. A useful quote should account for base prep, edges, drainage, heat exposure, pets, play, and how turf meets hardscape.',
      bullets: ['You want a cleaner lawn look without constant watering or patch repair.', 'The area needs to work for pets, kids, curb appeal, or a small putting/play zone.', 'You care about installation quality instead of just the cheapest turf roll.'],
      questions: ['Approximate turf area and whether old grass, rock, concrete, or irrigation must be removed.', 'How the turf will be used: pets, kids, front-yard curb appeal, putting, or low-maintenance green.', 'Photos showing edges, slopes, drainage, and adjacent pavers or planting.'],
      nextSteps: ['A range based on prep, product, drainage, and edge complexity.', 'Whether heat exposure or pet use changes the turf recommendation.', 'How turf should connect to pavers, rock, lighting, or planting beds.'],
      ctaHref: '/free-consultation?city=Peoria&service=artificial-turf&source=conversion_guide&autostart=1'
    },
    '/xeriscape-vs-turf-arizona': {
      eyebrow: 'Yard Strategy Fit',
      title: 'Choose the Yard Strategy Before Choosing Materials',
      intro: 'The right answer is not always turf or xeriscape. The better quote conversation starts with water use, maintenance tolerance, shade, pets, curb appeal, and how the family uses the yard.',
      bullets: ['You are deciding between lower-water planting, artificial turf, or a mixed layout.', 'The current yard feels too hot, too thirsty, too bare, or too much work.', 'You want a plan that looks intentional instead of just replacing grass with rock.'],
      questions: ['Where the yard needs green softness versus where it can be lower-water planting.', 'Pet, kid, HOA, shade, and maintenance requirements.', 'Current irrigation condition and whether grass removal or grading is needed.'],
      nextSteps: ['Whether turf, xeriscape, or a hybrid plan fits the actual use case.', 'Which irrigation and soil-prep changes belong in the first quote.', 'How to phase the project if front yard and backyard priorities differ.'],
      ctaHref: '/free-consultation?service=desert-landscaping&source=conversion_guide&autostart=1'
    },
    '/landscaping-cost-scottsdale': {
      eyebrow: 'Budget Quote Fit',
      title: 'Turn a Rough Budget Into a Scope You Can Compare',
      intro: 'The cost guide should help homeowners avoid fake precision. A quote is most useful when budget, finish level, site conditions, and the first phase are all discussed together.',
      bullets: ['You have a rough budget but are not sure what it realistically buys.', 'The project includes several possible scopes: patio, turf, planting, kitchen, lighting, or shade.', 'You want to compare options without getting trapped by a vague low estimate.'],
      questions: ['A comfortable budget range and the absolute must-have outcome.', 'Photos and rough measurements for the highest-priority area.', 'Whether you want the full yard priced or the strongest first phase priced first.'],
      nextSteps: ['A realistic scope range instead of a misleading single number.', 'Which features should be included, phased, or removed to match the budget.', 'What site conditions could change pricing after an on-site review.'],
      ctaHref: '/free-consultation?source=cost_guide_conversion&autostart=1'
    }
  };
  if (!Object.keys(PAGE_CONVERSION_GUIDES).length) {
    PAGE_CONVERSION_GUIDES = DEFAULT_PAGE_CONVERSION_GUIDES;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = value;
    });
  }

  function setHtml(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.innerHTML = value;
    });
  }

  function normalizePhone(rawValue) {
    return String(rawValue || '').replace(/\D/g, '');
  }

  function toTitleCase(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/(^|[-_\s])([a-z])/g, function (_, prefix, letter) {
        return prefix + letter.toUpperCase();
      });
  }

  function buildStarIcons(ratingValue) {
    var count = Math.max(1, Math.min(5, Number(ratingValue || 5)));
    var icon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.8l2.48 5.03 5.56.81-4.02 3.91.95 5.54L12 16.49l-4.97 2.58.95-5.54-4.02-3.91 5.56-.81L12 3.8z"></path></svg>';
    return new Array(count + 1).join(icon);
  }

  function detectLeadSource() {
    var explicitSource = String(URL_PARAMS.get('source') || '').toLowerCase().trim();
    if (explicitSource) return explicitSource;

    var utmSource = String(URL_PARAMS.get('utm_source') || '').toLowerCase().trim();
    var utmMedium = String(URL_PARAMS.get('utm_medium') || '').toLowerCase().trim();
    var hasGclid = URL_PARAMS.has('gclid');
    var referrer = String(document.referrer || '').toLowerCase();

    if (hasGclid || /cpc|ppc|paid|ads/.test(utmMedium) || /ads|googleads|adwords/.test(utmSource)) {
      return 'ads';
    }
    if (/gbp|google-business|googlebusiness|maps/.test(utmSource)) {
      return 'gbp';
    }
    if (referrer.includes('google.') || utmSource.includes('google')) {
      return 'google';
    }
    return 'website';
  }

  function applyTrackedPhone() {
    var source = detectLeadSource();
    var sourceMap = PHONE_TRACKING.sources || {};
    var defaultTracking = PHONE_TRACKING.default || {};
    var sourceConfig = sourceMap[source] || defaultTracking || PHONE || {};
    var resolvedRaw = normalizePhone(sourceConfig.raw || PHONE.raw || '4809229497');
    var resolvedDisplay = sourceConfig.display || PHONE.display || '(480) 922-9497';

    SITE_PHONE_RAW = resolvedRaw || SITE_PHONE_RAW;
    SITE_PHONE_DISPLAY = resolvedDisplay || SITE_PHONE_DISPLAY;
    DETECTED_LEAD_SOURCE = source || 'website';
  }

  function applyBrandTokens() {
    var root = document.documentElement;
    if (BRAND.primary) root.style.setProperty('--green', BRAND.primary);
    if (BRAND.primaryMid) root.style.setProperty('--green-mid', BRAND.primaryMid);
    if (BRAND.paper) root.style.setProperty('--paper', BRAND.paper);
  }

  function toRootAssetPath(path) {
    var value = String(path || '').trim();
    if (!value) return value;
    if (/^(https?:)?\/\//i.test(value) || value.indexOf('data:') === 0) return value;
    if (value.charAt(0) === '/') return value;
    return '/' + value.replace(/^\.?\//, '');
  }

  function applySiteBranding() {
    applyBrandTokens();

    if (BRAND.logoPath) {
      var resolvedLogoPath = toRootAssetPath(BRAND.logoPath);
      document.querySelectorAll('[data-site-logo]').forEach(function (logo) {
        logo.setAttribute('src', resolvedLogoPath);
      });
    }

    document.querySelectorAll('[data-site-phone-link]').forEach(function (el) {
      el.setAttribute('href', 'tel:' + SITE_PHONE_RAW);
    });
    setText('[data-site-phone-display]', SITE_PHONE_DISPLAY);

    document.querySelectorAll('.nav__call[data-site-phone-link]').forEach(function (el) {
      el.innerHTML =
        '<span class="nav__call-number" data-site-phone-display>' + SITE_PHONE_DISPLAY + '</span>' +
        '<span class="nav__call-label">Call Now</span>';
    });

    document.querySelectorAll('.sticky-bar .btn[data-site-phone-link]').forEach(function (el) {
      el.innerHTML =
        '<span class="sticky-bar__phone-number" data-site-phone-display>' + SITE_PHONE_DISPLAY + '</span>' +
        '<span class="sticky-bar__phone-label">Call Now</span>';
    });

    document.querySelectorAll('[data-site-email-link]').forEach(function (el) {
      el.setAttribute('href', 'mailto:' + SITE_EMAIL);
    });
    setText('[data-site-email-display]', SITE_EMAIL);

    setText('[data-site-address-line1]', SITE_ADDRESS_LINE1);
    setText('[data-site-city]', SITE_CITY);
    setText('[data-site-state]', SITE_STATE);
    setText('[data-site-zip]', SITE_ZIP);
    setText('[data-site-name]', SITE_NAME);
    setText('[data-site-year]', String(new Date().getFullYear()));

    var cityField = document.getElementById('city');
    if (cityField && !cityField.value) {
      cityField.setAttribute('placeholder', SITE_CITY);
    }
  }

  function ensureFooterServiceLinks() {
    var desertHref = '/services/desert-landscaping';
    var lightingHref = '/services/outdoor-lighting';
    document.querySelectorAll('.footer__col').forEach(function (column) {
      var heading = column.querySelector('h4');
      var list = column.querySelector('ul');
      if (!heading || !list) return;
      if (String(heading.textContent || '').trim().toLowerCase() !== 'services') return;

      if (!list.querySelector('a[href*="desert-landscaping"]')) {
        var desertItem = document.createElement('li');
        var desertLink = document.createElement('a');
        desertLink.href = desertHref;
        desertLink.textContent = 'Desert Landscaping';
        desertItem.appendChild(desertLink);

        var referenceItem = list.querySelector('a[href*="artificial-turf"]');
        if (referenceItem && referenceItem.parentElement) {
          referenceItem.parentElement.insertAdjacentElement('beforebegin', desertItem);
        } else {
          list.appendChild(desertItem);
        }
      }

      if (!list.querySelector('a[href*="outdoor-lighting"]')) {
        var lightingItem = document.createElement('li');
        var lightingLink = document.createElement('a');
        lightingLink.href = lightingHref;
        lightingLink.textContent = 'Outdoor Lighting';
        lightingItem.appendChild(lightingLink);
        list.appendChild(lightingItem);
      }
    });
  }

  function ensureFooterStudioLinks() {
    document.querySelectorAll('.footer__col').forEach(function (column) {
      var heading = column.querySelector('h4');
      var list = column.querySelector('ul');
      if (!heading || !list) return;
      if (String(heading.textContent || '').trim().toLowerCase() !== 'studio') return;

      var desiredLinks = [
        { href: '/about', label: 'About' },
        { href: '/process', label: 'Process' },
        { href: '/reviews', label: 'Reviews' },
        { href: '/financing', label: 'Financing' },
        { href: '/free-consultation', label: 'Project Review' }
      ];

      desiredLinks.forEach(function (entry) {
        var existing = Array.prototype.slice.call(list.querySelectorAll('a')).find(function (link) {
          return String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === entry.label.toLowerCase();
        });

        if (existing) {
          existing.setAttribute('href', entry.href);
          return;
        }

        var item = document.createElement('li');
        var link = document.createElement('a');
        link.href = entry.href;
        link.textContent = entry.label;
        item.appendChild(link);
        list.appendChild(item);
      });
    });
  }

  function ensureFooterResourceLinks() {
    document.querySelectorAll('.footer__col').forEach(function (column) {
      var heading = column.querySelector('h4');
      var list = column.querySelector('ul');
      if (!heading || !list) return;

      var headingText = String(heading.textContent || '').trim().toLowerCase();
      if (headingText !== 'resources' && headingText !== 'related pages') return;

      var desiredLinks = [
        { href: '/financing', label: 'Financing' },
        { href: '/warranty', label: 'Warranty' },
        { href: '/faq', label: 'FAQ' },
        { href: '/cost-calculator', label: 'Cost Calculator' }
      ];

      desiredLinks.forEach(function (entry) {
        var existing = Array.prototype.slice.call(list.querySelectorAll('a')).find(function (link) {
          return String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === entry.label.toLowerCase();
        });

        if (existing) {
          existing.setAttribute('href', entry.href);
          return;
        }

        var item = document.createElement('li');
        var link = document.createElement('a');
        link.href = entry.href;
        link.textContent = entry.label;
        item.appendChild(link);
        list.appendChild(item);
      });
    });
  }

  function ensurePrimaryNavigationLinks() {
    var navContainers = document.querySelectorAll('.nav__links, .nav__overlay nav');
    if (!navContainers.length) return;

    navContainers.forEach(function (nav) {
      var navClass = nav.classList.contains('nav__links') ? 'nav__link' : 'nav__overlay-link';
      var navItems = Array.prototype.slice.call(nav.querySelectorAll('a'));
      var contactLink = navItems.find(function (link) {
        return String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'contact';
      }) || null;
      var financingLink = navItems.find(function (link) {
        return String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'financing';
      }) || null;
      var processLink = navItems.find(function (link) {
        return String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'process';
      }) || null;
      var aboutLink = navItems.find(function (link) {
        return String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'about';
      }) || null;
      var consultationLink = navItems.find(function (link) {
        return /consultation/i.test(String(link.textContent || ''));
      }) || null;

      if (processLink) {
        processLink.setAttribute('href', '/process');
      }

      if (aboutLink) {
        aboutLink.setAttribute('href', '/about');
      }

      if (FINANCING.enabled !== false) {
        if (financingLink) {
          financingLink.setAttribute('href', '/financing');
        } else {
          financingLink = document.createElement('a');
          financingLink.className = navClass;
          financingLink.href = '/financing';
          financingLink.textContent = 'Financing';

          if (contactLink && contactLink.parentElement === nav) {
            contactLink.insertAdjacentElement('beforebegin', financingLink);
          } else if (consultationLink && consultationLink.parentElement === nav) {
            consultationLink.insertAdjacentElement('beforebegin', financingLink);
          } else {
            nav.appendChild(financingLink);
          }
        }
      }
    });
  }

  function renderFooterSocialLinks() {
    if (!SOCIAL_PROFILES.length) return;

    document.querySelectorAll('.footer__brand').forEach(function (brand) {
      if (!brand || brand.querySelector('.footer__social')) return;

      var socialWrap = document.createElement('div');
      socialWrap.className = 'footer__social';
      socialWrap.setAttribute('aria-label', 'Social profiles');

      SOCIAL_PROFILES.forEach(function (profile) {
        if (!profile || !profile.footerLabel) return;

        var label = escapeHtml(profile.footerLabel || profile.label || 'Social profile');
        var iconMarkup = '<span class="footer__social-icon" aria-hidden="true">' + getFooterSocialIcon(profile.icon || profile.label) + '</span>';

        if (profile.isPlaceholder || !profile.url) {
          var badge = document.createElement('span');
          badge.className = 'footer__social-link footer__social-link--placeholder';
          badge.setAttribute('role', 'img');
          badge.setAttribute('aria-label', label + ' profile coming soon');
          badge.innerHTML = iconMarkup;
          socialWrap.appendChild(badge);
          return;
        }

        var link = document.createElement('a');
        link.className = 'footer__social-link';
        link.href = profile.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', label);
        link.innerHTML =
          '<span class="footer__social-icon" aria-hidden="true">' + getFooterSocialIcon(profile.icon || profile.label) + '</span>';
        socialWrap.appendChild(link);
      });

      brand.appendChild(socialWrap);
    });
  }

  function renderFooterMeta() {
    var footerConfig = SITE_CONFIG.footer || {};
    var businessHours = SITE_CONFIG.businessHours || {};
    var address = SITE_CONFIG.address || {};
    var hoursText = [businessHours.weekday, businessHours.saturday, businessHours.sunday]
      .filter(Boolean)
      .join(' · ');
    var reviewLabel = String(footerConfig.reviewLabel || 'Read Google reviews').trim();
    var reviewUrl = String(footerConfig.reviewUrl || REVIEW_SOURCE_URL || '').trim();
    var blurb = String(
      footerConfig.blurb ||
        'Premium landscape design and construction for Scottsdale, Paradise Valley, Phoenix, and nearby Valley communities.'
    ).trim();
    var note = String(footerConfig.note || 'Arizona licensed, bonded, and insured team').trim();
    var reviewSummary = getReviewPresentationCopy(REVIEW_STATE).summary;
    var phoneDisplay = String(SITE_PHONE_DISPLAY || '').trim();
    var phoneRaw = String(SITE_PHONE_RAW || '').trim();
    var addressParts = [
      String(address.line1 || SITE_ADDRESS_LINE1 || '').trim(),
      [address.city || SITE_CITY, address.state || SITE_STATE, address.zip || SITE_ZIP].filter(Boolean).join(' ')
    ].filter(Boolean);
    var addressText = addressParts.join(', ');
    var addressUrl = addressText ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addressText) : '';

    document.querySelectorAll('.footer').forEach(function (footer) {
      var brand = footer.querySelector('.footer__brand');
      if (brand) {
        var brandCopy = brand.querySelector(':scope > p');
        if (brandCopy && blurb) {
          brandCopy.textContent = blurb;
        }

        var license = brand.querySelector('.footer__license');
        if (!license && note) {
          license = document.createElement('p');
          license.className = 'footer__license';
          brand.appendChild(license);
        }
        if (license && note) {
          license.textContent = note;
        }

        var meta = brand.querySelector('.footer__meta');
        if (!meta && (hoursText || reviewUrl || phoneRaw || addressText)) {
          meta = document.createElement('div');
          meta.className = 'footer__meta';

          if (hoursText) {
            var hours = document.createElement('p');
            hours.className = 'footer__meta-item';
            hours.textContent = hoursText;
            meta.appendChild(hours);
          }

          if (phoneRaw) {
            var phoneLine = document.createElement('p');
            phoneLine.className = 'footer__meta-item footer__meta-item--contact';
            var phoneLink = document.createElement('a');
            phoneLink.href = 'tel:' + phoneRaw;
            phoneLink.textContent = phoneDisplay || SITE_PHONE_DISPLAY || phoneRaw;
            phoneLink.setAttribute('aria-label', 'Call ' + (phoneDisplay || SITE_PHONE_DISPLAY || phoneRaw));
            phoneLine.appendChild(document.createTextNode('Call '));
            phoneLine.appendChild(phoneLink);
            meta.appendChild(phoneLine);
          }

          if (addressText) {
            var addressLine = document.createElement('p');
            addressLine.className = 'footer__meta-item footer__meta-item--contact';
            if (addressUrl) {
              var addressLink = document.createElement('a');
              addressLink.href = addressUrl;
              addressLink.target = '_blank';
              addressLink.rel = 'noopener noreferrer';
              addressLink.textContent = addressText;
              addressLink.setAttribute('aria-label', 'Open office location in Google Maps');
              addressLine.appendChild(addressLink);
            } else {
              addressLine.textContent = addressText;
            }
            meta.appendChild(addressLine);
          }

          if (reviewUrl) {
            var reviewLink = document.createElement('a');
            reviewLink.className = 'footer__meta-link';
            reviewLink.href = reviewUrl;
            reviewLink.target = '_blank';
            reviewLink.rel = 'noopener noreferrer';
            reviewLink.textContent = reviewLabel;
            reviewLink.setAttribute('aria-label', reviewLabel + ' on Google Maps');

            var reviewLine = document.createElement('p');
            reviewLine.className = 'footer__meta-item';
            reviewLine.textContent = reviewSummary;
            reviewLine.appendChild(document.createTextNode(' · '));
            reviewLine.appendChild(reviewLink);
            meta.appendChild(reviewLine);
          }

          brand.appendChild(meta);
        }
      }
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getFooterSocialIcon(label) {
    var key = String(label || '').trim().toLowerCase();
    var icons = {
      reviews: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.7l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8z"/></svg>',
      facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.6 1.6-1.6h1.4V4.8c-.2 0-1-.1-2-.1-2 0-3.4 1.2-3.4 3.6V11H8.8v3H11v7z"/></svg>',
      yelp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.2 3.3c.7-.1 1.3.3 1.4 1l.7 4.7c.1.7-.3 1.2-1 1.4-.7.1-1.2-.2-1.4-.9l-1.3-4.6c-.2-.8.2-1.4 1-1.6zM6 7.5c.5-.4 1.2-.4 1.7 0l3.3 2.7c.5.4.6 1.1.2 1.7-.4.6-1 .8-1.6.5L5.8 11c-.7-.3-1-.9-.8-1.6.1-.7.5-1.4 1-1.9zm12.7 3c.3.7 0 1.3-.6 1.7l-4.2 1.9c-.6.3-1.3 0-1.6-.6-.3-.7-.1-1.3.5-1.7l3.8-2.4c.6-.4 1.3-.2 1.8.3.3.2.4.5.3.8zm-8.2 4.2c.7.2 1.1.8.9 1.5l-1 4.6c-.2.7-.8 1-1.5.8-.7-.2-1.1-.8-.9-1.5l.4-4.7c.1-.7.7-1.1 1.4-1 .2 0 .5.1.7.3zm5 .7c.4.6.3 1.3-.3 1.7l-3.8 2.3c-.6.4-1.3.2-1.7-.4-.4-.6-.3-1.3.3-1.7l4.2-1.8c.6-.3 1.3-.1 1.7.5.1.1.1.2.1.4z"/></svg>',
      google: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5c-.2 1.2-.9 2.3-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.4z"/><path d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.8 19.8 8.1 22 12 22z"/><path d="M6.4 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.3.3-1.8V7.6H3.1C2.4 9 2 10.5 2 12s.4 3 1.1 4.4l3.3-2.6z"/><path d="M12 6.1c1.5 0 2.9.5 4 1.6l3-3C17 2.9 14.7 2 12 2 8.1 2 4.8 4.2 3.1 7.6l3.3 2.6C7.2 7.9 9.4 6.1 12 6.1z"/></svg>',
      instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2.2A2.8 2.8 0 004.2 7v10A2.8 2.8 0 007 19.8h10a2.8 2.8 0 002.8-2.8V7A2.8 2.8 0 0017 4.2H7zm5 2.3A5.5 5.5 0 1111.9 17 5.5 5.5 0 0112 6.5zm0 2.2a3.3 3.3 0 103.3 3.3A3.3 3.3 0 0012 8.7zm5.7-3.2a1.3 1.3 0 11-1.3 1.3 1.3 1.3 0 011.3-1.3z"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 3H22l-6.8 7.7 8 10.3h-6.3l-4.9-6.4L6.4 21H3.3l7.3-8.3L3 3h6.4l4.4 5.8L18.9 3zm-1.1 16h1.7L8.5 4.9H6.7L17.8 19z"/></svg>',
      youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.9 2.9 0 00-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.9 2.9 0 00-2 2A30.7 30.7 0 002 12a30.7 30.7 0 00.4 4.8 2.9 2.9 0 002 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.9 2.9 0 002-2A30.7 30.7 0 0022 12a30.7 30.7 0 00-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z"/></svg>',
      linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.9 8.5A1.9 1.9 0 116.9 4.7a1.9 1.9 0 010 3.8zM5 10h3.8v9H5zm6.1 0h3.6v1.2h.1a4 4 0 013.6-2c3.8 0 4.5 2.5 4.5 5.8v4h-3.8v-3.6c0-.9 0-2.1-1.3-2.1s-1.5 1-1.5 2v3.7h-3.8z"/></svg>'
    };
    return icons[key] || icons.reviews;
  }

  function applyContactFormServices() {
    var configuredServices = SITE_CONFIG.contactFormServices;
    var selects = document.querySelectorAll('[data-service-select]');
    if (!selects.length || !Array.isArray(configuredServices) || !configuredServices.length) return;

    selects.forEach(function (select) {
      var currentValue = String(select.value || '').trim();
      select.innerHTML = '';

      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select a project type…';
      select.appendChild(placeholder);

      configuredServices.forEach(function (service) {
        var option = document.createElement('option');
        option.value = String(service);
        option.textContent = String(service);
        select.appendChild(option);
      });

      if (currentValue) {
        Array.from(select.options).some(function (option) {
          var match = option.value.toLowerCase() === currentValue.toLowerCase();
          if (match) select.value = option.value;
          return match;
        });
      }
    });
  }

  function applyProjectFitCards() {
    var fitGrid = document.querySelector('.project-fit__grid');
    var configuredFit = SITE_CONFIG.projectFit;
    if (!fitGrid || !Array.isArray(configuredFit) || !configuredFit.length) return;

    fitGrid.innerHTML = '';

    configuredFit.forEach(function (item) {
      var article = document.createElement('article');
      article.className = 'fit-card reveal';

      var label = document.createElement('p');
      label.className = 'fit-card__label';
      label.textContent = item.label || 'Project Type';

      var title = document.createElement('h3');
      title.textContent = item.title || 'Landscape Project';

      var description = document.createElement('p');
      description.textContent = item.description || 'Tell us what you want to build and we will help you map the next step.';

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'fit-card__action';
      button.setAttribute('data-service-choice', item.ctaService || item.title || 'Not sure yet');
      button.textContent = OFFER_LABEL;

      article.appendChild(label);
      article.appendChild(title);
      article.appendChild(description);
      article.appendChild(button);
      fitGrid.appendChild(article);
    });
  }

  function applyBeforeAfterContent() {
    var data = SITE_CONFIG.beforeAfter || {};
    var afterImage = document.querySelector('[data-before-after-after-image]');
    var beforeImage = document.querySelector('[data-before-after-before-image]');
    var note = document.querySelector('[data-before-after-note]');

    if (afterImage && data.afterImage) {
      afterImage.setAttribute('src', data.afterImage);
      if (data.afterAlt) afterImage.setAttribute('alt', data.afterAlt);
    }

    if (beforeImage && data.beforeImage) {
      beforeImage.setAttribute('src', data.beforeImage);
      if (data.beforeAlt) beforeImage.setAttribute('alt', data.beforeAlt);
    }

    if (note && data.note) {
      note.textContent = data.note;
    }
  }

  function getReviewState() {
    return REVIEW_STATE;
  }

  function setReviewState(nextState) {
    if (!nextState) return;
    REVIEW_STATE = Object.assign({}, REVIEW_STATE, {
      rating: String(nextState.rating || nextState.reviewSummaryRating || REVIEW_STATE.rating || '').trim(),
      count: String(nextState.count || nextState.reviewCount || REVIEW_STATE.count || '').trim(),
      source: String(nextState.source || nextState.platform || REVIEW_STATE.source || 'Google').trim(),
      sourceUrl: String(nextState.sourceUrl || nextState.profileUrl || REVIEW_STATE.sourceUrl || '').trim(),
      snapshotDate: String(nextState.snapshotDate || nextState.updatedAt || REVIEW_STATE.snapshotDate || '').trim(),
      live: Boolean(nextState.live)
    });
  }

  function getReviewPresentationCopy(state) {
    var currentState = state || getReviewState();
    var rating = String(currentState.rating || '').trim();
    var count = String(currentState.count || '').trim();
    var source = String(currentState.source || 'Google').trim() || 'Google';
    var live = Boolean(currentState.live);

    if (live) {
      if (rating && count) {
        return {
          summary: rating + '-star ' + source + ' rating across ' + count + ' reviews',
          badge: 'Live Google reviews',
          dateText: 'Live from Google Business Profile'
        };
      }
      if (rating) {
        return {
          summary: rating + '-star ' + source + ' rating',
          badge: 'Live Google reviews',
          dateText: 'Live from Google Business Profile'
        };
      }
      if (count) {
        return {
          summary: count + ' reviews on ' + source,
          badge: 'Live Google reviews',
          dateText: 'Live from Google Business Profile'
        };
      }

      return {
        summary: 'Read recent homeowner feedback on ' + source,
        badge: 'Live Google reviews',
        dateText: 'Live from Google Business Profile'
      };
    }

    if (rating && count) {
      return {
        summary: source + ' review source: ' + rating + '-star rating across ' + count + ' reviews',
        badge: 'Google review source',
        dateText: currentState.snapshotDate ? String(currentState.snapshotDate) : 'Recent review source'
      };
    }
    if (rating) {
      return {
        summary: source + ' review source: ' + rating + '-star rating',
        badge: 'Google review source',
        dateText: currentState.snapshotDate ? String(currentState.snapshotDate) : 'Recent review source'
      };
    }
    if (count) {
      return {
        summary: source + ' review source: ' + count + ' reviews',
        badge: 'Google review source',
        dateText: currentState.snapshotDate ? String(currentState.snapshotDate) : 'Recent review source'
      };
    }

    return {
      summary: source + ' review source',
      badge: 'Google review source',
      dateText: currentState.snapshotDate ? String(currentState.snapshotDate) : 'Recent review source'
    };
  }

  function updateReviewPresentationTexts() {
    var state = getReviewState();
    var rating = String(state.rating || '').trim();
    var count = String(state.count || '').trim();
    var source = String(state.source || 'Google').trim() || 'Google';
    var copy = getReviewPresentationCopy(state);

    if (copy.summary) {
      setText('[data-google-reviews-summary]', copy.summary);
    }

    if (copy.dateText) {
      setText('[data-google-reviews-date]', copy.dateText);
    }

    var profileUrl = state.sourceUrl;
    if (profileUrl) {
      document.querySelectorAll('[data-google-reviews-link], [data-review-feed-link]').forEach(function (link) {
        link.setAttribute('href', profileUrl);
      });
    }

    document.querySelectorAll('[data-review-rating]').forEach(function (el) {
      el.textContent = rating || 'Google';
    });
    document.querySelectorAll('[data-review-count]').forEach(function (el) {
      el.textContent = count || 'recent';
    });
    document.querySelectorAll('[data-review-source]').forEach(function (el) {
      el.textContent = source;
    });
    document.querySelectorAll('[data-review-state-label]').forEach(function (el) {
      el.textContent = state.live ? '' : 'Cached snapshot: ';
    });
    document.querySelectorAll('[data-review-live-badge]').forEach(function (el) {
      el.textContent = copy.badge;
    });
  }

  function normalizeLiveGoogleReview(review) {
    var author = review && review.authorAttribution ? review.authorAttribution : {};
    var publishTime = review && (review.relativePublishTimeDescription || review.publishTime || review.relativePublishTime || '');
    var text = String(review && (review.text || review.originalText || '') || '').trim();

    return {
      rating: Number(review && review.rating) || 5,
      text: text,
      ratingOnly: Boolean(review && review.ratingOnly),
      author: String(review && review.author || author.displayName || 'Google reviewer').trim(),
      authorUrl: String(review && review.authorUrl || author.uri || '').trim(),
      authorPhoto: String(review && review.authorPhoto || author.photoUri || author.photoURI || '').trim(),
      location: String(review && review.location || '').trim(),
      projectType: String(review && review.projectType || 'Google review').trim(),
      reviewDate: String(review && review.reviewDate || publishTime || 'Recent review').trim(),
      sourceUrl: String(review && (review.sourceUrl || review.googleMapsUri || review.reviewUri) || '').trim()
    };
  }

  function renderReviewCards(reviews) {
    var grid = document.getElementById('reviews-grid');
    var reviewList = Array.isArray(reviews) ? reviews.filter(function (review) {
      return review && (String(review.text || review.originalText || '').trim() || review.ratingOnly);
    }) : [];
    if (!grid) return;

    var existingPagination = grid.parentNode && grid.parentNode.querySelector('[data-reviews-pagination]');
    if (existingPagination) existingPagination.remove();
    grid.innerHTML = '';

    if (!reviewList.length) {
      var empty = document.createElement('article');
      empty.className = 'review-card review-card--notice';
      empty.innerHTML = '<p class="review-card__text">Google review details load from the official review feed when available. Use the review profile link above to read current Google feedback directly.</p>';
      grid.appendChild(empty);
      return;
    }

    var isReviewsPage = document.body && document.body.classList && document.body.classList.contains('reviews-page');
    var displayList = isReviewsPage ? reviewList : reviewList.filter(function (review) {
      var rating = Number(review.rating || 0);
      var hasWrittenText = String(review.text || review.originalText || '').trim();
      return rating === 5 && hasWrittenText;
    }).slice(0, 3);

    function createReviewCard(review, index) {
      var sourceUrl = String(review.sourceUrl || review.googleMapsUri || review.reviewUri || '').trim();
      var article = document.createElement('article');
      article.className = 'review-card reveal is-visible';
      if (review.ratingOnly) article.className += ' review-card--rating-only';

      var stars = document.createElement('div');
      stars.className = 'review-card__stars';
      var rating = Number(review.rating || 5);
      stars.innerHTML = buildStarIcons(rating);
      stars.setAttribute('data-rating', String(Math.max(1, Math.min(5, rating)).toFixed(1)));
      stars.setAttribute('role', 'img');
      stars.setAttribute('aria-label', 'Rated ' + stars.getAttribute('data-rating') + ' out of 5');

      var text = document.createElement('p');
      text.className = 'review-card__text';
      var reviewText = review.text || review.originalText || 'Rating-only Google review. No written comment was shown on the public Google profile.';
      if (!isReviewsPage && reviewText.length > 420) {
        var reviewSummary = reviewText.slice(0, 417);
        var finalSpace = reviewSummary.lastIndexOf(' ');
        text.textContent = reviewSummary.slice(0, finalSpace > 320 ? finalSpace : 417).trim() + '...';
      } else {
        text.textContent = reviewText;
      }
      if (isReviewsPage) text.id = 'review-text-' + index;

      var meta = document.createElement('p');
      meta.className = 'review-card__meta';

      var author = document.createElement('strong');
      var authorName = review.author || 'Homeowner Review';
      author.textContent = authorName;

      var location = document.createElement('span');
      var metaParts = [
        review.location || REVIEW_STATE.source || 'Google',
        review.projectType || 'Google review',
        review.reviewDate || 'Recent review'
      ].filter(Boolean);
      location.textContent = metaParts.join(' · ');

      meta.appendChild(author);
      meta.appendChild(location);

      if (sourceUrl) {
        var sourceLink = document.createElement('a');
        sourceLink.className = 'review-card__source';
        sourceLink.href = sourceUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        sourceLink.textContent = 'Open in Google Maps';
        meta.appendChild(sourceLink);
      }

      article.appendChild(stars);
      article.appendChild(text);

      if (isReviewsPage && !review.ratingOnly && reviewText.length > 420) {
        text.classList.add('is-collapsed');

        var textToggle = document.createElement('button');
        textToggle.type = 'button';
        textToggle.className = 'review-card__toggle';
        textToggle.textContent = 'Read full review';
        textToggle.setAttribute('aria-expanded', 'false');
        textToggle.setAttribute('aria-controls', text.id);
        textToggle.setAttribute('aria-label', 'Read full review by ' + authorName);
        textToggle.addEventListener('click', function () {
          var isExpanded = textToggle.getAttribute('aria-expanded') === 'true';
          var nextExpanded = !isExpanded;
          textToggle.setAttribute('aria-expanded', String(nextExpanded));
          textToggle.setAttribute('aria-label', (nextExpanded ? 'Show less of' : 'Read full') + ' review by ' + authorName);
          textToggle.textContent = nextExpanded ? 'Show less' : 'Read full review';
          text.classList.toggle('is-collapsed', !nextExpanded);
        });
        article.appendChild(textToggle);
      }

      article.appendChild(meta);
      return article;
    }

    if (!isReviewsPage) {
      displayList.forEach(function (review, index) {
        grid.appendChild(createReviewCard(review, index));
      });
      return;
    }

    var reviewsPerBatch = 6;
    var renderedReviewCount = 0;
    var pagination = document.createElement('div');
    pagination.className = 'reviews-page__pagination';
    pagination.setAttribute('data-reviews-pagination', '');

    var paginationStatus = document.createElement('p');
    paginationStatus.className = 'reviews-page__status';
    paginationStatus.id = 'reviews-page-status';
    paginationStatus.setAttribute('role', 'status');
    paginationStatus.setAttribute('aria-live', 'polite');

    var showMore = document.createElement('button');
    showMore.type = 'button';
    showMore.className = 'reviews-page__more';
    showMore.setAttribute('aria-controls', grid.id);
    showMore.setAttribute('aria-describedby', paginationStatus.id);

    function updatePagination() {
      var remaining = displayList.length - renderedReviewCount;
      paginationStatus.textContent = 'Showing ' + renderedReviewCount + ' of ' + displayList.length + ' reviews.';
      if (remaining > 0) {
        var nextCount = Math.min(reviewsPerBatch, remaining);
        showMore.disabled = false;
        showMore.textContent = 'Show next ' + nextCount + ' reviews';
      } else {
        showMore.disabled = true;
        showMore.textContent = 'All reviews shown';
      }
    }

    function appendNextReviewBatch() {
      var nextEnd = Math.min(renderedReviewCount + reviewsPerBatch, displayList.length);
      for (var index = renderedReviewCount; index < nextEnd; index += 1) {
        grid.appendChild(createReviewCard(displayList[index], index));
      }
      renderedReviewCount = nextEnd;
      updatePagination();
    }

    showMore.addEventListener('click', appendNextReviewBatch);
    pagination.appendChild(paginationStatus);
    pagination.appendChild(showMore);
    grid.insertAdjacentElement('afterend', pagination);
    appendNextReviewBatch();
  }

  function applyGoogleReviewSnapshot() {
    updateReviewPresentationTexts();
  }

  async function loadLiveGoogleReviews() {
    if (!REVIEW_FEED_ENDPOINT) return false;

    var hasReviewTargets = !!document.getElementById('reviews-grid') ||
      !!document.querySelector('[data-google-reviews-summary]') ||
      !!document.querySelector('[data-review-live-badge]');
    if (!hasReviewTargets) return false;

    try {
      var response = await fetch(REVIEW_FEED_ENDPOINT, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) return false;

      var payload = await response.json();
      if (!payload || payload.ok === false) return false;

      setReviewState({
        rating: payload.rating,
        count: payload.reviewCount,
        source: payload.source || 'Google',
        sourceUrl: payload.profileUrl,
        snapshotDate: payload.snapshotDate,
        live: Boolean(payload.live)
      });

      updateReviewPresentationTexts();

      if (Array.isArray(payload.reviews) && payload.reviews.length) {
        renderReviewCards(payload.reviews.map(normalizeLiveGoogleReview));
      }

      renderFooterMeta();

      if (payload.placeName) {
        document.querySelectorAll('[data-google-reviews-source-name]').forEach(function (node) {
          node.textContent = payload.placeName;
        });
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  function applyTrustAssets() {
    var licenseUrl = String(TRUST_ASSETS.licenseVerifyUrl || '').trim();
    var bondUrl = String(TRUST_ASSETS.bondVerifyUrl || '').trim();
    var insuranceCopy = String(TRUST_ASSETS.insuranceStatement || '').trim();
    var licenseNumbers = Array.isArray(TRUST_ASSETS.licenseNumbers)
      ? TRUST_ASSETS.licenseNumbers.map(function (value) { return String(value || '').trim(); }).filter(Boolean)
      : [];

    if (licenseUrl) {
      document.querySelectorAll('[data-license-verify-link]').forEach(function (link) {
        link.setAttribute('href', licenseUrl);
        link.removeAttribute('aria-disabled');
        link.classList.remove('is-disabled');
        link.hidden = false;
      });
    } else {
      document.querySelectorAll('[data-license-verify-link]').forEach(function (link) {
        link.removeAttribute('href');
        link.removeAttribute('aria-disabled');
        link.classList.add('is-disabled');
        link.hidden = true;
      });
    }

    var licensePrompt = String(TRUST_ASSETS.licensePrompt || '').trim();
    if (licensePrompt) {
      setText('[data-license-verify-text]', licensePrompt);
    }
    if (licenseNumbers.length) {
      setText('[data-license-numbers]', 'Arizona ROC license numbers: ' + licenseNumbers.join(' · '));
    }

    if (bondUrl) {
      document.querySelectorAll('[data-bond-verify-link]').forEach(function (link) {
        link.setAttribute('href', bondUrl);
        link.removeAttribute('aria-disabled');
        link.classList.remove('is-disabled');
        link.hidden = false;
      });
    } else {
      document.querySelectorAll('[data-bond-verify-link]').forEach(function (link) {
        link.removeAttribute('href');
        link.removeAttribute('aria-disabled');
        link.classList.add('is-disabled');
        link.hidden = true;
      });
    }

    var bondPrompt = String(TRUST_ASSETS.bondPrompt || '').trim();
    if (bondPrompt) {
      setText('[data-bond-verify-text]', bondPrompt);
    }

    if (insuranceCopy) {
      setText('[data-insurance-statement]', insuranceCopy);
    }

    var responsePromise = String(TRUST_ASSETS.responsePromise || '').trim();
    if (responsePromise) {
      setText('[data-response-promise-copy]', responsePromise);
    }

    var warrantyCopy = String(TRUST_ASSETS.workmanshipWarranty || '').trim();
    if (warrantyCopy) {
      setText('[data-workmanship-warranty]', warrantyCopy);
    }

    if (BUSINESS_YEARS) {
      setText('[data-business-years]', BUSINESS_YEARS);
    }

    var trustHighlights = Array.isArray(TRUST_ASSETS.trustHighlights)
      ? TRUST_ASSETS.trustHighlights.map(function (item) { return String(item || '').trim(); }).filter(Boolean)
      : [];
    if (trustHighlights.length) {
      setHtml('[data-trust-highlights]', trustHighlights.map(function (item) {
        return '<li>' + item + '</li>';
      }).join(''));
    }
  }

  function injectLocationBusinessSchema() {
    var pathname = normalizedPath || '/';
    var locationMap = {
      '/scottsdale-landscaping': { city: 'Scottsdale', name: 'Scottsdale Landscaping' },
      '/phoenix-landscaping': { city: 'Phoenix', name: 'Phoenix Landscaping' },
      '/paradise-valley-landscaping': { city: 'Paradise Valley', name: 'Paradise Valley Landscaping' },
      '/arcadia-landscaping': { city: 'Arcadia', name: 'Arcadia Landscaping' },
      '/mesa-landscaping': { city: 'Mesa', name: 'Mesa Landscaping' },
      '/chandler-landscaping': { city: 'Chandler', name: 'Chandler Landscaping' },
      '/tempe-landscaping': { city: 'Tempe', name: 'Tempe Landscaping' },
      '/gilbert-landscaping': { city: 'Gilbert', name: 'Gilbert Landscaping' },
      '/fountain-hills-landscaping': { city: 'Fountain Hills', name: 'Fountain Hills Landscaping' },
      '/cave-creek-landscaping': { city: 'Cave Creek', name: 'Cave Creek Landscaping' }
    };

    var locationData = locationMap[pathname];
    if (!locationData) return;

    var schema = {
      '@context': 'https://schema.org',
      '@type': 'HomeAndConstructionBusiness',
      '@id': (SITE_CONFIG.siteBaseUrl || window.location.origin) + pathname + '#local-business',
      name: SITE_NAME + ' - ' + locationData.name,
      url: (SITE_CONFIG.siteBaseUrl || window.location.origin) + pathname,
      telephone: '+1-' + SITE_PHONE_RAW,
      areaServed: locationData.city,
      address: {
        '@type': 'PostalAddress',
        streetAddress: SITE_ADDRESS_LINE1,
        addressLocality: SITE_CITY,
        addressRegion: SITE_STATE,
        postalCode: SITE_ZIP,
        addressCountry: 'US'
      }
    };

    var existing = document.getElementById('location-business-schema');
    if (existing) existing.remove();
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'location-business-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  function enhanceAccessibilityAndMedia() {
    var notices = document.querySelectorAll('#form-success, #form-error, [data-resource-gate-success], [data-resource-gate-error]');
    notices.forEach(function (notice) {
      notice.setAttribute('aria-live', 'polite');
      notice.setAttribute('role', notice.id && notice.id.indexOf('error') >= 0 ? 'alert' : 'status');
      if (!notice.hasAttribute('tabindex')) {
        notice.setAttribute('tabindex', '-1');
      }
    });

    document.querySelectorAll('main img, .footer img').forEach(function (img) {
      if (!img.hasAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
      }
      if (!img.hasAttribute('loading') && !img.closest('.nav__logo') && !img.classList.contains('nav__logo-img')) {
        img.setAttribute('loading', 'lazy');
      }
    });
  }

  function injectLocationProofPanels() {
    var locationData = LOCATION_PAGES[normalizedPath];
    if (!locationData) return;

    var targetSection = document.querySelector('.page-section--alt[id$="-consultation"]');
    if (!targetSection || targetSection.querySelector('[data-location-proof-panel]')) return;

    var trustBullets = Array.isArray(locationData.trustBullets) ? locationData.trustBullets : [];
    var proofBlock = document.createElement('div');
    proofBlock.className = 'local-proof reveal';
    proofBlock.setAttribute('data-location-proof-panel', 'true');
    var reviewCopy = getReviewPresentationCopy(REVIEW_STATE);
    proofBlock.innerHTML = '' +
      '<div class="local-proof__intro">' +
      '  <p class="eyebrow">Local Proof</p>' +
      '  <h3>Why ' + locationData.city + ' homeowners use Think Green</h3>' +
      '  <p>Licensed Arizona landscape contractor support, visible Google review proof, and a quote-first process for ' + locationData.nearbyAreas + '.</p>' +
      '</div>' +
      '<div class="local-proof__grid">' +
      '  <article class="local-proof__card local-proof__card--review">' +
      '    <p class="local-proof__label"><span data-review-state-label>' + (REVIEW_STATE.live ? '' : 'Cached snapshot: ') + '</span><span data-review-rating>' + REVIEW_STATE.rating + '</span>-star <span data-review-source>' + REVIEW_STATE.source + '</span> rating across <span data-review-count>' + REVIEW_STATE.count + '</span> reviews</p>' +
      '    <p class="reviews__proof"><span data-review-live-badge>' + reviewCopy.badge + '</span></p>' +
      '    <blockquote>Open the Google review profile to read homeowner feedback directly from the source before you start a project review.</blockquote>' +
      '    <p class="local-proof__meta"><a href="' + REVIEW_STATE.sourceUrl + '" target="_blank" rel="noopener noreferrer" data-review-feed-link>Read Google reviews</a></p>' +
      '  </article>' +
      '  <article class="local-proof__card">' +
      '    <p class="local-proof__label">What usually matters most</p>' +
      '    <ul>' + trustBullets.map(function (item) { return '<li>' + item + '</li>'; }).join('') + '</ul>' +
      '  </article>' +
      '  <article class="local-proof__card">' +
      '    <p class="local-proof__label">What happens after you reach out</p>' +
      '    <ul>' +
      '      <li>' + (TRUST_ASSETS.responsePromise || 'Most project requests receive a response within one business day.') + '</li>' +
      '      <li>' + (TRUST_ASSETS.insuranceStatement || 'Insurance and bonding documentation is reviewed during consultation.') + '</li>' +
      '      <li>' + (BUSINESS_YEARS || 'Experienced Arizona residential landscape planning and construction support.') + '</li>' +
      '    </ul>' +
      '  </article>' +
      '</div>';

    var container = targetSection.querySelector('.container');
    if (container) {
      container.appendChild(proofBlock);
    }
  }

  function injectPageConversionGuide() {
    var guidePath = normalizedPath.replace(/\.html$/i, '');
    var guide = PAGE_CONVERSION_GUIDES[normalizedPath] || PAGE_CONVERSION_GUIDES[guidePath];
    if (!guide || document.querySelector('[data-page-conversion-guide]')) return;

    var targetSection = document.querySelector('.page-section--alt') || document.querySelector('.faq.page-section') || document.querySelector('main .page-section:last-of-type');
    if (!targetSection || !targetSection.parentNode) return;

    var bullets = Array.isArray(guide.bullets) ? guide.bullets.slice(0, 3) : [];
    var questions = Array.isArray(guide.questions) ? guide.questions.slice(0, 3) : [];
    var nextSteps = Array.isArray(guide.nextSteps) ? guide.nextSteps.slice(0, 3) : [];
    if (!bullets.length && !questions.length && !nextSteps.length) return;

    var section = document.createElement('section');
    section.className = 'page-section page-section--conversion';
    section.setAttribute('data-page-conversion-guide', 'true');
    section.innerHTML = '' +
      '<div class="container">' +
      '  <header class="page-section__header reveal reveal--left">' +
      '    <p class="eyebrow">' + (guide.eyebrow || 'Quote Fit') + '</p>' +
      '    <h2 class="section-title">' + (guide.title || 'Know If This Is the Right Next Step') + '</h2>' +
      '    <p>' + (guide.intro || 'Use these notes to decide whether to request a quote now or keep planning first.') + '</p>' +
      '  </header>' +
      '  <div class="conversion-guide">' +
      buildConversionGuideCard('Good fit when', bullets) +
      buildConversionGuideCard('Prepare before the callback', questions) +
      buildConversionGuideCard('What the follow-up should clarify', nextSteps) +
      '  </div>' +
      '  <div class="conversion-guide__actions reveal">' +
      '    <a class="btn btn--solid" href="' + (guide.ctaHref || recommendedConsultHref()) + '">' + (guide.ctaLabel || OFFER_LABEL) + '</a>' +
      '    <a class="text-link" href="/project-planning-checklist">Use the planning checklist &rarr;</a>' +
      '  </div>' +
      '</div>';

    targetSection.parentNode.insertBefore(section, targetSection);
  }

  function buildConversionGuideCard(label, items) {
    if (!items || !items.length) return '';
    return '' +
      '<article class="conversion-guide__card reveal">' +
      '  <p class="conversion-guide__label">' + label + '</p>' +
      '  <ul>' + items.map(function (item) { return '<li>' + item + '</li>'; }).join('') + '</ul>' +
      '</article>';
  }

  function toPathname(href) {
    if (!href) return '';
    if (href.charAt(0) === '#') return normalizedPath === '/' ? href : '';
    try {
      var url = new URL(href, window.location.origin);
      var path = url.pathname.replace(/\/index\.html$/i, '/').replace(/\/$/, '') || '/';
      if (url.hash && path === '/' && /^(#hero|#portfolio|#process|#reviews|#contact)$/.test(url.hash)) {
        return url.hash;
      }
      return path;
    } catch (error) {
      return '';
    }
  }

  function getPrimaryNavigationItems() {
    return [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: 'Portfolio', href: '/portfolio' },
      { label: 'Process', href: '/process' },
      { label: 'Financing', href: '/financing' },
      { label: 'Reviews', href: '/reviews' }
    ];
  }

  function getOverlayNavigationItems() {
    return [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: 'Portfolio', href: '/portfolio' },
      { label: 'Cost Calculator', href: '/cost-calculator' },
      { label: 'Warranty', href: '/warranty' },
      { label: 'Financing', href: '/financing' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Resources', href: '/resources' },
      { label: 'Process', href: '/process' },
      { label: 'Reviews', href: '/reviews' }
    ];
  }

  function createPrimaryNavLink(entry, className) {
    var link = document.createElement('a');
    link.className = className;
    link.href = entry.href;
    link.textContent = entry.label;
    return link;
  }

  function getPrimaryConsultHref() {
    if (normalizedPath.indexOf('/free-consultation') === 0) return '#consultation-request';
    if (isHomePath) return buildConsultationPageHref({ source: 'homepage_nav' });
    return getGlobalConsultFallbackHref();
  }

  function normalizePrimaryNavigation() {
    var navLinks = document.getElementById('nav-links');
    var navItems = getPrimaryNavigationItems();
    var consultHref = getPrimaryConsultHref();
    var primaryCta = document.querySelector('.nav__actions .nav__cta');
    var overlayPanel = document.getElementById('nav-overlay');
    var overlayNav = overlayPanel ? overlayPanel.querySelector('nav') : null;

    if (navLinks) {
      navLinks.innerHTML = '';
      navItems.forEach(function (entry) {
        navLinks.appendChild(createPrimaryNavLink(entry, 'nav__link'));
      });
    }

    if (primaryCta) {
      primaryCta.setAttribute('href', consultHref);
      primaryCta.textContent = OFFER_LABEL;
    }

    if (overlayNav) {
      Array.prototype.slice.call(overlayNav.querySelectorAll('.nav__overlay-link')).forEach(function (link) {
        link.remove();
      });
      getOverlayNavigationItems().forEach(function (entry) {
        overlayNav.appendChild(createPrimaryNavLink(entry, 'nav__overlay-link'));
      });
      var overlayCta = createPrimaryNavLink(
        { href: consultHref, label: OFFER_LABEL },
        'nav__overlay-link nav__overlay-cta'
      );
      overlayNav.appendChild(overlayCta);
    }
  }

  function applyActiveNavigationState() {
    var current = normalizedPath.replace(/\/$/, '') || '/';
    var currentHash = window.location.hash || (current === '/' ? '#hero' : '');

    document.querySelectorAll('.nav__link, .nav__overlay-link').forEach(function (link) {
      var href = String(link.getAttribute('href') || '').trim();
      var linkTarget = toPathname(href);
      var isActive = false;

      if (!linkTarget) {
        isActive = false;
      } else if (linkTarget.charAt(0) === '#') {
        isActive = current === '/' && linkTarget === currentHash;
      } else if (linkTarget === '/services') {
        // Mark Services active on all /services/* sub-pages too
        isActive = current === '/services' || current.indexOf('/services/') === 0;
      } else {
        isActive = linkTarget === current;
      }

      if (isActive) {
        link.setAttribute('aria-current', 'page');
        link.classList.add('nav__link--active');
      } else {
        link.removeAttribute('aria-current');
        link.classList.remove('nav__link--active');
      }
    });
  }

  function dedupeConsultNavigationLinks() {
    var primaryNav = document.querySelector('.nav__links');
    var primaryCta = document.querySelector('.nav__actions .nav__cta');

    if (primaryNav && primaryCta) {
      var ctaHref = String(primaryCta.getAttribute('href') || '').trim();
      Array.prototype.slice.call(primaryNav.querySelectorAll('.nav__link')).forEach(function (link) {
        var label = String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var href = String(link.getAttribute('href') || '').trim();
        if (label === 'contact' && href === ctaHref) {
          link.remove();
        }
      });
    }

    if (overlay) {
      var overlayCta = overlay.querySelector('.nav__overlay-cta');
      var overlayCtaHref = overlayCta ? String(overlayCta.getAttribute('href') || '').trim() : '';
      Array.prototype.slice.call(overlay.querySelectorAll('.nav__overlay-link')).forEach(function (link) {
        var label = String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var href = String(link.getAttribute('href') || '').trim();
        if (!link.classList.contains('nav__overlay-cta') && label === 'contact' && href === overlayCtaHref) {
          link.remove();
        }
      });
    }
  }

  function applyFinancingNote() {
    var financingNote = document.getElementById('financing-note');
    if (!financingNote) return;

    var enabled = FINANCING.enabled !== false;
    var copy = String(FINANCING.copy || '').trim();
    var ctaLabel = String(FINANCING.ctaLabel || '').trim();
    var ctaHref = String(FINANCING.ctaHref || '').trim();

    if (!enabled) {
      financingNote.style.display = 'none';
      return;
    }

    if (copy) {
      if (ctaLabel && ctaHref) {
        financingNote.innerHTML = copy + ' <a href="' + ctaHref + '" class="financing-note__link">' + ctaLabel + '</a>';
      } else {
        financingNote.textContent = copy;
      }
    }
  }

  function buildProjectThumbSourceSet(imagePath) {
    var cleanPath = String(imagePath || '').trim();
    if (!cleanPath) return '';
    var normalized = cleanPath.replace(/^\.\//, '').replace(/^\//, '');
    var extMatch = normalized.match(/\.([a-z0-9]+)$/i);
    if (!extMatch) return '';
    var ext = extMatch[1].toLowerCase();
    var base = normalized.slice(0, -1 * (ext.length + 1));
    var sources = [];

    sources.push('/' + base + '-640.avif 640w');

    if (ext === 'webp') {
      sources.push('/' + normalized + ' 1200w');
    } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      sources.push('/' + normalized + ' 1200w');
    }

    return sources.join(', ');
  }

  function renderRecentProjects() {
    var list = Array.isArray(window.RECENT_PROJECTS) ? window.RECENT_PROJECTS.slice(0, 5) : [];
    var grid = document.getElementById('recent-projects-grid');
    if (!grid || !list.length) return;

    grid.innerHTML = list.map(function (project, index) {
      var title = String(project.title || 'Recent Project').trim();
      var location = String(project.location || SITE_CITY + ', ' + SITE_STATE).trim();
      var styleSlug = String(project.styleSlug || 'all').trim();
      var serviceSlug = String(project.serviceSlug || '').trim();
      var src = String(project.image || '').trim();
      var srcset = buildProjectThumbSourceSet(src);
      var alt = String(project.imageAlt || title + ' in ' + location).trim();
      var width = Number(project.width || 1600);
      var height = Number(project.height || 900);
      var scope = String(project.scope || '').trim();
      var timeline = String(project.timeline || '').trim();
      var proof = String(project.proof || '').trim();
      var requestQuery = new URLSearchParams({
        source: 'recent_projects',
        service: serviceSlug || '',
        selected_style: styleSlug,
        selected_image: src || ('recent-project-' + (index + 1)),
        selected_project_label: title
      });

      return '' +
        '<article class="recent-project reveal">' +
        '  <figure class="recent-project__media">' +
        '    <img src="' + src + '" alt="' + alt + '" title="' + alt + '" loading="lazy" decoding="async" width="' + width + '" height="' + height + '"' +
        (srcset ? ' srcset="' + srcset + '" sizes="(max-width: 768px) 100vw, 33vw"' : '') +
        ' />' +
        '    <span class="recent-project__chip">' + (project.type || 'Project') + '</span>' +
        '  </figure>' +
        '  <div class="recent-project__body">' +
        '    <h3>' + title + '</h3>' +
        '    <p>' + location + '</p>' +
        (scope || timeline ? '    <ul class="recent-project__meta">' +
          (scope ? '<li><strong>Scope:</strong> ' + scope + '</li>' : '') +
          (timeline ? '<li><strong>Timeline:</strong> ' + timeline + '</li>' : '') +
        '</ul>' : '') +
        (proof ? '    <p class="recent-project__proof">' + proof + '</p>' : '') +
        '    <a href="/?' + requestQuery.toString() + '#contact" class="recent-project__cta">Request a Similar Project</a>' +
        '  </div>' +
        '</article>';
    }).join('');
  }

  function applyImageTitleFallbacks() {
    document.querySelectorAll('img').forEach(function (img) {
      var alt = String(img.getAttribute('alt') || '').trim();
      if (alt && !img.getAttribute('title')) {
        img.setAttribute('title', alt);
      }
    });
  }

  function installAnalytics() {
    var measurementId = String(ANALYTICS.ga4MeasurementId || '').trim();
    var HEATMAP = ANALYTICS.heatmap || {};
    var heatmapEnabled = HEATMAP.enabled !== false;
    var heatmapBufferLimit = Math.max(25, Math.min(500, Number(HEATMAP.bufferLimit || 200)));
    var heatmapClickSelector = String(HEATMAP.clickSelector || 'a, button, input, select, textarea, summary, [role="button"], [data-heatmap-track]');
    var trackingContext = {
      lead_source: DETECTED_LEAD_SOURCE || 'website',
      utm_source: String(URL_PARAMS.get('utm_source') || '').trim(),
      utm_medium: String(URL_PARAMS.get('utm_medium') || '').trim(),
      utm_campaign: String(URL_PARAMS.get('utm_campaign') || '').trim(),
      utm_content: String(URL_PARAMS.get('utm_content') || '').trim(),
      referrer: String(document.referrer || '').trim(),
      landing_path: String(window.location.pathname || '/')
    };

    window.dataLayer = window.dataLayer || [];
    window.heatmapEvents = window.heatmapEvents || [];

    function analyticsConsentGranted() {
      return localStorage.getItem('tg_cookie_consent') === 'accepted';
    }

    function getScrollPercent() {
      var body = document.body;
      var html = document.documentElement;
      var scrollTop = window.scrollY || html.scrollTop || body.scrollTop || 0;
      var scrollHeight = Math.max(body.scrollHeight, html.scrollHeight, body.offsetHeight, html.offsetHeight);
      var windowHeight = window.innerHeight || html.clientHeight || 0;
      var maxScrollable = Math.max(1, scrollHeight - windowHeight);
      return Math.min(100, Math.max(0, Math.round((scrollTop / maxScrollable) * 100)));
    }

    function getElementLabel(element) {
      if (!element) return '';
      return String(
        element.getAttribute('data-heatmap-label') ||
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.textContent ||
        element.getAttribute('name') ||
        element.id ||
        element.tagName ||
        ''
      ).replace(/\s+/g, ' ').trim().slice(0, 90);
    }

    function getElementZone(element) {
      var zone = element && element.closest ? element.closest('[data-heatmap-zone], section, header, footer, nav, main, aside') : null;
      if (!zone) return 'body';
      return String(
        zone.getAttribute('data-heatmap-zone') ||
        zone.id ||
        zone.getAttribute('aria-label') ||
        zone.className ||
        zone.tagName ||
        'body'
      ).replace(/\s+/g, ' ').trim().slice(0, 80);
    }

    function getHeatmapElementContext(element) {
      var href = element && element.getAttribute ? element.getAttribute('href') : '';
      return {
        element_tag: element && element.tagName ? element.tagName.toLowerCase() : '',
        element_id: element && element.id ? element.id : '',
        element_classes: element && element.className ? String(element.className).replace(/\s+/g, ' ').trim().slice(0, 120) : '',
        element_label: getElementLabel(element),
        element_href: href ? String(href).slice(0, 180) : '',
        heatmap_zone: getElementZone(element)
      };
    }

    window.trackHeatmapEvent = function trackHeatmapEvent(name, params) {
      if (!heatmapEnabled || !analyticsConsentGranted()) return;
      var eventPayload = Object.assign({
        event: name,
        heatmap_event: name,
        page_path: window.location.pathname || '/',
        page_location: window.location.href,
        viewport_width: window.innerWidth || document.documentElement.clientWidth || 0,
        viewport_height: window.innerHeight || document.documentElement.clientHeight || 0,
        scroll_percent: getScrollPercent(),
        timestamp: Date.now()
      }, trackingContext, params || {});

      window.heatmapEvents.push(eventPayload);
      if (window.heatmapEvents.length > heatmapBufferLimit) {
        window.heatmapEvents.splice(0, window.heatmapEvents.length - heatmapBufferLimit);
      }
      window.dataLayer.push(eventPayload);
    };

    window.trackLeadEvent = function trackLeadEvent(name, params) {
      if (!analyticsConsentGranted()) return;
      var payload = Object.assign({}, trackingContext, params || {});
      window.dataLayer.push(Object.assign({ event: name }, payload));
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, payload);
      }
    };

    window.initSiteAnalytics = function initSiteAnalytics() {
      if (!measurementId || window.__tgAnalyticsInitialized) return;
      window.__tgAnalyticsInitialized = true;
      var gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
      document.head.appendChild(gaScript);

      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };

      window.gtag('js', new Date());
      window.gtag('config', measurementId, {
        anonymize_ip: true
      });
    };

    if (analyticsConsentGranted()) {
      window.initSiteAnalytics();
    }

    var callClickMap = new WeakSet();
    document.querySelectorAll('[data-site-phone-link], a[href^="tel:"]').forEach(function (link) {
      if (callClickMap.has(link)) return;
      callClickMap.add(link);
      link.addEventListener('click', function () {
        var payload = {
          method: 'tel_link',
          source: DETECTED_LEAD_SOURCE,
          page_location: window.location.href
        };
        window.trackLeadEvent('call_click', payload);
        window.trackLeadEvent('click_call', payload);
      });
    });

    var trackedDepths = {};
    var depthThresholds = [25, 50, 75, 90];
    function trackScrollDepth() {
      var depth = getScrollPercent();

      depthThresholds.forEach(function (threshold) {
        if (depth >= threshold && !trackedDepths[threshold]) {
          trackedDepths[threshold] = true;
          window.trackLeadEvent('scroll_depth', {
            depth_percent: threshold,
            page_location: window.location.href
          });
          window.trackHeatmapEvent('heatmap_scroll_depth', {
            depth_percent: threshold
          });
        }
      });
    }

    window.addEventListener('scroll', trackScrollDepth, { passive: true });
    trackScrollDepth();

    var recentHeatmapClicks = [];
    function pruneRecentHeatmapClicks(now) {
      recentHeatmapClicks = recentHeatmapClicks.filter(function (click) {
        return now - click.time < 1200;
      });
    }

    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest
        ? event.target.closest('a, button')
        : null;
      var heatmapTarget = event.target && event.target.closest
        ? event.target.closest(heatmapClickSelector)
        : null;

      if (heatmapTarget) {
        var now = Date.now();
        var heatmapRect = heatmapTarget.getBoundingClientRect();
        var heatmapContext = getHeatmapElementContext(heatmapTarget);
        var clickPayload = Object.assign({}, heatmapContext, {
          click_x: Math.round(event.clientX),
          click_y: Math.round(event.clientY),
          element_x_percent: heatmapRect.width ? Math.round(((event.clientX - heatmapRect.left) / heatmapRect.width) * 100) : 0,
          element_y_percent: heatmapRect.height ? Math.round(((event.clientY - heatmapRect.top) / heatmapRect.height) * 100) : 0,
          is_primary_cta: /consult|project review|quote|call|contact|plan my|start/i.test(getElementLabel(heatmapTarget))
        });

        window.trackHeatmapEvent('heatmap_click', clickPayload);

        recentHeatmapClicks.push({ time: now, x: event.clientX, y: event.clientY, label: clickPayload.element_label });
        pruneRecentHeatmapClicks(now);
        var sameAreaClicks = recentHeatmapClicks.filter(function (click) {
          return Math.abs(click.x - event.clientX) <= 24 &&
            Math.abs(click.y - event.clientY) <= 24 &&
            click.label === clickPayload.element_label;
        });
        if (sameAreaClicks.length >= 3) {
          window.trackHeatmapEvent('heatmap_rage_click', clickPayload);
          recentHeatmapClicks = [];
        }
      }

      if (!trigger) return;

      var isCta = trigger.classList.contains('btn') ||
        trigger.classList.contains('nav__cta') ||
        trigger.classList.contains('fit-card__action') ||
        trigger.classList.contains('lead-tier__btn') ||
        trigger.classList.contains('text-link');

      if (!isCta) return;

      var ctaLabel = String(trigger.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      var ctaTarget = trigger.getAttribute('href') || trigger.id || 'button';
      window.trackLeadEvent('cta_click', {
        cta_label: ctaLabel,
        cta_target: ctaTarget,
        page_location: window.location.href
      });

      var normalizedLabel = ctaLabel.toLowerCase();
      var normalizedTarget = String(ctaTarget).toLowerCase();
      if (normalizedLabel.indexOf('consultation') >= 0 || normalizedTarget.indexOf('#contact') >= 0) {
        window.trackLeadEvent('click_get_consultation', {
          cta_label: ctaLabel,
          cta_target: ctaTarget,
          page_location: window.location.href
        });
      }
      if (normalizedLabel.indexOf('portfolio') >= 0 || normalizedTarget.indexOf('portfolio') >= 0) {
        window.trackLeadEvent('click_portfolio', {
          cta_label: ctaLabel,
          cta_target: ctaTarget,
          page_location: window.location.href
        });
      }
    });

    var heatmapFormStartMap = new WeakSet();
    document.addEventListener('focusin', function (event) {
      var field = event.target;
      if (!field || !/^(input|select|textarea)$/i.test(field.tagName || '')) return;
      var form = field.closest ? field.closest('form') : null;
      if (!form || heatmapFormStartMap.has(form)) return;
      heatmapFormStartMap.add(form);
      window.trackHeatmapEvent('heatmap_form_start', {
        form_id: form.id || '',
        form_name: form.getAttribute('name') || '',
        field_tag: field.tagName.toLowerCase(),
        field_name: field.getAttribute('name') || '',
        heatmap_zone: getElementZone(form)
      });
    });

    if (window.location.pathname.indexOf('thank-you') !== -1) {
      window.trackLeadEvent('thank_you_view', {
        page_location: window.location.href,
        source: String(URL_PARAMS.get('source') || DETECTED_LEAD_SOURCE || 'website')
      });
    }
  }

  applyTrackedPhone();
  applySiteBranding();
  ensureFooterServiceLinks();
  ensureFooterStudioLinks();
  ensureFooterResourceLinks();
  ensurePrimaryNavigationLinks();
  renderFooterSocialLinks();
  renderFooterMeta();
  applyContactFormServices();
  applyProjectFitCards();
  applyBeforeAfterContent();
  renderReviewCards();
  applyGoogleReviewSnapshot();
  applyTrustAssets();
  injectLocationBusinessSchema();
  enhanceAccessibilityAndMedia();
  injectLocationProofPanels();
  applyFinancingNote();
  renderRecentProjects();
  loadLiveGoogleReviews();
  applyImageTitleFallbacks();
  installAnalytics();

  function getFocusableElements(container) {
    if (!container) return [];
    return Array.prototype.slice.call(container.querySelectorAll(
      'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
    )).filter(function (element) {
      return !element.hasAttribute('hidden') && element.offsetParent !== null;
    });
  }

  function createFocusTrap(container, onEscape) {
    var previousActiveElement = null;

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        if (typeof onEscape === 'function') onEscape();
        return;
      }
      if (event.key !== 'Tab') return;

      var focusable = getFocusableElements(container);
      if (!focusable.length) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    return {
      activate: function activate(initialTarget) {
        previousActiveElement = document.activeElement;
        container.addEventListener('keydown', handleKeydown);
        var target = initialTarget || getFocusableElements(container)[0] || container;
        if (target && typeof target.focus === 'function') target.focus();
      },
      deactivate: function deactivate(restoreFocus) {
        container.removeEventListener('keydown', handleKeydown);
        if (restoreFocus !== false && previousActiveElement && typeof previousActiveElement.focus === 'function') {
          previousActiveElement.focus();
        }
      }
    };
  }

  /* ---- NAV SCROLL STATE ---- */
  var nav = document.getElementById('nav');
  var normalizedPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  var isHomePath = normalizedPath === '/' || normalizedPath === '/index.html';
  var forceScrolledShell = !isHomePath;
  function updateNav() {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', forceScrolledShell || window.scrollY > 60);
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
  normalizePrimaryNavigation();
  dedupeConsultNavigationLinks();
  applyActiveNavigationState();
  normalizeConsultationLinks();
  injectPageConversionGuide();

  /* ---- MOBILE MENU ---- */
  var burger = document.getElementById('nav-burger');
  var overlay = document.getElementById('nav-overlay');
  var close = document.getElementById('nav-close');
  var stickyBar = document.getElementById('sticky-bar');
  var isContactInView = false;
  var scrollTopButton = document.createElement('button');
  var menuFocusTrap = null;
  var consultDrawerReturnFocus = null;
  if (burger && overlay) {
    burger.setAttribute('aria-controls', overlay.id || 'nav-overlay');
    burger.setAttribute('aria-label', 'Open menu');
  }
  if (overlay) {
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Mobile navigation');
  }
  scrollTopButton.type = 'button';
  scrollTopButton.className = 'scroll-top';
  scrollTopButton.setAttribute('aria-label', 'Scroll back to top');
  scrollTopButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 19V5"></path><path d="M6 11l6-6 6 6"></path></svg>';
  document.body.appendChild(scrollTopButton);

  function updateStickyBar() {
    if (!stickyBar) return;
    var isMobile = window.innerWidth <= 768;
    var passedHero = window.scrollY > Math.max(220, window.innerHeight * 0.35);
    var menuOpen = overlay && overlay.classList.contains('is-open');
    var drawerOpen = document.body.classList.contains('has-consult-drawer-open');
    var shouldShow = isMobile && passedHero && !menuOpen && !drawerOpen && !isContactInView;
    stickyBar.classList.toggle('is-visible', shouldShow);
  }

  function getPageSecondaryAction() {
    var pathname = normalizedPath;
    var bodyServiceSlug = document.body && document.body.dataset ? document.body.dataset.serviceSlug : '';
    var nativeQuoteAction = getNativeQuoteAction();

    if (pathname === '/' || pathname === '/index.html') {
      return { href: buildConsultationPageHref({ source: 'homepage_sticky' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname === '/services') {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'services_hub' }), label: 'Start My Project Review' };
    }
    if (pathname.indexOf('/services/') === 0 && bodyServiceSlug) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'service_page' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('/portfolio') === 0) {
      return { href: '#portfolio-consultation', label: 'Request Similar Project' };
    }
    if (
      pathname.indexOf('scottsdale-landscaping') >= 0 ||
      pathname.indexOf('phoenix-landscaping') >= 0 ||
      pathname.indexOf('paradise-valley-landscaping') >= 0 ||
      pathname.indexOf('arcadia-landscaping') >= 0 ||
      pathname.indexOf('mesa-landscaping') >= 0 ||
      pathname.indexOf('chandler-landscaping') >= 0
    ) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'location_page' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('/resources') === 0) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'resources_hub' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('project-planning-checklist') >= 0) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'checklist_page' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('/about') === 0) {
      return { href: '/reviews', label: 'Read Reviews' };
    }
    if (pathname.indexOf('/process') === 0) {
      return { href: '/about', label: 'About The Team' };
    }
    if (pathname.indexOf('/reviews') === 0) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'reviews_page' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('/free-consultation') === 0) {
      return { href: '/services', label: 'Explore Services' };
    }
    if (pathname.indexOf('landscaping-cost-scottsdale') >= 0) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'cost_guide' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('xeriscape-vs-turf-arizona') >= 0) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'resource_article' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('pavers-vs-concrete-arizona') >= 0) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'resource_article' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('outdoor-kitchen-planning-arizona') >= 0) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'resource_article' }), label: OFFER_SHORT_LABEL };
    }
    if (pathname.indexOf('best-landscaper') >= 0) {
      return nativeQuoteAction || { href: buildConsultationPageHref({ source: 'comparison_page' }), label: OFFER_SHORT_LABEL };
    }
    return nativeQuoteAction || { href: getGlobalConsultFallbackHref(), label: OFFER_SHORT_LABEL };
  }

  function getNativeQuoteAction() {
    var links = Array.prototype.slice.call(document.querySelectorAll('a[href*="free-consultation"]'));
    var genericLabels = /^(contact|quote|free quote|project review|get quote|request free quote|request project review|request my free quote|request my project review)$/i;
    var best = links.find(function (link) {
      if (link.closest('.nav__overlay-actions')) return false;
      var label = String(link.textContent || '').replace(/\s+/g, ' ').trim();
      return label && !genericLabels.test(label);
    }) || links.find(function (link) {
      var label = String(link.textContent || '').replace(/\s+/g, ' ').trim();
      return label && !/^contact$/i.test(label);
    });

    if (!best) return null;
    return {
      href: best.getAttribute('href'),
      label: String(best.textContent || '').replace(/\s+/g, ' ').trim()
    };
  }

  function getOverlayConsultHref() {
    var calculatorReviewLink = document.getElementById('calc-review-link');
    var calculatorReviewHref = calculatorReviewLink ? String(calculatorReviewLink.getAttribute('href') || '').trim() : '';
    if (normalizedPath.indexOf('/cost-calculator') === 0 && calculatorReviewHref) return calculatorReviewHref;
    if (normalizedPath === '/services') return buildConsultationPageHref({ source: 'services_hub' });
    if (normalizedPath.indexOf('/services/') === 0) return buildConsultationPageHref({ source: 'service_page' });
    if (normalizedPath.indexOf('/portfolio') === 0) return buildConsultationPageHref({ source: 'portfolio' });
    if (normalizedPath.indexOf('/resources') === 0) return buildConsultationPageHref({ source: 'resources_hub' });
    if (currentPageCity()) return buildConsultationPageHref({ source: 'location_page' });
    if (normalizedPath.indexOf('/about') === 0) return buildConsultationPageHref({ source: 'about_page' });
    if (normalizedPath.indexOf('/process') === 0) return buildConsultationPageHref({ source: 'process_page' });
    if (normalizedPath.indexOf('/reviews') === 0) return buildConsultationPageHref({ source: 'reviews_page' });
    if (normalizedPath.indexOf('/free-consultation') === 0) return '#consultation-request';
    if (normalizedPath.indexOf('best-landscaper') >= 0) return buildConsultationPageHref({ source: 'comparison_page' });
    if (normalizedPath.indexOf('project-planning-checklist') >= 0) return buildConsultationPageHref({ source: 'checklist_page' });
    if (normalizedPath.indexOf('landscaping-cost-scottsdale') >= 0) return buildConsultationPageHref({ source: 'cost_guide' });
    if (normalizedPath.indexOf('xeriscape-vs-turf-arizona') >= 0) return buildConsultationPageHref({ source: 'resource_article' });
    if (normalizedPath.indexOf('pavers-vs-concrete-arizona') >= 0) return buildConsultationPageHref({ source: 'resource_article' });
    if (normalizedPath.indexOf('outdoor-kitchen-planning-arizona') >= 0) return buildConsultationPageHref({ source: 'resource_article' });
    return buildConsultationPageHref({ source: 'homepage_menu' });
  }

  function getGlobalConsultFallbackHref() {
    var calculatorReviewLink = document.getElementById('calc-review-link');
    var calculatorReviewHref = calculatorReviewLink ? String(calculatorReviewLink.getAttribute('href') || '').trim() : '';
    if (normalizedPath.indexOf('/cost-calculator') === 0 && calculatorReviewHref) return calculatorReviewHref;
    if (normalizedPath === '/services') return buildConsultationPageHref({ source: 'services_hub' });
    if (normalizedPath.indexOf('/services/') === 0) return buildConsultationPageHref({ source: 'service_page' });
    if (normalizedPath.indexOf('/portfolio') === 0) return buildConsultationPageHref({ source: 'portfolio' });
    if (normalizedPath.indexOf('/resources') === 0) return buildConsultationPageHref({ source: 'resources_hub' });
    if (currentPageCity()) return buildConsultationPageHref({ source: 'location_page' });
    if (normalizedPath.indexOf('/about') === 0) return buildConsultationPageHref({ source: 'about_page' });
    if (normalizedPath.indexOf('/process') === 0) return buildConsultationPageHref({ source: 'process_page' });
    if (normalizedPath.indexOf('/reviews') === 0) return buildConsultationPageHref({ source: 'reviews_page' });
    if (normalizedPath.indexOf('/free-consultation') === 0) return '#consultation-request';
    if (normalizedPath.indexOf('best-landscaper') >= 0) return buildConsultationPageHref({ source: 'comparison_page' });
    if (normalizedPath.indexOf('project-planning-checklist') >= 0) return buildConsultationPageHref({ source: 'checklist_page' });
    if (normalizedPath.indexOf('landscaping-cost-scottsdale') >= 0) return buildConsultationPageHref({ source: 'cost_guide' });
    if (normalizedPath.indexOf('xeriscape-vs-turf-arizona') >= 0) return buildConsultationPageHref({ source: 'resource_article' });
    if (normalizedPath.indexOf('pavers-vs-concrete-arizona') >= 0) return buildConsultationPageHref({ source: 'resource_article' });
    if (normalizedPath.indexOf('outdoor-kitchen-planning-arizona') >= 0) return buildConsultationPageHref({ source: 'resource_article' });
    return buildConsultationPageHref({ source: 'homepage_nav' });
  }

  function normalizeConsultationLinks() {
    if (isHomePath || normalizedPath.indexOf('/free-consultation') === 0) return;
    var dedicatedHref = getGlobalConsultFallbackHref();
    if (!dedicatedHref || dedicatedHref.charAt(0) === '#') return;

    document.querySelectorAll('a[href]').forEach(function (link) {
      var href = String(link.getAttribute('href') || '').trim();
      var text = String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      var isConsultText = text.indexOf('consultation') >= 0 || text === 'contact';
      var isLocalConsultAnchor = href.charAt(0) === '#' && (href.indexOf('consultation') >= 0 || href === '#contact');
      if (!isConsultText && !isLocalConsultAnchor) return;
      if (link.hasAttribute('data-service-consultation-link')) return;
      link.setAttribute('href', dedicatedHref);
    });
  }

  function getOverlayIntroContent() {
    if (normalizedPath === '/' || normalizedPath === '/index.html') {
      return {
        kicker: 'Scottsdale Design-Build',
        title: 'Plan Your Outdoor Space',
        sub: 'Jump into services, project inspiration, reviews, or start a project review without hunting through the page.'
      };
    }
    if (normalizedPath === '/services' || normalizedPath.indexOf('/services/') === 0) {
      return {
        kicker: 'Service Navigation',
        title: 'Choose Your Next Step',
        sub: 'Review services first, then use the action row for a call or a page-native consultation request.'
      };
    }
    if (normalizedPath.indexOf('/portfolio') === 0) {
      return {
        kicker: 'Project Inspiration',
        title: 'Browse Then Request',
        sub: 'Compare project styles, save what fits your yard, and use the project review path when you are ready.'
      };
    }
    return {
      kicker: 'Quick Navigation',
      title: 'Move Through the Site Fast',
      sub: 'Use the menu for navigation and the action row for the fastest way to call or start your request.'
    };
  }

  function ensureOverlayActions() {
    if (!overlay) return null;
    var navPanel = overlay.querySelector('nav');
    if (!navPanel) return null;

    var intro = navPanel.querySelector('.nav__overlay-intro');
    var introContent = getOverlayIntroContent();
    if (!intro) {
      intro = document.createElement('div');
      intro.className = 'nav__overlay-intro';
      intro.innerHTML =
        '<span class="nav__overlay-kicker"></span>' +
        '<h2 class="nav__overlay-title"></h2>' +
        '<p class="nav__overlay-sub"></p>';
      navPanel.insertBefore(intro, navPanel.firstChild);
    }
    var kicker = intro.querySelector('.nav__overlay-kicker');
    var title = intro.querySelector('.nav__overlay-title');
    var sub = intro.querySelector('.nav__overlay-sub');
    if (kicker) kicker.textContent = introContent.kicker;
    if (title) title.textContent = introContent.title;
    if (sub) sub.textContent = introContent.sub;

    var duplicateContact = Array.prototype.find.call(
      navPanel.querySelectorAll('.nav__overlay-link'),
      function (link) {
        return !link.classList.contains('nav__overlay-cta') &&
          String(link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'contact';
      }
    );
    if (duplicateContact) duplicateContact.remove();

    var legacyCta = navPanel.querySelector('.nav__overlay-cta');
    if (legacyCta) legacyCta.remove();

    var actions = overlay.querySelector('.nav__overlay-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'nav__overlay-actions';
      actions.innerHTML =
        '<a class="nav__overlay-action nav__overlay-action--ghost" data-overlay-call href="#">Call Now</a>' +
        '<a class="nav__overlay-action nav__overlay-action--solid" data-overlay-consult href="#">' + OFFER_LABEL + '</a>';
      navPanel.insertAdjacentElement('afterend', actions);
    }

    var callAction = actions.querySelector('[data-overlay-call]');
    var consultAction = actions.querySelector('[data-overlay-consult]');
    if (callAction) {
      callAction.setAttribute('href', 'tel:' + SITE_PHONE_RAW);
      callAction.textContent = 'Call Now';
      callAction.setAttribute('data-site-phone-link', '');
    }
    if (consultAction) {
      consultAction.setAttribute('href', getOverlayConsultHref());
      consultAction.textContent = OFFER_LABEL;
    }

    actions.querySelectorAll('a').forEach(function (link) {
      if (link.dataset.overlayBound === 'true') return;
      link.dataset.overlayBound = 'true';
      link.addEventListener('click', function () {
        closeMenu(false);
      });
    });

    return actions;
  }

  function configureMobileQuickActions() {
    var secondary = stickyBar ? stickyBar.querySelector('.btn--outline-dark') : null;
    var stickyAction = getPageSecondaryAction();
    if (secondary && stickyAction) {
      secondary.setAttribute('href', stickyAction.href);
      secondary.textContent = stickyAction.label;
      if (stickyAction.href.indexOf('downloads/') === 0) {
        secondary.setAttribute('download', '');
      } else {
        secondary.removeAttribute('download');
      }
    }

    ensureOverlayActions();
  }

  function updateScrollTop() {
    if (!scrollTopButton) return;
    var menuOpen = overlay && overlay.classList.contains('is-open');
    var drawerOpen = document.body.classList.contains('has-consult-drawer-open');
    var shouldShow = window.scrollY > Math.max(420, window.innerHeight * 0.7);
    scrollTopButton.classList.toggle('is-visible', shouldShow && !menuOpen && !drawerOpen);
  }

  function setBackgroundInertForMenu(isInert) {
    var targets = document.querySelectorAll('#nav, .breadcrumbs, main, footer, .sticky-bar, .scroll-top');
    targets.forEach(function (target) {
      if (!target || target === overlay || (target.contains && target.contains(overlay))) return;
      if (isInert) {
        target.dataset.menuPreviousAriaHidden = target.getAttribute('aria-hidden') || '';
        target.setAttribute('aria-hidden', 'true');
        if ('inert' in target) target.inert = true;
      } else {
        if (target.dataset.menuPreviousAriaHidden) {
          target.setAttribute('aria-hidden', target.dataset.menuPreviousAriaHidden);
        } else {
          target.removeAttribute('aria-hidden');
        }
        delete target.dataset.menuPreviousAriaHidden;
        if ('inert' in target) target.inert = false;
      }
    });
  }

  function setBackgroundInertForConsult(isInert) {
    var targets = document.querySelectorAll('#nav, .breadcrumbs, main, footer, .sticky-bar, .scroll-top, .cookie-banner');
    targets.forEach(function (target) {
      if (!target || (consultDrawerState && consultDrawerState.drawer && (target === consultDrawerState.drawer || target.contains(consultDrawerState.drawer)))) return;
      if (isInert) {
        target.dataset.consultPreviousAriaHidden = target.getAttribute('aria-hidden') || '';
        target.setAttribute('aria-hidden', 'true');
        if ('inert' in target) target.inert = true;
      } else {
        if (target.dataset.consultPreviousAriaHidden) {
          target.setAttribute('aria-hidden', target.dataset.consultPreviousAriaHidden);
        } else {
          target.removeAttribute('aria-hidden');
        }
        delete target.dataset.consultPreviousAriaHidden;
        if ('inert' in target) target.inert = false;
      }
    });
  }

  function openMenu() {
    if (!overlay || !burger) return;
    if (typeof closeConsultDrawer === 'function') closeConsultDrawer(false);
    overlay.classList.add('is-open');
    burger.classList.add('is-open');
    document.body.classList.add('has-nav-overlay-open');
    overlay.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
    setBackgroundInertForMenu(true);
    if (menuFocusTrap) {
      menuFocusTrap.activate(close || overlay);
    }
    updateStickyBar();
    updateScrollTop();
  }

  function closeMenu(restoreFocus) {
    if (!overlay || !burger) return;
    overlay.classList.remove('is-open');
    burger.classList.remove('is-open');
    document.body.classList.remove('has-nav-overlay-open');
    overlay.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = document.body.classList.contains('has-consult-drawer-open') ? 'hidden' : '';
    setBackgroundInertForMenu(false);
    if (menuFocusTrap) {
      menuFocusTrap.deactivate(restoreFocus !== false);
    }
    updateStickyBar();
    updateScrollTop();
  }

  if (overlay) {
    menuFocusTrap = createFocusTrap(overlay, function () {
      closeMenu();
    });
  }

  if (burger) burger.addEventListener('click', openMenu);
  if (close) close.addEventListener('click', closeMenu);
  if (overlay) {
    overlay.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        closeMenu(false);
      });
    });
    /* Close menu when tapping the darkened backdrop area (outside nav panel) */
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeMenu();
    });
  }

  if ('IntersectionObserver' in window) {
    var leadSectionSelector = getOverlayConsultHref();
    var leadSection = leadSectionSelector && leadSectionSelector.charAt(0) === '#'
      ? document.querySelector(leadSectionSelector)
      : document.getElementById('contact');
    if (leadSection) {
      var contactObs = new IntersectionObserver(function (entries) {
        isContactInView = entries.some(function (entry) {
          return entry.isIntersecting;
        });
        updateStickyBar();
      }, { threshold: 0.2 });
      contactObs.observe(leadSection);
    }
  }

  window.addEventListener('scroll', updateStickyBar, { passive: true });
  window.addEventListener('resize', updateStickyBar);
  window.addEventListener('scroll', updateScrollTop, { passive: true });
  window.addEventListener('resize', updateScrollTop);
  configureMobileQuickActions();
  updateStickyBar();
  updateScrollTop();

  scrollTopButton.addEventListener('click', function () {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  });

  var consultDrawerState = null;

  function normalizeSlug(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function deriveConsultSource() {
    var pathname = String(window.location.pathname || '/').toLowerCase();
    if (pathname.indexOf('/services/') >= 0) return 'service_page';
    if (pathname.indexOf('portfolio') >= 0) return 'portfolio';
    if (pathname.indexOf('scottsdale') >= 0) return 'scottsdale_location';
    if (pathname.indexOf('phoenix') >= 0) return 'phoenix_location';
    if (pathname.indexOf('search') >= 0) return 'search_topic';
    if (pathname.indexOf('checklist') >= 0) return 'checklist_download';
    if (pathname.indexOf('best-landscaper') >= 0) return 'comparison_page';
    return DETECTED_LEAD_SOURCE || 'website';
  }

  function currentServiceSlug() {
    return document.body && document.body.dataset && document.body.dataset.serviceSlug
      ? String(document.body.dataset.serviceSlug).trim()
      : '';
  }

  function currentPageCity() {
    var pathname = String(window.location.pathname || '').toLowerCase();
    var cityMap = [
      ['scottsdale-landscaping', 'Scottsdale'],
      ['phoenix-landscaping', 'Phoenix'],
      ['paradise-valley-landscaping', 'Paradise Valley'],
      ['arcadia-landscaping', 'Arcadia'],
      ['mesa-landscaping', 'Mesa'],
      ['chandler-landscaping', 'Chandler'],
      ['tempe-landscaping', 'Tempe'],
      ['gilbert-landscaping', 'Gilbert'],
      ['fountain-hills-landscaping', 'Fountain Hills'],
      ['cave-creek-landscaping', 'Cave Creek']
    ];
    var match = cityMap.find(function (entry) {
      return pathname.indexOf(entry[0]) >= 0;
    });
    return match ? match[1] : '';
  }

  function buildConsultationPageHref(overrides) {
    var params = new URLSearchParams();
    var options = overrides || {};
    var service = String(options.service || currentServiceSlug() || '').trim();
    var city = String(options.city || currentPageCity() || '').trim();
    var source = String(options.source || deriveConsultSource() || 'website').trim();
    var prefillMessage = String(options.prefill_message || '').trim();

    if (service) params.set('service', service);
    if (city) params.set('city', city);
    if (source) params.set('source', source);
    if (prefillMessage) params.set('prefill_message', prefillMessage);
    params.set('autostart', '1');
    return '/free-consultation?' + params.toString();
  }

  function resolveServiceFormValue(value) {
    var cleanValue = String(value || '').trim();
    if (!cleanValue) return '';

    var requestedSlug = normalizeSlug(cleanValue);
    var catalog = Array.isArray(window.SERVICES_DATA) ? window.SERVICES_DATA : [];
    var serviceFromCatalog = catalog.find(function (item) {
      return normalizeSlug(item.slug) === requestedSlug ||
        normalizeSlug(item.title) === requestedSlug ||
        normalizeSlug(item.formValue) === requestedSlug ||
        normalizeSlug(item.navLabel) === requestedSlug;
    });
    if (serviceFromCatalog) {
      return String(serviceFromCatalog.formValue || serviceFromCatalog.title || '');
    }

    var configuredServices = Array.isArray(SITE_CONFIG.contactFormServices) ? SITE_CONFIG.contactFormServices : [];
    var serviceAliases = {
      'outdoor-kitchens': 'Fire Feature / Outdoor Kitchen',
      'outdoor-kitchen': 'Fire Feature / Outdoor Kitchen',
      'fire-features': 'Fire Feature / Outdoor Kitchen',
      'fire-feature': 'Fire Feature / Outdoor Kitchen',
      'pergola-shade': 'Pergola / Shade Structure',
      'pergola-shade-structure': 'Pergola / Shade Structure',
      'desert-landscaping': 'Desert / Drought-Tolerant Design',
      'desert-drought-tolerant-design': 'Desert / Drought-Tolerant Design'
    };
    if (serviceAliases[requestedSlug] && configuredServices.indexOf(serviceAliases[requestedSlug]) >= 0) {
      return serviceAliases[requestedSlug];
    }
    var exactMatch = configuredServices.find(function (service) {
      return normalizeSlug(service) === requestedSlug;
    });
    return exactMatch || cleanValue;
  }

  function parseConsultUrl(rawHref) {
    var href = String(rawHref || '').trim();
    if (!href) return null;
    try {
      return new URL(href, window.location.href);
    } catch (error) {
      return null;
    }
  }

  function buildConsultPrefillFromTrigger(trigger) {
    var prefill = {
      source: deriveConsultSource(),
      city: '',
      service: '',
      selected_style: '',
      selected_image: '',
      selected_project_label: '',
      prefill_message: '',
      estimated_timeline: '',
      consultation_tier: '',
      lead_tier: '',
      budget_range: '',
      project_goal: '',
      priority_zone: ''
    };
    var parsedUrl = null;

    if (trigger && trigger.getAttribute) {
      parsedUrl = parseConsultUrl(trigger.getAttribute('href'));
      if (parsedUrl) {
        prefill.source = parsedUrl.searchParams.get('source') || prefill.source;
        prefill.city = parsedUrl.searchParams.get('city') || prefill.city;
        prefill.service = parsedUrl.searchParams.get('service') || prefill.service;
        prefill.selected_style = parsedUrl.searchParams.get('selected_style') || prefill.selected_style;
        prefill.selected_image = parsedUrl.searchParams.get('selected_image') || prefill.selected_image;
        prefill.selected_project_label = parsedUrl.searchParams.get('selected_project_label') || prefill.selected_project_label;
        prefill.prefill_message = parsedUrl.searchParams.get('prefill_message') || prefill.prefill_message;
        prefill.estimated_timeline = parsedUrl.searchParams.get('estimated_timeline') || parsedUrl.searchParams.get('timeline') || prefill.estimated_timeline;
        prefill.budget_range = parsedUrl.searchParams.get('budget_range') || prefill.budget_range;
        prefill.project_goal = parsedUrl.searchParams.get('project_goal') || prefill.project_goal;
        prefill.priority_zone = parsedUrl.searchParams.get('priority_zone') || prefill.priority_zone;
      }

      if (trigger.hasAttribute('data-service-choice')) {
        prefill.service = trigger.getAttribute('data-service-choice') || prefill.service;
        prefill.source = 'project_fit';
      }
      if (trigger.hasAttribute('data-lead-tier')) {
        prefill.consultation_tier = trigger.getAttribute('data-lead-tier') || '';
        prefill.lead_tier = prefill.consultation_tier;
        prefill.budget_range = getBudgetRangeFromTier(prefill.consultation_tier);
        prefill.source = 'lead_tier';
      }
      if (trigger.hasAttribute('data-form-prefill-trigger')) {
        prefill.service = trigger.getAttribute('data-prefill-service') || prefill.service;
        prefill.selected_style = trigger.getAttribute('data-prefill-style') || prefill.selected_style;
        prefill.selected_image = trigger.getAttribute('data-prefill-image') || prefill.selected_image;
        prefill.selected_project_label = trigger.getAttribute('data-prefill-project-label') || prefill.selected_project_label;
        prefill.prefill_message = trigger.getAttribute('data-prefill-message') || prefill.prefill_message;
        prefill.source = trigger.getAttribute('data-prefill-source') || prefill.source;
      }
    }

    if (!prefill.service && document.body && document.body.dataset && document.body.dataset.serviceSlug) {
      prefill.service = document.body.dataset.serviceSlug;
    }

    if (!prefill.prefill_message && prefill.service) {
      prefill.prefill_message = 'Interested in ' + resolveServiceFormValue(prefill.service) + '. Please contact me about next steps.';
    }

    return prefill;
  }

  function ensureConsultDrawer() {
    if (consultDrawerState) return consultDrawerState;

    var drawer = document.createElement('div');
    drawer.className = 'consult-drawer';
    drawer.id = 'consult-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="consult-drawer__backdrop" data-consult-close></div>' +
      '<aside class="consult-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="consult-drawer-title">' +
      '  <button type="button" class="consult-drawer__close" id="consult-drawer-close" aria-label="Close consultation drawer">&#x2715;</button>' +
      '  <div class="consult-drawer__content">' +
      '    <span class="consult-drawer__eyebrow">Fastest Way to Start</span>' +
      '    <h2 class="consult-drawer__title" id="consult-drawer-title">' + OFFER_FORM_TITLE + '</h2>' +
      '    <p class="consult-drawer__sub" id="consult-drawer-sub">Share the basics only. We use this to understand your yard before calling. No spam, no obligation.</p>' +
      '    <ul class="consult-drawer__proof">' +
      '      <li>Prefer not to fill this out? Call ' + SITE_PHONE_DISPLAY + ' and we will talk it through.</li>' +
      '      <li>Starter phases and full transformations are both welcome when the scope is prioritized.</li>' +
      '      <li>We use your phone only to clarify this project request. Prefer text? Choose text below.</li>' +
      '    </ul>' +
      '    <div class="consult-drawer__trust-row" aria-label="Project review trust signals">' +
      '      <span>43 Google reviews</span>' +
      '      <span>ROC + warranty review</span>' +
      '      <span>1-business-day follow-up</span>' +
      '    </div>' +
      '    <div class="consult-drawer__context" id="consult-drawer-context">' +
      '      <strong id="consult-drawer-context-label">Request Context</strong>' +
      '      <p id="consult-drawer-context-body"></p>' +
      '    </div>' +
      '    <form class="consult-drawer__form" id="consult-drawer-form" novalidate>' +
      '      <input type="hidden" name="form_type" value="project_request" />' +
      '      <input type="hidden" name="ticket_id" id="consult-ticket-id" value="" />' +
      '      <input type="hidden" name="submitted_local" id="consult-submitted-local" value="" />' +
      '      <input type="hidden" name="first_name" id="consult-first-name" value="" />' +
      '      <input type="hidden" name="last_name" id="consult-last-name" value="" />' +
      '      <input type="hidden" name="selected_service" id="consult-selected-service" value="" />' +
      '      <input type="hidden" name="selected_style" id="consult-selected-style" value="" />' +
      '      <input type="hidden" name="selected_image" id="consult-selected-image" value="" />' +
      '      <input type="hidden" name="selected_project_label" id="consult-selected-project-label" value="" />' +
      '      <input type="hidden" name="lead_source" id="consult-lead-source" value="" />' +
      '      <input type="hidden" name="utm_source" id="consult-utm-source" value="" />' +
      '      <input type="hidden" name="utm_medium" id="consult-utm-medium" value="" />' +
      '      <input type="hidden" name="utm_campaign" id="consult-utm-campaign" value="" />' +
      '      <input type="hidden" name="utm_content" id="consult-utm-content" value="" />' +
      '      <input type="hidden" name="referrer" id="consult-referrer" value="" />' +
      '      <input type="hidden" name="landing_path" id="consult-landing-path" value="" />' +
      '      <input type="hidden" name="page_url" id="consult-page-url" value="" />' +
      '      <input type="hidden" name="consultation_tier" id="consult-consultation-tier" value="" />' +
      '      <input type="hidden" name="lead_tier" id="consult-lead-tier" value="" />' +
      '      <input type="hidden" name="preferred_contact_method" id="consult-contact-method" value="" />' +
      '      <input type="hidden" name="contact_method" id="consult-contact-method-value" value="" />' +
      '      <input type="hidden" name="timeline" id="consult-timeline-hidden" value="" />' +
      '      <input type="hidden" name="start_timeline" id="consult-start-timeline" value="" />' +
      '      <p class="hidden-field"><label>Do not fill this out: <input name="bot-field" tabindex="-1" autocomplete="off" /></label></p>' +
      '      <input type="hidden" name="form_started_at" id="consult-form-started-at" value="" />' +
      '      <input type="hidden" name="js_check" id="consult-js-check" value="0" />' +
      '      <input type="hidden" name="consent_required" value="1" />' +
      '      <div class="form-field">' +
      '        <label for="consult-full-name">Name <span class="field-required">Required</span></label>' +
      '        <input type="text" id="consult-full-name" name="full_name" placeholder="Your full name" autocomplete="name" required />' +
      '      </div>' +
      '      <div class="consult-drawer__grid">' +
      '        <div class="form-field">' +
      '          <label for="consult-phone">Phone Number <span class="field-required">Required</span></label>' +
      '          <input type="tel" id="consult-phone" name="phone" placeholder="(480) 555-0000" autocomplete="tel" inputmode="tel" required />' +
      '        </div>' +
      '        <div class="form-field">' +
      '          <label for="consult-city">City <span class="field-required">Required</span></label>' +
      '          <input type="text" id="consult-city" name="city" placeholder="' + SITE_CITY + '" autocomplete="address-level2" required />' +
      '        </div>' +
      '      </div>' +
      '      <div class="consult-drawer__grid">' +
      '        <div class="form-field">' +
      '          <label for="consult-email">Email <span class="field-optional">Optional</span></label>' +
      '          <input type="email" id="consult-email" name="email_visible" placeholder="you@example.com" autocomplete="email" inputmode="email" />' +
      '        </div>' +
      '        <div class="form-field">' +
      '          <label for="consult-service">Project Type <span class="field-required">Required</span></label>' +
      '          <select id="consult-service" name="service" data-service-select required></select>' +
      '        </div>' +
      '      </div>' +
      '      <p class="consult-drawer__talk-note">Prefer to talk it through? Call ' + SITE_PHONE_DISPLAY + ', or choose text below and send only the basics.</p>' +
      '      <details class="consult-drawer__details">' +
      '        <summary>Add optional details</summary>' +
      '      <div class="consult-drawer__grid">' +
      '        <div class="form-field">' +
      '          <label for="consult-project-goal">Project Goal <span class="field-optional">Optional</span></label>' +
      '          <select id="consult-project-goal" name="project_goal">' +
      '            <option value="">Select goal</option>' +
      '            <option value="Focused first phase">Focused first phase</option>' +
      '            <option value="Whole-yard design-build">Whole-yard design-build</option>' +
      '            <option value="Private estate project review">Private estate project review</option>' +
      '            <option value="Fix layout, drainage, or usability">Fix layout, drainage, or usability</option>' +
      '            <option value="Not sure yet">Not sure yet</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="form-field">' +
      '          <label for="consult-priority-zone">Top Priority Zone <span class="field-optional">Optional</span></label>' +
      '          <select id="consult-priority-zone" name="priority_zone">' +
      '            <option value="">Select priority zone</option>' +
      '            <option value="Front yard curb appeal">Front yard curb appeal</option>' +
      '            <option value="Backyard entertaining">Backyard entertaining</option>' +
      '            <option value="Patio or pavers">Patio or pavers</option>' +
      '            <option value="Turf or play zone">Turf or play zone</option>' +
      '            <option value="Pool-adjacent living">Pool-adjacent living</option>' +
      '            <option value="Irrigation, drainage, or lighting">Irrigation, drainage, or lighting</option>' +
      '          </select>' +
      '        </div>' +
      '      </div>' +
      '      <div class="consult-drawer__grid">' +
      '        <div class="form-field">' +
      '          <label for="consult-budget-range">Rough Budget <span class="field-optional">Optional</span></label>' +
      '          <select id="consult-budget-range" name="budget_range">' +
      '            <option value="">Select a planning range</option>' +
      '            <option value="$10,000 - $25,000">$10,000 - $25,000</option>' +
      '            <option value="$25,000 - $60,000">$25,000 - $60,000</option>' +
      '            <option value="$60,000 - $150,000">$60,000 - $150,000</option>' +
      '            <option value="$150,000+">$150,000+</option>' +
      '            <option value="Not sure yet">Not sure yet</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="form-field">' +
      '          <label for="consult-estimated-timeline">Estimated Timeline <span class="field-optional">Optional</span></label>' +
      '          <select id="consult-estimated-timeline" name="estimated_timeline">' +
      '            <option value="">Select a timeline</option>' +
      '            <option value="3-6 months">3-6 months</option>' +
      '            <option value="1-3 months">1-3 months</option>' +
      '            <option value="Within 30 days">Within 30 days</option>' +
      '            <option value="ASAP">ASAP</option>' +
      '          </select>' +
      '        </div>' +
      '      </div>' +
      '      <div class="form-field">' +
      '        <label for="consult-contact-method-choice">Preferred Contact Method <span class="field-optional">Optional</span></label>' +
      '        <select id="consult-contact-method-choice" aria-describedby="consult-contact-help">' +
      '          <option value="">No preference</option>' +
      '          <option value="Phone call">Phone call</option>' +
      '          <option value="Text message">Text message</option>' +
      '          <option value="Email">Email</option>' +
      '        </select>' +
      '      </div>' +
      '      <div class="form-field">' +
      '        <label for="consult-message">Project Notes <span class="field-optional">Optional</span></label>' +
      '        <textarea id="consult-message" name="message" rows="4" placeholder="Optional: share goals, HOA or access needs, phasing, style preferences, or the kind of yard you want to build."></textarea>' +
      '      </div>' +
      '      </details>' +
      '      <label class="form-consent form-consent--drawer" for="consult-contact-consent">' +
      '        <input type="checkbox" id="consult-contact-consent" name="contact_consent" value="yes" required />' +
      '        <span>I agree to be contacted by Think Green about this project request by phone, text, or email. No spam, no resale. See our <a href="/privacy-policy">Privacy Policy</a>.</span>' +
      '      </label>' +
      '      <div class="turnstile-field" data-turnstile-container></div>' +
      '      <p class="turnstile-status" data-turnstile-status role="status" aria-live="polite"></p>' +
      '      <div class="consult-drawer__actions">' +
      '        <button type="submit" class="btn btn--submit" id="consult-submit">' + OFFER_SUBMIT_LABEL + '</button>' +
      '        <p class="consult-drawer__budget-note" id="consult-budget-note">Focused first phases and larger builds are reviewed by the same local team. We filter out maintenance-only, tree trimming, mow/blow, and tiny repair calls before scheduling.</p>' +
      '        <p class="consult-drawer__note" id="consult-contact-help">Takes about 60 seconds. No obligation. Your phone is used only to follow up about this project, and we do not sell or share your request.</p>' +
      '        <p class="consult-drawer__error" id="consult-drawer-error" role="alert" aria-live="polite"></p>' +
      '      </div>' +
      '    </form>' +
      '    <div class="consult-drawer__success" id="consult-drawer-success" aria-live="polite">' +
      '      <h3>Request received.</h3>' +
      '      <p>Your project request is on the way to the team now. Redirecting to the confirmation page.</p>' +
      '    </div>' +
      '  </div>' +
      '</aside>';

    document.body.appendChild(drawer);
    applyContactFormServices();

    consultDrawerState = {
      drawer: drawer,
      panel: drawer.querySelector('.consult-drawer__panel'),
      close: drawer.querySelector('#consult-drawer-close'),
      backdrop: drawer.querySelector('[data-consult-close]'),
      form: drawer.querySelector('#consult-drawer-form'),
      title: drawer.querySelector('#consult-drawer-title'),
      sub: drawer.querySelector('#consult-drawer-sub'),
      context: drawer.querySelector('#consult-drawer-context'),
      contextBody: drawer.querySelector('#consult-drawer-context-body'),
      fullName: drawer.querySelector('#consult-full-name'),
      phone: drawer.querySelector('#consult-phone'),
      city: drawer.querySelector('#consult-city'),
      email: drawer.querySelector('#consult-email'),
      service: drawer.querySelector('#consult-service'),
      contactChoice: drawer.querySelector('#consult-contact-method-choice'),
      timeline: drawer.querySelector('#consult-estimated-timeline'),
      message: drawer.querySelector('#consult-message'),
      ticketId: drawer.querySelector('#consult-ticket-id'),
      submittedLocal: drawer.querySelector('#consult-submitted-local'),
      firstName: drawer.querySelector('#consult-first-name'),
      lastName: drawer.querySelector('#consult-last-name'),
      selectedService: drawer.querySelector('#consult-selected-service'),
      selectedStyle: drawer.querySelector('#consult-selected-style'),
      selectedImage: drawer.querySelector('#consult-selected-image'),
      selectedProjectLabel: drawer.querySelector('#consult-selected-project-label'),
      leadSource: drawer.querySelector('#consult-lead-source'),
      utmSource: drawer.querySelector('#consult-utm-source'),
      utmMedium: drawer.querySelector('#consult-utm-medium'),
      utmCampaign: drawer.querySelector('#consult-utm-campaign'),
      utmContent: drawer.querySelector('#consult-utm-content'),
      referrer: drawer.querySelector('#consult-referrer'),
      landingPath: drawer.querySelector('#consult-landing-path'),
      pageUrl: drawer.querySelector('#consult-page-url'),
      consultationTier: drawer.querySelector('#consult-consultation-tier'),
      leadTier: drawer.querySelector('#consult-lead-tier'),
      budgetRange: drawer.querySelector('#consult-budget-range'),
      projectGoal: drawer.querySelector('#consult-project-goal'),
      priorityZone: drawer.querySelector('#consult-priority-zone'),
      contactMethod: drawer.querySelector('#consult-contact-method'),
      contactMethodValue: drawer.querySelector('#consult-contact-method-value'),
      timelineHidden: drawer.querySelector('#consult-timeline-hidden'),
      startTimeline: drawer.querySelector('#consult-start-timeline'),
      formStartedAt: drawer.querySelector('#consult-form-started-at'),
      jsCheck: drawer.querySelector('#consult-js-check'),
      consent: drawer.querySelector('#consult-contact-consent'),
      error: drawer.querySelector('#consult-drawer-error'),
      success: drawer.querySelector('#consult-drawer-success'),
      submit: drawer.querySelector('#consult-submit')
    };

    setupTurnstileForm(consultDrawerState.form, 'project_request');

    consultDrawerState.focusTrap = createFocusTrap(consultDrawerState.panel, function () {
      closeConsultDrawer();
    });

    function syncDrawerContactMethod(value) {
      var next = String(value || '').trim();
      consultDrawerState.contactMethod.value = next;
      consultDrawerState.contactMethodValue.value = next;
    }

    function syncDrawerTimeline(value) {
      var next = String(value || '').trim();
      consultDrawerState.timelineHidden.value = next;
      consultDrawerState.startTimeline.value = next;
    }

    function clearDrawerError() {
      consultDrawerState.error.textContent = '';
      consultDrawerState.error.classList.remove('is-visible');
    }

    consultDrawerState.contactChoice.addEventListener('change', function () {
      syncDrawerContactMethod(this.value);
    });
    consultDrawerState.timeline.addEventListener('change', function () {
      syncDrawerTimeline(this.value);
    });
    consultDrawerState.phone.addEventListener('input', function () {
      var digits = this.value.replace(/\D/g, '');
      if (digits.length >= 10) {
        this.value = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6, 10);
      } else {
        this.value = digits;
      }
    });
    consultDrawerState.form.querySelectorAll('input, select, textarea').forEach(function (field) {
      field.addEventListener('input', function () {
        this.style.borderColor = '';
        clearDrawerError();
      });
      field.addEventListener('change', function () {
        this.style.borderColor = '';
        clearDrawerError();
      });
    });

    consultDrawerState.close.addEventListener('click', function () {
      closeConsultDrawer();
    });
    consultDrawerState.backdrop.addEventListener('click', function () {
      closeConsultDrawer();
    });

    consultDrawerState.form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearDrawerError();

      var requiredFields = [
        consultDrawerState.fullName,
        consultDrawerState.phone,
        consultDrawerState.city,
        consultDrawerState.service,
        consultDrawerState.consent
      ];
      if (!validateRequiredFields(requiredFields, consultDrawerState.error, 'Please complete the required fields before submitting your project request.')) {
        consultDrawerState.error.classList.add('is-visible');
        return;
      }

      var turnstileToken = getTurnstileToken(consultDrawerState.form);
      if (!turnstileToken) {
        var turnstileMessage = getTurnstileRequiredMessage(consultDrawerState.form);
        setTurnstileStatus(consultDrawerState.form, turnstileMessage, true);
        consultDrawerState.error.textContent = turnstileMessage;
        consultDrawerState.error.classList.add('is-visible');
        return;
      }

      var ticketId = getOrCreateTicketId(consultDrawerState.ticketId);
      var submittedDate = new Date();
      var submittedLocalTime = formatPhoenixDateTime(submittedDate);
      var nameParts = splitName(consultDrawerState.fullName.value);
      var service = String(consultDrawerState.service.value || '').trim();
      var city = String(consultDrawerState.city.value || '').trim();
      var leadSource = String(consultDrawerState.leadSource.value || deriveConsultSource()).trim();
      var selectedStyle = String(consultDrawerState.selectedStyle.value || '').trim();
      var selectedProjectLabel = String(consultDrawerState.selectedProjectLabel.value || '').trim();

      consultDrawerState.ticketId.value = ticketId;
      consultDrawerState.submittedLocal.value = submittedLocalTime;
      consultDrawerState.firstName.value = nameParts.first;
      consultDrawerState.lastName.value = nameParts.last;
      consultDrawerState.selectedService.value = service;
      consultDrawerState.leadSource.value = leadSource;
      consultDrawerState.utmSource.value = String(URL_PARAMS.get('utm_source') || '');
      consultDrawerState.utmMedium.value = String(URL_PARAMS.get('utm_medium') || '');
      consultDrawerState.utmCampaign.value = String(URL_PARAMS.get('utm_campaign') || '');
      consultDrawerState.utmContent.value = String(URL_PARAMS.get('utm_content') || '');
      consultDrawerState.referrer.value = String(document.referrer || 'direct');
      consultDrawerState.landingPath.value = String(window.location.pathname || '/');
      consultDrawerState.pageUrl.value = String(window.location.href || '');
      syncDrawerContactMethod(consultDrawerState.contactChoice.value);
      syncDrawerTimeline(consultDrawerState.timeline.value);

      var payload = {};
      new FormData(consultDrawerState.form).forEach(function (value, key) {
        payload[key] = String(value);
      });
      payload['cf-turnstile-response'] = turnstileToken;

      var defaultButtonText = consultDrawerState.submit.textContent;
      consultDrawerState.submit.disabled = true;
      consultDrawerState.submit.textContent = 'Submitting...';

      try {
        var response = await fetch(getLeadSubmissionEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encodeFormData(payload)
        });

        await requireAcceptedLeadResponse(response);

        consultDrawerState.form.hidden = true;
        consultDrawerState.success.classList.add('is-visible');

        if (typeof window.trackLeadEvent === 'function') {
          window.trackLeadEvent('form_submit', {
            ticket_id: ticketId,
            service: service,
            lead_source: leadSource,
            selected_style: selectedStyle || undefined,
            selected_project_label: selectedProjectLabel || undefined,
            city: city,
            page_location: window.location.href
          });
        }

        setTimeout(function () {
          var thankYouParams = new URLSearchParams({
            ticket_id: ticketId,
            service: service,
            city: city,
            source: leadSource,
            selected_style: selectedStyle,
            selected_project_label: selectedProjectLabel
          });
          window.location.href = '/thank-you?' + thankYouParams.toString();
        }, 350);
      } catch (error) {
        consultDrawerState.submit.disabled = false;
        consultDrawerState.submit.textContent = defaultButtonText;
        consultDrawerState.error.textContent = error && error.message
          ? error.message
          : 'We could not submit your request right now. Please call us at ' + SITE_PHONE_DISPLAY + '.';
        consultDrawerState.error.classList.add('is-visible');
      } finally {
        safeResetTurnstile(consultDrawerState.form);
      }
    });

    return consultDrawerState;
  }

  function getConsultDrawerFallbackFocus() {
    var candidates = [
      consultDrawerReturnFocus,
      document.querySelector('.nav__cta'),
      document.getElementById('nav-burger'),
      document.querySelector('main a[href], main button:not([disabled])')
    ];

    return candidates.find(function (candidate) {
      return candidate &&
        typeof candidate.focus === 'function' &&
        document.contains(candidate) &&
        candidate.getClientRects().length > 0 &&
        !(consultDrawerState && consultDrawerState.drawer && consultDrawerState.drawer.contains(candidate));
    }) || null;
  }

  function openConsultDrawer(prefill) {
    var state = ensureConsultDrawer();
    var nextPrefill = prefill || {};
    var resolvedService = resolveServiceFormValue(nextPrefill.service);
    var contextLines = [];
    var contextSource = String(nextPrefill.source || '').trim();
    var activeBeforeDrawer = document.activeElement;

    function getConsultSubmitLabel() {
      if (contextSource === 'mesa_first_phase' || /first phase/i.test(String(nextPrefill.prefill_message || ''))) {
        return 'Price My First Phase';
      }
      if (contextSource === 'paradise_valley_private_review' || contextSource === 'estate_project_review') {
        return 'Request My Private Review';
      }
      return OFFER_SUBMIT_LABEL;
    }

    function getConsultTitle() {
      if (contextSource === 'mesa_first_phase' || /first phase/i.test(String(nextPrefill.prefill_message || nextPrefill.project_goal || ''))) {
        return 'Price a Practical First Phase';
      }
      if (contextSource === 'paradise_valley_private_review' || contextSource === 'estate_project_review' || /estate/i.test(String(nextPrefill.project_goal || ''))) {
        return 'Tell Us About the Property and Project Scope';
      }
      return 'Start Your Project Review';
    }

    function getConsultSubcopy() {
      if (contextSource === 'mesa_first_phase' || /first phase/i.test(String(nextPrefill.prefill_message || nextPrefill.project_goal || ''))) {
        return 'Share the city, priority zone, budget comfort range, and timing so the team can price the highest-impact first phase before a larger rebuild.';
      }
      if (contextSource === 'paradise_valley_private_review' || contextSource === 'estate_project_review' || /estate/i.test(String(nextPrefill.project_goal || ''))) {
        return 'Share the property context, finish expectations, access or trade coordination needs, budget range, and timing for a private estate project review.';
      }
      return 'Share city, project type, budget range, and timing first. Contact details are used only to follow up about this project.';
    }

    closeMenu(false);
    if (activeBeforeDrawer && activeBeforeDrawer !== document.body && !state.drawer.contains(activeBeforeDrawer)) {
      consultDrawerReturnFocus = activeBeforeDrawer;
    } else {
      consultDrawerReturnFocus = document.querySelector('.nav__cta') || document.getElementById('nav-burger');
    }

    state.form.reset();
    safeResetTurnstile(state.form);
    state.form.hidden = false;
    state.success.classList.remove('is-visible');
    state.submit.disabled = false;
    state.title.textContent = getConsultTitle();
    state.sub.textContent = getConsultSubcopy();
    state.submit.textContent = getConsultSubmitLabel();
    state.error.textContent = '';
    state.error.classList.remove('is-visible');

    state.ticketId.value = '';
    state.submittedLocal.value = '';
    state.firstName.value = '';
    state.lastName.value = '';
    state.selectedService.value = resolvedService;
    state.selectedStyle.value = nextPrefill.selected_style || '';
    state.selectedImage.value = nextPrefill.selected_image || '';
    state.selectedProjectLabel.value = nextPrefill.selected_project_label || '';
    state.leadSource.value = nextPrefill.source || deriveConsultSource();
    state.consultationTier.value = nextPrefill.consultation_tier || '';
    state.leadTier.value = nextPrefill.lead_tier || nextPrefill.consultation_tier || '';
    state.budgetRange.value = nextPrefill.budget_range || '';
    state.projectGoal.value = nextPrefill.project_goal || '';
    state.priorityZone.value = nextPrefill.priority_zone || '';
    state.pageUrl.value = String(window.location.href || '');
    state.referrer.value = String(document.referrer || 'direct');
    state.landingPath.value = String(window.location.pathname || '/');

    state.service.value = resolvedService;
    state.city.value = nextPrefill.city || '';
    state.contactChoice.value = nextPrefill.contact_method || '';
    state.timeline.value = nextPrefill.estimated_timeline || '';
    state.message.value = nextPrefill.prefill_message || '';

    state.contactMethod.value = state.contactChoice.value;
    state.contactMethodValue.value = state.contactChoice.value;
    state.timelineHidden.value = state.timeline.value;
    state.startTimeline.value = state.timeline.value;
    state.formStartedAt.value = String(Date.now());
    state.jsCheck.value = '1';

    if (resolvedService) {
      contextLines.push('Project type: ' + resolvedService);
    }
    if (nextPrefill.city) {
      contextLines.push('City: ' + nextPrefill.city);
    }
    if (nextPrefill.budget_range) {
      contextLines.push('Planning range: ' + nextPrefill.budget_range);
    }
    if (nextPrefill.project_goal) {
      contextLines.push('Project goal: ' + nextPrefill.project_goal);
    }
    if (nextPrefill.priority_zone) {
      contextLines.push('Priority zone: ' + nextPrefill.priority_zone);
    }
    if (contextSource === 'mesa_first_phase') {
      contextLines.push('First-phase request: price the highest-impact Mesa scope before a whole-yard rebuild.');
    }
    if (contextSource === 'paradise_valley_private_review' || contextSource === 'estate_project_review') {
      contextLines.push('Private review: coordination, finish quality, access, and construction sequencing matter.');
    }
    if (nextPrefill.selected_project_label) {
      contextLines.push('Project reference: ' + nextPrefill.selected_project_label);
    }
    if (nextPrefill.selected_style) {
      contextLines.push('Style direction: ' + toTitleCase(String(nextPrefill.selected_style).replace(/[-_]/g, ' ')));
    }
    if (nextPrefill.consultation_tier) {
      contextLines.push('Budget tier interest: ' + nextPrefill.consultation_tier);
    }

    state.context.classList.toggle('is-visible', !!contextLines.length);
    state.contextBody.textContent = contextLines.join(' · ');

    state.drawer.classList.add('is-open');
    state.drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-consult-drawer-open');
    document.body.style.overflow = 'hidden';
    setBackgroundInertForConsult(true);
    state.focusTrap.activate(state.close);
    state.fullName.focus();
    updateStickyBar();
    updateScrollTop();

    if (typeof window.trackLeadEvent === 'function') {
      window.trackLeadEvent('consult_drawer_open', {
        source: state.leadSource.value,
        service: resolvedService || undefined,
        selected_style: state.selectedStyle.value || undefined,
        page_location: window.location.href
      });
    }
  }

  function closeConsultDrawer(restoreFocus) {
    if (!consultDrawerState || !consultDrawerState.drawer.classList.contains('is-open')) return;
    var shouldRestoreFocus = restoreFocus !== false;
    var focusTarget = shouldRestoreFocus ? getConsultDrawerFallbackFocus() : null;
    consultDrawerState.drawer.classList.remove('is-open');
    consultDrawerState.drawer.setAttribute('aria-hidden', 'true');
    safeResetTurnstile(consultDrawerState.form);
    document.body.classList.remove('has-consult-drawer-open');
    document.body.style.overflow = overlay && overlay.classList.contains('is-open') ? 'hidden' : '';
    setBackgroundInertForConsult(false);
    consultDrawerState.focusTrap.deactivate(false);
    if (focusTarget) {
      window.setTimeout(function () {
        focusTarget.focus({ preventScroll: true });
      }, 0);
    }
    updateStickyBar();
    updateScrollTop();
  }

  window.openConsultDrawer = openConsultDrawer;
  window.closeConsultDrawer = closeConsultDrawer;

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('a, button') : null;
    if (!trigger) return;
    if (trigger.type === 'submit') return;
    if (trigger.closest('#contact-form') || trigger.closest('#consult-drawer-form')) return;
    if (trigger.hasAttribute('download')) return;

    var href = String(trigger.getAttribute('href') || '');
    var text = String(trigger.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var isDedicatedConsultPageLink = href.indexOf('/free-consultation') >= 0;
    var isConsultTrigger = trigger.hasAttribute('data-service-choice') ||
      trigger.hasAttribute('data-lead-tier') ||
      trigger.hasAttribute('data-form-prefill-trigger') ||
      href.indexOf('#contact') >= 0 ||
      href.indexOf('selected_style=') >= 0 ||
      text.indexOf('get free landscaping quote') >= 0 ||
      text.indexOf('request a similar project') >= 0;

    if (!isConsultTrigger) return;
    if (isDedicatedConsultPageLink) return;

    event.preventDefault();
    openConsultDrawer(buildConsultPrefillFromTrigger(trigger));
  });

  /* ---- SMOOTH SCROLL ---- */
  function focusHashTarget(target) {
    if (!target) return;
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    try {
      target.focus({ preventScroll: true });
    } catch (error) {
      target.focus();
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = this.getAttribute('href');
      if (id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var offset = nav ? nav.offsetHeight + 8 : 80;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', id);
      } else {
        window.location.hash = id.slice(1);
      }
      if (this.classList.contains('skip-link') || id === '#main-content') {
        window.setTimeout(function () {
          focusHashTarget(target);
        }, 120);
      }
    });
  });

  window.addEventListener('load', function () {
    if (!window.location.hash) return;
    var hashTarget = document.querySelector(window.location.hash);
    if (!hashTarget) return;
    var offset = nav ? nav.offsetHeight + 8 : 80;
    window.scrollTo({ top: hashTarget.getBoundingClientRect().top + window.scrollY - offset, behavior: 'auto' });
    if (window.location.hash === '#main-content') {
      focusHashTarget(hashTarget);
    }
  });

  if (normalizedPath.indexOf('/free-consultation') === 0) {
    var autostartConsultation = URL_PARAMS.get('autostart') === '1';
    var prefillingConsultation = URL_PARAMS.get('service') || URL_PARAMS.get('city') || URL_PARAMS.get('prefill_message');
    if (autostartConsultation || prefillingConsultation) {
      window.requestAnimationFrame(function () {
        openConsultDrawer({
          source: URL_PARAMS.get('source') || 'consultation_page',
          service: URL_PARAMS.get('service') || '',
          city: URL_PARAMS.get('city') || '',
          selected_style: URL_PARAMS.get('selected_style') || '',
          selected_image: URL_PARAMS.get('selected_image') || '',
          selected_project_label: URL_PARAMS.get('selected_project_label') || '',
          prefill_message: URL_PARAMS.get('prefill_message') || '',
          estimated_timeline: URL_PARAMS.get('estimated_timeline') || URL_PARAMS.get('timeline') || '',
          budget_range: URL_PARAMS.get('budget_range') || '',
          project_goal: URL_PARAMS.get('project_goal') || '',
          priority_zone: URL_PARAMS.get('priority_zone') || ''
        });
      });
    }
  }

  /* ---- HERO CAROUSEL ---- */
  var slides = document.querySelectorAll('.hero__slide');
  var dots = document.querySelectorAll('.hero__dot');
  var current = 0;
  var heroTimer;
  var heroLeaveTimer;
  var heroPreloadTimer;
  var heroRequestId = 0;

  function heroBackgroundValue(avifPath, webpPath) {
    if (avifPath && webpPath) {
      return 'image-set(url("' + avifPath + '") type("image/avif"), url("' + webpPath + '") type("image/webp"))';
    }
    return 'url("' + (avifPath || webpPath) + '")';
  }

  function preloadHeroSlide(index) {
    if (!slides.length) return Promise.resolve(null);
    var slide = slides[(index + slides.length) % slides.length];
    if (!slide) return Promise.resolve(null);
    if (slide.dataset.preloaded === 'true') return Promise.resolve(slide);
    if (slide._heroLoadPromise) return slide._heroLoadPromise;

    if (slide.style.backgroundImage) {
      slide.dataset.preloaded = 'true';
      return Promise.resolve(slide);
    }

    var avifPath = String(slide.dataset.heroImageAvif || '').trim();
    var webpPath = String(slide.dataset.heroImageWebp || '').trim();
    var primaryPath = avifPath || webpPath;
    if (!primaryPath) return Promise.resolve(null);

    slide._heroLoadPromise = new Promise(function (resolve) {
      var image = new Image();
      var triedWebp = false;
      image.decoding = 'async';
      image.onload = function () {
        slide.style.backgroundImage = heroBackgroundValue(avifPath, webpPath);
        slide.dataset.preloaded = 'true';
        resolve(slide);
      };
      image.onerror = function () {
        if (!triedWebp && webpPath && primaryPath !== webpPath) {
          triedWebp = true;
          image.src = webpPath;
          return;
        }
        slide.dataset.preloadFailed = 'true';
        resolve(null);
      };
      image.src = primaryPath;
    });
    return slide._heroLoadPromise;
  }

  function scheduleHeroPreload(index, delay) {
    clearTimeout(heroPreloadTimer);
    heroPreloadTimer = setTimeout(function () {
      preloadHeroSlide(index);
    }, delay);
  }

  function goToSlide(n) {
    if (!slides.length || !dots.length) return;
    var target = (n + slides.length) % slides.length;
    var requestId = ++heroRequestId;
    preloadHeroSlide(target).then(function (readySlide) {
      if (!readySlide || requestId !== heroRequestId || target === current) return;

      var previous = slides[current];
      clearTimeout(heroLeaveTimer);
      previous.classList.add('is-leaving');
      previous.classList.remove('is-active');
      dots[current].classList.remove('is-active');

      current = target;
      readySlide.classList.add('is-active');
      dots[current].classList.add('is-active');
      scheduleHeroPreload(current + 1, 2200);

      heroLeaveTimer = setTimeout(function () {
        previous.classList.remove('is-leaving');
      }, 1900);
    });
  }

  function nextSlide() {
    goToSlide(current + 1);
  }

  function startCarousel() {
    clearInterval(heroTimer);
    heroTimer = setInterval(nextSlide, 5500);
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      goToSlide(parseInt(this.dataset.slide, 10));
      startCarousel();
    });
  });

  if (slides.length > 1) {
    preloadHeroSlide(0);
    var initialHeroPreloadDelay = window.matchMedia && window.matchMedia('(max-width: 640px)').matches ? 3500 : 2000;
    scheduleHeroPreload(1, initialHeroPreloadDelay);
    startCarousel();
  }

  /* Pause carousel on hover or keyboard focus (accessibility) */
  var heroSection = document.querySelector('.hero');
  if (heroSection) {
    heroSection.addEventListener('mouseenter', function () { clearInterval(heroTimer); });
    heroSection.addEventListener('mouseleave', function () { if (slides.length > 1) startCarousel(); });
    heroSection.addEventListener('focusin',    function () { clearInterval(heroTimer); });
    heroSection.addEventListener('focusout',   function () { if (slides.length > 1) startCarousel(); });
  }

  /* ---- BEFORE / AFTER SLIDER ---- */
  document.querySelectorAll('[data-before-after]').forEach(function (slider) {
    var range = slider.querySelector('[data-before-after-range]');
    var overlayPanel = slider.querySelector('[data-before-after-overlay]');
    var divider = slider.querySelector('[data-before-after-divider]');
    if (!range || !overlayPanel || !divider) return;
    var activePointerId = null;

    function updateBeforeAfter() {
      var value = Number(range.value || 50);
      var insetRight = Math.max(0, Math.min(100, 100 - value));
      overlayPanel.style.clipPath = 'inset(0 ' + insetRight + '% 0 0)';
      overlayPanel.style.webkitClipPath = 'inset(0 ' + insetRight + '% 0 0)';
      divider.style.left = value + '%';
    }

    function updateFromClientX(clientX) {
      var rect = slider.getBoundingClientRect();
      if (!rect.width) return;
      var value = ((clientX - rect.left) / rect.width) * 100;
      value = Math.max(0, Math.min(100, value));
      range.value = String(value);
      updateBeforeAfter();
    }

    function startDrag(event) {
      activePointerId = event.pointerId;
      slider.classList.add('is-dragging');
      if (typeof slider.setPointerCapture === 'function' && event.pointerId !== undefined) {
        slider.setPointerCapture(event.pointerId);
      }
      updateFromClientX(event.clientX);
    }

    function moveDrag(event) {
      if (activePointerId === null) return;
      if (event.pointerId !== undefined && event.pointerId !== activePointerId) return;
      event.preventDefault();
      updateFromClientX(event.clientX);
    }

    function endDrag(event) {
      if (activePointerId === null) return;
      if (event && event.pointerId !== undefined && event.pointerId !== activePointerId) return;
      slider.classList.remove('is-dragging');
      if (event && typeof slider.releasePointerCapture === 'function' && event.pointerId !== undefined) {
        try { slider.releasePointerCapture(event.pointerId); } catch (err) {}
      }
      activePointerId = null;
    }

    range.addEventListener('input', updateBeforeAfter);
    range.addEventListener('change', updateBeforeAfter);
    slider.addEventListener('pointerdown', startDrag);
    slider.addEventListener('pointermove', moveDrag);
    slider.addEventListener('pointerup', endDrag);
    slider.addEventListener('pointercancel', endDrag);
    slider.addEventListener('pointerleave', endDrag);
    updateBeforeAfter();
  });

  /* ---- SCROLL REVEAL ---- */
  function assignRevealVariants() {
    var selectors = [
      '.feature-strip',
      '.service-item',
      '.review-card',
      '.fit-card',
      '.cost-card',
      '.why-card',
      '.process__step',
      '.faq-item',
      '.pf-item',
      '.pf-story',
      '.portfolio__item',
      '.before-after',
      '.feature-strip__image',
      '.feature-strip__body',
      '.trust-assets__card',
      '.search-intent__card',
      '.owner-proof-strip__item',
      '.local-proof__card',
      '.topic-list li',
      '.recent-project',
      '.conversion-guide__card'
    ];

    var variantClasses = [
      'reveal--left',
      'reveal--right',
      'reveal--lift',
      'reveal--scale',
      'reveal--soft',
      'reveal--zoom',
      'reveal--fade',
      'reveal--rotate',
      'reveal--clip',
      'reveal--drift',
      'reveal--sweep',
      'reveal--mask-up',
      'reveal--blur',
      'reveal--flip',
      'reveal--pin',
      'reveal--tilt',
      'reveal--glide-left',
      'reveal--glide-right',
      'reveal--unfold',
      'reveal--settle',
      'reveal--focus',
      'reveal--tuck'
    ];

    function hasRevealVariant(el) {
      return variantClasses.some(function (className) {
        return el.classList.contains(className);
      });
    }

    function addVariant(el, variants, index) {
      el.classList.add(variants[index % variants.length]);
    }

    selectors.forEach(function (selector) {
      document.querySelectorAll(selector + '.reveal').forEach(function (el, index) {
        if (hasRevealVariant(el)) {
          return;
        }

        if (selector === '.feature-strip__image') {
          addVariant(el, ['reveal--sweep', 'reveal--clip', 'reveal--focus'], index);
          return;
        }

        if (selector === '.feature-strip__body') {
          addVariant(el, ['reveal--glide-right', 'reveal--tuck', 'reveal--soft'], index);
          return;
        }

        if (selector === '.pf-item' || selector === '.portfolio__item') {
          addVariant(el, ['reveal--mask-up', 'reveal--focus', 'reveal--glide-left', 'reveal--settle'], index);
          return;
        }

        if (selector === '.review-card' || selector === '.recent-project') {
          addVariant(el, ['reveal--tilt', 'reveal--unfold', 'reveal--settle'], index);
          return;
        }

        if (selector === '.conversion-guide__card') {
          addVariant(el, ['reveal--settle', 'reveal--focus', 'reveal--tuck'], index);
          return;
        }

        if (selector === '.process__step') {
          addVariant(el, ['reveal--pin', 'reveal--lift', 'reveal--unfold'], index);
          return;
        }

        if (selector === '.service-item') {
          addVariant(el, ['reveal--glide-right', 'reveal--tuck', 'reveal--sweep'], index);
          return;
        }

        if (selector === '.faq-item') {
          addVariant(el, ['reveal--glide-left', 'reveal--mask-up', 'reveal--tuck'], index);
          return;
        }

        if (selector === '.cost-card' || selector === '.why-card' || selector === '.trust-assets__card' || selector === '.search-intent__card') {
          addVariant(el, ['reveal--settle', 'reveal--focus', 'reveal--pin'], index);
          return;
        }

        if (selector === '.pf-story' || selector === '.feature-strip') {
          el.classList.add('reveal--drift');
          return;
        }

        if (selector === '.before-after') {
          el.classList.add('reveal--mask-up');
          return;
        }

        if (selector === '.owner-proof-strip__item' || selector === '.local-proof__card' || selector === '.topic-list li') {
          addVariant(el, ['reveal--soft', 'reveal--settle', 'reveal--glide-left'], index);
          return;
        }

        addVariant(el, ['reveal--left', 'reveal--right', 'reveal--lift'], index);
      });
    });

    document.querySelectorAll('.reveal').forEach(function (el) {
      if (el.classList.contains('hero__stats') ||
          el.classList.contains('portfolio__header') ||
          el.classList.contains('services__header') ||
          el.classList.contains('featured-project__header') ||
          el.classList.contains('reviews__header') ||
          el.classList.contains('areas__header') ||
          el.classList.contains('project-fit__header') ||
          el.classList.contains('cost-expectations__header') ||
          el.classList.contains('faq__header') ||
          el.classList.contains('why-choose__header') ||
          el.classList.contains('pf-grid__header') ||
          el.classList.contains('pf-request')) {
        if (hasRevealVariant(el)) {
          return;
        }
        el.classList.add('reveal--soft');
      }
    });

    document.querySelectorAll('.lead-tier__actions.reveal, .portfolio__footer.reveal, .conversion-guide__actions.reveal, .recent-projects__links.reveal').forEach(function (el) {
      if (!hasRevealVariant(el)) {
        el.classList.add('reveal--settle');
      }
    });
  }

  assignRevealVariants();

  if ('IntersectionObserver' in window) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });

    /* Per-section stagger: elements in the same section get incrementing delays */
    var sectionCounters = new Map();
    document.querySelectorAll('.reveal').forEach(function (el) {
      if (/reveal--d(?:10|[1-9])/.test(el.className)) {
        revealObs.observe(el);
        return;
      }
      var section = el.closest('section') || el.closest('main') || document.body;
      var idx = sectionCounters.get(section) || 0;
      el.style.transitionDelay = Math.min(idx * 0.04, 0.16) + 's';
      sectionCounters.set(section, idx + 1);
      revealObs.observe(el);
    });

    /* Process connector draw animation */
    var connectorObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-drawn');
          connectorObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('.process__connector').forEach(function (c) {
      connectorObs.observe(c);
    });

    /* Number counter animation for hero stats */
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        counterObserver.unobserve(el);
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var isFloat = String(target).indexOf('.') !== -1;
        var duration = 1200;
        var start = performance.now();
        function step(now) {
          var elapsed = now - start;
          var progress = Math.min(elapsed / duration, 1);
          /* ease-out cubic */
          var eased = 1 - Math.pow(1 - progress, 3);
          var current = eased * target;
          el.textContent = (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(function (el) {
      counterObserver.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
    document.querySelectorAll('.process__connector').forEach(function (c) {
      c.classList.add('is-drawn');
    });
  }

  /* ---- FAQ ACCORDION ---- */
  var faqButtons = document.querySelectorAll('.faq__question');
  function setFaqState(item, button, answer, expanded) {
    item.classList.toggle('is-open', expanded);
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    answer.hidden = !expanded;
    answer.setAttribute('aria-hidden', expanded ? 'false' : 'true');
  }

  if (faqButtons.length) {
    var hasPresetOpenFaq = Array.prototype.some.call(faqButtons, function (button) {
      var faqItem = button.closest('.faq-item');
      return faqItem && faqItem.classList.contains('is-open');
    });

    faqButtons.forEach(function (btn, index) {
      var item = btn.closest('.faq-item');
      var answer = item ? item.querySelector('.faq__answer') : null;
      if (!item || !answer) return;

      if (!btn.id) btn.id = 'faq-question-' + (index + 1);
      if (!answer.id) answer.id = 'faq-answer-' + (index + 1);
      btn.setAttribute('aria-controls', answer.id);
      answer.setAttribute('role', 'region');
      answer.setAttribute('aria-labelledby', btn.id);

      var shouldBeOpen = item.classList.contains('is-open') || (!hasPresetOpenFaq && index === 0);
      setFaqState(item, btn, answer, shouldBeOpen);

      btn.addEventListener('click', function () {
        var willOpen = btn.getAttribute('aria-expanded') !== 'true';
        faqButtons.forEach(function (otherBtn) {
          var otherItem = otherBtn.closest('.faq-item');
          var otherAnswer = otherItem ? otherItem.querySelector('.faq__answer') : null;
          if (!otherItem || !otherAnswer) return;
          setFaqState(otherItem, otherBtn, otherAnswer, false);
        });
        if (willOpen) {
          setFaqState(item, btn, answer, true);
        }
      });
    });
  }

  function setupFaqSearch() {
    var searchInputs = document.querySelectorAll('[data-faq-filter]');
    var faqItems = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    if (!searchInputs.length || !faqItems.length) return;

    var emptyState = document.querySelector('[data-faq-empty]');

    function applyFilter(value) {
      var query = String(value || '').trim().toLowerCase();
      var visibleCount = 0;

      faqItems.forEach(function (item) {
        var text = String(item.textContent || '').toLowerCase();
        var match = !query || text.indexOf(query) >= 0;
        item.hidden = !match;
        item.setAttribute('aria-hidden', match ? 'false' : 'true');
        if (match) visibleCount++;
      });

      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
      }
    }

    searchInputs.forEach(function (input) {
      input.addEventListener('input', function () {
        applyFilter(input.value);
      });
      input.addEventListener('change', function () {
        applyFilter(input.value);
      });
    });

    applyFilter(searchInputs[0].value);
  }

  setupFaqSearch();

  /* ---- CONTACT FORM ---- */
  var form = document.getElementById('contact-form');
  var success = document.getElementById('form-success');
  var errorMessage = document.getElementById('form-error');
  var ticketInput = document.getElementById('ticket-id');
  var submittedLocal = document.getElementById('submitted-local');
  var ownerSummary = document.getElementById('owner-summary');
  var ownerPriority = document.getElementById('owner-priority');
  var ownerContact = document.getElementById('owner-contact-card');
  var ownerProject = document.getElementById('owner-project-snapshot');
  var ownerTracking = document.getElementById('owner-tracking');
  var serviceInput = document.getElementById('service');
  var fullNameInput = document.getElementById('full_name');
  var firstNameInput = document.getElementById('fname');
  var lastNameInput = document.getElementById('lname');
  var emailVisibleInput = document.getElementById('email_visible');
  var emailInput = document.getElementById('email');
  var phoneInput = document.getElementById('phone');
  var cityInput = document.getElementById('city');
  var addressInput = document.getElementById('property_address');
  var budgetInput = document.getElementById('budget');
  var consultationTierInput = document.getElementById('consultation_tier');
  var timelineInput = document.getElementById('timeline');
  var startTimelineInput = document.getElementById('start_timeline');
  var estimatedTimelineInput = document.getElementById('estimated_timeline');
  var contactMethod = document.getElementById('contact_method');
  var contactMethodValueInput = document.getElementById('contact_method_value');
  var preferredContactChoiceInput = document.getElementById('preferred_contact_method_visible');
  var leadTierInput = document.getElementById('lead_tier');
  var leadSourceInput = document.getElementById('lead_source');
  var utmSourceInput = document.getElementById('utm_source');
  var utmMediumInput = document.getElementById('utm_medium');
  var utmCampaignInput = document.getElementById('utm_campaign');
  var utmContentInput = document.getElementById('utm_content');
  var referrerInput = document.getElementById('referrer');
  var landingPathInput = document.getElementById('landing_path');
  var pageUrlInput = document.getElementById('page_url');
  var selectedServiceInput = document.getElementById('selected_service');
  var selectedStyleInput = document.getElementById('selected_style');
  var selectedImageInput = document.getElementById('selected_image');
  var selectedProjectLabelInput = document.getElementById('selected_project_label');
  var formStartedAtInput = document.getElementById('form-started-at');
  var jsCheckInput = document.getElementById('js-check');
  var messageInput = document.getElementById('message');
  var ticketReference = document.getElementById('ticket-reference');
  var progressBar = document.querySelector('.ticket-progress__bar');
  var progressFill = document.getElementById('ticket-progress-fill');
  var progressText = document.getElementById('ticket-progress-text');

  function encodeFormData(data) {
    return Object.keys(data)
      .map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]); })
      .join('&');
  }

  function createTicketId() {
    var stamp = Date.now().toString(36).toUpperCase();
    var randomSource = '';
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      randomSource = window.crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    } else if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      var randomBytes = new Uint8Array(6);
      window.crypto.getRandomValues(randomBytes);
      randomSource = Array.prototype.map.call(randomBytes, function (value) {
        return value.toString(16).padStart(2, '0');
      }).join('');
    } else {
      randomSource = String(Date.now()) + String(window.performance && window.performance.now ? window.performance.now() : '');
    }
    var rand = randomSource.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
    return 'TG-' + stamp + '-' + rand;
  }

  function getOrCreateTicketId(input) {
    var existing = String(input && input.value || '').trim();
    if (existing) return existing;
    var ticketId = createTicketId();
    if (input) input.value = ticketId;
    return ticketId;
  }

  async function requireAcceptedLeadResponse(response) {
    var responseBody = {};
    try {
      responseBody = await response.json();
    } catch (jsonError) {}

    if (!response.ok || !responseBody || responseBody.ok !== true) {
      throw new Error(responseBody && responseBody.error ? responseBody.error : 'Submission failed');
    }
    return responseBody;
  }

  function formatPhoenixDateTime(date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Phoenix',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    }).format(date);
  }

  function getPriority(budget, timeline) {
    if (timeline === 'ASAP' || timeline === 'Within 30 days' || budget === '$100,000+') return 'High Priority';
    if (budget === '$50,000 - $100,000' || timeline === '1-3 months') return 'Qualified Opportunity';
    return 'Standard Intake';
  }

  function valueOrFallback(input, fallback) {
    if (!input) return fallback;
    return input.value && input.value.trim() ? input.value.trim() : fallback;
  }

  function splitName(fullName) {
    var cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
      if (!cleaned) return { first: '', last: '' };
    var parts = cleaned.split(' ');
    if (parts.length === 1) return { first: parts[0], last: '' };
    return {
      first: parts.shift(),
      last: parts.join(' ')
    };
  }

  function normalizeTierText(value) {
    return String(value || '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function getBudgetRangeFromTier(tierLabel) {
    var tier = normalizeTierText(tierLabel);
    if (!tier) return '';
    if (tier.indexOf('10k') >= 0 && tier.indexOf('25k') >= 0) return '$10,000 - $25,000';
    if (tier.indexOf('25k') >= 0 && tier.indexOf('60k') >= 0) return '$25,000 - $60,000';
    if (tier.indexOf('60k') >= 0) return '$60,000 - $150,000';
    return '';
  }

  function updateFormProgress() {
    if (!form || !progressFill || !progressText || !progressBar) return;
    var required = Array.from(form.querySelectorAll('[required]'));
    var filled = required.filter(function (field) {
      return field.type === 'checkbox'
        ? field.checked
        : field.value.trim() !== '';
    }).length;

    var percent = required.length ? Math.round((filled / required.length) * 100) : 0;
    progressFill.style.width = percent + '%';
    progressText.textContent = percent + '% complete';
    progressBar.setAttribute('aria-valuenow', String(percent));
  }

  function bindFitButtons() {
    var fitButtons = document.querySelectorAll('[data-service-choice]');
    fitButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var choice = this.getAttribute('data-service-choice');
        if (serviceInput && choice) {
          serviceInput.value = choice;
          serviceInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (messageInput && choice && !messageInput.value.trim()) {
          messageInput.value = 'Interested in ' + choice + '. Please contact me about next steps.';
          messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (typeof window.trackLeadEvent === 'function') {
          window.trackLeadEvent('project_fit_click', {
            service_interest: choice || 'not_set',
            page_location: window.location.href
          });
        }

        if (typeof window.openConsultDrawer === 'function') {
          window.openConsultDrawer({
            source: 'project_fit',
            service: choice || '',
            prefill_message: choice ? ('Interested in ' + choice + '. Please contact me about next steps.') : ''
          });
        } else {
          var section = document.getElementById('contact');
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  bindFitButtons();

  function bindLeadTierButtons() {
    var tierButtons = document.querySelectorAll('[data-lead-tier]');
    if (!tierButtons.length) return;

    tierButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tier = String(this.getAttribute('data-lead-tier') || '').trim();
        if (!tier) return;

        tierButtons.forEach(function (other) { other.classList.remove('is-selected'); });
        this.classList.add('is-selected');

        if (leadTierInput) leadTierInput.value = tier;
        if (consultationTierInput) consultationTierInput.value = tier;
        if (budgetInput) budgetInput.value = getBudgetRangeFromTier(tier);

        if (messageInput) {
          var tierLine = 'Interested in the ' + tier + ' tier.';
          var current = String(messageInput.value || '').trim();
          if (!current) {
            messageInput.value = tierLine;
          } else if (!current.includes(tierLine)) {
            messageInput.value = current + '\n' + tierLine;
          }
          messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (typeof window.trackLeadEvent === 'function') {
          window.trackLeadEvent('lead_tier_select', {
            lead_tier: tier,
            page_location: window.location.href
          });
        }

        if (typeof window.openConsultDrawer === 'function') {
          window.openConsultDrawer({
            source: 'lead_tier',
            consultation_tier: tier,
            lead_tier: tier,
            budget_range: getBudgetRangeFromTier(tier),
            prefill_message: 'Interested in the ' + tier + ' tier.'
          });
        } else {
          var section = document.getElementById('contact');
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  bindLeadTierButtons();

  function bindFormPrefillTriggers() {
    var triggers = document.querySelectorAll('[data-form-prefill-trigger]');
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function (event) {
        if (!form) return;
        event.preventDefault();

        var prefillService = this.getAttribute('data-prefill-service') || '';
        var prefillStyle = this.getAttribute('data-prefill-style') || '';
        var prefillProjectLabel = this.getAttribute('data-prefill-project-label') || '';
        var prefillImage = this.getAttribute('data-prefill-image') || '';
        var prefillMessage = this.getAttribute('data-prefill-message') || '';
        var prefillSource = this.getAttribute('data-prefill-source') || 'website';

        if (serviceInput && prefillService) {
          serviceInput.value = prefillService;
          serviceInput.dispatchEvent(new Event('input', { bubbles: true }));
          serviceInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (selectedServiceInput && prefillService) selectedServiceInput.value = prefillService;
        if (selectedStyleInput && prefillStyle) selectedStyleInput.value = prefillStyle;
        if (selectedImageInput && prefillImage) selectedImageInput.value = prefillImage;
        if (selectedProjectLabelInput && prefillProjectLabel) selectedProjectLabelInput.value = prefillProjectLabel;
        if (leadSourceInput && prefillSource) leadSourceInput.value = prefillSource;

        if (messageInput && prefillMessage) {
          var currentMessage = String(messageInput.value || '').trim();
          if (!currentMessage) {
            messageInput.value = prefillMessage + ' Please contact me about next steps.';
          } else if (!currentMessage.includes(prefillMessage)) {
            messageInput.value = currentMessage + '\n' + prefillMessage;
          }
          messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (typeof window.trackLeadEvent === 'function') {
          window.trackLeadEvent('click_get_consultation', {
            source: prefillSource,
            service: prefillService || 'not_set',
            selected_style: prefillStyle || 'not_set',
            selected_project_label: prefillProjectLabel || 'not_set',
            page_location: window.location.href
          });
        }

        var section = document.getElementById('contact');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  bindFormPrefillTriggers();

  function bindResourceGateForms() {
    var gateForms = document.querySelectorAll('[data-resource-gate-form]');
    if (!gateForms.length) return;

    gateForms.forEach(function (gateForm) {
      var downloadTargetId = gateForm.getAttribute('data-download-target') || '';
      var downloadTarget = downloadTargetId ? document.getElementById(downloadTargetId) : null;
      var error = gateForm.querySelector('[data-resource-gate-error]');
      var submit = gateForm.querySelector('[type="submit"]');
      var requiredName = gateForm.querySelector('input[name="full_name"]');
      var requiredEmail = gateForm.querySelector('input[name="email_visible"]');
      var requiredConsent = gateForm.querySelector('input[name="contact_consent"]');
      var hiddenTicket = gateForm.querySelector('input[name="ticket_id"]');
      var hiddenSubmitted = gateForm.querySelector('input[name="submitted_local"]');
      var hiddenPageUrl = gateForm.querySelector('input[name="page_url"]');
      var hiddenReferrer = gateForm.querySelector('input[name="referrer"]');
      var hiddenLandingPath = gateForm.querySelector('input[name="landing_path"]');
      var hiddenLeadSource = gateForm.querySelector('input[name="lead_source"]');
      var hiddenFormStartedAt = gateForm.querySelector('input[name="form_started_at"]');
      var hiddenJsCheck = gateForm.querySelector('input[name="js_check"]');

      setupTurnstileForm(gateForm, 'resource_gate');
      if (hiddenFormStartedAt) hiddenFormStartedAt.value = String(Date.now());
      if (hiddenJsCheck) hiddenJsCheck.value = '1';

      gateForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (error) error.textContent = '';
        if (!validateRequiredFields([requiredName, requiredEmail, requiredConsent], error, 'Enter your name, email, and consent to unlock the checklist download.')) {
          return;
        }

        var turnstileToken = getTurnstileToken(gateForm);
        if (!turnstileToken) {
          var turnstileMessage = getTurnstileRequiredMessage(gateForm);
          setTurnstileStatus(gateForm, turnstileMessage, true);
          if (error) error.textContent = turnstileMessage;
          return;
        }

        var ticketId = getOrCreateTicketId(hiddenTicket);
        if (hiddenSubmitted) hiddenSubmitted.value = formatPhoenixDateTime(new Date());
        if (hiddenPageUrl) hiddenPageUrl.value = String(window.location.href || '');
        if (hiddenReferrer) hiddenReferrer.value = String(document.referrer || 'direct');
        if (hiddenLandingPath) hiddenLandingPath.value = String(window.location.pathname || '/');
        if (hiddenLeadSource) hiddenLeadSource.value = 'checklist_download';

        var payload = {};
        new FormData(gateForm).forEach(function (value, key) {
          payload[key] = String(value);
        });
        payload['cf-turnstile-response'] = turnstileToken;

        var defaultText = submit ? submit.textContent : '';
        if (submit) {
          submit.disabled = true;
          submit.textContent = 'Unlocking...';
        }

        try {
          var response = await fetch(getLeadSubmissionEndpoint(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: encodeFormData(payload)
          });

          await requireAcceptedLeadResponse(response);

          gateForm.setAttribute('hidden', 'hidden');
          if (downloadTarget) {
            downloadTarget.hidden = false;
            downloadTarget.classList.add('is-visible');
          }

          if (typeof window.trackLeadEvent === 'function') {
            window.trackLeadEvent('resource_gate_submit', {
              resource: gateForm.getAttribute('data-resource-name') || 'resource',
              ticket_id: ticketId,
              page_location: window.location.href
            });
          }
        } catch (gateError) {
          if (submit) {
            submit.disabled = false;
            submit.textContent = defaultText;
          }
          if (error) {
            error.textContent = gateError && gateError.message
              ? gateError.message
              : 'We could not unlock the checklist right now. Please try again or call us.';
          }
        } finally {
          safeResetTurnstile(gateForm);
        }
      });
    });
  }

  bindResourceGateForms();

  if (form) {
    setupTurnstileForm(form, 'project_request');
    var params = URL_PARAMS;
    var utmSource = params.get('utm_source') || '';
    var utmMedium = params.get('utm_medium') || '';
    var utmCampaign = params.get('utm_campaign') || '';
    var utmContent = params.get('utm_content') || '';
    var requestedService = params.get('service') || '';
    var requestedStyle = params.get('selected_style') || '';
    var requestedImage = params.get('selected_image') || '';
    var requestedProjectLabel = params.get('selected_project_label') || '';
    var requestedPrefillMessage = params.get('prefill_message') || '';
    var requestedSource = params.get('source') || '';
    var requestedTimeline = params.get('estimated_timeline') || params.get('timeline') || '';
    var referrerValue = String(document.referrer || '');
    var landingPathValue = String(window.location.pathname || '/');
    var currentPageUrl = String(window.location.href || '');
    var hasTrackedFormStarted = false;

    if (formStartedAtInput) formStartedAtInput.value = String(Date.now());
    if (jsCheckInput) jsCheckInput.value = '1';

    function normalizeServiceSlug(value) {
      return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function mapStyleToService(styleValue) {
      var slug = normalizeServiceSlug(styleValue);
      if (!slug) return '';
      if (slug.indexOf('hardscape') >= 0) return 'Hardscaping';
      if (slug.indexOf('water') >= 0) return 'Water Feature';
      if (slug.indexOf('fire') >= 0) return 'Fire Feature / Outdoor Kitchen';
      if (slug.indexOf('outdoor') >= 0) return 'Fire Feature / Outdoor Kitchen';
      if (slug.indexOf('desert') >= 0 || slug.indexOf('xeriscape') >= 0 || slug.indexOf('turf') >= 0) {
        return 'Desert / Drought-Tolerant Design';
      }
      if (slug.indexOf('irrigation') >= 0) return 'Irrigation';
      if (slug.indexOf('frontyard') >= 0 || slug.indexOf('backyard') >= 0 || slug.indexOf('curb') >= 0) {
        return 'Landscape Design & Build';
      }
      return '';
    }

    function resolveServicePrefill(value) {
      if (!value || !serviceInput) return '';
      var cleanValue = String(value).trim();
      if (!cleanValue) return '';
      var requestedSlug = normalizeServiceSlug(cleanValue);

      var catalog = Array.isArray(window.SERVICES_DATA) ? window.SERVICES_DATA : [];
      var serviceFromCatalog = catalog.find(function (item) {
        return normalizeServiceSlug(item.slug) === requestedSlug;
      });
      if (serviceFromCatalog) {
        return String(serviceFromCatalog.formValue || serviceFromCatalog.title || '');
      }

      var options = Array.from(serviceInput.options).map(function (option) {
        return String(option.value || '').trim();
      }).filter(Boolean);
      var serviceAliases = {
        'outdoor-kitchens': 'Fire Feature / Outdoor Kitchen',
        'outdoor-kitchen': 'Fire Feature / Outdoor Kitchen',
        'fire-features': 'Fire Feature / Outdoor Kitchen',
        'fire-feature': 'Fire Feature / Outdoor Kitchen',
        'pergola-shade': 'Pergola / Shade Structure',
        'pergola-shade-structure': 'Pergola / Shade Structure',
        'desert-landscaping': 'Desert / Drought-Tolerant Design',
        'desert-drought-tolerant-design': 'Desert / Drought-Tolerant Design'
      };
      if (serviceAliases[requestedSlug] && options.indexOf(serviceAliases[requestedSlug]) >= 0) {
        return serviceAliases[requestedSlug];
      }

      var directMatch = options.find(function (option) {
        return option.toLowerCase() === cleanValue.toLowerCase();
      });
      if (directMatch) return directMatch;

      var slugMatch = options.find(function (option) {
        return normalizeServiceSlug(option) === requestedSlug;
      });
      if (slugMatch) return slugMatch;

      return '';
    }

    function applyServicePrefillFromQuery() {
      if (!serviceInput) return;
      if (serviceInput.value && serviceInput.value.trim()) return;

      var styleMappedService = mapStyleToService(requestedStyle);
      var resolvedService = resolveServicePrefill(requestedService) || resolveServicePrefill(styleMappedService);
      if (!resolvedService) return;

      serviceInput.value = resolvedService;
      serviceInput.dispatchEvent(new Event('input', { bubbles: true }));
      serviceInput.dispatchEvent(new Event('change', { bubbles: true }));

      if (selectedServiceInput) selectedServiceInput.value = resolvedService;

      var prefillLines = [];
      prefillLines.push(requestedPrefillMessage || ('Interested in ' + resolvedService + '.'));
      if (requestedStyle) prefillLines.push('Preferred style: ' + toTitleCase(String(requestedStyle).replace(/[-_]/g, ' ')) + '.');
      if (requestedProjectLabel) prefillLines.push('Project reference: ' + requestedProjectLabel + '.');
      var prefill = prefillLines.join(' ');

      if (messageInput && !messageInput.value.trim()) {
        messageInput.value = prefill + ' Please contact me about next steps.';
      } else if (messageInput && prefill && !messageInput.value.includes(prefill)) {
        messageInput.value = String(messageInput.value).trim() + '\n' + prefill;
      }

      if (typeof window.trackLeadEvent === 'function') {
        window.trackLeadEvent('service_prefill', {
          service: resolvedService,
          source: requestedSource || DETECTED_LEAD_SOURCE || 'url_param',
          page_location: window.location.href
        });
      }
    }

    if (leadSourceInput) {
      leadSourceInput.value = requestedSource || utmSource || DETECTED_LEAD_SOURCE || 'website';
    }
    if (utmSourceInput) utmSourceInput.value = utmSource;
    if (utmMediumInput) utmMediumInput.value = utmMedium;
    if (utmCampaignInput) utmCampaignInput.value = utmCampaign;
    if (utmContentInput) utmContentInput.value = utmContent;
    if (referrerInput) referrerInput.value = referrerValue || 'direct';
    if (landingPathInput) landingPathInput.value = landingPathValue || '/';
    if (pageUrlInput) pageUrlInput.value = currentPageUrl || window.location.href;

    if (selectedStyleInput && requestedStyle) selectedStyleInput.value = requestedStyle;
    if (selectedImageInput && requestedImage) selectedImageInput.value = requestedImage;
    if (selectedProjectLabelInput && requestedProjectLabel) selectedProjectLabelInput.value = requestedProjectLabel;

    if (estimatedTimelineInput && requestedTimeline) {
      Array.from(estimatedTimelineInput.options).some(function (option) {
        var sameValue = option.value.toLowerCase() === String(requestedTimeline).toLowerCase();
        if (sameValue) estimatedTimelineInput.value = option.value;
        return sameValue;
      });
    }
    if (estimatedTimelineInput) {
      var syncTimeline = function syncTimeline(value) {
        var next = value || '';
        if (timelineInput) timelineInput.value = next;
        if (startTimelineInput) startTimelineInput.value = next;
      };
      syncTimeline(estimatedTimelineInput.value || (timelineInput && timelineInput.value) || '');
      estimatedTimelineInput.addEventListener('change', function () {
        syncTimeline(this.value);
      });
    }

    function syncPreferredContact(value) {
      var next = String(value || '').trim();
      if (contactMethod) contactMethod.value = next;
      if (contactMethodValueInput) contactMethodValueInput.value = next;
    }

    if (preferredContactChoiceInput) {
      preferredContactChoiceInput.addEventListener('change', function () {
        syncPreferredContact(this.value);
      });
      syncPreferredContact(preferredContactChoiceInput.value || (contactMethodValueInput && contactMethodValueInput.value) || '');
    } else {
      syncPreferredContact((contactMethodValueInput && contactMethodValueInput.value) || (contactMethod && contactMethod.value) || '');
    }

    applyServicePrefillFromQuery();

    if (messageInput && !messageInput.value.trim() && (requestedStyle || requestedProjectLabel)) {
      var styleLine = requestedStyle ? ('Interested in a ' + toTitleCase(String(requestedStyle).replace(/[-_]/g, ' ')) + ' project.') : '';
      var projectLine = requestedProjectLabel ? (' Project reference: ' + requestedProjectLabel + '.') : '';
      messageInput.value = (styleLine + projectLine).trim();
    }

    if (serviceInput && selectedServiceInput) {
      serviceInput.addEventListener('change', function () {
        selectedServiceInput.value = this.value || '';
      });
      serviceInput.addEventListener('input', function () {
        selectedServiceInput.value = this.value || '';
      });
      if (serviceInput.value) selectedServiceInput.value = serviceInput.value;
    }

    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        var v = this.value.replace(/\D/g, '');
        if (v.length >= 10) v = '(' + v.slice(0, 3) + ') ' + v.slice(3, 6) + '-' + v.slice(6, 10);
        this.value = v;
      });
    }

    function trackFormStarted() {
      if (hasTrackedFormStarted) return;
      hasTrackedFormStarted = true;
      if (typeof window.trackLeadEvent === 'function') {
        window.trackLeadEvent('form_started', {
          form_id: 'contact-form',
          page_location: window.location.href
        });
      }
    }

    form.querySelectorAll('input, select, textarea, button').forEach(function (field) {
      field.addEventListener('focus', trackFormStarted, { once: true });
      field.addEventListener('input', trackFormStarted, { once: true });
      field.addEventListener('change', trackFormStarted, { once: true });
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validateRequiredFields(Array.from(form.querySelectorAll('[required]')), errorMessage, 'Please complete all required fields before submitting your project request.')) {
        if (errorMessage) errorMessage.style.display = 'block';
        return;
      }

      var turnstileToken = getTurnstileToken(form);
      if (!turnstileToken) {
        var turnstileMessage = getTurnstileRequiredMessage(form);
        setTurnstileStatus(form, turnstileMessage, true);
        if (errorMessage) {
          errorMessage.textContent = turnstileMessage;
          errorMessage.style.display = 'block';
        }
        return;
      }

      if (errorMessage) {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
      }

      var ticketId = getOrCreateTicketId(ticketInput);
      var submittedDate = new Date();
      var submittedLocalTime = formatPhoenixDateTime(submittedDate);
      var nameParts = splitName(valueOrFallback(fullNameInput, ''));
      if (firstNameInput) firstNameInput.value = nameParts.first;
      if (lastNameInput) lastNameInput.value = nameParts.last;
      if (emailInput) emailInput.value = valueOrFallback(emailVisibleInput, '');

      var fullName = (valueOrFallback(firstNameInput, '') + ' ' + valueOrFallback(lastNameInput, '')).trim();
      var service = valueOrFallback(serviceInput, '');
      var leadTier = valueOrFallback(leadTierInput, '');
      var consultationTier = valueOrFallback(consultationTierInput, '');
      if (!consultationTier && leadTier) {
        consultationTier = leadTier;
      }
      var budget = valueOrFallback(budgetInput, '');
      if (!budget || budget === 'Not discussed yet') {
        budget = getBudgetRangeFromTier(consultationTier || leadTier);
      }
      var timeline = valueOrFallback(startTimelineInput || timelineInput, '');
      var leadSource = valueOrFallback(leadSourceInput, DETECTED_LEAD_SOURCE || 'website');
      var selectedStyle = valueOrFallback(selectedStyleInput, '');
      var selectedImage = valueOrFallback(selectedImageInput, '');
      var selectedProjectLabel = valueOrFallback(selectedProjectLabelInput, '');
      var priority = getPriority(budget, timeline);
      var preferredContact = valueOrFallback(contactMethodValueInput || contactMethod, '');
      var projectCity = valueOrFallback(cityInput, '');
      var projectAddress = valueOrFallback(addressInput, '');
      var vision = valueOrFallback(messageInput, 'No project details provided.');
      var email = valueOrFallback(emailInput, '');
      var phone = valueOrFallback(phoneInput, '');

      if (ticketInput) ticketInput.value = ticketId;
      if (consultationTierInput) consultationTierInput.value = consultationTier;
      if (budgetInput) budgetInput.value = budget;
      if (submittedLocal) submittedLocal.value = submittedLocalTime;
      if (timelineInput) timelineInput.value = timeline;
      if (startTimelineInput) startTimelineInput.value = timeline;
      if (contactMethod) contactMethod.value = preferredContact;
      if (contactMethodValueInput) contactMethodValueInput.value = preferredContact;
      if (ownerPriority) ownerPriority.value = priority;

      if (ownerSummary) {
        ownerSummary.value = [
          'New project request submitted.',
          'Priority: ' + priority,
          service ? 'Requested service: ' + service : '',
          [budget, timeline].filter(Boolean).length ? 'Budget / Timeline: ' + [budget, timeline].filter(Boolean).join(' / ') : '',
          consultationTier ? 'Consultation tier: ' + consultationTier : '',
          leadSource ? 'Source: ' + leadSource : '',
          selectedStyle ? 'Style reference: ' + selectedStyle : '',
          selectedProjectLabel ? 'Project reference: ' + selectedProjectLabel : ''
        ].filter(Boolean).join('\n');
      }

      if (ownerContact) {
        ownerContact.value = [
          fullName ? 'Client: ' + fullName : '',
          email ? 'Email: ' + email : '',
          phone ? 'Phone: ' + phone : '',
          preferredContact ? 'Preferred contact: ' + preferredContact : ''
        ].filter(Boolean).join('\n');
      }

      if (ownerProject) {
        ownerProject.value = [
          submittedLocalTime ? 'Submitted (Phoenix): ' + submittedLocalTime : '',
          [projectAddress, projectCity].filter(Boolean).length ? 'Project location: ' + [projectAddress, projectCity].filter(Boolean).join(', ') : '',
          consultationTier ? 'Consultation tier: ' + consultationTier : '',
          budget ? 'Budget range: ' + budget : '',
          timeline ? 'Estimated timeline: ' + timeline : '',
          selectedStyle ? 'Selected style: ' + selectedStyle : '',
          selectedImage ? 'Selected image: ' + selectedImage : '',
          selectedProjectLabel ? 'Selected project label: ' + selectedProjectLabel : '',
          vision ? 'Project vision:\n' + vision : ''
        ].filter(Boolean).join('\n');
      }

      if (ownerTracking) {
        ownerTracking.value = [
          'Lead source: ' + leadSource,
          'Page URL: ' + window.location.href,
          'UTM source: ' + (utmSource || 'n/a'),
          'UTM medium: ' + (utmMedium || 'n/a'),
          'UTM campaign: ' + (utmCampaign || 'n/a'),
          'UTM content: ' + (utmContent || 'n/a'),
          'Referrer: ' + (referrerValue || 'direct'),
          'Landing path: ' + (landingPathValue || '/'),
          'Selected style: ' + selectedStyle,
          'Selected image: ' + selectedImage,
          'Selected project label: ' + selectedProjectLabel
        ].join('\n');
      }

      if (pageUrlInput) {
        pageUrlInput.value = window.location.href;
      }

      var btn = form.querySelector('[type="submit"]');
      var defaultBtnText = btn.textContent;
      btn.textContent = 'Submitting…';
      btn.disabled = true;

      var payload = {};
      new FormData(form).forEach(function (value, key) {
        payload[key] = String(value);
      });
      payload['cf-turnstile-response'] = turnstileToken;

      try {
        var response = await fetch(getLeadSubmissionEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encodeFormData(payload)
        });

        await requireAcceptedLeadResponse(response);
        if (typeof window.trackLeadEvent === 'function') {
          var submitPayload = {
            ticket_id: ticketId,
            service: service,
            consultation_tier: consultationTier || undefined,
            lead_tier: leadTier || undefined,
            budget_range: budget || undefined,
            lead_source: leadSource,
            selected_style: selectedStyle || undefined,
            city: projectCity,
            page_location: window.location.href
          };
          window.trackLeadEvent('form_submit', submitPayload);
          window.trackLeadEvent('form_submitted', submitPayload);
        } else if (typeof window.gtag === 'function') {
          window.gtag('event', 'form_submit', {
            event_category: 'lead',
            event_label: service,
            value: 1
          });
        }

        var thankYouParams = new URLSearchParams({
          ticket_id: ticketId,
          service: service,
          city: projectCity,
          source: leadSource,
          selected_style: selectedStyle,
          selected_project_label: selectedProjectLabel
        });
        window.location.href = '/thank-you?' + thankYouParams.toString();
      } catch (error) {
        if (errorMessage) {
          errorMessage.textContent = error && error.message
            ? error.message
            : 'We could not submit your request right now. Please call us at ' + SITE_PHONE_DISPLAY + '.';
          errorMessage.style.display = 'block';
        }
        btn.disabled = false;
        btn.textContent = defaultBtnText;
      } finally {
        safeResetTurnstile(form);
      }
    });

    form.querySelectorAll('input, select, textarea').forEach(function (f) {
      f.addEventListener('input', function () {
        setFieldValidationState(this, true);
        updateFormProgress();
      });
      f.addEventListener('change', function () {
        setFieldValidationState(this, true);
        updateFormProgress();
      });
    });
    updateFormProgress();
  }
})();

/* ============================================================
   Loading skeletons for dynamic grids
   ============================================================ */
(function () {
  function buildSkeletons(count) {
    var html = '';
    for (var i = 0; i < count; i++) {
      html += '<div class="skeleton-card">' +
        '<div class="skeleton-card__img skeleton"></div>' +
        '<div class="skeleton-card__body">' +
        '<div class="skeleton-card__line skeleton skeleton-card__line--med"></div>' +
        '<div class="skeleton-card__line skeleton skeleton-card__line--short"></div>' +
        '</div></div>';
    }
    return html;
  }

  var reviewsGrid = document.getElementById('reviews-grid');
  if (reviewsGrid && !reviewsGrid.hasChildNodes()) {
    reviewsGrid.innerHTML = buildSkeletons(3);
  }

  var projectsGrid = document.getElementById('recent-projects-grid');
  if (projectsGrid && !projectsGrid.hasChildNodes()) {
    projectsGrid.innerHTML = buildSkeletons(3);
  }
})();

/* ============================================================
   Cookie consent banner
   ============================================================ */
(function () {
  var COOKIE_KEY = 'tg_cookie_consent';
  if (localStorage.getItem(COOKIE_KEY)) return;

  var banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML =
    '<p>We use cookies to improve performance and measure project review activity. ' +
    '<a href="/cookie-policy">Cookie policy</a></p>' +
    '<div class="cookie-banner__actions">' +
    '<button class="cookie-banner__decline" type="button">Decline</button>' +
    '<button class="cookie-banner__accept" type="button">Accept All</button>' +
    '</div>';
  document.body.appendChild(banner);

  var cookieDelay = window.matchMedia && window.matchMedia('(max-width: 640px)').matches ? 2200 : 0;
  setTimeout(function () {
    requestAnimationFrame(function () {
      document.body.classList.add('has-cookie-banner-visible');
      banner.classList.add('is-visible');
    });
  }, cookieDelay);

  function dismiss(accepted) {
    localStorage.setItem(COOKIE_KEY, accepted ? 'accepted' : 'declined');
    if (accepted && typeof window.initSiteAnalytics === 'function') {
      window.initSiteAnalytics();
    }
    document.body.classList.remove('has-cookie-banner-visible');
    banner.classList.remove('is-visible');
    setTimeout(function () { banner.remove(); }, 450);
  }

  banner.querySelector('.cookie-banner__accept').addEventListener('click', function () { dismiss(true); });
  banner.querySelector('.cookie-banner__decline').addEventListener('click', function () { dismiss(false); });
})();

/* ============================================================
   Exit-intent popup
   ============================================================ */
(function () {
  var POPUP_KEY = 'tg_exit_popup_seen';
  if (localStorage.getItem(POPUP_KEY)) return;

  var shown = false;
  var minTimeMs = 15000;
  var pageEnteredAt = Date.now();

  function show() {
    if (shown) return;
    shown = true;
    localStorage.setItem(POPUP_KEY, '1');

    var popupConfig = window.SITE_CONFIG || {};
    var popupBrand = popupConfig.brand || {};
    var popupLogoPath = String(popupBrand.logoPath || 'img/logo.png').trim();
    var popupLogo = popupLogoPath.charAt(0) === '/' ? popupLogoPath : '/' + popupLogoPath.replace(/^\.?\//, '');
    var popupConsultHref = '/free-consultation?source=exit_popup&autostart=1';
    var popup = document.createElement('div');
    popup.className = 'exit-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', 'Before you go');
    popup.innerHTML =
      '<div class="exit-popup__backdrop"></div>' +
      '<div class="exit-popup__card">' +
      '<button class="exit-popup__close" aria-label="Close">&times;</button>' +
      '<div class="exit-popup__icon" aria-hidden="true"><img src="' + popupLogo + '" alt="" loading="lazy" decoding="async" width="68" height="68"></div>' +
      '<p class="exit-popup__eyebrow">Before You Leave</p>' +
      '<h2 class="exit-popup__title">Want a clear next step for your yard?</h2>' +
      '<p class="exit-popup__sub">Share your project goals and we will follow up with a clear next-step plan.</p>' +
      '<div class="exit-popup__actions">' +
      '<a href="' + popupConsultHref + '" class="btn btn--solid exit-popup__cta">' + OFFER_LABEL + '</a>' +
      '<button class="exit-popup__dismiss" type="button">Continue browsing</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(popup);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        popup.classList.add('is-open');
      });
    });

    function close() {
      popup.classList.remove('is-open');
      setTimeout(function () { popup.remove(); }, 400);
    }

    popup.querySelector('.exit-popup__close').addEventListener('click', close);
    popup.querySelector('.exit-popup__dismiss').addEventListener('click', close);
    popup.querySelector('.exit-popup__backdrop').addEventListener('click', close);
    popup.querySelector('.exit-popup__cta').addEventListener('click', close);

    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  document.addEventListener('mouseleave', function (e) {
    if (e.clientY > 0) return;
    if (Date.now() - pageEnteredAt < minTimeMs) return;
    show();
  });
})();

/* ============================================================
   Progressive media and responsive comparison enhancements
   ============================================================ */
(function () {
  'use strict';

  var motionPreference = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  var ambientVideo = document.querySelector('[data-ambient-video]');

  function syncAmbientVideo() {
    if (!ambientVideo || !motionPreference) return;
    if (motionPreference.matches) {
      ambientVideo.pause();
      ambientVideo.removeAttribute('autoplay');
      return;
    }

    ambientVideo.setAttribute('autoplay', '');
    var playAttempt = ambientVideo.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(function () {
        /* The poster remains visible when browser autoplay policy blocks video. */
      });
    }
  }

  syncAmbientVideo();
  if (motionPreference && typeof motionPreference.addEventListener === 'function') {
    motionPreference.addEventListener('change', syncAmbientVideo);
  }

  document.querySelectorAll('.comparison-table').forEach(function (table) {
    var headings = Array.prototype.map.call(
      table.querySelectorAll('thead th'),
      function (heading) { return String(heading.textContent || '').trim(); }
    );

    table.querySelectorAll('tbody tr').forEach(function (row) {
      row.querySelectorAll('td').forEach(function (cell, index) {
        if (headings[index]) cell.setAttribute('data-label', headings[index]);
      });
    });
  });
})();
