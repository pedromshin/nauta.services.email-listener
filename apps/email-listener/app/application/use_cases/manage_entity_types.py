"""manage_entity_types — entity-type + field CRUD use cases (D-26/D-27).

These use cases back the /v1/entity-types management surface. They enforce the
D-27 integrity rules at the application boundary (defense in depth — the Pydantic
boundary in the router re-validates field_type):

  - field_type is constrained to ALLOWED_FIELD_TYPES on create/update.
  - slug uniqueness per entity type is checked before a field insert.
  - deleting a field still referenced by a confirmed component's
    entity_type_field_id (the D-04 FK) is GUARDED: it is SOFT-DEACTIVATED rather
    than hard-deleted, so the FK is never orphaned. Fields with zero confirmed
    references are hard-deleted.

Delete-guard policy (Claude's Discretion per the plan): SOFT-DEACTIVATE on
references > 0. This keeps the field row (and the D-04 FK target) intact while
removing it from the active schema, which is non-destructive and reversible —
preferable to a hard block that would leave the user unable to clean up a field
without first re-classifying every confirmed component.

Architecture contract: imports ONLY domain ports/entities. No infrastructure.
"""

from __future__ import annotations

from dataclasses import dataclass

import structlog

from app.domain.entities.entity_type import EntityType, EntityTypeField
from app.domain.ports.entity_type_repository import EntityTypeRepository

logger = structlog.get_logger(__name__)

#: The JSON-Schema field types a property may declare (D-27). Anything else is
#: rejected at this boundary (the Pydantic boundary re-validates — defense in depth).
ALLOWED_FIELD_TYPES: tuple[str, ...] = ("string", "number", "date", "array", "object")


def _validate_field_type(field_type: str) -> None:
    """Raise ValueError when field_type is not in the allowed set (D-27)."""
    if field_type not in ALLOWED_FIELD_TYPES:
        raise ValueError(f"invalid field_type: {field_type!r} (allowed: {', '.join(ALLOWED_FIELD_TYPES)})")


@dataclass(frozen=True)
class DeleteFieldResult:
    """Outcome of a field delete — surfaced to the UI so it can report the guard.

    Exactly one of hard_deleted / soft_deactivated is True:
      - hard_deleted: zero confirmed references, the row was removed.
      - soft_deactivated: confirmed references existed, the row was kept but
        marked inactive (the D-04 FK is preserved, D-27).
    """

    field_id: str
    hard_deleted: bool
    soft_deactivated: bool
    confirmed_references: int


class CreateEntityTypeUseCase:
    """Create a new system-default entity type (importer_id NULL, D-26).

    A duplicate slug surfaces as a ValueError carrying the 'slug exists' marker,
    which the endpoint maps to a 409.

    HIGH-2: an APP-LEVEL pre-check is required for the system-default scope. The
    DB ``UNIQUE(importer_id, slug)`` constraint never collides on NULL importer_id
    (SQL ``NULL != NULL``), so duplicate system entity types would persist silently
    and the repository's 23505→ValueError path is dead for system types. We look up
    an existing active system type by slug (importer_id IS NULL) BEFORE the insert
    and raise the marker if one exists. The partial unique index added in migration
    0014 (``ON entity_types (slug) WHERE importer_id IS NULL``) is the real backstop
    against a TOCTOU race.
    """

    def __init__(self, *, entity_types: EntityTypeRepository) -> None:
        self._entity_types = entity_types

    async def execute(self, *, slug: str, label: str, description: str | None = None) -> EntityType:
        log = logger.bind(slug=slug)
        log.info("create_entity_type_start")

        # HIGH-2: app-level pre-check — the DB UNIQUE(importer_id, slug) never fires
        # for system defaults (NULL importer_id), so guard the system-slug here.
        existing = await self._entity_types.find_by_slug(None, slug)
        if existing is not None:
            log.warning("create_entity_type_duplicate_slug")
            raise ValueError(f"entity type slug exists: {slug}")

        created = await self._entity_types.create_entity_type(slug=slug, label=label, description=description)
        log.info("create_entity_type_done", entity_type_id=created.id)
        return created


class UpdateEntityTypeUseCase:
    """Update / rename / re-describe / activate-deactivate an entity type (D-26)."""

    def __init__(self, *, entity_types: EntityTypeRepository) -> None:
        self._entity_types = entity_types

    async def execute(
        self,
        *,
        entity_type_id: str,
        label: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
    ) -> EntityType:
        log = logger.bind(entity_type_id=entity_type_id)
        log.info("update_entity_type_start")
        updated = await self._entity_types.update_entity_type(
            entity_type_id,
            label=label,
            description=description,
            is_active=is_active,
        )
        log.info("update_entity_type_done")
        return updated


