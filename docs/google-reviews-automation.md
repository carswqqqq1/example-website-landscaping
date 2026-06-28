# Google Reviews Automation

The reviews page reads `/google-reviews.json`. Do not hand-write review cards in HTML or `site-config.js`.

## Easy Setup: Google Places

Add these GitHub repository secrets:

- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_PLACE_ID` if known, otherwise set `GOOGLE_PLACES_TEXT_QUERY`

The scheduled workflow runs `node scripts/update-google-reviews.js` daily and commits a refreshed `google-reviews.json`.

Google Places may return only a limited official review sample, plus the rating and review count.

## Fuller Owner Feed: Google Business Profile

For a fuller exact owner review feed, connect the Business Profile account and add:

- `GOOGLE_REVIEW_FETCH_MODE=business-profile`
- `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID`
- `GOOGLE_BUSINESS_PROFILE_LOCATION_ID`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

The script writes only Google-returned review text and source metadata. If credentials are missing, the site shows the Google review profile link instead of demo reviews.
