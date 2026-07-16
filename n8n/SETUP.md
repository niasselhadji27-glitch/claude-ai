# WhatsApp Real Estate Lead Qualifier — Setup Guide

An n8n automation for a real estate agency: when a prospect messages the agency's
WhatsApp Business number, an AI assistant replies instantly, answers questions,
and qualifies the lead. Lead details are saved to a Google Sheet, and the realtor
gets a WhatsApp alert the moment a lead is fully qualified.

**Workflow in n8n:** `WhatsApp Real Estate Lead Qualifier`
(created from `whatsapp-lead-qualifier.workflow.ts` in this folder).

## How it works

```
WhatsApp Trigger (incoming message)
  → Is Text Message?  (ignores delivery receipts / media-only events)
  → Lead Qualifier Agent
      ├─ OpenAI Chat Model        (the brain)
      ├─ Per-Prospect Memory      (conversation history, keyed by the sender's phone number)
      ├─ save_lead                (Google Sheets upsert, one row per phone number)
      └─ notify_realtor           (WhatsApp alert to the realtor when lead is qualified)
  → Reply on WhatsApp             (sends the agent's answer back to the prospect)
```

The agent collects six qualification fields conversationally — **name, intent
(buy/rent/sell), property type, budget, location, timeline** — asking at most one
question per reply. It updates the Google Sheet row after every new piece of
information (status: `new` → `in_progress` → `qualified`) and alerts the realtor
exactly once when all six fields are known. It replies in the prospect's language.

## 1. Meta / WhatsApp Business Cloud prerequisites

You need a Meta developer app with the WhatsApp product added
(https://developers.facebook.com → Create App → Business type → add WhatsApp):

1. Note the **Phone Number ID** of the business number (WhatsApp → API Setup).
2. Create a **System User access token** (Business Settings → System Users) with
   `whatsapp_business_messaging` and `whatsapp_business_management` permissions —
   the temporary token from API Setup expires in 24 h.
3. In n8n, create two credentials:
   - **WhatsApp Trigger account** (`whatsAppTriggerApi`): App ID + App Secret from
     the Meta app dashboard. n8n gives you a webhook URL + verify token — paste
     those into the Meta app under WhatsApp → Configuration → Webhook, and
     subscribe to the **messages** field.
   - **WhatsApp account** (`whatsAppApi`): the access token + Business Account ID.

## 2. Configure the workflow nodes

In the n8n canvas, fill in the values the workflow can't know:

| Node | What to set |
|------|-------------|
| WhatsApp Trigger | WhatsApp Trigger credential (may already be auto-assigned) |
| Reply on WhatsApp | WhatsApp credential + **Phone Number ID** |
| notify_realtor | Same credential + Phone Number ID, plus the **realtor's own WhatsApp number** (with country code) as recipient |
| OpenAI Chat Model | OpenAI API key credential |
| save_lead | Google Sheets OAuth credential + select your **Leads spreadsheet** |

## 3. Google Sheet

Create a spreadsheet with a tab named **Leads** and this header row (row 1),
matching exactly:

```
phone | name | intent | property_type | budget | location | timeline | status | notes | last_contact
```

The workflow upserts by `phone`, so each prospect gets exactly one row that
fills in as the conversation progresses.

## 4. Customize the agent

Open **Lead Qualifier Agent → Options → System Message** and personalize:
agency name, service area, office hours, tone. Keep the tool-usage rules
(`save_lead`, `notify_realtor`) intact — they drive the qualification logic.

## 5. Test, then activate

1. With credentials connected, use **Execute workflow** in n8n and send a real
   WhatsApp message to the business number (Meta's test number works too).
2. Check: the bot replies, a row appears/updates in the sheet, and after a full
   conversation the realtor receives the summary alert.
3. Toggle the workflow **Active**. Done — the webhook now answers 24/7.

## Notes & limits

- WhatsApp allows free-form replies only within 24 h of the customer's last
  message; since this bot replies immediately, that's not a constraint in
  practice. Alerts to the realtor's number: message the business number once
  from the realtor's phone to open that 24 h window, or use a template message.
- Non-text messages (voice notes, images) are currently ignored by the
  "Is Text Message?" filter.
- Memory is n8n's in-memory buffer (last 20 exchanges per phone number); it
  resets if the n8n instance restarts. For durable history, swap in a Postgres
  memory node later.
