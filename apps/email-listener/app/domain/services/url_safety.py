"""url_safety -- pure SSRF guard for the web_search fetch pipeline (Phase 54, CLUS-03, T-54-02-01).

Domain layer, stdlib-only (`ipaddress` / `urllib.parse`) -- import-linter's
"Domain has no external deps" contract forbids anything else here (verified
by lint-imports). DNS resolution (`socket.getaddrinfo`) does NOT happen in
this module -- it happens in the infrastructure adapter
(`web_search_executor.py`), which resolves a hostname to its IP address(es)
and calls `is_public_ip` on EACH resolved address before ever issuing a
fetch. `is_public_https_url` alone proves only the pre-DNS checks (scheme,
non-empty host, and -- for a literal-IP host -- publicness) so that an
obviously-unsafe target (`https://127.0.0.1/`, `https://10.0.0.5/`) is
rejected before any network I/O, not just after a DNS round-trip.

Fail-closed, fail-generic (T-54-02-01): `SsrfRejected` carries a FIXED
reason string, never the raw host/URL that tripped it -- mirrors
`tool_envelope_gate.py`'s `EnvelopeGateOutcome.reason` convention, so a
caught exception can never leak which internal host was probed.
"""

from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

# CGNAT (RFC 6598, 100.64.0.0/10) -- not covered by `IPv4Address.is_private`
# on every Python version, so it is checked explicitly regardless of
# interpreter version (deterministic behavior on py311, this repo's target).
_CGNAT_NETWORK = ipaddress.ip_network("100.64.0.0/10")

_REJECTED_REASON = "URL rejected: target is not a permitted public HTTPS resource"


class SsrfRejected(Exception):  # noqa: N818 - plan-fixed name (54-02-PLAN.md exports it verbatim)
    """Raised when a URL/IP fails the public-HTTPS-only guard.

    Carries a FIXED, generic reason -- never the raw host/URL that tripped
    it (fail-closed, no info leak; mirrors `tool_envelope_gate.py`'s
    `EnvelopeGateOutcome.reason` convention applied to an exception).
    """

    def __init__(self) -> None:
        super().__init__(_REJECTED_REASON)


def is_public_ip(ip: str) -> bool:
    """Return True only if `ip` is a public, routable unicast address.

    Rejects loopback, private (RFC 1918), link-local, reserved, multicast,
    unspecified, and the 100.64.0.0/10 CGNAT block (RFC 6598) -- covers both
    IPv4 and IPv6 (`::1`, `fe80::/10`, etc, via the stdlib `ipaddress`
    module's own classification properties).
    """
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return False
    if (
        parsed.is_private
        or parsed.is_loopback
        or parsed.is_link_local
        or parsed.is_reserved
        or parsed.is_multicast
        or parsed.is_unspecified
    ):
        return False
    return not (isinstance(parsed, ipaddress.IPv4Address) and parsed in _CGNAT_NETWORK)


def is_public_https_url(url: str) -> bool:
    """Return True only if `url` is https, has a non-empty host, and -- when
    the host is a literal IP -- that IP is public. Performs NO DNS resolution.

    This is the pre-fetch, pre-DNS defense (T-54-02-01): a literal private/
    loopback/link-local/CGNAT IP host (`https://127.0.0.1/`,
    `https://10.0.0.5:8080/`) is rejected here, before the adapter's own
    post-DNS `is_public_ip` re-check on the resolved address(es). A
    non-literal-IP hostname passes this check and is deferred to the
    adapter's DNS step -- this function alone cannot prove a hostname
    resolves to a public address, only that the URL isn't OBVIOUSLY unsafe
    (wrong scheme, empty host, or a private IP written out literally).

    Userinfo (`https://user:pass@host/`) and non-standard ports are stripped
    by `urlparse(...).hostname` before the check runs, so embedding
    credentials or a non-standard port in front of a private-range literal
    IP does not bypass the guard.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme != "https":
            return False
        hostname = parsed.hostname
    except ValueError:
        return False

    if not hostname:
        return False

    try:
        literal_ip = ipaddress.ip_address(hostname)
    except ValueError:
        # Not a literal IP -- a real hostname, deferred to the adapter's
        # post-DNS is_public_ip check.
        return True

    return is_public_ip(str(literal_ip))


__all__ = ["SsrfRejected", "is_public_https_url", "is_public_ip"]
