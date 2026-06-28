#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'google-reviews.json');
const siteConfig = require(path.join(root, 'site-config.js'));
const args = new Set(process.argv.slice(2));
let cachedExistingFeed;

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

function textValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value.text === 'string') return value.text.trim();
  return '';
}

function starRatingToNumber(value) {
  if (typeof value === 'number') return value;
  const text = String(value || '').toUpperCase();
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[text] || Number(value) || 0;
}

function formatReviewDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Recent review';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: 'long'
  }).format(date);
}

function formatSnapshotDate(date = new Date()) {
  return `Last updated ${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)}`;
}

function readExistingFeed() {
  if (cachedExistingFeed !== undefined) return cachedExistingFeed;
  if (!fs.existsSync(outputPath)) {
    cachedExistingFeed = {};
    return cachedExistingFeed;
  }

  try {
    cachedExistingFeed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } catch (error) {
    cachedExistingFeed = {};
  }
  return cachedExistingFeed;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload.error && payload.error.message ? payload.error.message : text;
    throw new Error(`${response.status} ${response.statusText}: ${message}`);
  }
  return payload;
}

function normalizePlacesReview(review) {
  const text = textValue(review.text) || textValue(review.originalText);
  if (!text) return null;
  const author = review.authorAttribution || {};
  return {
    id: String(review.name || review.googleMapsUri || text.slice(0, 32)).trim(),
    author: String(author.displayName || 'Google reviewer').trim(),
    authorUrl: String(author.uri || '').trim(),
    authorPhoto: String(author.photoUri || '').trim(),
    rating: starRatingToNumber(review.rating) || 5,
    text,
    location: 'Google',
    projectType: 'Google review',
    reviewDate: review.relativePublishTimeDescription || formatReviewDate(review.publishTime),
    sourceUrl: String(review.googleMapsUri || author.uri || siteConfig.reviewSummary?.sourceUrl || siteConfig.googleReviews?.profileUrl || '').trim(),
    publishTime: String(review.publishTime || '').trim()
  };
}

function normalizeBusinessProfileReview(review) {
  const text = String(review.comment || '').trim();
  if (!text) return null;
  const reviewer = review.reviewer || {};
  return {
    id: String(review.reviewId || review.name || text.slice(0, 32)).trim(),
    author: String(reviewer.displayName || 'Google reviewer').trim(),
    authorUrl: '',
    authorPhoto: String(reviewer.profilePhotoUrl || '').trim(),
    rating: starRatingToNumber(review.starRating) || 5,
    text,
    location: 'Google Business Profile',
    projectType: 'Google review',
    reviewDate: formatReviewDate(review.updateTime || review.createTime),
    sourceUrl: String(siteConfig.reviewSummary?.sourceUrl || siteConfig.googleReviews?.profileUrl || '').trim(),
    publishTime: String(review.updateTime || review.createTime || '').trim()
  };
}

function uniqueReviews(reviews) {
  const seen = new Set();
  return reviews.filter((review) => {
    if (!review || !review.text) return false;
    const key = `${review.author}|${review.text}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getBusinessProfileAccessToken() {
  const payload = new URLSearchParams({
    client_id: required('GOOGLE_OAUTH_CLIENT_ID'),
    client_secret: required('GOOGLE_OAUTH_CLIENT_SECRET'),
    refresh_token: required('GOOGLE_OAUTH_REFRESH_TOKEN'),
    grant_type: 'refresh_token'
  });
  const token = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString()
  });
  if (!token.access_token) throw new Error('Google OAuth token response did not include access_token');
  return token.access_token;
}

async function fetchBusinessProfileReviews() {
  const accountId = required('GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID');
  const locationId = required('GOOGLE_BUSINESS_PROFILE_LOCATION_ID');
  const accessToken = await getBusinessProfileAccessToken();
  const reviews = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ pageSize: '50' });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews?${params.toString()}`;
    const payload = await fetchJson(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    reviews.push(...(payload.reviews || []).map(normalizeBusinessProfileReview).filter(Boolean));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  return {
    provider: 'google-business-profile',
    limited: false,
    placeName: siteConfig.businessName || 'Think Green Design | Build Landscape',
    profileUrl: siteConfig.reviewSummary?.sourceUrl || siteConfig.googleReviews?.profileUrl || '',
    rating: String(siteConfig.reviewSummary?.rating || siteConfig.googleReviews?.rating || ''),
    reviewCount: String(reviews.length || siteConfig.reviewSummary?.count || siteConfig.googleReviews?.count || ''),
    reviews: uniqueReviews(reviews)
  };
}

async function fetchPlacesByName(apiKey, textQuery) {
  const payload = await fetchJson('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.name,places.displayName,places.formattedAddress,places.googleMapsUri,places.rating,places.userRatingCount,places.reviews'
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 })
  });
  if (!payload.places || !payload.places.length) {
    throw new Error(`No Google Place found for query: ${textQuery}`);
  }
  return payload.places[0];
}

