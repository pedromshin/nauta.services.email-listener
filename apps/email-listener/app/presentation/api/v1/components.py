"""Components API — autofill, confirm, and region-edit endpoints.

POST /v1/components/{component_id}/autofill triggers cold-start (+ few-shot)
field extraction for a registered region Component and returns the candidate
field values.

POST /v1/components/{component_id}/confirm confirms a region as correct, stores
optional corrected fields, embeds the region, and indexes it for few-shot
retrieval (D-15 learning flywheel).

Region-edit write side (Phase 06, supersede-not-mutate D-16):
  POST /{id}/accept   — pending → candidate (status-only)
  POST /{id}/reject   — → rejected (status-only)
  POST /{id}/redraw   — new candidate + original superseded
  POST /{id}/split    — ≥2 new candidates + original superseded
  POST /merge         — one new candidate from ≥2 originals (all superseded)
  POST /{id}/nest     — set/clear parent_component_id (no supersede)
  POST /{page_id}/regions — create candidate region (Add-region, zero-proposal OK)

Geometry validation at this boundary (T-06-01/T-06-02): polygon is exactly 4
[x,y] pairs with every coord in [0,1]; page_index >= 0. Violations → 422.

Auth: X-API-Key (require_api_key) — all routes protected (T-06-05).
Tenancy (D-18): importer_id is derived from the component row itself inside the
use cases (ingest assigns it from the sender domain, D-05) — never from callers.
Errors (T-06-04): ValueError → 404 with a generic detail; full context is
logged server-side inside the use cases via structlog.
"""

from typing import Literal
from uuid import UUID

import structlog
from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.application.use_cases.autofill import AutofillUseCase
from app.application.use_cases.autofill_fields import AutofilledField, AutofillFieldsUseCase
from app.application.use_cases.classify_document import ClassifyDocumentUseCase
from app.application.use_cases.confirm_region import ConfirmRegionUseCase
from app.application.use_cases.deny_field import DenyFieldUseCase
from app.application.use_cases.edit_region import (
    AcceptRegionUseCase,
    CreateRegionUseCase,
    MergeRegionsUseCase,
    NestRegionUseCase,
    RedrawRegionUseCase,
    RejectRegionUseCase,
    SplitRegionUseCase,
)
from app.application.use_cases.promote_entity_on_confirm import PromoteEntityOnConfirmUseCase
from app.application.use_cases.set_component_relationship import (
    SetComponentEntityTypeUseCase,
    SetComponentFieldRelationshipUseCase,
    SetComponentRoleUseCase,
)
from app.presentation.api.response import ApiResponse
from app.presentation.middleware.auth import require_api_key

router = APIRouter(
    prefix="/v1/components",
    tags=["components"],
    dependencies=[Depends(require_api_key)],
)

_NOT_FOUND_DETAIL = "Component not found"


class AutofillRequest(BaseModel):
    entity_type_slug: str


class AutofillResultView(BaseModel):
    extracted_fields: dict[str, object]
    confidence_score: float
    confidence_breakdown: dict[str, object] | None


class AutofilledFieldView(BaseModel):
    """One autofilled field child (D-13/D-15): box -> property -> candidate value."""

    field_component_id: str
    entity_type_field_id: str | None
    candidate_value: object | None
    confidence: float


class AutofillFieldsResultView(BaseModel):
    """The list of autofilled field children produced for an entity."""

    fields: list[AutofilledFieldView]


class ConfirmRequest(BaseModel):
    corrected_fields: dict[str, object] | None = None


class ConfirmAck(BaseModel):
    component_id: str
    status: str = "confirmed"


def _validate_polygon(polygon: list[list[float]]) -> list[list[float]]:
    """T-06-01: exactly 4 [x,y] pairs, every coordinate a float in [0,1]."""
    if len(polygon) != 4:
        raise ValueError("polygon must have exactly 4 [x,y] pairs")
    for point in polygon:
        if len(point) != 2:
            raise ValueError("each polygon point must be an [x,y] pair")
        if any(coord < 0.0 or coord > 1.0 for coord in point):
            raise ValueError("polygon coordinates must be within [0,1]")
    return polygon


