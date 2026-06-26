-- Phase 4: Seed system-default entity types.
-- importer_id = NULL means system-default (shared across all importers).
-- ON CONFLICT (importer_id, slug) DO NOTHING ensures idempotency.
-- entity_type_fields rows follow each entity type with is_identifier = true
-- for the primary identifying field of each type.

-- ---------------------------------------------------------------------------
-- Insert system entity types
-- ---------------------------------------------------------------------------
INSERT INTO "entity_types" ("slug", "label", "description", "importer_id", "is_active", "config")
VALUES
  (
    'order',
    'Order',
    'A purchase order issued by the importer to a supplier, identifying goods to be shipped.',
    NULL,
    true,
    '{}'
  ),
  (
    'invoice',
    'Invoice',
    'A commercial invoice issued by the supplier detailing goods sold, quantities, unit prices, and total value for customs and payment.',
    NULL,
    true,
    '{}'
  ),
  (
    'bill_of_lading',
    'Bill of Lading',
    'A transport document issued by the carrier acknowledging receipt of cargo and specifying terms of delivery. Serves as title document for the goods.',
    NULL,
    true,
    '{}'
  ),
  (
    'container',
    'Container',
    'A shipping container unit identified by its ISO container number, tracking physical cargo movement through ports and terminals.',
    NULL,
    true,
    '{}'
  ),
  (
    'booking',
    'Booking',
    'A freight booking confirmation from the carrier or forwarder reserving space on a vessel or transport leg for a shipment.',
    NULL,
    true,
    '{}'
  ),
  (
    'shipment',
    'Shipment',
    'A logical grouping of cargo moving from origin to destination under a single freight arrangement, potentially spanning multiple containers and transport legs.',
    NULL,
    true,
    '{}'
  ),
  (
    'supplier',
    'Supplier',
    'A vendor or manufacturer supplying goods to the importer. Identified by name and optionally by tax ID or country of origin.',
    NULL,
    true,
    '{}'
  ),
  (
    'maritime_line',
    'Maritime Line',
    'A shipping line or ocean carrier operating container vessels, identified by SCAC code or carrier name.',
    NULL,
    true,
    '{}'
  )
ON CONFLICT ("importer_id", "slug") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Insert system entity type fields (is_identifier = true for primary keys)
-- ---------------------------------------------------------------------------

-- order fields
INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'order_number',
  'Order Number',
  'The purchase order number as printed on the order document.',
  'string',
  true,
  0,
  '{"is_identifier": true}'
FROM "entity_types" et WHERE et.slug = 'order' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'order_date',
  'Order Date',
  'Date the purchase order was issued.',
  'date',
  false,
  1,
  '{}'
FROM "entity_types" et WHERE et.slug = 'order' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

-- invoice fields
INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'invoice_number',
  'Invoice Number',
  'The invoice number as issued by the supplier.',
  'string',
  true,
  0,
  '{"is_identifier": true}'
FROM "entity_types" et WHERE et.slug = 'invoice' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'invoice_date',
  'Invoice Date',
  'Date the invoice was issued.',
  'date',
  false,
  1,
  '{}'
FROM "entity_types" et WHERE et.slug = 'invoice' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'total_amount',
  'Total Amount',
  'Total invoice value including currency.',
  'string',
  false,
  2,
  '{}'
FROM "entity_types" et WHERE et.slug = 'invoice' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

-- bill_of_lading fields
INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'bl_number',
  'B/L Number',
  'The bill of lading number issued by the carrier.',
  'string',
  true,
  0,
  '{"is_identifier": true}'
FROM "entity_types" et WHERE et.slug = 'bill_of_lading' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'vessel_name',
  'Vessel Name',
  'Name of the vessel carrying the cargo.',
  'string',
  false,
  1,
  '{}'
FROM "entity_types" et WHERE et.slug = 'bill_of_lading' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'port_of_loading',
  'Port of Loading',
  'Port where cargo was loaded onto the vessel.',
  'string',
  false,
  2,
  '{}'
FROM "entity_types" et WHERE et.slug = 'bill_of_lading' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'port_of_discharge',
  'Port of Discharge',
  'Port where cargo will be discharged from the vessel.',
  'string',
  false,
  3,
  '{}'
FROM "entity_types" et WHERE et.slug = 'bill_of_lading' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

-- container fields
INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'container_number',
  'Container Number',
  'ISO container identification number (e.g. MSCU1234567).',
  'string',
  true,
  0,
  '{"is_identifier": true}'
FROM "entity_types" et WHERE et.slug = 'container' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'container_size',
  'Container Size',
  'Container size code (e.g. 20GP, 40HC).',
  'string',
  false,
  1,
  '{}'
FROM "entity_types" et WHERE et.slug = 'container' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

-- booking fields
INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'booking_number',
  'Booking Number',
  'The carrier or forwarder booking confirmation number.',
  'string',
  true,
  0,
  '{"is_identifier": true}'
FROM "entity_types" et WHERE et.slug = 'booking' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'etd',
  'ETD',
  'Estimated time of departure from port of loading.',
  'date',
  false,
  1,
  '{}'
FROM "entity_types" et WHERE et.slug = 'booking' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'eta',
  'ETA',
  'Estimated time of arrival at port of discharge.',
  'date',
  false,
  2,
  '{}'
FROM "entity_types" et WHERE et.slug = 'booking' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

-- shipment fields
INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'shipment_reference',
  'Shipment Reference',
  'Internal or forwarder reference number for the shipment.',
  'string',
  true,
  0,
  '{"is_identifier": true}'
FROM "entity_types" et WHERE et.slug = 'shipment' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'origin_country',
  'Country of Origin',
  'Country where goods were manufactured or produced.',
  'string',
  false,
  1,
  '{}'
FROM "entity_types" et WHERE et.slug = 'shipment' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

-- supplier fields
INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'supplier_name',
  'Supplier Name',
  'Legal or trade name of the supplier.',
  'string',
  true,
  0,
  '{"is_identifier": true}'
FROM "entity_types" et WHERE et.slug = 'supplier' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'supplier_country',
  'Country',
  'Country where the supplier is registered or operates.',
  'string',
  false,
  1,
  '{}'
FROM "entity_types" et WHERE et.slug = 'supplier' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

-- maritime_line fields
INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'scac_code',
  'SCAC Code',
  'Standard Carrier Alpha Code identifying the maritime line (e.g. MSCU, MAEU).',
  'string',
  true,
  0,
  '{"is_identifier": true}'
FROM "entity_types" et WHERE et.slug = 'maritime_line' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "entity_type_fields"
  ("entity_type_id", "importer_id", "slug", "label", "description", "field_type", "is_required", "sort_order", "config")
SELECT
  et.id,
  NULL,
  'carrier_name',
  'Carrier Name',
  'Full legal or commercial name of the maritime carrier.',
  'string',
  false,
  1,
  '{}'
FROM "entity_types" et WHERE et.slug = 'maritime_line' AND et.importer_id IS NULL
ON CONFLICT DO NOTHING;
