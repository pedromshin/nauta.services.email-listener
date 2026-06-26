"""Relationship setter use cases — role / entity-type / field-relationship (D-10/D-11).

Architecture contract: imports ONLY domain ports and entities.
No infrastructure imports permitted (verified by lint-imports rule).

Each setter loads the component, applies the tenant-from-component guard (D-18:
importer_id derived from the loaded row, never from the caller), calls a single
ComponentRepository writer, and returns the refreshed Component. Missing
component → ValueError → 404 at the FastAPI boundary.
"""

from __future__ import annotations

from typing import Literal

import structlog

from app.domain.entities.component import Component
from app.domain.ports.component_repository import ComponentRepository

logger = structlog.get_logger(__name__)

# Role allow-list (D-01). None clears the role to unclassified — manual override
# always wins over the AI's guess.
ComponentRole = Literal["entity", "field", "unrelated"]


class SetComponentRoleUseCase:
    """Set or clear a component's role (D-10): entity | field | unrelated | None."""

    def __init__(self, *, components: ComponentRepository) -> None:
        self._components = components

    async def execute(
        self,
        *,
        component_id: str,
        role: ComponentRole | None,
        importer_id: str | None = None,
    ) -> Component:
        """Update the component's role; returns the refreshed Component.

        importer_id (D-18): when None, the tenant is derived from the loaded
        component. When given, a mismatch with the component's importer 404s.

        Raises:
            ValueError: if the component cannot be found (or tenant mismatch).
        """
        log = logger.bind(component_id=component_id, role=role)
        log.info("set_component_role_start")

        component = await self._components.find_by_id(component_id)
        if component is None:
            log.warning("set_component_role_component_not_found")
            raise ValueError(f"Component not found: {component_id}")

        # D-18: derive tenant from the component row; explicit mismatch 404s.
        if importer_id is not None and component.importer_id != importer_id:
            log.warning("set_component_role_component_importer_mismatch")
            raise ValueError(f"Component not found: {component_id}")

        updated = await self._components.update_role(component_id, role)
        log.info("set_component_role_done")
        return updated


class SetComponentEntityTypeUseCase:
    """Set or clear a component's entity_type_id (D-03/D-11)."""

    def __init__(self, *, components: ComponentRepository) -> None:
        self._components = components

    async def execute(
        self,
        *,
        component_id: str,
        entity_type_id: str | None,
        importer_id: str | None = None,
    ) -> Component:
        """Update the component's entity_type_id; returns the refreshed Component.

        importer_id (D-18): when None, the tenant is derived from the loaded
        component. When given, a mismatch with the component's importer 404s.

        Raises:
            ValueError: if the component cannot be found (or tenant mismatch).
        """
        log = logger.bind(component_id=component_id, entity_type_id=entity_type_id)
        log.info("set_component_entity_type_start")

        component = await self._components.find_by_id(component_id)
        if component is None:
            log.warning("set_component_entity_type_component_not_found")
            raise ValueError(f"Component not found: {component_id}")

        if importer_id is not None and component.importer_id != importer_id:
            log.warning("set_component_entity_type_component_importer_mismatch")
            raise ValueError(f"Component not found: {component_id}")

        updated = await self._components.update_entity_type(component_id, entity_type_id)
        log.info("set_component_entity_type_done")
        return updated


class SetComponentFieldRelationshipUseCase:
    """Set or clear a field component's parent + entity_type_field_id (D-04/D-11)."""

    def __init__(self, *, components: ComponentRepository) -> None:
        self._components = components

    async def execute(
        self,
        *,
        component_id: str,
        parent_component_id: str | None,
        entity_type_field_id: str | None,
        importer_id: str | None = None,
    ) -> Component:
        """Set parent_component_id + entity_type_field_id together; returns refreshed.

        Both may be None to clear the field relationship (D-11).

        importer_id (D-18): when None, the tenant is derived from the loaded
        component. When given, a mismatch with the component's importer 404s.

        Raises:
            ValueError: if the component cannot be found (or tenant mismatch).
        """
        log = logger.bind(
            component_id=component_id,
            parent_component_id=parent_component_id,
            entity_type_field_id=entity_type_field_id,
        )
        log.info("set_component_field_relationship_start")

        component = await self._components.find_by_id(component_id)
        if component is None:
            log.warning("set_component_field_relationship_component_not_found")
            raise ValueError(f"Component not found: {component_id}")

        if importer_id is not None and component.importer_id != importer_id:
            log.warning("set_component_field_relationship_component_importer_mismatch")
            raise ValueError(f"Component not found: {component_id}")

        updated = await self._components.update_field_relationship(
            component_id, parent_component_id, entity_type_field_id
        )
        log.info("set_component_field_relationship_done")
        return updated