class RedrawRequest(BaseModel):
    polygon: list[list[float]]
    page_index: int = Field(ge=0)

    @field_validator("polygon")
    @classmethod
    def _check_polygon(cls, value: list[list[float]]) -> list[list[float]]:
        return _validate_polygon(value)


class SplitRequest(BaseModel):
    regions: list[RedrawRequest] = Field(min_length=2)


class MergeRequest(BaseModel):
    component_ids: list[str] = Field(min_length=2)
    polygon: list[list[float]] | None = None
    page_index: int | None = Field(default=None, ge=0)

    @field_validator("polygon")
    @classmethod
    def _check_polygon(cls, value: list[list[float]] | None) -> list[list[float]] | None:
        return None if value is None else _validate_polygon(value)


class NestRequest(BaseModel):
    parent_component_id: str | None = None


class CreateRegionRequest(BaseModel):
    polygon: list[list[float]]
    page_index: int = Field(ge=0)

    @field_validator("polygon")
    @classmethod
    def _check_polygon(cls, value: list[list[float]]) -> list[list[float]]:
        return _validate_polygon(value)


class RoleRequest(BaseModel):
    """Set/clear a component's role (D-10). None clears to unclassified (D-01)."""

    role: Literal["entity", "field", "unrelated"] | None = None


class EntityTypeRequest(BaseModel):
    """Set/clear a component's entity_type_id (D-03). None clears."""

    entity_type_id: str | None = None


class FieldRelationshipRequest(BaseModel):
    """Set/clear a field's parent + property mapping (D-04/D-11). Both None clears.

    Both ids are validated as UUIDs at this boundary (Pydantic) so a malformed
    value → 422 here instead of reaching the `email_components` uuid FK columns in
    Postgres (entity_type_field_id → D-04, parent_component_id → the self-FK). The
    use case still operates on plain `str` ids, so the route coerces with `str()`.
    """

    parent_component_id: UUID | None = None
    entity_type_field_id: UUID | None = None


class RegionView(BaseModel):
    component_id: str
    extraction_status: str


class SplitView(BaseModel):
    component_ids: list[str]


