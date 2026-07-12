"""Tests for url_safety -- the pure SSRF guard (Phase 54, CLUS-03, T-54-02-01).

Behaviors:
  1.  is_public_https_url: non-https schemes rejected (http, ftp), https
      accepted for a real hostname.
  2.  is_public_https_url: empty host ("https://") rejected.
  3.  is_public_https_url: a literal private/loopback IP host is rejected
      WITHOUT any DNS resolution (pure -- no socket calls in this module).
  4.  is_public_https_url: embedded userinfo/credentials or a non-standard
      port in front of a private-range literal IP still gets rejected
      (urlparse.hostname strips both before the check).
  5.  is_public_ip: loopback (127.0.0.1, ::1) rejected.
  6.  is_public_ip: private ranges (10/8, 172.16/12, 192.168/16) rejected.
  7.  is_public_ip: link-local (169.254.0.0/16, fe80::/10) rejected.
  8.  is_public_ip: CGNAT (100.64.0.0/10) rejected.
  9.  is_public_ip: a real public IP accepted.
  10. is_public_ip: a malformed IP string is rejected (never raises).
  11. SsrfRejected carries a fixed generic reason, never any argument.
"""

from __future__ import annotations

import pytest

from app.domain.services.url_safety import SsrfRejected, is_public_https_url, is_public_ip


@pytest.mark.unit
@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("http://example.com", False),  # wrong scheme
        ("ftp://example.com", False),  # wrong scheme
        ("https://example.com", True),  # real hostname, accepted
        ("https://example.com/path?q=1", True),
    ],
)
def test_is_public_https_url_scheme_gate(url: str, expected: bool) -> None:
    assert is_public_https_url(url) is expected


@pytest.mark.unit
@pytest.mark.parametrize("url", ["https://", "https:///path", "https:"])
def test_is_public_https_url_rejects_empty_host(url: str) -> None:
    assert is_public_https_url(url) is False


@pytest.mark.unit
@pytest.mark.parametrize(
    "url",
    [
        "https://127.0.0.1/",
        "https://127.0.0.1:8080/",
        "https://10.0.0.5/",
        "https://172.16.0.1/",
        "https://192.168.1.1/",
        "https://169.254.169.254/",  # cloud metadata endpoint
        "https://[::1]/",
        "https://[fe80::1]/",
        "https://100.64.0.1/",  # CGNAT
    ],
)
def test_is_public_https_url_rejects_literal_private_ip_without_dns(url: str) -> None:
    """Literal private/loopback/link-local/CGNAT IP hosts are rejected pre-DNS.

    This module performs no DNS resolution or network I/O at all (pure,
    stdlib-only) -- rejecting here proves the defense doesn't wait on a
    resolver round-trip.
    """
    assert is_public_https_url(url) is False


@pytest.mark.unit
@pytest.mark.parametrize(
    "url",
    [
        "https://user:pass@127.0.0.1/",
        "https://user:pass@10.0.0.5:9999/",
        "https://evil:hunter2@169.254.169.254/latest/meta-data/",
    ],
)
def test_is_public_https_url_rejects_private_ip_with_userinfo_and_port(url: str) -> None:
    """Embedded credentials or a non-standard port must not smuggle a private-range host past the guard."""
    assert is_public_https_url(url) is False


@pytest.mark.unit
def test_is_public_https_url_accepts_a_public_hostname_with_userinfo_stripped() -> None:
    assert is_public_https_url("https://user:pass@example.com:8443/path") is True


@pytest.mark.unit
@pytest.mark.parametrize("ip", ["127.0.0.1", "::1"])
def test_is_public_ip_rejects_loopback(ip: str) -> None:
    assert is_public_ip(ip) is False


@pytest.mark.unit
@pytest.mark.parametrize("ip", ["10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.0.1"])
def test_is_public_ip_rejects_private_ranges(ip: str) -> None:
    assert is_public_ip(ip) is False


@pytest.mark.unit
@pytest.mark.parametrize("ip", ["169.254.0.1", "169.254.169.254", "fe80::1"])
def test_is_public_ip_rejects_link_local(ip: str) -> None:
    assert is_public_ip(ip) is False


@pytest.mark.unit
@pytest.mark.parametrize("ip", ["100.64.0.1", "100.100.100.100", "100.127.255.255"])
def test_is_public_ip_rejects_cgnat(ip: str) -> None:
    assert is_public_ip(ip) is False


@pytest.mark.unit
@pytest.mark.parametrize("ip", ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"])
def test_is_public_ip_accepts_real_public_ip(ip: str) -> None:
    assert is_public_ip(ip) is True


@pytest.mark.unit
@pytest.mark.parametrize("ip", ["not-an-ip", "999.999.999.999", ""])
def test_is_public_ip_rejects_malformed_input_never_raises(ip: str) -> None:
    assert is_public_ip(ip) is False


@pytest.mark.unit
def test_ssrf_rejected_carries_fixed_generic_reason_never_the_raw_host() -> None:
    exc = SsrfRejected()
    message = str(exc)
    assert message == "URL rejected: target is not a permitted public HTTPS resource"
    assert "127.0.0.1" not in message
    assert "10.0.0" not in message
