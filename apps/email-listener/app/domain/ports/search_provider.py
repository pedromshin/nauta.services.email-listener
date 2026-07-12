"""SearchProvider port -- domain abstraction over keyless web search (Phase 54, CLUS-03).

Backs `WebSearchExecutor` (web_search_executor.py): the executor collaborates
with a `SearchProvider` to run the query half of a web-search round, then
fetches + strips + quarantines each result page itself (the provider's job
ends at "which URLs match this query", never at "fetch page content").
Mirrors `KnowledgeGraphRepository`'s plain-Protocol-plus-DTO shape -- the
domain layer has no external deps (verified by lint-imports), so the
concrete `DuckDuckGoSearchProvider` adapter (infrastructure) is never
imported here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SearchResult:
    """One search hit: title + target URL + a short provider-supplied snippet.

    Deliberately carries no fetched-page content -- that is the executor's
    own job (fetch -> strip -> quarantine), kept out of this port so a
    provider implementation can never short-circuit the SSRF guard by
    embedding page text directly in a search result.
    """

    title: str
    url: str
    snippet: str


class SearchProvider(Protocol):
    """Port for one keyless web-search backend (Phase 54: DuckDuckGo, the only adapter today)."""

    async def search(self, *, query: str, limit: int) -> list[SearchResult]:
        """Return up to `limit` search hits for `query`.

        Implementations must never raise past this boundary -- a provider
        failure (network error, malformed response, rate limit) degrades to
        an empty list, never an exception. Mirrors `ToolExecutor.execute`'s
        identical never-raise obligation one layer down.
        """
        ...


__all__ = ["SearchProvider", "SearchResult"]
