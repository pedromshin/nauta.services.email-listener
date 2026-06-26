"""Entity-types management API — entity-type + field CRUD (D-26/D-27).

POST   /v1/entity-types                          create a system-default entity type
PATCH  /v1/entity-types/{entity_type_id}         update / rename / deactivate a type
POST   /v1/entity-types/{entity_type_id}/fields  create a field on a type
PATCH  /v1/entity-types/fields/{field_id}        update a field
DELETE /v1/entity-types/fields/{field_id}        delete a field (D-27 guarded)
POST   /v1/entity-types/{entity_type_id}/fields/reorder   reorder fields

Validation (D-27): field_type is constrained to {string,number,date,array,object}
at this Pydantic boundary (T-09-21); the use case re-validates (defense in depth).

Auth: X-API-Key (require_api_key) — all routes protected at the router level
(T-09-20). Errors: a slug-conflict ValueError (carrying the repo's 'slug exists'
marker) → 409; any other ValueError → 404. Full context is logged server-side
inside the use cases via structlog (T-09-24).
"""

from typing import NoReturn
from uuid import UUID

from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.application.use_cases.manage_entity_types import (
    ALLOWED_FIELD_TYPES,
    CreateEntityTypeUseCase,
    CreateFieldUseCase,
    DeleteFieldResult,
    DeleteFieldUseCase,
    ReorderFieldsUseCase,
    UpdateEntityTypeUseCase,
    UpdateFieldUseCase,
)
from app.domain.entities.entity_type import EntityType, EntityTypeField
from app.presentation.api.response import ApiResponse
from app.presentation.middleware.auth import require_api_key

router = APIRouter(
    prefix="/v1/entity-types",
    tags=["entity-types"],
    dependencies=[Depends(require_api_key)],
)

_NOT_FOUND_DETAIL = "Entity type not found"
_CONFLICT_DETAIL = "Slug already exists"
_SLUG_EXISTS_MARKER = "slug exists"


def _validate_field_type(value: str) -> str:
    """T-09-21: field_type must be one of the allowed JSON-Schema types (D-27)."""
    if value not in ALLOWED_FIELD_TYPES:
        raise ValueError(f"field_type must be one of {', '.join(ALLOWED_FIELD_TYPES)}")
    return value


def _raise_for_value_error(exc: ValueError) -> NoReturn:
    """Map a use-case ValueError to 409 (slug conflict) or 404 (not found)."""
    if _SLUG_EXISTS_MARKER in str(exc):
        raise HTTPException(status_code=409, detail=_CONFLICT_DETAIL) from exc
    raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc


# ── Request models ───────────────────────────────────────────────────────────


class CreateEntityTypeRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=200)
    description: str | None = None


class UpdateEntityTypeRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_active: bool | None = None


class CreateFieldRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=200)
    field_type: str
    is_required: bool = False
    sort_order: int = Field(default=0, ge=0)
    is_identifier: bool = False
    description: str | None = None

    @field_validator("field_type")
    @classmethod
    def _check_field_type(cls, value: str) -> str:
        return _validate_field_type(value)


class UpdateFieldRequest(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    label: str | None = Field(default=None, min_length=1, max_length=200)
    field_type: str | None = None
    is_required: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)
    is_identifier: bool | None = None
    description: str | None = None

    @field_validator("field_type")
    @classmethod
    def _check_field_type(cls, value: str | None) -> str | None:
        return None if value is None else _validate_field_type(value)


class ReorderFieldsRequest(BaseModel):
    ordered_field_ids: list[str] = Field(min_length=1)


# ── Response views ───────────────────────────────────────────────────────────


class FieldView(BaseModel):
    id: str
    slug: str
    label: str
    field_type: str
    is_required: bool
    is_identifier: bool
    sort_order: int
    description: str | None


class EntityTypeView(BaseModel):
    id: str
    slug: str
    label: str
    description: str | None
    is_active: bool
    fields: list[FieldView]


class DeleteFieldView(BaseModel):
    field_id: str
    hard_deleted: bool
    soft_deactivated: bool


def _to_field_view(field: EntityTypeField) -> FieldView:
    return FieldView(
        id=field.id,
        slug=field.slug,
        label=field.label,
        field_type=field.data_type,
        is_required=field.is_required,
        is_identifier=field.is_identifier,
        sort_order=field.sort_order,
        description=field.description,
    )


