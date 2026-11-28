/* Portfolio page filter + lightbox + request-style prefill flow */
(function () {
  'use strict';

  var filters = Array.prototype.slice.call(document.querySelectorAll('.pf-filter'));
  var items = Array.prototype.slice.call(document.querySelectorAll('.pf-item'));

  if (!filters.length || !items.length) return;

  var currentFilter = 'all';
  var currentLightboxIndex = -1;
  var touchStartX = 0;
  var touchEndX = 0;
  var lastFocusedElement = null;
  var requestStyleButton = document.getElementById('pf-request-style');
  var pageParams = new URLSearchParams(window.location.search);
  var storyMedia = document.querySelector('.pf-story__media');

  var lightbox = document.getElementById('pf-lightbox');
  var lightboxImg = document.getElementById('pf-lightbox-img');
  var lightboxType = document.getElementById('pf-lightbox-type');
  var lightboxLocation = document.getElementById('pf-lightbox-location');
  var lightboxDetail = document.getElementById('pf-lightbox-detail');
  var lightboxRequest = document.getElementById('pf-lightbox-request');
  var lightboxClose = document.getElementById('pf-lightbox-close');
  var lightboxPrev = document.getElementById('pf-lightbox-prev');
  var lightboxNext = document.getElementById('pf-lightbox-next');
  var lightboxBackdrop = lightbox ? lightbox.querySelector('[data-lightbox-close]') : null;
  var lightboxFigure = lightbox ? lightbox.querySelector('.pf-lightbox__figure') : null;

  function visibleItems() {
    return items.filter(function (item) { return !item.classList.contains('is-hidden'); });
  }

  function normalizeSlug(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function toTitle(value) {
    return String(value || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b([a-z])/g, function (_, letter) { return letter.toUpperCase(); });
  }

  function extractImageId(item) {
    var image = item ? item.querySelector('img') : null;
    if (!image) return 'portfolio-style';
    var src = image.currentSrc || image.getAttribute('src') || '';
    var file = src.split('/').pop() || 'portfolio-style';
    return file;
  }

  function extractProjectLabel(item) {
    var heading = item ? item.querySelector('.pf-item__cap h3') : null;
    if (heading && heading.textContent.trim()) return heading.textContent.trim();
    return toTitle(item && item.dataset.type ? item.dataset.type : currentFilter || 'Project style');
  }

  function mapCategoryToServiceSlug(category, itemType) {
    var slug = normalizeSlug(category);
    var type = normalizeSlug(itemType);
    if (slug === 'hardscape' || type.indexOf('hardscape') >= 0) return 'hardscaping';
    if (slug === 'water' || type.indexOf('water') >= 0) return 'irrigation';
    if (slug === 'outdoor' || type.indexOf('outdoor') >= 0 || type.indexOf('kitchen') >= 0) return 'outdoor-kitchens';
    if (slug === 'desert' || type.indexOf('desert') >= 0 || type.indexOf('xeriscape') >= 0) return 'desert-landscaping';
    if (slug === 'frontyard' || type.indexOf('curb') >= 0) return 'landscape-design';
    if (type.indexOf('fire') >= 0) return 'fire-features';
    if (slug === 'backyard') return 'landscape-design';
    return 'landscape-design';
  }

  function itemServiceSlugs(item) {
    return String(item && item.dataset.services ? item.dataset.services : '')
      .split(/\s+/)
      .map(normalizeSlug)
      .filter(Boolean);
  }

  function itemPrimaryService(item) {
    var slugs = itemServiceSlugs(item);
    if (slugs.length) return slugs[0];
    return mapCategoryToServiceSlug(item && item.dataset.cat, item && item.dataset.type);
  }

  function itemMatchesFilter(item, cat) {
    if (cat === 'all') return true;
    if (cat.indexOf('service:') === 0) return itemServiceSlugs(item).indexOf(cat.slice(8)) >= 0;
    return item.dataset.cat === cat;
  }

  function mapServiceToFilter(serviceSlug) {
    var slug = normalizeSlug(serviceSlug);
    if (!slug) return 'all';
    if (slug === 'hardscaping') return 'hardscape';
    if (slug === 'outdoor-kitchens') return 'outdoor';
    if (slug === 'fire-features') return 'outdoor';
    if (slug === 'artificial-turf' || slug === 'desert-landscaping') return 'desert';
    if (slug === 'irrigation') return 'water';
    if (slug === 'landscape-design') return 'backyard';
    return 'all';
  }

  function buildRequestHref(item) {
    var category = item && item.dataset.cat ? item.dataset.cat : currentFilter;
    if (!category || category === 'all') category = 'backyard';
    var itemType = item && item.dataset.type ? item.dataset.type : '';
    var projectLabel = extractProjectLabel(item);
    var params = new URLSearchParams({
      source: 'portfolio',
      service: itemPrimaryService(item),
      selected_style: normalizeSlug(category),
      selected_image: extractImageId(item),
      selected_project_label: projectLabel,
      prefill_message: 'Interested in a project similar to ' + projectLabel + '.'
    });
    params.set('autostart', '1');
    return '/free-consultation?' + params.toString();
  }

  /* The filter-bar CTA is generic: it never claims a project the visitor did
     not pick. It only carries the service when the page is filtered by one. */
  function buildGenericRequestHref() {
    var params = new URLSearchParams({ source: 'portfolio' });
    if (currentFilter.indexOf('service:') === 0) params.set('service', currentFilter.slice(8));
    params.set('autostart', '1');
    return '/free-consultation?' + params.toString();
  }

  function updateRequestLinks(item) {
    if (requestStyleButton) requestStyleButton.setAttribute('href', buildGenericRequestHref());
    if (lightboxRequest && item) lightboxRequest.setAttribute('href', buildRequestHref(item));
  }

  function updateFilterCounts() {
    filters.forEach(function (btn) {
      var cat = btn.dataset.filter || 'all';
      var count = cat === 'all'
        ? items.length
        : items.filter(function (item) { return item.dataset.cat === cat; }).length;
      var badge = btn.querySelector('.pf-filter__count');
      if (badge) badge.textContent = String(count);
    });
  }

  function applyFilter(cat) {
    currentFilter = cat;
    filters.forEach(function (btn) {
      var isActive = (btn.dataset.filter || 'all') === cat;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    items.forEach(function (item) {
      var match = itemMatchesFilter(item, cat);
      item.classList.toggle('is-hidden', !match);
      item.setAttribute('aria-hidden', match ? 'false' : 'true');
      item.classList.toggle('is-visible', match);
    });

    updateRequestLinks(null);
  }

  function updateLightboxFrame(item) {
    if (!lightbox || !lightboxImg || !item) return;
    var image = item.querySelector('img');
    if (!image) return;

    // The grid shows a small file; the preview loads the full-size one.
    lightboxImg.src = image.getAttribute('src') || image.currentSrc || image.src;
    lightboxImg.alt = image.alt || 'Project image preview';
    lightboxType.textContent = item.dataset.type || 'Landscape Project';
    lightboxLocation.textContent = item.dataset.location || 'Scottsdale / Phoenix Area';
    lightboxDetail.textContent = item.dataset.detail || 'Design-build landscape project by Mesa Wren.';
    updateRequestLinks(item);
  }

  function getStoryLightboxItem() {
    return items.find(function (item) {
      var heading = item.querySelector('.pf-item__cap h3');
      return heading && /architectural grounds/i.test(heading.textContent || '');
    }) || items.find(function (item) {
      var image = item.querySelector('img');
      var src = image ? String(image.getAttribute('src') || image.currentSrc || '') : '';
      return src.indexOf('fireplace-1280') >= 0;
    }) || items[0];
  }

  function openLightboxByItem(item) {
    var visible = visibleItems();
    var index = visible.indexOf(item);
    if (index === -1 || !lightbox) return;

    lastFocusedElement = document.activeElement;
    currentLightboxIndex = index;
    updateLightboxFrame(visible[currentLightboxIndex]);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('has-pf-lightbox-open');
    setLightboxBackgroundInert(true);
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.body.classList.remove('has-pf-lightbox-open');
    setLightboxBackgroundInert(false);
    currentLightboxIndex = -1;
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function moveLightbox(step) {
    var visible = visibleItems();
    if (!visible.length || currentLightboxIndex < 0) return;
    currentLightboxIndex = (currentLightboxIndex + step + visible.length) % visible.length;
    updateLightboxFrame(visible[currentLightboxIndex]);
  }

  function handleLightboxTabTrap(event) {
    if (!lightbox || !lightbox.classList.contains('is-open') || event.key !== 'Tab') return;
    var focusable = Array.prototype.slice.call(lightbox.querySelectorAll('button, a[href]')).filter(function (element) {
      return element.offsetParent !== null;
    });
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyFilter(this.dataset.filter || 'all');
    });
  });

  /* Each figure keeps its figure semantics; a real button inside it opens
     the preview, so keyboard and screen reader users get native behavior. */
  function addOpenButton(container, label, onOpen) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pf-item__open';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      onOpen();
    });
    container.appendChild(button);
    container.addEventListener('click', function (event) {
      if (event.target === button || event.defaultPrevented) return;
      if (event.target.closest && event.target.closest('a')) return;
      onOpen();
    });
    return button;
  }

  items.forEach(function (item) {
    item.removeAttribute('tabindex');
    item.removeAttribute('role');
    addOpenButton(item, 'Open project preview: ' + extractProjectLabel(item), function () {
      openLightboxByItem(item);
    });
  });

  if (storyMedia) {
    if (window.getComputedStyle(storyMedia).position === 'static') storyMedia.style.position = 'relative';
    addOpenButton(storyMedia, 'Open featured project preview', function () {
      var storyItem = getStoryLightboxItem();
      if (storyItem) {
        applyFilter(storyItem.dataset.cat || 'all');
        openLightboxByItem(storyItem);
      }
    });
  }

  function setLightboxBackgroundInert(isInert) {
    Array.prototype.slice.call(document.body.children).forEach(function (node) {
      if (node === lightbox || node.tagName === 'SCRIPT') return;
      if (isInert) {
        if (node.hasAttribute('data-lightbox-inert')) return;
        if (node.inert || node.getAttribute('aria-hidden') === 'true') return;
        node.setAttribute('data-lightbox-inert', '');
        node.setAttribute('aria-hidden', 'true');
        if ('inert' in node) node.inert = true;
      } else if (node.hasAttribute('data-lightbox-inert')) {
        node.removeAttribute('data-lightbox-inert');
        node.removeAttribute('aria-hidden');
        if ('inert' in node) node.inert = false;
      }
    });
  }

  if (lightbox) {
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener('click', function () { moveLightbox(-1); });
    if (lightboxNext) lightboxNext.addEventListener('click', function () { moveLightbox(1); });

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });

    if (lightboxFigure) {
      lightboxFigure.addEventListener('touchstart', function (event) {
        touchStartX = event.changedTouches[0].clientX;
      }, { passive: true });

      lightboxFigure.addEventListener('touchend', function (event) {
        touchEndX = event.changedTouches[0].clientX;
        var delta = touchEndX - touchStartX;
        if (Math.abs(delta) < 40) return;
        if (delta > 0) moveLightbox(-1);
        else moveLightbox(1);
      }, { passive: true });
    }
  }

  window.addEventListener('keydown', function (event) {
    if (!lightbox || !lightbox.classList.contains('is-open')) return;
    handleLightboxTabTrap(event);
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') moveLightbox(-1);
    if (event.key === 'ArrowRight') moveLightbox(1);
  });

  var requestedService = normalizeSlug(pageParams.get('service'));
  if (requestedService && items.some(function (item) { return itemServiceSlugs(item).indexOf(requestedService) >= 0; })) {
    currentFilter = 'service:' + requestedService;
  } else if (requestedService) {
    var initialServiceFilter = mapServiceToFilter(requestedService);
    if (initialServiceFilter && initialServiceFilter !== 'all') currentFilter = initialServiceFilter;
  }

  updateFilterCounts();
  applyFilter(currentFilter);
})();
