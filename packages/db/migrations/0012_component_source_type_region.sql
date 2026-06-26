-- Phase 4 live gap: add "region" to the component_source_type enum.
--
-- ProposeRegionsUseCase creates child components with source_type="region"
-- (apps/email-listener/.../use_cases/propose_regions.py), but the enum only had
-- email_body/attachment_page/attachment_sheet/attachment_section/attachment_whole.
-- Every region child persist failed with 22P02 ("invalid input value for enum
-- component_source_type: region"). This never surfaced until segmentation actually
-- completed AND reached the batched region save against a real DB (local runs were
-- interrupted; earlier runs were Bedrock-blocked), so neither fake-repo tests nor
-- partial live runs caught it.
--
-- ADD VALUE IF NOT EXISTS is idempotent and additive (backward-compatible).

ALTER TYPE "public"."component_source_type" ADD VALUE IF NOT EXISTS 'region';
