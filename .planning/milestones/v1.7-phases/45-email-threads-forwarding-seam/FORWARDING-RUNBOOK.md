# Forwarding Setup Runbook — Personal Email Forwarding (THRD-04)

**Audience:** the human operator. Everything under Section 1 is a manual, user-gated action —
autonomous execution never runs `terraform apply` against live SES. Sections 2-5 are things
you do yourself in your browser/email client once Section 1 is live; nothing there requires
CLI access either. This mirrors the user-gated-runbook precedent set by
`EXTERNAL-RENAME-RUNBOOK.md` (Phase 42) and `GOOGLE-OAUTH-RUNBOOK.md` (Phase 43): documented,
not executed.

**Scope:** get your own personal `u-{token}@{FORWARDING_EMAIL_DOMAIN}` forwarding address live,
point your email provider (Gmail, in this runbook) at it, and complete Gmail's
destination-verification handshake so the forward actually activates. Full onboarding UX
(in-app setup wizard, multiple forwarding addresses, etc.) is explicitly deferred — see
`45-CONTEXT.md`'s Deferred Ideas.

---

## 1. SES routing — add a domain-level catch-all receipt rule

**Status: NOT applied. This is the terraform change gating everything below.**

Today (`infrastructure/aws/ses.tf`), SES receipt rules are per-**exact**-recipient:

| Rule | Recipient | Routes to |
|---|---|---|
| `agent-local` | `agent-local@magnitudetech.com.br` | local SNS topic |
| `agent-staging` | `agent-staging@magnitudetech.com.br` | staging SNS topic |
| `agent-prod` | `agent@magnitudetech.com.br` | prod SNS topic |

None of these match an arbitrary `u-{token}@magnitudetech.com.br` address — the personal
forwarding seam needs a **domain-level catch-all** rule (recipient = the bare domain, not an
exact local-part), evaluated in the same rule set, so any `u-{token}@` mail is delivered to the
pipeline's S3/SNS path exactly like the three exact-match rules above.

**What to add (draft — review before applying):**

```hcl
# Domain catch-all — routes u-{token}@magnitudetech.com.br (any token) to the
# environment's inbound pipeline. Position AFTER the three exact-match rules
# (agent-local / agent-staging / agent-prod) so a literal agent@ address still
# matches its own dedicated rule first if you ever want them to diverge.
resource "aws_ses_receipt_rule" "forwarding_catchall" {
  name          = "forwarding-catchall"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = ["magnitudetech.com.br"]   # bare domain = catch-all
  enabled       = true
  scan_enabled  = false
  after         = aws_ses_receipt_rule.prod.name

  s3_action {
    bucket_name       = aws_s3_bucket.ses_inbound.bucket
    object_key_prefix = "inbound/prod/"   # or a dedicated "inbound/forwarding/" prefix
    topic_arn         = aws_sns_topic.ses_inbound["prod"].arn
    position          = 1
  }

  depends_on = [aws_s3_bucket_policy.ses_inbound]
}
```

Which environment's SNS topic/prefix the catch-all should point at is a judgment call — for a
single-operator personal-use seam, routing it at the **prod** pipeline (like `agent-prod`) is
the simplest correct default, since the forwarding user's account lives in the prod database.
Adjust `topic_arn`/`object_key_prefix` if you want staging/local forwarding testing instead.

**Steps:**

1. Add the rule to `infrastructure/aws/ses.tf` (draft above, adjusted for your target
   environment).
2. Run the read-only proof step:
   ```bash
   npm run infra:tf -- plan
   ```
   Confirm the plan shows exactly one new `aws_ses_receipt_rule.forwarding_catchall` resource
   being created — no unexpected diffs on the three existing rules (position/`after` chaining
   can otherwise cause SES to reorder them; review carefully).
3. **`terraform apply` is a separate, later, deliberate action** — run it only after reviewing
   the plan output personally, same discipline as `EXTERNAL-RENAME-RUNBOOK.md` Section 2.
4. **`FORWARDING_EMAIL_DOMAIN` must equal the SES domain** (`magnitudetech.com.br` today, per
   `aws_ses_domain_identity.main` in `infrastructure/aws/ses.tf`). If SES is ever verified
   under a different/new domain (see the domain-purchase section of the rename runbook), this
   env var must be updated in lockstep — a mismatch here silently produces addresses that SES
   will never route (mail bounces or vanishes, no error surfaces in the app).

---

## 2. Get your address

