# Email Deliverability Checklist (Netlify + Resend/SMTP)

Use this before sending client-facing confirmation emails at scale.

## 1) Use a branded sending domain
- Buy/use a domain you control (example: `clientdomain.com`).
- Set `RESEND_FROM_EMAIL` to a real mailbox on that domain.
- Example: `Think Green <quotes@clientdomain.com>`.

## 2) Configure DNS authentication
Add these records in DNS exactly as your provider requests:
- SPF
- DKIM
- DMARC

Recommended DMARC starting policy:
- `v=DMARC1; p=none; rua=mailto:dmarc@clientdomain.com; adkim=s; aspf=s`

After validation and stable sending volume:
- move to `p=quarantine`, then `p=reject`.

## 3) Keep reply paths clean
- Reply-To should be monitored (`OWNER_EMAIL` or intake mailbox).
- Avoid no-reply addresses when possible.

## 4) Warm up volume
- First week: low volume and genuine submissions only.
- Avoid mass test sends from new domains.

## 5) Content hygiene
- Keep subject lines plain and specific.
- Avoid spammy wording and excessive links/images.
- Ensure HTML + text version are present (already handled in function fallback).

## 6) Monitor placement
- Send test submissions to Gmail, iCloud, Outlook.
- Check spam placement and adjust DNS/sender reputation before scaling.

## 7) Environment variables to verify
- `EMAIL_PROVIDER`
- `OWNER_EMAIL_PROVIDER`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `FROM_EMAIL` (SMTP fallback)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
