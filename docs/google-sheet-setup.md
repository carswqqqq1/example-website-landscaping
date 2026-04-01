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

## 3) Set Netlify environment variables

Set these vars for site `thinkgreen-az`:

- `GOOGLE_SHEETS_WEBHOOK_URL` = your web app URL
- `GOOGLE_SHEETS_WEBHOOK_SECRET` = same secret from script
- `GOOGLE_SHEET_URL` = full URL of the target sheet (used in owner email fallback button)

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
