"""BackfillEntityIdentitiesUseCase — idempotent corpus rebuild from confirmed entity components (D-10).

For a given importer, fetches all confirmed role='entity' components and re-runs
PromoteEntityOnConfirmUseCase for each. Errors on individual components are logged
and skipped so the rest of the backfill continues (partial success is acceptable).

D-10 re-runnable: running this multiple times for the same importer is always safe.
All writes in promote are idempotent (upsert on deterministic UUID5 instance id).

Architecture contract: imports ONLY domain ports, domain entities, and sibling use cases.
"""

from __future__ import annotations

import structlog

from app.domain.ports.entity_instance_repository import EntityInstanceRepository

from .promote_entity_on_confirm import PromoteEntityOnConfirmUseCase

logger = structlog.get_logger(__name__)


class BackfillEntityIdentitiesUseCase:
    """Re-run entity promotion for every confirmed entity component (D-10 backfill).

    Collaborators:
        entity_instances: EntityInstanceRepository — fetch the confirmed component list.
        promote: PromoteEntityOnConfirmUseCase — execute promotion for each component.

    The use case iterates list_confirmed_entity_components(importer_id) and calls
    promote.execute(component_id=...) for each. Individual failures are caught and
    logged but do not abort the loop — the caller receives a summary count.
    """

    def __init__(
        self,
        *,
        entity_instances: EntityInstanceRepository,
        promote: PromoteEntityOnConfirmUseCase,
    ) -> None:
        self._entity_instances = entity_instances
        self._promote = promote

    async def execute(self, *, importer_id: str) -> dict[str, int]:
        """Re-promote all confirmed entity components for the given importer.

        Returns a summary dict with keys:
            total: int — number of confirmed components found.
            succeeded: int — number successfully promoted.
            failed: int — number that raised an error (logged, skipped).
        """
        log = logger.bind(importer_id=importer_id)
        log.info("backfill_entity_identities_start")

        components = await self._entity_instances.list_confirmed_entity_components(importer_id)
        total = len(components)
        succeeded = 0
        failed = 0

        log.info("backfill_entity_identities_components_fetched", total=total)

        for component in components:
            try:
                await self._promote.execute(component_id=component.id)
                succeeded += 1
            except Exception:
                failed += 1
                log.warning(
                    "backfill_entity_identities_component_failed",
                    component_id=component.id,
                    exc_info=True,
                )

        log.info(
            "backfill_entity_identities_done",
            total=total,
            succeeded=succeeded,
            failed=failed,
        )
        return {"total": total, "succeeded": succeeded, "failed": failed}