async function fetchPlacesDetails(apiKey, placeId) {
  const resourceName = String(placeId || '').startsWith('places/') ? placeId : `places/${placeId}`;
  return fetchJson(`https://places.googleapis.com/v1/${resourceName}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,name,displayName,formattedAddress,googleMapsUri,rating,userRatingCount,reviews'
    }
  });
}

async function fetchPlacesReviews() {
  const apiKey = required('GOOGLE_PLACES_API_KEY');
  const existing = readExistingFeed();
  const configuredPlaceId = optional('GOOGLE_PLACE_ID') ||
    optional('GOOGLE_PLACES_PLACE_ID') ||
    String(siteConfig.googleReviews?.placeId || '').trim() ||
    String(existing.placeId || '').trim();
  const defaultQuery = [
    siteConfig.businessName,
    siteConfig.address?.line1,
    siteConfig.address?.city,
    siteConfig.address?.state,
    siteConfig.address?.zip
  ].filter(Boolean).join(' ');
  const place = configuredPlaceId
    ? await fetchPlacesDetails(apiKey, configuredPlaceId)
    : await fetchPlacesByName(apiKey, optional('GOOGLE_PLACES_TEXT_QUERY', optional('GOOGLE_PLACES_QUERY', defaultQuery)));

  return {
    provider: 'google-places',
    limited: true,
    placeId: String(place.id || '').trim(),
    placeName: textValue(place.displayName) || siteConfig.businessName || 'Think Green Design | Build Landscape',
    profileUrl: String(place.googleMapsUri || siteConfig.reviewSummary?.sourceUrl || siteConfig.googleReviews?.profileUrl || '').trim(),
    rating: place.rating ? String(place.rating) : String(siteConfig.reviewSummary?.rating || siteConfig.googleReviews?.rating || ''),
    reviewCount: place.userRatingCount ? String(place.userRatingCount) : String(siteConfig.reviewSummary?.count || siteConfig.googleReviews?.count || ''),
    reviews: uniqueReviews((place.reviews || []).map(normalizePlacesReview).filter(Boolean))
  };
}

async function buildReviewFeed() {
  const wantsBusinessProfile = optional('GOOGLE_REVIEW_FETCH_MODE') === 'business-profile' ||
    optional('GOOGLE_BUSINESS_PROFILE_LOCATION_ID');

  if (wantsBusinessProfile) {
    return fetchBusinessProfileReviews();
  }
  return fetchPlacesReviews();
}

(async () => {
  try {
    const fetched = await buildReviewFeed();
    const now = new Date();
    const existing = readExistingFeed();
    const existingReviews = Array.isArray(existing.reviews) ? existing.reviews : [];
    const fetchedReviews = Array.isArray(fetched.reviews) ? fetched.reviews : [];
    const shouldPreserveFullSnapshot = Boolean(fetched.limited) &&
      existingReviews.length > fetchedReviews.length;
    const reviews = shouldPreserveFullSnapshot ? existingReviews : fetchedReviews;
    const output = {
      ok: true,
      source: 'Google',
      provider: fetched.provider,
      live: true,
      limited: Boolean(fetched.limited),
      preservedFullSnapshot: shouldPreserveFullSnapshot,
      placeId: fetched.placeId || '',
      placeName: fetched.placeName || siteConfig.businessName || '',
      profileUrl: fetched.profileUrl || siteConfig.reviewSummary?.sourceUrl || siteConfig.googleReviews?.profileUrl || '',
      rating: fetched.rating || '',
      reviewCount: fetched.reviewCount || '',
      writtenReviewCount: String(reviews.filter((review) => String(review.text || review.originalText || '').trim()).length),
      ratingOnlyCount: String(reviews.filter((review) => !String(review.text || review.originalText || '').trim()).length),
      snapshotDate: formatSnapshotDate(now),
      updatedAt: now.toISOString(),
      reviews
    };

    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Updated google-reviews.json with ${output.reviews.length} Google review(s) via ${output.provider}.`);
    if (output.limited) {
      console.log('Note: Google Places may return a limited official review sample. Use Business Profile API credentials for a fuller owner review feed.');
      if (shouldPreserveFullSnapshot) {
        console.log('Preserved the fuller existing review snapshot instead of replacing it with the limited Places sample.');
      }
    }
  } catch (error) {
    if (args.has('--allow-missing') && /^Missing required env var:/.test(String(error.message || ''))) {
      console.warn(`Skipped Google review update: ${error.message}`);
      process.exit(0);
    }
    console.error(`Google review update failed: ${error.message}`);
    process.exit(1);
  }
})();