@router.post("/{component_id}/autofill")
@inject
async def autofill_component(
    component_id: UUID,
    body: AutofillRequest,
    use_case: FromDishka[AutofillUseCase],
) -> ApiResponse[AutofillResultView]:
    """Run autofill (cold-start + few-shot) for the given component.

    Returns candidate field values extracted by the LLM using the entity
    type's preset description + field schema.  When confirmed similar examples
    are available they are injected as few-shot context (D-15); otherwise the
    cold-start path is used (D-13).
    Region content is isolated to the user turn inside delimiters (D-14).
    """
    try:
        result = await use_case.execute(
            component_id=str(component_id),
            entity_type_slug=body.entity_type_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(
        AutofillResultView(
            extracted_fields=result.extracted_fields,
            confidence_score=result.confidence_score,
            confidence_breakdown=result.confidence_breakdown,
        )
    )


@router.post("/{component_id}/confirm")
@inject
async def confirm_component(
    component_id: UUID,
    body: ConfirmRequest,
    use_case: FromDishka[ConfirmRegionUseCase],
    promote: FromDishka[PromoteEntityOnConfirmUseCase],
) -> ApiResponse[ConfirmAck]:
    """Confirm a region component and index it for few-shot retrieval (D-15).

    Marks the ExtractionRecord status='confirmed', stores optional corrected
    field values (D-16: never overwrites prior confirmed values), embeds the
    region text + confirmed fields via Bedrock Titan, and persists the
    embedding so the region becomes a retrievable few-shot child (D-15).

    For entity-role components, also promotes to entity_instances and records
    BlendedRAG resolution candidates as provenance (D-02/D-09). This step is
    best-effort (D-12): a Bedrock or resolution failure does NOT fail the confirm.
    """
    try:
        await use_case.execute(
            component_id=str(component_id),
            corrected_fields=body.corrected_fields,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    # D-02/D-09: promote entity instance and record candidates (best-effort, D-12).
    # Errors here must NOT propagate — confirm has already succeeded.
    try:
        await promote.execute(component_id=str(component_id))
    except Exception:
        structlog.get_logger(__name__).warning(
            "confirm_component_promote_failed",
            component_id=str(component_id),
            exc_info=True,
        )

    return ApiResponse.ok(ConfirmAck(component_id=str(component_id)))


@router.post("/merge")
@inject
async def merge_regions(
    body: MergeRequest,
    use_case: FromDishka[MergeRegionsUseCase],
) -> ApiResponse[RegionView]:
    """Merge ≥2 regions into one new candidate; supersede all originals (D-16).

    Default polygon is the union of the originals' polygons. Rejects merges
    across different emails/attachments (T-06-03 IDOR guard) → 404.
    """
    try:
        merged = await use_case.execute(
            component_ids=body.component_ids,
            polygon=body.polygon,
            page_index=body.page_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=merged.id, extraction_status=merged.extraction_status))


@router.post("/{component_id}/classify-document")
@inject
async def classify_document(
    component_id: UUID,
    use_case: FromDishka[ClassifyDocumentUseCase],
) -> ApiResponse[RegionView]:
    """Classify a whole multi-page attachment as one entity.

    component_id is any attachment_page component of the attachment; the use
    case gathers every page and creates one candidate region whose content_text
    spans all pages (so autofill extracts fields across the whole document).
    """
    try:
        region = await use_case.execute(page_component_id=str(component_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=region.id, extraction_status=region.extraction_status))


@router.post("/{component_id}/accept")
@inject
async def accept_region(
    component_id: UUID,
    use_case: FromDishka[AcceptRegionUseCase],
) -> ApiResponse[RegionView]:
    """Accept a proposed region: pending → candidate (status-only, no supersede)."""
    try:
        component = await use_case.execute(component_id=str(component_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))


@router.post("/{component_id}/reject")
@inject
async def reject_region(
    component_id: UUID,
    use_case: FromDishka[RejectRegionUseCase],
) -> ApiResponse[RegionView]:
    """Reject a region: → rejected (status-only, no supersede)."""
    try:
        component = await use_case.execute(component_id=str(component_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))


@router.post("/{component_id}/redraw")
@inject
async def redraw_region(
    component_id: UUID,
    body: RedrawRequest,
    use_case: FromDishka[RedrawRegionUseCase],
) -> ApiResponse[RegionView]:
    """Redraw a region: create a NEW candidate; the original is superseded (D-16)."""
    try:
        new_component = await use_case.execute(
            component_id=str(component_id),
            polygon=body.polygon,
            page_index=body.page_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(
        RegionView(
            component_id=new_component.id,
            extraction_status=new_component.extraction_status,
        )
    )


@router.post("/{component_id}/split")
@inject
async def split_region(
    component_id: UUID,
    body: SplitRequest,
    use_case: FromDishka[SplitRegionUseCase],
) -> ApiResponse[SplitView]:
    """Split a region into ≥2 new candidates; the original is superseded (D-16)."""
    try:
        new_components = await use_case.execute(
            component_id=str(component_id),
            regions=[{"polygon": region.polygon, "page_index": region.page_index} for region in body.regions],
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(SplitView(component_ids=[c.id for c in new_components]))


@router.post("/{component_id}/nest")
@inject
async def nest_region(
    component_id: UUID,
    body: NestRequest,
    use_case: FromDishka[NestRegionUseCase],
) -> ApiResponse[RegionView]:
    """Set or clear a region's parent_component_id (no supersede)."""
    try:
        component = await use_case.execute(
            component_id=str(component_id),
            parent_component_id=body.parent_component_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))


@router.post("/{page_component_id}/regions")
@inject
async def create_region(
    page_component_id: UUID,
    body: CreateRegionRequest,
    use_case: FromDishka[CreateRegionUseCase],
) -> ApiResponse[RegionView]:
    """Create a new candidate region under a page component (Add-region).

    Works with ZERO prior proposed regions (D-09). Tenant is derived from the
    loaded page row (D-18) — never from the caller.
    """
    try:
        component = await use_case.execute(
            page_component_id=str(page_component_id),
            polygon=body.polygon,
            page_index=body.page_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))


@router.patch("/{component_id}/role")
@inject
async def set_component_role(
    component_id: UUID,
    body: RoleRequest,
    use_case: FromDishka[SetComponentRoleUseCase],
) -> ApiResponse[RegionView]:
    """Set or clear a component's role (D-10): entity | field | unrelated | null.

    Tenant is derived from the loaded component row (D-18) — never from callers.
    """
    try:
        component = await use_case.execute(component_id=str(component_id), role=body.role)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))