def _to_entity_type_view(entity_type: EntityType) -> EntityTypeView:
    return EntityTypeView(
        id=entity_type.id,
        slug=entity_type.slug,
        label=entity_type.label,
        description=entity_type.description,
        is_active=entity_type.is_active,
        fields=[_to_field_view(f) for f in entity_type.fields],
    )


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("")
@inject
async def create_entity_type(
    body: CreateEntityTypeRequest,
    use_case: FromDishka[CreateEntityTypeUseCase],
) -> ApiResponse[EntityTypeView]:
    """Create a system-default entity type (D-26). Duplicate slug → 409."""
    try:
        entity_type = await use_case.execute(slug=body.slug, label=body.label, description=body.description)
    except ValueError as exc:
        _raise_for_value_error(exc)
    return ApiResponse.ok(_to_entity_type_view(entity_type))


@router.patch("/{entity_type_id}")
@inject
async def update_entity_type(
    entity_type_id: UUID,
    body: UpdateEntityTypeRequest,
    use_case: FromDishka[UpdateEntityTypeUseCase],
) -> ApiResponse[EntityTypeView]:
    """Update / rename / deactivate an entity type (D-26)."""
    try:
        entity_type = await use_case.execute(
            entity_type_id=str(entity_type_id),
            label=body.label,
            description=body.description,
            is_active=body.is_active,
        )
    except ValueError as exc:
        _raise_for_value_error(exc)
    return ApiResponse.ok(_to_entity_type_view(entity_type))


@router.post("/{entity_type_id}/fields")
@inject
async def create_field(
    entity_type_id: UUID,
    body: CreateFieldRequest,
    use_case: FromDishka[CreateFieldUseCase],
) -> ApiResponse[FieldView]:
    """Create a field on an entity type (D-25/D-27). Duplicate slug → 409."""
    try:
        field = await use_case.execute(
            entity_type_id=str(entity_type_id),
            slug=body.slug,
            label=body.label,
            field_type=body.field_type,
            is_required=body.is_required,
            sort_order=body.sort_order,
            is_identifier=body.is_identifier,
            description=body.description,
        )
    except ValueError as exc:
        _raise_for_value_error(exc)
    return ApiResponse.ok(_to_field_view(field))


@router.patch("/fields/{field_id}")
@inject
async def update_field(
    field_id: UUID,
    body: UpdateFieldRequest,
    use_case: FromDishka[UpdateFieldUseCase],
) -> ApiResponse[FieldView]:
    """Update a field's attributes (D-25/D-27). Duplicate slug → 409."""
    try:
        field = await use_case.execute(
            field_id=str(field_id),
            slug=body.slug,
            label=body.label,
            field_type=body.field_type,
            is_required=body.is_required,
            sort_order=body.sort_order,
            is_identifier=body.is_identifier,
            description=body.description,
        )
    except ValueError as exc:
        _raise_for_value_error(exc)
    return ApiResponse.ok(_to_field_view(field))


@router.delete("/fields/{field_id}")
@inject
async def delete_field(
    field_id: UUID,
    use_case: FromDishka[DeleteFieldUseCase],
) -> ApiResponse[DeleteFieldView]:
    """Delete a field — guarded (D-27).

    Returns whether the field was hard-deleted or soft-deactivated because a
    confirmed component still references it (the D-04 FK is never orphaned).
    """
    try:
        result: DeleteFieldResult = await use_case.execute(field_id=str(field_id))
    except ValueError as exc:
        _raise_for_value_error(exc)
    return ApiResponse.ok(
        DeleteFieldView(
            field_id=result.field_id,
            hard_deleted=result.hard_deleted,
            soft_deactivated=result.soft_deactivated,
        )
    )


@router.post("/{entity_type_id}/fields/reorder")
@inject
async def reorder_fields(
    entity_type_id: UUID,
    body: ReorderFieldsRequest,
    use_case: FromDishka[ReorderFieldsUseCase],
) -> ApiResponse[ReorderFieldsRequest]:
    """Reorder an entity type's fields (sort_order = position, D-25)."""
    try:
        await use_case.execute(entity_type_id=str(entity_type_id), ordered_field_ids=body.ordered_field_ids)
    except ValueError as exc:
        _raise_for_value_error(exc)
    return ApiResponse.ok(body)
