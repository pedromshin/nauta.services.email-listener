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

import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Final

# Tier 2 fallback window: how close in time an unlinked forwarded email's
# normalized subject match must be to join an existing thread. Conservative
# per 45-CONTEXT.md's "false-split beats false-merge" — Claude's discretion.
# Public (not module-private): reused by the Plan 45-03 SupabaseThreadResolver
# adapter so the ingest-time Tier 2 fallback window matches the backfill's.
DEFAULT_TIER2_WINDOW: Final[timedelta] = timedelta(days=14)

# Repeated leading Re:/Fwd:/Fw:/Enc:/Res: tokens (any order, case-insensitive,
# whitespace-tolerant). "fwd?" matches both "Fw" and "Fwd".
_RE_SUBJECT_PREFIX: re.Pattern[str] = re.compile(r"^(?:\s*(?:re|fwd?|enc|res)\s*:\s*)+", re.IGNORECASE)

# "Message-ID: <...>" header line as embedded by Gmail inside a forwarded body block.
_RE_EMBEDDED_MESSAGE_ID: re.Pattern[str] = re.compile(r"message-id:\s*(<[^>\s]+>)", re.IGNORECASE)


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


def normalize_subject(subject: str | None) -> str:
    """Strip repeated leading Re:/Fwd:/Fw:/Enc:/Res: tokens, collapse whitespace, lowercase.

    Empty/whitespace-only/None subject normalizes to "" — an empty normalized
    subject never participates in Tier 2 matching (false-split beats false-merge).
    """
    if not subject:
        return ""
    stripped = _RE_SUBJECT_PREFIX.sub("", subject)
    return " ".join(stripped.split()).lower()


def extract_embedded_message_ids(body_text: str | None, body_html: str | None) -> tuple[str, ...]:
    """Return de-duplicated Message-IDs embedded in a forwarded body (Gmail forward block).

    Scans both the plain-text and HTML bodies for "Message-ID: <...>" header
    lines that Gmail embeds when forwarding a message. Returns () when none found.
    """
    seen: list[str] = []
    for body in (body_text, body_html):
        if not body:
            continue
        for match in _RE_EMBEDDED_MESSAGE_ID.finditer(body):
            message_id = match.group(1)
            if message_id not in seen:
                seen.append(message_id)
    return tuple(seen)


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
    """Tier 0 + Tier 1: union emails linked via header Message-IDs or an embedded original id."""
    by_message_id: dict[str, str] = {email.message_id: email.id for email in emails if email.message_id}
    for email in emails:
        linked_ids = set(email.references_ids)
        if email.in_reply_to:
            linked_ids.add(email.in_reply_to)
        linked_ids.update(extract_embedded_message_ids(email.body_text, email.body_html))
        for linked_message_id in linked_ids:
            target_id = by_message_id.get(linked_message_id)
            if target_id is not None:
                uf.union(email.id, target_id)


def _components(emails: Sequence[ThreadableEmail], uf: _UnionFind) -> dict[str, list[ThreadableEmail]]:
    components: dict[str, list[ThreadableEmail]] = {}
    for email in emails:
        components.setdefault(uf.find(email.id), []).append(email)
    return components


def _group_matches_subject(members: list[ThreadableEmail], normalized_subject: str) -> bool:
    return any(normalize_subject(member.subject) == normalized_subject for member in members)


def _apply_subject_window_fallback(emails: Sequence[ThreadableEmail], uf: _UnionFind, window: timedelta) -> None:
    """Tier 2: conservative subject+window fallback for emails still alone in their component.

    Skips (stays singleton) when the normalized subject is empty, when no other
    component's normalized subject matches within `window`, or when >= 2 distinct
    components match (ambiguous) — false-split beats false-merge.
    """
    for email in emails:
        components = _components(emails, uf)
        root = uf.find(email.id)
        if len(components[root]) != 1:
            continue  # already linked via Tier 0/1 — Tier 2 only applies to singletons

        normalized = normalize_subject(email.subject)
        if not normalized:
            continue  # empty/generic subject never matches

        matching_roots = {
            other_root
            for other_root, members in components.items()
            if other_root != root
            and _group_matches_subject(members, normalized)
            and abs(email.received_at - max(m.received_at for m in members)) <= window
        }

        if len(matching_roots) == 1:
            (target_root,) = matching_roots
            uf.union(email.id, components[target_root][0].id)


def group_emails(
    emails: Sequence[ThreadableEmail], *, window: timedelta = DEFAULT_TIER2_WINDOW
) -> list[tuple[str, ...]]:
    """Group emails into threads. Deterministic: groups and members sort by (received_at, id)."""
    if not emails:
        return []

    uf = _UnionFind([email.id for email in emails])
    _link_headers(emails, uf)
    _apply_subject_window_fallback(emails, uf, window)

    by_id = {email.id: email for email in emails}
    groups = [
        tuple(member.id for member in sorted(members, key=lambda e: (e.received_at, e.id)))
        for members in _components(emails, uf).values()
    ]
    return sorted(groups, key=lambda group: (by_id[group[0]].received_at, group[0]))
