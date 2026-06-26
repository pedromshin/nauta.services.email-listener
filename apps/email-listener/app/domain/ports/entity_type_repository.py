"""EntityTypeRepository port — domain abstraction over entity type lookup + writes."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.domain.entities.entity_type import EntityType, EntityTypeField


class EntityTypeRepository(Protocol):
    """Port for looking up + mutating EntityType definitions.

    Reads (find_by_slug / find_by_id / list_active) existed since Phase 4.
    Writes (create/update entity types + create/update/delete/reorder fields +
    the delete-guard reference count) were added in 09-03 (D-26/D-27) to back
    the /v1/entity-types management surface. All writes operate on the
    system-default scope (importer_id NULL); per-importer overrides are out of
    scope (D-27).

    Slug-conflict signalling (D-27): create_entity_type / create_field raise a
    ValueError whose message contains the marker ``"slug exists"`` when a
    UNIQUE(importer_id, slug) / per-entity-type slug collision occurs, so the
    presentation layer can map it to a 409 instead of a raw 500.
    """

    async def find_by_slug(self, importer_id: str | None, slug: str) -> EntityType | None:
        """Return the entity type matching (importer_id, slug), or None."""
        ...

    async def find_by_id(self, entity_type_id: str) -> EntityType | None:
        """Return the entity type with the given id (+ its field schema), or None.

        Used by AutofillFieldsUseCase (09-02b) to resolve an entity component's
        EntityType + property schema from its first-class entity_type_id column
        (D-03/D-13). Id is a global primary key, so this lookup is not
        importer-scoped — tenant isolation is enforced on the component row that
        carries the entity_type_id, never here.
        """
        ...

    async def list_active(self, importer_id: str | None) -> list[EntityType]:
        """Return all active entity types visible to the given importer."""
        ...

    # ── Writes (09-03, D-26/D-27) ────────────────────────────────────────────

    async def create_entity_type(
        self,
        *,
        slug: str,
        label: str,
        description: str | None = None,
    ) -> EntityType:
        """Insert a new system-default entity type (importer_id NULL, active).

        Raises a ValueError containing ``"slug exists"`` on a UNIQUE
        (importer_id, slug) violation (D-27) so the endpoint can map it to 409.
        """
        ...

    async def update_entity_type(
        self,
        entity_type_id: str,
        *,
        label: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
    ) -> EntityType:
        """Partially update an entity type; return the refreshed EntityType.

        Only the provided (non-None) fields are written. Raises ValueError when
        no row matches the id.
        """
        ...

    async def find_entity_type_by_id(self, entity_type_id: str) -> EntityType | None:
        """Return the entity type with the given id, or None.

        Alias of find_by_id named per the 09-03 plan; used by the management use
        cases (and 09-02 autofill-fields) to load an entity type before a write.
        """
        ...

    async def find_entity_type_by_field_id(self, field_id: str) -> EntityType | None:
        """Return the EntityType that owns the given field id, or None.

        Used by UpdateFieldUseCase (WR-03) to mirror CreateFieldUseCase's
        per-type slug-uniqueness pre-check on update (excluding the field being
        updated) — the field row carries entity_type_id, which this resolves to
        its owning EntityType + active field schema.
        """
        ...

    async def create_field(
        self,
        entity_type_id: str,
        *,
        slug: str,
        label: str,
        field_type: str,
        is_required: bool = False,
        sort_order: int = 0,
        is_identifier: bool = False,
        description: str | None = None,
    ) -> EntityTypeField:
        """Insert a new field on an entity type (is_identifier lives in config jsonb).

        Raises a ValueError containing ``"slug exists"`` when the slug already
        exists within the entity type (D-27 per-type slug uniqueness).
        """
        ...

    async def update_field(
        self,
        field_id: str,
        *,
        slug: str | None = None,
        label: str | None = None,
        field_type: str | None = None,
        is_required: bool | None = None,
        sort_order: int | None = None,
        is_identifier: bool | None = None,
        description: str | None = None,
    ) -> EntityTypeField:
        """Partially update a field row (is_identifier maps into config jsonb).

        Only the provided (non-None) fields are written. Raises ValueError when
        no row matches the id.
        """
        ...

    async def deactivate_field(self, field_id: str) -> EntityTypeField:
        """Soft-deactivate a field (config.is_active = False) without deleting it.

        Used by the delete-guard (D-27) when a field is still referenced by a
        confirmed component's entity_type_field_id — never orphans the D-04 FK.
        Raises ValueError when no row matches the id.
        """
        ...

    async def delete_field(self, field_id: str) -> None:
        """Hard-delete a field row (only when it has zero confirmed references)."""
        ...

    async def reorder_fields(self, entity_type_id: str, ordered_field_ids: list[str]) -> None:
        """Set sort_order = position for each id in the given order."""
        ...

    async def count_confirmed_references(self, field_id: str) -> int:
        """Count confirmed components referencing this field (D-27 delete-guard).

        Returns the number of email_components rows whose entity_type_field_id
        equals field_id AND whose extraction_status is 'confirmed'. A positive
        count blocks the hard-delete path (the field is soft-deactivated instead).
        """
        ...
