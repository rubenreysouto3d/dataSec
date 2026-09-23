#!/usr/bin/env python3
"""Monthly London crime ingester for dataSec.

No third-party Python packages required.

Flow:
1. ask data.police.uk for the latest month (or --month YYYY-MM)
2. drive its CSRF-protected custom-download form for Metropolitan Police
3. fetch current neighbourhood boundaries from the official API
4. spatially assign each anonymised crime point to a neighbourhood in memory
5. aggregate counts by neighbourhood/category
6. optionally upsert only boundaries + aggregates to Supabase

With --dry-run, nothing is written to Supabase.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from collections import Counter, defaultdict
from http.cookiejar import CookieJar

BASE = "https://data.police.uk"
API = f"{BASE}/api"
DATA_FORM = f"{BASE}/data/"
FORCE = "metropolitan"
SOURCE_SLUG = "uk-police-open-data"
CITY_SLUG = "london"
COUNTRY_CODE = "GB"
CELL_SIZE = 0.02
USER_AGENT = "dataSec-ingest/0.1 (+https://github.com/rubenreysouto3d/dataSec)"


def log(message: str) -> None:
    print(message, flush=True)


def request_bytes(
    url: str,
    *,
    opener: urllib.request.OpenerDirector | None = None,
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    attempts: int = 4,
) -> bytes:
    client = opener or urllib.request.build_opener()
    merged = {"User-Agent": USER_AGENT, **(headers or {})}
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=merged)
            with client.open(req, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in {429, 500, 502, 503, 504} or attempt == attempts:
                raise
            delay = min(8, 1.5 ** attempt)
            log(f"HTTP {exc.code} from {url}; retrying in {delay:.1f}s")
            time.sleep(delay)
        except urllib.error.URLError as exc:
            last_error = exc
            if attempt == attempts:
                raise
            time.sleep(min(8, 1.5 ** attempt))
    assert last_error is not None
    raise last_error


def get_json(url: str) -> object:
    return json.loads(request_bytes(url).decode("utf-8"))


def latest_month() -> str:
    payload = get_json(f"{API}/crime-last-updated")
    if not isinstance(payload, dict) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(payload.get("date", ""))):
        raise RuntimeError(f"Unexpected crime-last-updated payload: {payload!r}")
    return str(payload["date"])[:7]


def csrf_token(html: str) -> str:
    patterns = (
        r"name=['\"]csrfmiddlewaretoken['\"][^>]*value=['\"]([^'\"]+)",
        r"csrfmiddlewaretoken['\"]?\s+value=['\"]([^'\"]+)",
    )
    for pattern in patterns:
        match = re.search(pattern, html, re.I)
        if match:
            return match.group(1)
    raise RuntimeError("Could not find CSRF token on data.police.uk/data/; form structure may have changed")


def custom_download(month: str) -> bytes:
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    final_url = ""
    for attempt in range(1, 4):
        html = request_bytes(DATA_FORM, opener=opener).decode("utf-8", errors="replace")
        token = csrf_token(html)
        form = urllib.parse.urlencode(
            [
                ("csrfmiddlewaretoken", token),
                ("date_from", month),
                ("date_to", month),
                ("forces", FORCE),
                ("include_crime", "on"),
            ]
        ).encode("utf-8")
        try:
            req = urllib.request.Request(
                DATA_FORM,
                data=form,
                headers={
                    "User-Agent": USER_AGENT,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": DATA_FORM,
                    "Origin": BASE,
                },
            )
            with opener.open(req, timeout=60) as response:
                final_url = response.geturl()
                response.read()
            break
        except urllib.error.HTTPError as exc:
            if exc.code == 403 and attempt < 3:
                log("Transient CSRF rejection; fetching a fresh token")
                time.sleep(attempt)
                continue
            raise

    match = re.search(r"/data/fetch/([0-9a-f-]{36})/", final_url)
    if not match:
        raise RuntimeError(f"Custom download did not redirect to a fetch job: {final_url}")

    job_id = match.group(1)
    progress_url = f"{BASE}/data/progress/{job_id}/"
    deadline = time.monotonic() + 180
    zip_url = None

    while time.monotonic() < deadline:
        progress = json.loads(request_bytes(progress_url, opener=opener).decode("utf-8"))
        if progress.get("status") == "ready":
            zip_url = progress.get("url")
            break
        if progress.get("status") in {"failed", "error"}:
            raise RuntimeError(f"Custom download job failed: {progress}")
        time.sleep(2)

    if not zip_url:
        raise RuntimeError("Custom download job did not become ready within 180 seconds")

    log("Custom crime ZIP ready")
    return request_bytes(str(zip_url), opener=opener, attempts=4)


def parse_crime_zip(blob: bytes, month: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        names = [
            name
            for name in archive.namelist()
            if name.lower().endswith("-street.csv") and "metropolitan" in name.lower()
        ]
        if not names:
            raise RuntimeError(f"No Metropolitan street-crime CSV found in ZIP; members: {archive.namelist()[:20]}")
        for name in names:
            with archive.open(name) as member:
                text = io.TextIOWrapper(member, encoding="utf-8-sig", newline="")
                reader = csv.DictReader(text)
                required = {"Month", "Longitude", "Latitude", "Crime type"}
                if not required.issubset(set(reader.fieldnames or [])):
                    raise RuntimeError(f"Crime CSV schema changed in {name}: {reader.fieldnames}")
                for row in reader:
                    if row.get("Month") == month:
                        rows.append(row)
    if not rows:
        raise RuntimeError(f"Crime ZIP contained no rows for {month}")
    return rows


def fetch_neighbourhoods() -> list[dict[str, object]]:
    raw = get_json(f"{API}/{FORCE}/neighbourhoods")
    if not isinstance(raw, list) or len(raw) < 10:
        raise RuntimeError("Unexpected Metropolitan neighbourhood list")

    areas: list[dict[str, object]] = []
    for index, item in enumerate(raw, 1):
        area_id = str(item["id"])
        boundary = get_json(f"{API}/{FORCE}/{urllib.parse.quote(area_id)}/boundary")
        if not isinstance(boundary, list) or len(boundary) < 3:
            raise RuntimeError(f"Malformed boundary for {area_id}")
        ring = [(float(p["longitude"]), float(p["latitude"])) for p in boundary]
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        areas.append(
            {
                "source_area_id": area_id,
                "name": str(item["name"]),
                "ring": ring,
                "bbox": (min(xs), min(ys), max(xs), max(ys)),
            }
        )
        if index % 75 == 0:
            log(f"Fetched {index}/{len(raw)} neighbourhood boundaries")
        time.sleep(0.075)
    return areas


def grid_cell(lon: float, lat: float) -> tuple[int, int]:
    return (math.floor(lon / CELL_SIZE), math.floor(lat / CELL_SIZE))


def build_grid(areas: list[dict[str, object]]) -> dict[tuple[int, int], list[int]]:
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for idx, area in enumerate(areas):
        minx, miny, maxx, maxy = area["bbox"]  # type: ignore[misc]
        x0, y0 = grid_cell(float(minx), float(miny))
        x1, y1 = grid_cell(float(maxx), float(maxy))
        for gx in range(x0, x1 + 1):
            for gy in range(y0, y1 + 1):
                grid[(gx, gy)].append(idx)
    return grid


def point_on_segment(
    x: float, y: float, x1: float, y1: float, x2: float, y2: float, eps: float = 1e-10
) -> bool:
    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    if abs(cross) > eps:
        return False
    return min(x1, x2) - eps <= x <= max(x1, x2) + eps and min(y1, y2) - eps <= y <= max(y1, y2) + eps


def point_in_ring(lon: float, lat: float, ring: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if point_on_segment(lon, lat, xi, yi, xj, yj):
            return True
        if (yi > lat) != (yj > lat):
            cross_lon = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lon < cross_lon:
                inside = not inside
        j = i
    return inside


def locate_area(
    lon: float,
    lat: float,
    areas: list[dict[str, object]],
    grid: dict[tuple[int, int], list[int]],
) -> str | None:
    for idx in grid.get(grid_cell(lon, lat), []):
        area = areas[idx]
        minx, miny, maxx, maxy = area["bbox"]  # type: ignore[misc]
        if not (float(minx) <= lon <= float(maxx) and float(miny) <= lat <= float(maxy)):
            continue
        ring = area["ring"]  # type: ignore[assignment]
        if point_in_ring(lon, lat, ring):
            return str(area["source_area_id"])
    return None


def slugify(value: str) -> str:
    normalised = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalised.lower()).strip("-")


def source_categories(month: str) -> dict[str, str]:
    raw = get_json(f"{API}/crime-categories?date={urllib.parse.quote(month)}")
    if not isinstance(raw, list):
        raise RuntimeError("Unexpected crime-categories response")
    mapping: dict[str, str] = {}
    for item in raw:
        if isinstance(item, dict) and item.get("name") and item.get("url"):
            mapping[str(item["name"])] = str(item["url"])
    if not mapping:
        raise RuntimeError("Crime category mapping is empty")
    return mapping


def polygon_wkt(ring: list[tuple[float, float]]) -> str:
    coords = ", ".join(f"{lon:.7f} {lat:.7f}" for lon, lat in ring)
    return f"MULTIPOLYGON((({coords})))"


class SupabaseRest:
    def __init__(self, base_url: str, service_key: str):
        self.base = base_url.rstrip("/") + "/rest/v1"
        self.key = service_key

    def request(
        self,
        table: str,
        *,
        method: str = "GET",
        query: str = "",
        payload: object | None = None,
        prefer: str | None = None,
    ) -> object | None:
        url = f"{self.base}/{table}"
        if query:
            url += "?" + query
        headers = {
            "User-Agent": USER_AGENT,
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        data = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
                body = response.read()
                if not body:
                    return None
                return json.loads(body.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase {method} {table} failed: HTTP {exc.code}: {body}") from exc

    def upsert(self, table: str, rows: list[dict[str, object]], on_conflict: str, batch: int = 400) -> None:
        for start in range(0, len(rows), batch):
            chunk = rows[start : start + batch]
            query = urllib.parse.urlencode({"on_conflict": on_conflict})
            self.request(
                table,
                method="POST",
                query=query,
                payload=chunk,
                prefer="resolution=merge-duplicates,return=minimal",
            )


def persist(
    month: str,
    rows: list[dict[str, str]],
    areas: list[dict[str, object]],
    aggregates: dict[tuple[str, str], int],
    category_map: dict[str, str],
    unmatched: int,
    checksum: str,
) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless --dry-run is used")

    db = SupabaseRest(url, key)
    run_id = str(uuid.uuid4())
    period_start = f"{month}-01"

    db.upsert("countries", [{"code": COUNTRY_CODE, "name": "United Kingdom"}], "code")
    db.upsert(
        "cities",
        [{"slug": CITY_SLUG, "country_code": COUNTRY_CODE, "name": "London", "timezone": "Europe/London"}],
        "slug",
    )
    db.upsert(
        "sources",
        [{
            "slug": SOURCE_SLUG,
            "authority": "Single Online Home National Digital Team / UK Police",
            "source_url": "https://data.police.uk/",
            "licence": "Open Government Licence v3.0",
            "update_frequency": "monthly",
            "source_type": "police-recorded street-level crime",
            "granularity": "anonymised point locations and neighbourhood policing boundaries",
            "notes": "Locations are approximate; recorded crime is not equivalent to personal risk.",
        }],
        "slug",
    )

    db.upsert(
        "ingestion_runs",
        [{
            "id": run_id,
            "source_slug": SOURCE_SLUG,
            "status": "running",
            "source_version": month,
            "row_count": len(rows),
            "matched_row_count": len(rows) - unmatched,
            "checksum": checksum,
            "diagnostics": {"unmatched_rows": unmatched},
        }],
        "id",
    )

    try:
        metric_rows = [
            {
                "slug": slug,
                "label": name,
                "family": "recorded_crime",
                "description": f"Police-recorded {name.lower()} incidents.",
                "higher_is_worse": None,
            }
            for name, slug in sorted(category_map.items())
        ]
        db.upsert("metrics", metric_rows, "slug")

        area_rows: list[dict[str, object]] = []
        boundary_rows: list[dict[str, object]] = []
        for area in areas:
            source_id = str(area["source_area_id"])
            area_id = f"gb-london-metropolitan:{source_id}"
            name = str(area["name"])
            area_rows.append(
                {
                    "id": area_id,
                    "city_slug": CITY_SLUG,
                    "source_slug": SOURCE_SLUG,
                    "source_area_id": source_id,
                    "parent_area_id": None,
                    "area_type": "police_neighbourhood",
                    "slug": slugify(name),
                    "name": name,
                    "population": None,
                    "active": True,
                }
            )
            ring = area["ring"]  # type: ignore[assignment]
            wkt = polygon_wkt(ring)
            boundary_rows.append(
                {
                    "area_id": area_id,
                    "source_slug": SOURCE_SLUG,
                    "period_start": period_start,
                    "geometry": wkt,
                    "source_hash": hashlib.sha256(wkt.encode("utf-8")).hexdigest(),
                }
            )

        db.upsert("areas", area_rows, "id")
        db.upsert("area_boundaries", boundary_rows, "area_id,period_start")

        metric_slugs = sorted(set(category_map.values()))
        observation_rows: list[dict[str, object]] = []
        for area in areas:
            area_id = f"gb-london-metropolitan:{area['source_area_id']}"
            for metric_slug in metric_slugs:
                value = aggregates.get((str(area["source_area_id"]), metric_slug), 0)
                observation_rows.append(
                    {
                        "area_id": area_id,
                        "source_slug": SOURCE_SLUG,
                        "metric_slug": metric_slug,
                        "period_start": period_start,
                        "period_end": period_start,
                        "value": value,
                        "unit": "count",
                        "numerator": value,
                        "denominator": None,
                        "provenance": {
                            "source_month": month,
                            "location_model": "anonymised_point_assigned_to_current_police_neighbourhood_boundary",
                        },
                    }
                )
        db.upsert(
            "observations",
            observation_rows,
            "area_id,source_slug,metric_slug,period_start,period_end,unit",
        )

        unmatched_ratio = unmatched / max(len(rows), 1)
        if unmatched:
            severity = "warning" if unmatched_ratio <= 0.05 else "error"
            db.request(
                "data_quality_flags",
                method="POST",
                payload=[{
                    "ingestion_run_id": run_id,
                    "severity": severity,
                    "code": "unmatched_crime_points",
                    "message": f"{unmatched} source rows could not be assigned to a Metropolitan Police neighbourhood.",
                    "details": {"ratio": unmatched_ratio},
                }],
                prefer="return=minimal",
            )
        if unmatched_ratio > 0.05:
            raise RuntimeError(f"Unmatched-row ratio {unmatched_ratio:.2%} exceeds 5% quality gate")

        patch_query = urllib.parse.urlencode({"id": f"eq.{run_id}"})
        db.request(
            "ingestion_runs",
            method="PATCH",
            query=patch_query,
            payload={"status": "passed", "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            prefer="return=minimal",
        )
    except Exception as exc:
        patch_query = urllib.parse.urlencode({"id": f"eq.{run_id}"})
        try:
            db.request(
                "ingestion_runs",
                method="PATCH",
                query=patch_query,
                payload={
                    "status": "failed",
                    "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "diagnostics": {"error": str(exc), "unmatched_rows": unmatched},
                },
                prefer="return=minimal",
            )
        finally:
            raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", help="YYYY-MM; defaults to latest source month")
    parser.add_argument("--dry-run", action="store_true", help="Do everything except Supabase writes")
    args = parser.parse_args()

    current_month = latest_month()
    month = args.month or current_month
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise SystemExit("--month must be YYYY-MM")

    # The neighbourhood API exposes today's policing boundaries, not an
    # arbitrary historical boundary snapshot. A persisted backfill would
    # therefore mislabel old incidents with modern geography.
    if not args.dry_run and month != current_month:
        raise RuntimeError(
            f"Persisted backfill for {month} is disabled: the live boundary API currently "
            f"represents {current_month}. Add archived boundary ingestion before backfilling."
        )

    log(f"dataSec London ingest: {month}")
    blob = custom_download(month)
    checksum = hashlib.sha256(blob).hexdigest()
    rows = parse_crime_zip(blob, month)
    log(f"Loaded {len(rows):,} Metropolitan street-crime rows")

    categories = source_categories(month)
    areas = fetch_neighbourhoods()
    grid = build_grid(areas)
    log(f"Built spatial index for {len(areas)} neighbourhoods")

    aggregates: dict[tuple[str, str], int] = Counter()
    unmatched = 0
    unknown_categories: Counter[str] = Counter()

    for index, row in enumerate(rows, 1):
        lon_text = (row.get("Longitude") or "").strip()
        lat_text = (row.get("Latitude") or "").strip()
        if not lon_text or not lat_text:
            unmatched += 1
            continue
        try:
            lon = float(lon_text)
            lat = float(lat_text)
        except ValueError:
            unmatched += 1
            continue

        area_source_id = locate_area(lon, lat, areas, grid)
        if area_source_id is None:
            unmatched += 1
            continue

        source_name = (row.get("Crime type") or "").strip()
        metric_slug = categories.get(source_name)
        if metric_slug is None:
            unknown_categories[source_name] += 1
            continue

        aggregates[(area_source_id, metric_slug)] += 1
        if index % 100000 == 0:
            log(f"Assigned {index:,}/{len(rows):,} source rows")

    if unknown_categories:
        raise RuntimeError(f"Unknown crime categories in CSV: {dict(unknown_categories)}")

    matched = len(rows) - unmatched
    ratio = unmatched / max(len(rows), 1)
    log(f"Matched {matched:,}/{len(rows):,}; unmatched {unmatched:,} ({ratio:.2%})")

    if matched < 1000:
        raise RuntimeError("Implausibly few matched rows; refusing to publish")
    if ratio > 0.05:
        raise RuntimeError(f"Unmatched-row ratio {ratio:.2%} exceeds 5% quality gate")

    if args.dry_run:
        busiest = sorted(
            ((key, value) for key, value in aggregates.items()),
            key=lambda item: item[1],
            reverse=True,
        )[:10]
        log(json.dumps({
            "ok": True,
            "dry_run": True,
            "month": month,
            "source_rows": len(rows),
            "matched_rows": matched,
            "unmatched_rows": unmatched,
            "neighbourhoods": len(areas),
            "aggregate_cells": len(aggregates),
            "top_area_metric_counts": busiest,
            "source_zip_sha256": checksum,
        }, indent=2))
        return 0

    persist(month, rows, areas, aggregates, categories, unmatched, checksum)
    log("Supabase ingest passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise
    except Exception as exc:
        print(f"INGEST_ERROR: {exc}", file=sys.stderr)
        raise
