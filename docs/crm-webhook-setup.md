# CRM Webhook Fan-Out Setup

The Netlify function `netlify/functions/send-ticket-emails.js` can now fan out leads to multiple webhook targets.

## Optional Environment Variables

- `CRM_WEBHOOK_URL`
- `CRM_WEBHOOK_SECRET` (sent as `x-webhook-secret`)
- `SLACK_WEBHOOK_URL`
- `AIRTABLE_WEBHOOK_URL`
- `HUBSPOT_WEBHOOK_URL`

## Payload Summary

Each webhook receives JSON with:

- contact fields (`first_name`, `last_name`, `email`, `phone`)
- project fields (`service`, `selected_style`, `selected_image`, `selected_project_label`)
- qualification fields (`consultation_tier`, `lead_tier`, `budget_range`, `start_timeline`, `estimated_timeline`, `contact_method`)
- attribution fields (`lead_source`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `referrer`, `landing_path`, `page_url`)
- sheet context (`sheet_status`, `sheet_row_id`, `sheet_row_url`)
- triage fields (`owner_priority`, `owner_lead_score`, `owner_lead_tier`, `owner_lead_tags`, `high_intent`, `budget_fit`, `service_match`)

## Retry Behavior

- Each webhook call retries up to 2 times with short backoff.
- Failures are captured in function response under `crm_result`.
- Email delivery and form submission continue even if webhook fan-out fails.