Once Section 1's catch-all rule is live:

1. Sign in to the app (Google OAuth — see `GOOGLE-OAUTH-RUNBOOK.md` if you haven't already).
2. Open **`/settings/forwarding`**.
3. Your personal address — `u-{token}@{FORWARDING_EMAIL_DOMAIN}` — is generated the first time
   you visit (get-or-create, idempotent: it's the same address every time after that). Click the
   copy button next to the address field.

---

## 3. Gmail forwarding setup

1. In Gmail, go to **Settings (gear icon) → See all settings → Forwarding and POP/IMAP**.
2. Click **Add a forwarding address**.
3. Paste your `u-{token}@{FORWARDING_EMAIL_DOMAIN}` address from Section 2.
4. Click **Next → Proceed → OK**.

Gmail will now attempt to send a confirmation email **to that address** — this is the
destination-verification handshake, and it's the step this runbook exists to unblock (Section 4).

---

## 4. Retrieve the verification code (the handshake)

Gmail's confirmation email is sent from a `forwarding-noreply@google.com`-style sender to your
`u-{token}@` address. Because that address is routed through the SES catch-all (Section 1) into
this app's own ingestion pipeline (Plan 45-05's `ForwardingAddressResolver`), the email is
**ingested under your account, not dropped or quarantined** — Plan 45-05's own test suite
specifically asserts the Gmail-verification email is saved (`email_repo.save` is called), not
silently discarded, for exactly this sender/recipient combination.

1. Wait ~1-2 minutes for the forward + SES pipeline to process (SNS → ingest → your inbox).
2. Open the app's inbox at `/` and look for a new email from a `google.com` sender (subject
   typically contains "Gmail Confirmation - Forward Emails").
3. Open it — the numeric confirmation code is in the body.
4. **Fallback**, if it doesn't appear in the inbox UI within a few minutes: check the raw email
   store (S3 bucket `${var.project}-ses-inbound-emails`, under the environment prefix from
   Section 1's `object_key_prefix`) or the ingestion logs for the message, in case the inbox
   list query is filtered in a way that hides it (e.g. a default importer/entity-type filter).
5. Return to the still-open Gmail "Add forwarding address" dialog (or Gmail will have emailed you
   a reminder) and paste the code in.

---

## 5. Verify end-to-end

1. Send a normal test email to your own regular Gmail address (from any other account).
2. Wait for it to land in Gmail, then forward it (or configure a Gmail filter that auto-forwards)
   to your `u-{token}@{FORWARDING_EMAIL_DOMAIN}` address.
3. Confirm it appears in this app's inbox (`/`) within a couple of minutes, correctly attributed
   to your account/importer.

**This full round-trip (Sections 3-5) is a MANUAL UAT item** — it requires a live Gmail account,
the SES catch-all actually applied (Section 1), and cannot be exercised by autonomous execution.
Track it as a `human_needed` verification item for this phase, same class as the other
live-OAuth/live-SES UAT items already deferred to `43-HUMAN-UAT.md`-style tracking.

---

## Troubleshooting

- **Confirmation code never arrives:** confirm the Section 1 catch-all rule is actually applied
  (`terraform apply` completed, not just planned) and that `FORWARDING_EMAIL_DOMAIN` in the web
  app's env exactly matches the SES-verified domain (`magnitudetech.com.br`). A mismatch here is
  the single most likely cause — the address the app shows you would be syntactically valid but
  unroutable.
- **Gmail says "This address already receives mail there" / duplicate:** each user gets exactly
  one forwarding address (`UNIQUE(user_id)` on `forwarding_addresses`, Plan 45-01) — revisiting
  `/settings/forwarding` always returns the SAME address, so re-adding it in Gmail is a no-op,
  not a new token.
- **Mail forwards but never appears in the inbox:** check that the sender-domain importer was
  created (Plan 45-05 anchors a new importer to your `user_id` on first mail from an unseen
  sender domain) and that you're looking at the account you signed in with — forwarded mail is
  scoped to whichever user's token routed it, not a shared/global inbox.
- **SES catch-all rule conflicts with the exact-match `agent@` rule:** SES evaluates receipt
  rules in the `rule_set`'s defined order (`after = ...` chaining) and stops at the first match
  — a bare-domain catch-all placed AFTER the three exact-match rules (per the draft in Section 1)
  will never shadow them; if you see the exact-match rules stop working, check the `after` chain
  wasn't accidentally reordered by the `terraform apply`.
