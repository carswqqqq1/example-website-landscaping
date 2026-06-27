# Heatmap Analytics Structure

The site has a privacy-safe heatmap event layer in `script.js`, configured from `site-config.js`.

Events only run after the existing cookie consent is accepted. The tracker does not capture form values, names, emails, phone numbers, message text, or payment details.

## Event Names

- `heatmap_click`: click/tap position, viewport size, scroll depth, element label, element type, href, and page zone.
- `heatmap_scroll_depth`: first time a visitor reaches 25%, 50%, 75%, and 90% scroll depth.
- `heatmap_form_start`: first focus inside each form, including the dynamic project-review drawer.
- `heatmap_rage_click`: three rapid clicks in the same small area on the same labeled element.

## Runtime Hooks

- `window.trackHeatmapEvent(name, params)`: pushes a privacy-safe event.
- `window.heatmapEvents`: recent in-memory event buffer for QA.
- `window.dataLayer`: receives heatmap events for GTM, GA4, Clarity, Hotjar, or another vendor.

## Vendor Wiring

Use Google Tag Manager or a vendor snippet to listen for the event names above. Keep the existing consent gate in place before enabling any session-recording or heatmap vendor.
