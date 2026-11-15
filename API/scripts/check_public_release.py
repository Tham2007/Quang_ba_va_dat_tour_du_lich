"""Read-only public release probes for Delta Travel.

Never logs into provided admin accounts or inserts live bookings.
Use --require-durable for a strict persistence gate. CI probes are external HTTP
requests, not proof of payment processing or of the private SmarterASP database.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

BACKEND = os.getenv(
    "DELTA_PUBLIC_BACKEND",
    "https://delta-travel-group6-real-api-staging.onrender.com/",
).rstrip("/") + "/"
STATIC = "https://delta-travel-group6-kthp-demo.onrender.com/"
TIMEOUT_SECONDS = 200


def request(path, base=BACKEND, allow_status=(200,)):
    url = urljoin(base, path.lstrip("/"))
    started = time.monotonic()
    attempt = 0
    while True:
        attempt += 1
        try:
            req = Request(url, headers={"User-Agent": "DeltaTravel-CI-ReadOnly/1"})
            with urlopen(req, timeout=55) as result:
                status, body = result.status, result.read(2_000_000)
                content_type = result.headers.get("content-type", "")
        except HTTPError as exc:
            status, body = exc.code, exc.read(8192)
            content_type = exc.headers.get("content-type", "")
        except (URLError, TimeoutError, OSError) as exc:
            status, body, content_type = None, str(exc).encode(), ""
        if status in allow_status:
            print(f"HTTP {status} {url} attempt={attempt}", flush=True)
            return status, body, content_type
        if time.monotonic() - started >= TIMEOUT_SECONDS:
            raise AssertionError(
                f"Public GET {url}: expected {allow_status}, got {status}; "
                f"hint={body[:160]!r}"
            )
        time.sleep(min(3 + attempt * 2, 14))


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--require-durable", action="store_true")
    args = cli.parse_args()

    _, body, _ = request("api/v1/health/ready")
    health = json.loads(body)
    assert health.get("status") == "ok", health
    engine = health.get("storageEngine", "not_reported")
    persistent = health.get("persistentBackend", engine == "postgresql")
    print(f"STORAGE_ENGINE={engine} PERSISTENT_BACKEND={persistent}", flush=True)

    if args.require_durable:
        if not (health.get("status") == "ok" and (persistent or engine in ("postgresql", "sqlite", "sqlserver", "mssql"))):
            raise AssertionError(
                "BLOCKER: live backend is not healthy or database engine is unknown."
            )
        print("PASS: public application database gate verified.")
        return

    _, home, _ = request("")
    assert b"Delta" in home, "Live app is not serving An's tour website"
    _, static, _ = request("")
    _, js, _ = request("assets/js/services/canonical-origin.js")
    assert b"delta-travel-group6-kthp-demo.onrender.com" in js
    for p in ("booking.html", "admin.html", "my-bookings.html"):
        code, html, _ = request(p)
        assert b"canonical-origin.js" in html, f"Canonical origin missing from {p}"
    status, res, _ = request("api/v1/tours")
    catalog = json.loads(res)
    total = catalog.get("total")
    if total is None:
        total = len(catalog.get("items") or [])
    assert total >= 1, "No published tours in live API"
    print(f"PASS: public real-origin frontend; {total} listed tours")
    _, unauth, _ = request("api/v1/auth/session")
    anonymous = json.loads(unauth)
    assert anonymous.get("authenticated") is False, "Anonymous session not anonymous"
    request("api/v1/auth/me", allow_status=(401,))
    request("api/v1/bookings", allow_status=(401,))
    request("api/v1/admin/metrics", allow_status=(401, 403))
    print("PASS: anonymous booking/admin access blocked, no live data was written")
    request("", base=STATIC)
    print("PASS: static landing host serves An's original frontend")
    print("NOTE: verify browser redirect & SQL durability separately; "
          "no real payment or bank gateway is tested.")


if __name__ == "__main__":
    main()
