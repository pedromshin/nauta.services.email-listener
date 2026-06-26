"""ResolveEntityCandidatesUseCase — suggest-only entity resolution (D-05).

Loads the target entity instance, derives the importer from the row (D-21),
runs BlendedRAG resolution (dense + lexical fused by RRF k=60), and returns
the ranked candidate list. NEVER writes a merge or flips any status (D-05).

Architecture contract: imports ONLY domain ports and entities.
No infrastructure imports permitted.
"""

from __future__ import annotations

import structlog

from app.domain.ports.entity_instance_repository import EntityInstanceRepository
from app.domain.ports.entity_resolution_repository import (
    EntityCandidate,
    EntityResolutionRepository,
)

logger = structlog.get_logger(__name__)


class ResolveEntityCandidatesUseCase:
    """Return ranked resolution candidates for a given entity instance.

    Collaborators:
        entity_instances: EntityInstanceRepository — load the source instance.
        resolution_repo: EntityResolutionRepository — run BlendedRAG arms.

    Suggest-only (D-05): this use case never writes a merge, never auto-confirms,
    and never modifies any row. It is read-only.

    Tenant isolation (D-21): importer_id is derived from the loaded instance row,
    never from a caller argument.
    """

    def __init__(
        self,
        *,
        entity_instances: EntityInstanceRepository,
        resolution_repo: EntityResolutionRepository,
    ) -> None:
        self._entity_instances = entity_instances
        self._resolution_repo = resolution_repo

    async def execute(
        self,
        *,
        entity_instance_id: str,
        top_n: int = 5,
    ) -> list[EntityCandidate]:
        """Return top-N resolution candidates for the given entity instance.

        Raises:
            ValueError: if the entity instance cannot be found.
        """
        log = logger.bind(entity_instance_id=entity_instance_id)
        log.info("resolve_entity_candidates_start")

        instance = await self._entity_instances.find_by_id(entity_instance_id)
        if instance is None:
            log.warning("resolve_entity_candidates_not_found")
            raise ValueError(f"EntityInstance not found: {entity_instance_id}")

        # D-21: importer_id derived from the ROW, never from a caller arg.
        importer_id = instance.importer_id
        log = log.bind(importer_id=importer_id, entity_type_id=instance.entity_type_id)

        candidates = self._resolution_repo.find_candidates(
            display_name=instance.display_name,
            identifiers=instance.identifiers,
            entity_type_id=instance.entity_type_id,
            importer_id=importer_id,
            embedding=instance.embedding,
            top_n=top_n,
        )

        log.info("resolve_entity_candidates_done", count=len(candidates))
        return candidates
