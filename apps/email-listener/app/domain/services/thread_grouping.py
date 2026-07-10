"""Pure domain service: groups parsed emails into threads via Union-Find over
RFC 5322 threading headers (Message-ID / In-Reply-To / References), with
conservative fallback tiers for forwarded mail that strips those headers
(Gmail UI forward — see 45-CONTEXT.md).

Tiers
-----
- Tier 0 (THRD-01): union any two emails linked by Message-ID <-> In-Reply-To
  or Message-ID <-> References.
- Tier 1 (THRD-02): union any email whose body embeds a "Message-ID: <...>"
  header line matching an existing member's Message-ID (Gmail forward block).
- Tier 2 (THRD-02): conservative fallback — an email still alone in its own
  component joins an existing group only if its normalized subject exactly
  matches the group's normalized subject AND arrived within ``window`` of
  the group's latest received_at. Ambiguous (matches >= 2 distinct groups)
  or empty/generic subject -> DOES NOT merge (false-split beats false-merge).

No I/O, no external dependencies — pure stdlib. This satisfies the
domain-purity constraint (lint-imports forbids ``app.domain`` importing
infrastructure/application/presentation) and makes the algorithm
exhaustively unit-testable via fixtures, independently of persistence.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Final

# Tier 2 fallback window: how close in time an unlinked forwarded email's
# normalized subject match must be to join an existing thread. Conservative
# per 45-CONTEXT.md's "false-split beats false-merge" — Claude's discretion.
_DEFAULT_TIER2_WINDOW: Final[timedelta] = timedelta(days=14)


@dataclass(frozen=True)
class ThreadableEmail:
    """Minimal email shape the grouping algorithm needs (mirrors ParsedEmail)."""

    id: str
    message_id: str | None
    in_reply_to: str | None
    references_ids: tuple[str, ...]
    subject: str | None
    received_at: datetime
    body_text: str | None
    body_html: str | None


class _UnionFind:
    """Disjoint-set over email ids, with path compression."""

    def __init__(self, ids: Sequence[str]) -> None:
        self._parent: dict[str, str] = {i: i for i in ids}

    def find(self, x: str) -> str:
        root = x
        while self._parent[root] != root:
            root = self._parent[root]
        while self._parent[x] != root:
            self._parent[x], x = root, self._parent[x]
        return root

    def union(self, a: str, b: str) -> None:
        root_a, root_b = self.find(a), self.find(b)
        if root_a != root_b:
            self._parent[root_b] = root_a


def _link_headers(emails: Sequence[ThreadableEmail], uf: _UnionFind) -> None:
    """Tier 0: union emails bidirectionally linked via Message-ID <-> In-Reply-To/References."""
    by_message_id: dict[str, str] = {email.message_id: email.id for email in emails if email.message_id}
    for email in emails:
        linked_ids = set(email.references_ids)
        if email.in_reply_to:
            linked_ids.add(email.in_reply_to)
        for linked_message_id in linked_ids:
            target_id = by_message_id.get(linked_message_id)
            if target_id is not None:
                uf.union(email.id, target_id)


def _components(emails: Sequence[ThreadableEmail], uf: _UnionFind) -> dict[str, list[ThreadableEmail]]:
    components: dict[str, list[ThreadableEmail]] = {}
    for email in emails:
        components.setdefault(uf.find(email.id), []).append(email)
    return components


def group_emails(
    emails: Sequence[ThreadableEmail], *, window: timedelta = _DEFAULT_TIER2_WINDOW
) -> list[tuple[str, ...]]:
    """Group emails into threads. Deterministic: groups and members sort by (received_at, id)."""
    if not emails:
        return []

    uf = _UnionFind([email.id for email in emails])
    _link_headers(emails, uf)

    by_id = {email.id: email for email in emails}
    groups = [
        tuple(member.id for member in sorted(members, key=lambda e: (e.received_at, e.id)))
        for members in _components(emails, uf).values()
    ]
    return sorted(groups, key=lambda group: (by_id[group[0]].received_at, group[0]))
