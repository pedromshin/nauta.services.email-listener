# Phase 45: User Setup Required

**Generated:** 2026-07-10
**Phase:** 45-email-threads-forwarding-seam
**Status:** Incomplete

Complete this item for the personal forwarding seam (THRD-04) to route real mail. Claude
automated everything possible (the tRPC router, the web surface, and drafted the SES terraform
rule as a reviewable diff in `FORWARDING-RUNBOOK.md`); this item requires human access to the
live AWS/SES console and a deliberate `terraform apply`.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `FORWARDING_EMAIL_DOMAIN` | The SES inbound domain — `aws_ses_domain_identity.main` in `infrastructure/aws/ses.tf`, currently `magnitudetech.com.br` | `apps/web/.env.local` (and `.env.staging`/`.env.production` for those environments) |

## Dashboard Configuration

- [ ] **Add the SES domain-level catch-all receipt rule**
  - Location: `infrastructure/aws/ses.tf` (draft provided in `FORWARDING-RUNBOOK.md` Section 1)
  - Action: review the draft `aws_ses_receipt_rule.forwarding_catchall` resource, run
    `npm run infra:tf -- plan` (read-only) to confirm the diff is exactly the one new rule, then
    run `terraform apply` yourself after reviewing the plan output — same discipline as
    `EXTERNAL-RENAME-RUNBOOK.md`'s AWS/Terraform section.
  - Without this rule, `u-{token}@` addresses are syntactically valid but SES never routes them
    anywhere — forwarded mail bounces or is silently dropped by SES itself.

## Verification

After completing setup:

```bash
# Confirm the env var is set (server-side only — do not prefix NEXT_PUBLIC_)
grep FORWARDING_EMAIL_DOMAIN apps/web/.env.local

# Confirm the new SES rule is live
terraform -chdir=infrastructure/aws state show aws_ses_receipt_rule.forwarding_catchall
```

Then follow `FORWARDING-RUNBOOK.md` Sections 2-5 end to end: get your address at
`/settings/forwarding`, add it as a Gmail forwarding address, retrieve the confirmation code from
this app's own inbox, and confirm a real forwarded test email arrives. This full round-trip is a
manual UAT item — see the runbook's own note on that.

---

**Once all items complete:** Mark status as "Complete" at top of file.
