# Accessibility Release Checklist

Use this before launch or resale handoff.

## Automated baseline

Run:

```bash
npm run check:a11y
```

This confirms:

- every public page has a skip link to `#main-content`
- every public page has a matching `<main id="main-content">`
- nav burger controls keep the expected ARIA baseline
- key JS-dependent pages include a `<noscript>` fallback message

## Manual pass

Verify these in a real browser before calling a build final:

1. Keyboard-only navigation can reach primary nav, mobile menu, CTA buttons, FAQ toggles, and form fields.
2. Focus is visible on nav links, footer links, sticky CTA buttons, and the back-to-top button.
3. Mobile menu opens, traps focus correctly, and closes with Escape.
4. Consultation drawer opens, traps focus correctly, and returns focus to the trigger on close.
5. Portfolio lightbox opens, supports keyboard navigation, and returns focus correctly.
6. Before/after slider remains understandable without drag gestures alone.
7. Form validation errors are announced clearly and success/error states are visible.
8. The page remains usable with reduced motion enabled.
9. Pages remain readable at 200% zoom on desktop and mobile.
10. Screen-reader pass:
    - homepage
    - services hub
    - one service page
    - portfolio
    - reviews
    - free consultation

## Release note

This checklist does not replace a formal WCAG audit, but it creates a repeatable release gate instead of relying on memory.
