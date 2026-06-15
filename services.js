(function () {
  'use strict';

  var services = Array.isArray(window.SERVICES_DATA) ? window.SERVICES_DATA : [];
  if (!services.length) return;
  var root = document.body;
  var isNestedServicePage = !!(root && root.classList.contains('service-page'));
  var offerConfig = (window.SITE_CONFIG && window.SITE_CONFIG.primaryOffer) || {};
  var offerLabel = String(offerConfig.label || 'Request Free Quote').trim();

  function byId(id) {
    return document.getElementById(id);
  }

  function withBase(path) {
    if (isNestedServicePage) {
      return '../' + String(path || '').replace(/^\//, '');
    }
    return String(path || '');
  }

  function iconMarkup(type) {
    if (type === 'shield') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l8 4v6c0 5-3.2 7.8-8 9-4.8-1.2-8-4-8-9V7l8-4z"></path><path d="M9 12l2 2 4-4"></path></svg>';
    }
    if (type === 'projects') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 19h16"></path><path d="M5 19V7l7-4 7 4v12"></path><path d="M9 12h6"></path></svg>';
    }
    if (type === 'plan') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h10"></path><path d="M17 17l2 2 3-3"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>';
  }

  function serviceConsultationHref(service) {
    var params = new URLSearchParams();
    if (service && service.slug) params.set('service', service.slug);
    params.set('source', isNestedServicePage ? 'service_page' : 'services_hub');
    params.set('autostart', '1');
    return withBase('/free-consultation?' + params.toString());
  }

  function servicePortfolioHref(service) {
    return withBase('portfolio?service=' + encodeURIComponent(service.slug));
  }

  function normalizePath(path) {
    if (!path) return '';
    return path.replace(/^\.\//, '').replace(/^\//, '');
  }

  function normalizeDisplayPath(path) {
    var value = String(path || '').trim();
    if (!value) return value;
    if (/^(https?:)?\/\//i.test(value) || value.charAt(0) === '#') return value;
    return withBase(value);
  }

  function buildProofMarkup() {
    var items = Array.isArray(window.SERVICE_PROOF_ITEMS) ? window.SERVICE_PROOF_ITEMS : [];
    return items.map(function (item) {
      return '' +
        '<article class="service-proof__item">' +
        '  <span class="service-proof__icon">' + iconMarkup(item.icon) + '</span>' +
        '  <p>' + item.label + '</p>' +
        '</article>';
    }).join('');
  }

  function sourceSetForImage(path) {
    var normalized = String(path || '').replace(/^\.\//, '').replace(/^\//, '');
    var match = normalized.match(/\.([a-z0-9]+)$/i);
    if (!match) return { avif: '', fallback: '' };
    var ext = match[1].toLowerCase();
    var base = normalized.slice(0, -1 * (ext.length + 1));
    return {
      avif: withBase(base + '-640.avif'),
      fallback: withBase(normalized)
    };
  }

  function injectFaqSchema(service) {
    if (!service || !Array.isArray(service.faqs) || !service.faqs.length) return;

    var schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: service.faqs.map(function (item) {
        return {
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a
          }
        };
      })
    };

    var existing = document.getElementById('service-faq-schema');
    if (existing) existing.remove();
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'service-faq-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  function applyReviewSnapshot(selector) {
    var reviewConfig = window.SITE_CONFIG || {};
    var reviewSummary = reviewConfig.reviewSummary || {};
    var target = selector ? document.querySelector(selector) : null;
    if (!target) return;

    var rating = String(reviewSummary.rating || reviewConfig.reviewRating || (reviewConfig.googleReviews && reviewConfig.googleReviews.rating) || '').trim();
    var count = String(reviewSummary.count || reviewConfig.reviewCount || (reviewConfig.googleReviews && reviewConfig.googleReviews.count) || '').trim();
    var platform = String(reviewSummary.source || reviewConfig.reviewSource || (reviewConfig.googleReviews && reviewConfig.googleReviews.platform) || 'Birdeye').trim();
    var link = String(reviewSummary.sourceUrl || reviewConfig.reviewSourceUrl || (reviewConfig.googleReviews && reviewConfig.googleReviews.profileUrl) || '').trim();
    var snapshotDate = String(reviewSummary.snapshotDate || reviewConfig.reviewSnapshotDate || (reviewConfig.googleReviews && reviewConfig.googleReviews.snapshotDate) || '').trim();
    if (!rating && !count) return;

    var text = rating + '-star ' + platform + ' rating';
    if (count) text += ' across ' + count + ' reviews';
    if (snapshotDate) text += ' · ' + snapshotDate;

    target.innerHTML = link
      ? '<a href="' + link + '" target="_blank" rel="noopener noreferrer">' + text + '</a>'
      : text;
  }

  function buildServiceStoryMarkup(service, options) {
    if (!service || !service.featuredProject) return '';

    var story = service.featuredProject;
    var isHub = !!(options && options.isHub);
    var eyebrow = isHub ? service.title : 'Recent Project Story';
    var detailLinkLabel = isHub ? 'View ' + service.title + ' Service' : 'See More ' + service.title + ' Projects';

    return '' +
      '<article class="service-story-card reveal reveal--scale">' +
      '  <p class="service-story-card__eyebrow">' + eyebrow + '</p>' +
      '  <h3>' + story.title + '</h3>' +
      '  <p class="service-story-card__location">' + story.location + '</p>' +
      '  <ul class="service-story-card__meta">' +
      '    <li><strong>Scope:</strong> ' + story.scope + '</li>' +
      '    <li><strong>Timeline:</strong> ' + story.timeline + '</li>' +
      '  </ul>' +
      '  <p class="service-story-card__outcome">' + story.outcome + '</p>' +
      '  <div class="service-story-card__actions">' +
      '    <a class="btn btn--dark" href="' + serviceConsultationHref(service) + '">' + offerLabel + '</a>' +
      '    <a class="text-link" href="' + normalizeDisplayPath(service.path) + '">' + detailLinkLabel + ' &rarr;</a>' +
      '  </div>' +
      '</article>';
  }

  function serviceFitItems(service) {
    if (service && Array.isArray(service.goodFit) && service.goodFit.length) {
      return service.goodFit;
    }
    return [
      'You want a clearer plan before comparing contractor quotes.',
      'You need the finished yard to look good and work better day to day.',
      'You want pricing, timing, and next steps explained before work starts.'
    ];
  }

  function servicePlanningItems(service) {
    if (service && Array.isArray(service.planFor) && service.planFor.length) {
      return service.planFor;
    }
    return [
      'Final pricing depends on access, existing conditions, finish choices, and total scope.',
      'Photos, rough measurements, and priority areas help the first callback stay specific.',
      'Some projects are best phased so the highest-value area gets handled first.'
    ];
  }

  function buildFitList(items) {
    return items.map(function (item) {
      return '<li>' + item + '</li>';
    }).join('');
  }

  function pricingDriversFor(service) {
    var fallback = {
      'landscape-design': [
        'Whether the scope needs concept planning, 3D visuals, construction details, or full design-build coordination.',
        'How many zones need decisions: patio, planting, lighting, irrigation, shade, kitchen, or fire features.',
        'Revision depth, material selections, site measurements, and HOA or permitting requirements.'
      ],
      hardscaping: [
        'Square footage, demo, base depth, drainage correction, edge restraint, and finish material.',
        'Transitions into doors, steps, walls, turf, planting, fire features, kitchens, or existing concrete.',
        'Access, haul-off, grade changes, compaction needs, and whether the patio supports future phases.'
      ],
      'outdoor-kitchens': [
        'Appliance package, utility routing, island size, counter material, and cabinet or masonry style.',
        'Whether the kitchen needs adjacent patio work, shade, lighting, seating, or fire-feature coordination.',
        'Gas, electric, water, drainage, access, and finish choices that affect labor and schedule.'
      ],
      'outdoor-lighting': [
        'Fixture count, transformer capacity, wiring access, control type, and number of lighting zones.',
        'Whether the scope is path safety, patio use, accent lighting, architecture, trees, or full-property coverage.',
        'Existing system condition, trenching access, voltage drop, and future landscape plans.'
      ],
      'pergola-shade': [
        'Structure size, material, footing needs, attachment method, fan or lighting integration, and finish detail.',
        'Sun exposure, roofline relationship, patio layout, drainage, and whether permits or engineering are needed.',
        'Access, demolition, existing slab condition, and coordination with kitchens, seating, or lighting.'
      ],
      'fire-features': [
        'Gas line distance, feature type, finish material, seating layout, ventilation, and ignition controls.',
        'Whether the feature is standalone or tied into pavers, seat walls, kitchens, or full patio redesign.',
        'Access, utility trenching, code clearance, drainage, and surrounding hardscape complexity.'
      ],
      'desert-landscaping': [
        'Plant palette, boulder or rock quantities, irrigation conversion, grading, removals, and lighting tie-ins.',
        'Whether the goal is curb appeal, lower water use, privacy, slope control, or full-yard transformation.',
        'Soil condition, existing irrigation, drainage, HOA rules, and how sparse or lush the final look should feel.'
      ],
      'artificial-turf': [
        'Square footage, turf product, base depth, drainage, seams, edge complexity, and removal work.',
        'Pet use, heat exposure, putting or play areas, and how turf connects to pavers or planting beds.',
        'Existing grass, rock, irrigation, concrete, grade changes, and access for base material.'
      ],
      irrigation: [
        'Zone count, valve access, controller needs, water pressure, drip conversion, and system condition.',
        'Whether the scope is troubleshooting, retrofit, new planting support, or full system redesign.',
        'Plant types, sun exposure, runoff, leaks, trenching access, and compatibility with future landscape work.'
      ]
    };
    return service && Array.isArray(service.pricingDrivers) && service.pricingDrivers.length
      ? service.pricingDrivers
      : (fallback[service.slug] || [
        'Final price depends on scope, access, finish choices, and existing site conditions.',
        'Photos and rough measurements help narrow the first realistic planning range.',
        'The best quote separates must-have work from later-phase upgrades.'
      ]);
  }

  function quotePrepFor(service) {
    var fallback = {
      'landscape-design': [
        'Photos from each corner of the yard and from the main indoor view looking out.',
        'A must-have list, a nice-to-have list, and any style references you already like.',
        'Timing, HOA, access, drainage, or budget limits that should shape the first design direction.'
      ],
      hardscaping: [
        'Approximate patio or walkway dimensions and photos of existing concrete, steps, slopes, and gates.',
        'How the area will be used: dining, lounge, fire, kitchen, pool access, or daily walkway.',
        'Any cracking, pooling water, grade problems, or transitions that already bother you.'
      ],
      'outdoor-kitchens': [
        'Desired appliances and whether gas, electric, or water already exists nearby.',
        'Photos of the patio, utility area, seating zone, and shade conditions.',
        'How you host: quick grilling, full meals, bar seating, prep space, or weekend entertaining.'
      ],
      'outdoor-lighting': [
        'A few dusk or night photos showing dark paths, patios, entries, trees, or feature areas.',
        'Whether you have an existing transformer, timer, or low-voltage wiring.',
        'The main goal: safety, curb appeal, patio comfort, feature accents, or all of the above.'
      ],
      'pergola-shade': [
        'Photos of the patio, roofline, sun direction, and any slab or footing area.',
        'Desired use: dining shade, lounge comfort, grill cover, fans, lighting, or visual structure.',
        'Any HOA, permit, material, color, or attachment constraints you already know.'
      ],
      'fire-features': [
        'Where the feature should sit and whether gas is already available nearby.',
        'Preferred style: fire pit, fireplace, linear feature, seat-wall integration, or lounge zone.',
        'Photos of surrounding patio, furniture plan, shade, drainage, and access.'
      ],
      'desert-landscaping': [
        'Photos of the current planting, irrigation, rock, turf, slopes, and sun exposure.',
        'Whether the goal is lower water use, better curb appeal, privacy, color, or less maintenance.',
        'Plants or looks you like, plus anything you definitely want removed.'
      ],
      'artificial-turf': [
        'Approximate turf area and photos of edges, gates, slopes, irrigation, and adjacent surfaces.',
        'How the turf will be used: pets, kids, putting, curb appeal, or low-maintenance green.',
        'Whether old grass, rock, concrete, or sprinklers need removal or adjustment.'
      ],
      irrigation: [
        'Photos or notes showing dry spots, runoff, leaks, controller location, and valve areas.',
        'What changed recently: new plants, dead plants, high water bills, pressure issues, or uneven coverage.',
        'Whether irrigation is standalone or part of planting, turf, or full landscape work.'
      ]
    };
    return service && Array.isArray(service.quotePrep) && service.quotePrep.length
      ? service.quotePrep
      : (fallback[service.slug] || [
        'Photos of the area from a few angles.',
        'A rough budget range, timeline, and must-have outcome.',
        'Any access, HOA, drainage, utility, or maintenance constraints.'
      ]);
  }

  function insertServiceQuoteGuide(service, anchor) {
    if (!anchor || !service || document.getElementById('service-quote-guide')) return;

    var section = document.createElement('div');
    section.className = 'service-quote-guide reveal';
    section.id = 'service-quote-guide';
    section.innerHTML = '' +
      '<article class="service-quote-guide__panel service-quote-guide__panel--dark">' +
      '  <p class="eyebrow">Why Prices Move</p>' +
      '  <h3>What Changes ' + service.title + ' Pricing</h3>' +
      '  <ul>' + buildFitList(pricingDriversFor(service).slice(0, 3)) + '</ul>' +
      '</article>' +
      '<article class="service-quote-guide__panel">' +
      '  <p class="eyebrow">Before You Request a Quote</p>' +
      '  <h3>What Helps Us Respond Faster</h3>' +
      '  <ul>' + buildFitList(quotePrepFor(service).slice(0, 3)) + '</ul>' +
      '  <a class="text-link" href="' + serviceConsultationHref(service) + '">' + offerLabel + ' &rarr;</a>' +
      '</article>';

    anchor.insertAdjacentElement('afterend', section);
  }

  function renderHubStories() {
    var ctaSection = document.querySelector('.services-hub-cta');
    if (!ctaSection) return;

    var storyServices = services.filter(function (service) {
      return !!service.featuredProject;
    }).slice(0, 3);

    if (!storyServices.length) return;

    var existing = document.getElementById('services-hub-stories');
    if (existing) existing.remove();

    var section = document.createElement('section');
    section.className = 'service-story-strip service-story-strip--hub';
    section.id = 'services-hub-stories';
    section.innerHTML = '' +
      '<div class="container">' +
      '  <header class="service-block__header reveal reveal--left">' +
      '    <p class="eyebrow">Project Stories</p>' +
      '    <h2 class="section-title">How These Services Show Up in Real Arizona Projects</h2>' +
      '    <p>Short scope snapshots help homeowners compare service fit before they request a quote.</p>' +
      '  </header>' +
      '  <div class="service-story-grid">' +
      storyServices.map(function (service) {
        return buildServiceStoryMarkup(service, { isHub: true });
      }).join('') +
      '  </div>' +
      '</div>';

    ctaSection.parentNode.insertBefore(section, ctaSection);
  }

  function renderHub() {
    var hubGrid = byId('services-hub-grid');
    var hubProof = byId('service-proof');
    var hubReviewProof = byId('services-hub-proof');
    if (!hubGrid) return;
    if (hubProof) {
      hubProof.innerHTML = buildProofMarkup();
    }
    if (hubReviewProof) {
      applyReviewSnapshot('#services-hub-proof');
    }

    hubGrid.innerHTML = services.map(function (service) {
      var planningRange = service.typicalRange
        ? '<p class="service-card__range"><span>Typical range</span><strong>' + service.typicalRange + '</strong></p>'
        : '';
      return '' +
        '<article class="service-card reveal reveal--scale">' +
        '  <p class="service-card__eyebrow">Scottsdale &amp; Phoenix</p>' +
        '  <h3>' + service.title + '</h3>' +
        '  <p>' + service.heroSubtext + '</p>' +
        planningRange +
        '  <ul class="service-card__list">' +
        service.whatYouGet.slice(0, 3).map(function (item) {
          return '<li>' + item + '</li>';
        }).join('') +
        '  </ul>' +
        '  <div class="service-card__actions">' +
        '    <a class="btn btn--dark" href="' + serviceConsultationHref(service) + '">' + offerLabel + '</a>' +
        '    <a class="text-link" href="' + service.path + '">View Service Details &rarr;</a>' +
        '  </div>' +
        '</article>';
    }).join('');

    renderHubStories();
  }

  function renderServicePage() {
    if (!root || !root.dataset.serviceSlug) return;

    var service = (window.getServiceBySlug && window.getServiceBySlug(root.dataset.serviceSlug)) || null;
    if (!service) return;

    var heroBackground = document.querySelector('.service-hero__bg');
    var heading = byId('service-heading');
    var subtext = byId('service-subtext');
    var breadcrumbCurrent = byId('service-breadcrumb-current');
    var ctaPrimaryAll = document.querySelectorAll('[data-service-consultation-link]');
    var ctaHeading = document.querySelector('.service-cta .section-title');
    var ctaCopy = document.querySelector('.service-cta__copy p:not(.eyebrow)');
    var proof = byId('service-proof');
    var whatYouGet = byId('service-what-you-get');
    var process = byId('service-process');
    var gallery = byId('service-gallery');
    var area = byId('service-area-text');
    var faq = byId('service-faq');
    var related = byId('related-services-list');
    var reviewProof = byId('service-review-proof');
    var relatedSection = related ? related.closest('.service-related') : null;
    var gallerySection = gallery ? gallery.closest('.service-block') : null;
    var faqHeading = faq && faq.closest('.service-block')
      ? faq.closest('.service-block').querySelector('.section-title')
      : null;

    if (heading) heading.textContent = service.heroHeadline;
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = service.title;
    if (subtext) subtext.textContent = service.heroSubtext;
    if (heroBackground && Array.isArray(service.gallery) && service.gallery.length) {
      heroBackground.style.backgroundImage = 'url(\"../' + service.gallery[0].src + '\")';
    }

    var ctaLabel = offerLabel;
    ctaPrimaryAll.forEach(function (link) {
      link.setAttribute('href', serviceConsultationHref(service));
      link.textContent = ctaLabel;
    });

    if (ctaHeading) {
      ctaHeading.textContent = ctaLabel;
    }
    if (ctaCopy) {
      ctaCopy.textContent = 'Share your city, project goals, and target timeline so we can map the right next step for your ' + service.title.toLowerCase() + ' project.';
    }

    if (proof) {
      proof.innerHTML = buildProofMarkup();
    }

    if (whatYouGet) {
      whatYouGet.innerHTML = service.whatYouGet.map(function (item) {
        return '<li>' + item + '</li>';
      }).join('');

      var existingRange = document.getElementById('service-typical-range');
      if (existingRange) existingRange.remove();
      if (service.typicalRange) {
        var rangeCard = document.createElement('div');
        rangeCard.className = 'service-range reveal';
        rangeCard.id = 'service-typical-range';
        rangeCard.innerHTML = '' +
          '<div class="service-range__intro">' +
          '  <p class="eyebrow">Planning Range</p>' +
          '  <h3>Typical Project Range</h3>' +
          '</div>' +
          '<div class="service-range__content">' +
          '  <p class="service-range__value">' + service.typicalRange + '</p>' +
          '  <p class="service-range__note">Final pricing depends on scope and site conditions.</p>' +
          '</div>';
        whatYouGet.insertAdjacentElement('afterend', rangeCard);
        var fitCard = document.createElement('div');
        fitCard.className = 'service-fit reveal';
        fitCard.id = 'service-fit';
        fitCard.innerHTML = '' +
          '<article class="service-fit__panel">' +
          '  <p class="eyebrow">Good Fit If</p>' +
          '  <ul>' + buildFitList(serviceFitItems(service)) + '</ul>' +
          '</article>' +
          '<article class="service-fit__panel">' +
          '  <p class="eyebrow">Plan For</p>' +
          '  <ul>' + buildFitList(servicePlanningItems(service)) + '</ul>' +
          '</article>';
        rangeCard.insertAdjacentElement('afterend', fitCard);
        insertServiceQuoteGuide(service, fitCard);
        if (Array.isArray(service.proofBlurbs) && service.proofBlurbs.length) {
          var proofStrip = document.createElement('div');
          proofStrip.className = 'service-proof-blurbs reveal';
          proofStrip.innerHTML = service.proofBlurbs.map(function (item) {
            return '' +
              '<article class="service-proof-blurbs__item">' +
              '  <p>' + item + '</p>' +
              '</article>';
          }).join('');
          fitCard.insertAdjacentElement('afterend', proofStrip);
        }
      }
    }

    if (process) {
      process.innerHTML = service.process.map(function (step, index) {
        var displayIndex = String(index + 1).padStart(2, '0');
        return '' +
          '<article class="service-step">' +
          '  <span class="service-step__num">' + displayIndex + '</span>' +
          '  <p>' + step + '</p>' +
          '</article>';
      }).join('');
    }

    if (gallery) {
      gallery.innerHTML = service.gallery.map(function (item) {
        var sourceSet = sourceSetForImage(item.src);
        return '' +
          '<a class="service-gallery__item" href="' + servicePortfolioHref(service) + '">' +
          '  <picture>' +
          '    <source type="image/avif" srcset="' + sourceSet.avif + '" />' +
          '    <img src="' + sourceSet.fallback + '" alt="' + item.alt + '" title="' + item.alt + '" loading="lazy" decoding="async" sizes="(max-width: 768px) 100vw, 33vw" width="' + item.width + '" height="' + item.height + '" />' +
          '  </picture>' +
          '  <span class="service-gallery__chip">' + item.chip + '</span>' +
          '  <span class="service-gallery__label">' + item.label + '</span>' +
          '</a>';
      }).join('');
    }

    if (gallerySection) {
      var existingStorySection = document.getElementById('service-project-story-section');
      if (existingStorySection) existingStorySection.remove();
      if (service.featuredProject) {
        var storySection = document.createElement('section');
        storySection.className = 'service-block service-block--alt service-story-section';
        storySection.id = 'service-project-story-section';
        storySection.innerHTML = '' +
          '<div class="container">' +
          '  <header class="service-block__header reveal reveal--left">' +
          '    <p class="eyebrow">Project Story</p>' +
          '    <h2 class="section-title">One Recent ' + service.title + ' Example</h2>' +
          '    <p>A quick snapshot of how this service usually gets scoped, timed, and used in real Arizona backyards.</p>' +
          '  </header>' +
          '  <div class="service-story-grid service-story-grid--single">' +
               buildServiceStoryMarkup(service) +
          '  </div>' +
          '</div>';
        gallerySection.insertAdjacentElement('afterend', storySection);
      }
    }

    if (area) {
      area.textContent = service.serviceAreaText;
    }

    if (faq) {
      faq.innerHTML = service.faqs.map(function (item, index) {
        var openClass = index === 0 ? ' is-open' : '';
        var expanded = index === 0 ? 'true' : 'false';
        return '' +
          '<article class="faq-item service-faq__item' + openClass + '">' +
          '  <button class="faq__question service-faq__question" type="button" aria-expanded="' + expanded + '">' +
          '    <span>' + item.q + '</span><span class="faq__icon" aria-hidden="true">+</span>' +
          '  </button>' +
          '  <div class="faq__answer"><p>' + item.a + '</p></div>' +
          '</article>';
      }).join('');
    }

    if (faqHeading) {
      faqHeading.textContent = 'Questions Homeowners Ask About ' + service.title;
    }

    if (related) {
      var currentPath = normalizePath(service.path);
      var relatedServices = services.filter(function (item) {
        return normalizePath(item.path) !== currentPath;
      }).slice(0, 3);

      related.innerHTML = relatedServices.map(function (item) {
        return '<li><a href=\"' + withBase(item.path) + '\">' + item.title + '</a></li>';
      }).join('');
    }

    if (reviewProof) {
      applyReviewSnapshot('#service-review-proof');
    }

    if (relatedSection) {
      var existingResourceBlock = relatedSection.querySelector('.service-related__resources');
      if (existingResourceBlock) existingResourceBlock.remove();
      if (Array.isArray(service.resources) && service.resources.length) {
        var resourceBlock = document.createElement('div');
        var relatedContainer = relatedSection.querySelector('.container');
        if (!relatedContainer) return;
        resourceBlock.className = 'service-related__resources reveal';
        resourceBlock.innerHTML =
          '<p class="service-related__eyebrow">Related Guides</p>' +
          '<ul class="service-related__resource-list">' +
          service.resources.map(function (item) {
            return '<li><a href="' + normalizeDisplayPath(item.path) + '">' + item.title + '</a></li>';
          }).join('') +
          '</ul>';
        relatedContainer.appendChild(resourceBlock);
      }
    }

    injectFaqSchema(service);
  }

  renderHub();
  renderServicePage();
})();