@router.patch("/{component_id}/entity-type")
@inject
async def set_component_entity_type(
    component_id: UUID,
    body: EntityTypeRequest,
    use_case: FromDishka[SetComponentEntityTypeUseCase],
) -> ApiResponse[RegionView]:
    """Set or clear a component's entity_type_id (D-03/D-11).

    Tenant is derived from the loaded component row (D-18) — never from callers.
    """
    try:
        component = await use_case.execute(
            component_id=str(component_id),
            entity_type_id=body.entity_type_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))


@router.patch("/{component_id}/field-relationship")
@inject
async def set_component_field_relationship(
    component_id: UUID,
    body: FieldRelationshipRequest,
    use_case: FromDishka[SetComponentFieldRelationshipUseCase],
) -> ApiResponse[RegionView]:
    """Set or clear a field's parent + property mapping together (D-04/D-11).

    Tenant is derived from the loaded component row (D-18) — never from callers.
    """
    try:
        component = await use_case.execute(
            component_id=str(component_id),
            parent_component_id=(str(body.parent_component_id) if body.parent_component_id is not None else None),
            entity_type_field_id=(str(body.entity_type_field_id) if body.entity_type_field_id is not None else None),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))


@router.post("/{component_id}/deny")
@inject
async def deny_field(
    component_id: UUID,
    use_case: FromDishka[DenyFieldUseCase],
) -> ApiResponse[RegionView]:
    """Deny a field box — origin-aware (D-18) + record the D-19 denial memo.

    Auto-detected box → soft-reject (status=rejected) + remember on the parent;
    user-drawn box → keep geometry, clear the wrong candidate value/property.
    Tenant is derived from the loaded component row (D-18) — never from callers.
    """
    try:
        component = await use_case.execute(component_id=str(component_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))


def _to_field_view(field: AutofilledField) -> AutofilledFieldView:
    """Map a domain AutofilledField to its API view (no behaviour, pure mapping)."""
    return AutofilledFieldView(
        field_component_id=field.field_component_id,
        entity_type_field_id=field.entity_type_field_id,
        candidate_value=field.candidate_value,
        confidence=field.confidence,
    )


@router.post("/{component_id}/autofill-fields")
@inject
async def autofill_fields(
    component_id: UUID,
    use_case: FromDishka[AutofillFieldsUseCase],
) -> ApiResponse[AutofillFieldsResultView]:
    """Auto-detect + autofill the entity's sub-fields as CANDIDATEs (D-13/14/15/19).

    Given an ENTITY component, detects FIELD boxes inside its bbox (token-grounded,
    excluding boxes overlapping the parent's remembered denied polygons, D-19),
    incorporates any user-drawn field children, and autofills each as a candidate
    value + property mapping + confidence (nothing auto-confirms, D-14).
    Tenant is derived from the loaded entity row (D-18) — never from callers.
    """
    try:
        result = await use_case.execute(entity_component_id=str(component_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc

    return ApiResponse.ok(AutofillFieldsResultView(fields=[_to_field_view(f) for f in result]))
