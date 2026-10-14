# EARS examples — vague → testable rewrites

The examples use a neutral sample application: an invoicing product with
**the web app** (browser client), **the API** (HTTP backend) and **the worker**
(background jobs). Domain words (invoice, line item, status
`draft | sent | paid | void`, reminder) are the ones its code would use. In your
project, take the subjects and terms from the spec's glossary instead.

## Event-driven (WHEN)

- ✗ "Clicking a status should filter the invoices."
- ✓ **AC-1** WHEN the user activates an inactive status filter on the invoice
  list, the web app shall show only the invoices with that status.
- ✓ **AC-2** WHEN the user activates the active status filter, the web app shall
  show all invoices.
  *(split: two behaviours → two IDs)*

## State-driven (WHILE)

- ✗ "Show progress during the export."
- ✓ WHILE an invoice export is in progress, the web app shall show the number of
  exported invoices and the elapsed time on the export page.
- ✓ WHILE the API is unreachable, the web app shall show an offline banner with
  a Retry action and keep the last loaded invoices visible.

## Unwanted behaviour (IF … THEN)

- ✗ "Must not crash if the payment provider is down."
- ✓ IF the payment provider does not answer within 10 s, THEN the API shall mark
  the payment attempt `failed` and return HTTP 503 with error code
  `PAYMENT_PROVIDER_UNAVAILABLE`.
- ✗ "Handle big imports properly."
- ✓ IF an uploaded CSV file exceeds 10 MB, THEN the API shall reject it with
  HTTP 413 before reading its rows.
- ✓ IF a line item references a product that no longer exists, THEN the worker
  shall skip that line item and record its id in the import report.

## Optional feature (WHERE)

- ✗ "Support reminders."
- ✓ WHERE automatic reminders are enabled for an organisation, the worker shall
  send a reminder email for each `sent` invoice 7 days after its due date.

## Ubiquitous

- ✗ "Totals should make sense."
- ✓ The API shall compute an invoice total as the sum of its line-item amounts
  rounded to the currency's minor unit.
- ✓ The web app shall render every count on the status bar from the
  already-loaded invoices, without an additional API request.

## Complex (WHERE → WHILE → WHEN/IF)

- ✓ WHERE multi-currency is enabled, WHILE an invoice is `draft`, WHEN the user
  changes its currency, the web app shall re-display every line-item amount in
  the new currency.

## NFR

- ✗ "The invoice list must be fast."
- ✓ **NFR-1** WHEN the user opens the invoice list of an organisation with
  ≤ 2,000 invoices on the seeded dataset, the web app shall render the first
  page within 1.5 s.
- ✗ "Exports should be cheap."
- ✓ **NFR-2** The worker shall make at most one database query per 500 exported
  invoices.

## Untrusted input

- ✗ "Be careful with customer notes."
- ✓ IF an invoice note contains HTML or Markdown links, THEN the web app shall
  render it as plain text.
- ✓ IF a requested attachment path resolves outside the organisation's storage
  folder, THEN the API shall reject the request with HTTP 400 and log the
  redacted path.
- ✓ IF text sent to a language model for invoice categorisation contains
  instructions addressed to the model, THEN the worker shall treat them as data
  and shall not change the category rules because of them.

## Common pattern mistakes

| Wrong | Why | Right |
|---|---|---|
| WHEN the export is in progress, … | a state, not an event | WHILE the export is in progress, … |
| WHEN the payment provider returns 500, … | a failure | IF the payment provider returns 500, THEN … |
| The system shall validate input and show errors. | two responses, no trigger | WHEN … submits …, the API shall validate …; IF validation fails, THEN the web app shall show … |
| The invoices shall be filtered. | passive, no subject, no trigger | WHEN …, the web app shall show only … |
| The web app shall use a query cache for invoices. | implementation | WHEN the user returns to an invoice within the session, the web app shall show the previously loaded invoice without a loading state. |
