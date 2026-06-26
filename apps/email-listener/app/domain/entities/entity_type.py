"""Domain entities for entity types and their field definitions."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EntityTypeField:
    """A single field definition within an EntityType.

    ``id`` is the entity_type_fields primary key (uuid). It is the identity the
    D-04 FK (email_components.entity_type_field_id) references and the value the
    autofill property mapping must persist — the slug is only a human-readable
    schema key, never a foreign key target.
    """

    id: str
    slug: str
    label: str
    data_type: str
    is_identifier: bool
    is_required: bool
    description: str | None
    sort_order: int


@dataclass(frozen=True)
class EntityType:
    """A named entity type that components can be classified against.

    Fields are nested as a tuple of EntityTypeField instances.
    """

    id: str
    importer_id: str | None
    slug: str
    label: str
    description: str | None
    is_active: bool
    embedding: tuple[float, ...] | None
    fields: tuple[EntityTypeField, ...]