class CreateFieldUseCase:
    """Create a field on an entity type with validation (D-27).

    Enforces the field_type allowlist + per-type slug uniqueness BEFORE the
    insert (the DB unique constraint is a backstop; this gives a clean 409).
    """

    def __init__(self, *, entity_types: EntityTypeRepository) -> None:
        self._entity_types = entity_types

    async def execute(
        self,
        *,
        entity_type_id: str,
        slug: str,
        label: str,
        field_type: str,
        is_required: bool = False,
        sort_order: int = 0,
        is_identifier: bool = False,
        description: str | None = None,
    ) -> EntityTypeField:
        log = logger.bind(entity_type_id=entity_type_id, slug=slug)
        _validate_field_type(field_type)

        entity_type = await self._entity_types.find_entity_type_by_id(entity_type_id)
        if entity_type is None:
            log.warning("create_field_entity_type_not_found")
            raise ValueError(f"EntityType not found: {entity_type_id}")

        # D-27: slug uniqueness within the entity type, checked before insert.
        if any(existing.slug == slug for existing in entity_type.fields):
            log.warning("create_field_duplicate_slug")
            raise ValueError(f"field slug exists: {slug}")

        created = await self._entity_types.create_field(
            entity_type_id,
            slug=slug,
            label=label,
            field_type=field_type,
            is_required=is_required,
            sort_order=sort_order,
            is_identifier=is_identifier,
            description=description,
        )
        log.info("create_field_done", field_slug=created.slug)
        return created


class UpdateFieldUseCase:
    """Update a field's attributes with field_type validation (D-27).

    Mirrors CreateFieldUseCase's per-type slug-uniqueness pre-check (WR-03): when
    a new slug is supplied, it must not collide with a SIBLING field on the same
    entity type (the field being updated is excluded). The DB unique constraint
    is a backstop; this pre-check yields a clean 409 instead of a raw 500.
    """

    def __init__(self, *, entity_types: EntityTypeRepository) -> None:
        self._entity_types = entity_types

    async def execute(
        self,
        *,
        field_id: str,
        slug: str | None = None,
        label: str | None = None,
        field_type: str | None = None,
        is_required: bool | None = None,
        sort_order: int | None = None,
        is_identifier: bool | None = None,
        description: str | None = None,
    ) -> EntityTypeField:
        log = logger.bind(field_id=field_id)
        if field_type is not None:
            _validate_field_type(field_type)

        if slug is not None:
            await self._guard_slug_unique(field_id=field_id, slug=slug, log=log)

        updated = await self._entity_types.update_field(
            field_id,
            slug=slug,
            label=label,
            field_type=field_type,
            is_required=is_required,
            sort_order=sort_order,
            is_identifier=is_identifier,
            description=description,
        )
        log.info("update_field_done")
        return updated

    async def _guard_slug_unique(
        self,
        *,
        field_id: str,
        slug: str,
        log: structlog.stdlib.BoundLogger,
    ) -> None:
        """Reject a rename that collides with a sibling field's slug (WR-03).

        The field being updated is excluded by id, so renaming a field to its own
        slug is a no-op. When the owning entity type cannot be resolved, the DB
        unique constraint remains the backstop (no false 409).
        """
        entity_type = await self._entity_types.find_entity_type_by_field_id(field_id)
        if entity_type is None:
            return
        if any(existing.slug == slug and existing.id != field_id for existing in entity_type.fields):
            log.warning("update_field_duplicate_slug")
            raise ValueError(f"field slug exists: {slug}")


class DeleteFieldUseCase:
    """Delete a field with the D-27 confirmed-reference guard.

    references > 0  -> SOFT-DEACTIVATE (keep the row + the D-04 FK target).
    references == 0 -> hard delete.
    """

    def __init__(self, *, entity_types: EntityTypeRepository) -> None:
        self._entity_types = entity_types

    async def execute(self, *, field_id: str) -> DeleteFieldResult:
        log = logger.bind(field_id=field_id)
        references = await self._entity_types.count_confirmed_references(field_id)

        if references > 0:
            await self._entity_types.deactivate_field(field_id)
            log.info("delete_field_soft_deactivated", confirmed_references=references)
            return DeleteFieldResult(
                field_id=field_id,
                hard_deleted=False,
                soft_deactivated=True,
                confirmed_references=references,
            )

        await self._entity_types.delete_field(field_id)
        log.info("delete_field_hard_deleted")
        return DeleteFieldResult(
            field_id=field_id,
            hard_deleted=True,
            soft_deactivated=False,
            confirmed_references=0,
        )


class ReorderFieldsUseCase:
    """Set each field's sort_order to its position in the given id order (D-25)."""

    def __init__(self, *, entity_types: EntityTypeRepository) -> None:
        self._entity_types = entity_types

    async def execute(self, *, entity_type_id: str, ordered_field_ids: list[str]) -> None:
        log = logger.bind(entity_type_id=entity_type_id, field_count=len(ordered_field_ids))
        await self._entity_types.reorder_fields(entity_type_id, ordered_field_ids)
        log.info("reorder_fields_done")
