# Google Sheet Setup (Lead Capture)

This uses the webhook script in `docs/google-sheets-webhook.gs`.

## 1) Create the script

1. Open [script.new](https://script.new).
2. Replace the default code with the contents of `docs/google-sheets-webhook.gs`.
3. Set:
   - `TARGET_SPREADSHEET_ID` to your existing sheet ID (or leave blank to auto-create one).
   - `WEBHOOK_SECRET` to a long random secret.

## 2) Deploy as Web App

1. Click `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone`.
5. Deploy and copy the Web app URL.

## 3) Set Cloudflare Pages variables and secrets

In **Workers & Pages → example-website-landscaping → Settings → Variables and Secrets**, set these values for Production (and Preview when preview form testing is required):

- `GOOGLE_SHEETS_WEBHOOK_URL` = your web app URL (store as an encrypted secret)
- `GOOGLE_SHEETS_WEBHOOK_SECRET` = same secret from the script (store as an encrypted secret)
- `GOOGLE_SHEET_URL` = full URL of the target sheet (used in owner email fallback button)

Save the values before deploying the Pages Function that uses them.

## 4) Verify

Submit the contact form once. The script auto-creates a spreadsheet named `Think Green Lead Dashboard` and writes rows to the `Owner Lead Dashboard` tab.

Expected behavior:

1. New leads default to:
   - `status = New`
   - `follow_up_due = NOW()+1 day`
   - `next_action = Call`
2. Duplicate leads (same email or phone in last 7 days) are marked:
   - `status = Duplicate`
   - `lead_tags` includes `duplicate`
3. Webhook response includes:
   - `row_id`
   - `row_url`
   - `status`

Lead attribution fields to confirm in the owner sheet:

- `lead_source`
- `page_url`
- `referrer`
- `landing_path`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`

These fields help the landscaper see which page, campaign, service CTA, or resource produced the lead before they call back.
