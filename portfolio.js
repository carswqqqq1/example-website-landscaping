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
      service: mapCategoryToServiceSlug(category, itemType),
      selected_style: normalizeSlug(category),
      selected_image: extractImageId(item),
      selected_project_label: projectLabel,
      prefill_message: 'Interested in a ' + (itemType || 'landscape') + ' project similar to ' + projectLabel + '.'
    });
    params.set('autostart', '1');
    return '/free-consultation?' + params.toString();
  }

  function updateRequestLinks(item) {
    var targetItem = item || visibleItems()[0] || items[0];
    var href = buildRequestHref(targetItem);
    if (requestStyleButton) requestStyleButton.setAttribute('href', href);
    if (lightboxRequest) lightboxRequest.setAttribute('href', href);
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
      var match = cat === 'all' || item.dataset.cat === cat;
      item.classList.toggle('is-hidden', !match);
      item.setAttribute('aria-hidden', match ? 'false' : 'true');
      item.classList.toggle('is-visible', match);
    });

    updateRequestLinks(visibleItems()[0]);
  }

  function updateLightboxFrame(item) {
    if (!lightbox || !lightboxImg || !item) return;
    var image = item.querySelector('img');
    if (!image) return;

    lightboxImg.src = image.currentSrc || image.src;
    lightboxImg.alt = image.alt || 'Project image preview';
    lightboxType.textContent = item.dataset.type || 'Landscape Project';
    lightboxLocation.textContent = item.dataset.location || 'Scottsdale / Phoenix Area';
    lightboxDetail.textContent = item.dataset.detail || 'Design-build landscape project by Think Green.';
    updateRequestLinks(item);
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
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
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

  items.forEach(function (item) {
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', 'Open project preview');

    item.addEventListener('click', function () {
      openLightboxByItem(item);
    });

    item.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightboxByItem(item);
      }
    });
  });

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

  var initialServiceFilter = mapServiceToFilter(pageParams.get('service'));
  if (initialServiceFilter && initialServiceFilter !== 'all') {
    currentFilter = initialServiceFilter;
  }

  updateFilterCounts();
  applyFilter(currentFilter);
})();
