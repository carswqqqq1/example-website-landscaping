const DEFAULT_QUERY = process.env.GOOGLE_PLACES_QUERY || 'Think Green Design | Build Landscape, 7730 E. Gelding Dr. Ste 1, Scottsdale, AZ 85260';
const DEFAULT_PROFILE_URL = process.env.GOOGLE_PLACES_PROFILE_URL || 'https://www.google.com/maps/place/Think+Green+Design+%7C+Build+Landscape/@33.61549,-111.9165894,17z/data=!3m1!4b1!4m6!3m5!1s0x872b74777c987d53:0x8acb242f61538220!8m2!3d33.6154856!4d-111.9140145!16s%2Fg%2F1vg4k7_v?entry=ttu&g_ep=EgoyMDI2MDQxNS4wIKXMDSoASAFQAw%3D%3D';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=900'
    },
    body: JSON.stringify(body)
  };
}

function trim(value) {
  return String(value || '').trim();
}

function normalizeReview(review) {
  const author = review && review.authorAttribution ? review.authorAttribution : {};
  return {
    rating: Number(review && review.rating) || 5,
    text: trim(review && (review.text || review.originalText || '')),
    author: trim(author.displayName) || 'Google reviewer',
    authorUrl: trim(author.uri),
    authorPhoto: trim(author.photoUri || author.photoURI),
    reviewDate: trim(review && (review.relativePublishTimeDescription || review.publishTime)) || 'Recent review',
    sourceUrl: trim(review && review.googleMapsUri)
  };
}

async function requestPlaces(url, body, fieldMask, apiKey) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google Places request failed (${response.status}): ${text.slice(0, 240)}`);
  }

  return response.json();
}

async function resolvePlace(apiKey, placeId) {
  if (placeId) {
    return placeId;
  }

  const search = await requestPlaces(
    'https://places.googleapis.com/v1/places:searchText',
    {
      textQuery: DEFAULT_QUERY,
      includePureServiceAreaBusinesses: true,
      pageSize: 5
    },
    'places.id,places.displayName,places.formattedAddress,places.googleMapsUri',
    apiKey
  );

  const firstPlace = Array.isArray(search.places) ? search.places.find(Boolean) : null;
  if (!firstPlace || !firstPlace.id) {
    throw new Error('Unable to resolve a Google Place ID for the business.');
  }

  return firstPlace.id;
}

async function loadGoogleReviewFeed() {
  const apiKey = trim(process.env.GOOGLE_PLACES_API_KEY);
  const envPlaceId = trim(process.env.GOOGLE_PLACES_PLACE_ID);

  if (!apiKey) {
    return {
      ok: false,
      source: 'Google',
      profileUrl: DEFAULT_PROFILE_URL,
      live: false,
      reason: 'missing_google_places_api_key'
    };
  }

  const placeId = await resolvePlace(apiKey, envPlaceId);
  const details = await requestPlaces(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {},
    'id,displayName,formattedAddress,rating,userRatingCount,reviews,googleMapsUri',
    apiKey
  );

  const reviews = Array.isArray(details.reviews) ? details.reviews.map(normalizeReview).filter((review) => review.text || review.author) : [];
  const placeName = trim(details.displayName && details.displayName.text) || trim(details.displayName) || 'Think Green Design | Build Landscape';
  const profileUrl = trim(details.googleMapsUri) || DEFAULT_PROFILE_URL;

  return {
    ok: true,
    live: true,
    source: 'Google',
    placeId,
    placeName,
    profileUrl,
    rating: details.rating ? String(details.rating) : '',
    reviewCount: details.userRatingCount ? String(details.userRatingCount) : '',
    formattedAddress: trim(details.formattedAddress),
    snapshotDate: 'Live from Google Business Profile',
    reviews
  };
}

exports.handler = async function handler() {
  try {
    const payload = await loadGoogleReviewFeed();
    return json(200, payload);
  } catch (error) {
    return json(200, {
      ok: false,
      source: 'Google',
      profileUrl: DEFAULT_PROFILE_URL,
      live: false,
      reason: 'fetch_failed'
    });
  }
};
