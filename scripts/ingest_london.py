#!/usr/bin/env python3
"""Monthly London crime ingester for dataSec.

No third-party Python packages required.

Flow:
1. ask data.police.uk for the latest month (or --month YYYY-MM)
2. drive its CSRF-protected custom-download form for Metropolitan Police
3. download the official monthly NPT boundary archive for the same month
4. spatially assign each anonymised crime point to a neighbourhood in memory
5. aggregate counts by neighbourhood/category
6. optionally upsert only boundaries + aggregates to Supabase

With --dry-run, nothing is written to Supabase.
"""

from __future__ import annotations

import argparse
import calendar
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
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from http.cookiejar import CookieJar

BASE = "https://data.police.uk"
API = f"{BASE}/api"
DATA_FORM = f"{BASE}/data/"
FORCE = "metropolitan"
SOURCE_SLUG = "uk-police-open-data"
ONS_WARD_LAD_SOURCE_SLUG = "ons-ward-lad-lookup-2022"
ONS_WARD_LAD_URL = (
    "https://open-geography-portalx-ons.hub.arcgis.com/api/download/v1/items/"
    "823978f94c5543fea5d59722adc2a0ea/csv?layers=0"
)
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


KML_NS = "{http://www.opengis.net/kml/2.2}"


def parse_kml_ring(text: str) -> list[tuple[float, float]]:
    ring: list[tuple[float, float]] = []
    for token in text.split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        ring.append((float(parts[0]), float(parts[1])))
    if len(ring) < 3:
        raise RuntimeError("KML ring has fewer than three coordinates")
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def parse_boundary_archive(blob: bytes, month: str) -> list[dict[str, object]]:
    areas: list[dict[str, object]] = []
    prefix = f"{month}/{FORCE}/"

    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        members = [
            name for name in archive.namelist()
            if name.startswith(prefix) and name.lower().endswith(".kml")
        ]

        for member in members:
            root = ET.fromstring(archive.read(member))
            placemark = root.find(f".//{KML_NS}Placemark")
            if placemark is None:
                raise RuntimeError(f"No Placemark in {member}")

            source_area_id = member.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            name_node = placemark.find(f"{KML_NS}name")
            description_node = placemark.find(f"{KML_NS}description")
            kml_id = (name_node.text or "").strip() if name_node is not None else ""
            if kml_id and kml_id != source_area_id:
                raise RuntimeError(
                    f"KML ID mismatch in {member}: filename={source_area_id}, name={kml_id}"
                )
            display_name = (
                (description_node.text or "").strip()
                if description_node is not None
                else source_area_id
            ) or source_area_id

            polygons: list[dict[str, object]] = []
            all_outer_points: list[tuple[float, float]] = []

            for polygon in placemark.findall(f".//{KML_NS}Polygon"):
                outer_node = polygon.find(
                    f"./{KML_NS}outerBoundaryIs/{KML_NS}LinearRing/{KML_NS}coordinates"
                )
                if outer_node is None or not (outer_node.text or "").strip():
                    continue
                outer = parse_kml_ring(outer_node.text or "")
                holes: list[list[tuple[float, float]]] = []
                for hole_node in polygon.findall(
                    f"./{KML_NS}innerBoundaryIs/{KML_NS}LinearRing/{KML_NS}coordinates"
                ):
                    if (hole_node.text or "").strip():
                        holes.append(parse_kml_ring(hole_node.text or ""))
                polygons.append({"outer": outer, "holes": holes})
                all_outer_points.extend(outer)

            if not polygons or not all_outer_points:
                raise RuntimeError(f"No polygon geometry in {member}")

            xs = [point[0] for point in all_outer_points]
            ys = [point[1] for point in all_outer_points]
            areas.append(
                {
                    "source_area_id": source_area_id,
                    "name": display_name,
                    "polygons": polygons,
                    "bbox": (min(xs), min(ys), max(xs), max(ys)),
                }
            )

    return areas


def fetch_neighbourhoods(month: str) -> tuple[list[dict[str, object]], str]:
    url = f"{BASE}/data/boundaries/{month}.zip"
    log(f"Downloading monthly NPT boundary archive: {url}")
    blob = request_bytes(url, attempts=4)
    checksum = hashlib.sha256(blob).hexdigest()
    areas = parse_boundary_archive(blob, month)

    if len(areas) < 10:
        raise RuntimeError(
            f"Boundary archive has too few Metropolitan KML files for {month}: {len(areas)}"
        )

    log(f"Loaded {len(areas)} Metropolitan NPT boundaries from monthly archive")
    return areas, checksum


def parse_ward_borough_lookup(
    blob: bytes,
    areas: list[dict[str, object]],
) -> dict[str, dict[str, str]]:
    text = blob.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    required = {"WD22CD", "WD22NM", "LAD22CD", "LAD22NM"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise RuntimeError(f"ONS ward/LAD lookup schema changed; missing: {sorted(missing)}")

    current_codes = {
        str(area["source_area_id"]).removesuffix("N")
        for area in areas
    }
    lookup: dict[str, dict[str, str]] = {}

    for row in reader:
        ward_code = (row.get("WD22CD") or "").strip()
        if ward_code not in current_codes:
            continue

        ward_name = (row.get("WD22NM") or "").strip()
        lad_code = (row.get("LAD22CD") or "").strip()
        lad_name = (row.get("LAD22NM") or "").strip()
        if not ward_name or not lad_code.startswith("E09") or not lad_name:
            raise RuntimeError(
                f"Invalid London ward/LAD lookup row for {ward_code}: "
                f"{ward_name!r}, {lad_code!r}, {lad_name!r}"
            )
        if ward_code in lookup:
            raise RuntimeError(f"Duplicate ward code in ONS ward/LAD lookup: {ward_code}")

        lookup[ward_code] = {
            "ward_name": ward_name,
            "lad_code": lad_code,
            "lad_name": lad_name,
        }

    missing_codes = sorted(current_codes - set(lookup))
    if missing_codes:
        raise RuntimeError(
            "ONS ward/LAD lookup does not cover current Metropolitan wards: "
            f"{missing_codes[:20]}"
        )
    if len(lookup) != len(current_codes):
        raise RuntimeError(
            f"Expected {len(current_codes)} London ward/LAD mappings, got {len(lookup)}"
        )

    return lookup


def fetch_ward_borough_lookup(
    areas: list[dict[str, object]],
) -> tuple[dict[str, dict[str, str]], str]:
    log(f"Downloading ONS ward-to-borough lookup: {ONS_WARD_LAD_URL}")
    blob = request_bytes(ONS_WARD_LAD_URL, attempts=4)
    checksum = hashlib.sha256(blob).hexdigest()
    lookup = parse_ward_borough_lookup(blob, areas)

    boroughs = {item["lad_code"]: item["lad_name"] for item in lookup.values()}
    if not 30 <= len(boroughs) <= 33:
        raise RuntimeError(f"Implausible London borough count from ONS lookup: {len(boroughs)}")

    log(f"Matched {len(lookup)} wards to {len(boroughs)} London boroughs")
    return lookup, checksum


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
        polygons = area["polygons"]  # type: ignore[assignment]
        for polygon in polygons:
            outer = polygon["outer"]
            holes = polygon["holes"]
            if point_in_ring(lon, lat, outer) and not any(
                point_in_ring(lon, lat, hole) for hole in holes
            ):
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


def multipolygon_wkt(polygons: list[dict[str, object]]) -> str:
    parts: list[str] = []
    for polygon in polygons:
        rings = [polygon["outer"], *polygon["holes"]]  # type: ignore[list-item]
        rendered_rings: list[str] = []
        for ring in rings:
            coords = ", ".join(f"{lon:.7f} {lat:.7f}" for lon, lat in ring)
            rendered_rings.append(f"({coords})")
        parts.append(f"({', '.join(rendered_rings)})")
    return f"MULTIPOLYGON({', '.join(parts)})"


def github_oidc_token() -> str:
    explicit = os.environ.get("DATASEC_INGEST_GATEWAY_TOKEN", "").strip()
    if explicit:
        return explicit

    request_url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "").strip()
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "").strip()
    if not request_url or not request_token:
        return ""

    separator = "&" if "?" in request_url else "?"
    url = f"{request_url}{separator}audience=datasec-supabase-ingest"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {request_token}",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"GitHub OIDC token request failed: HTTP {exc.code}: {body[:500]}"
        ) from exc

    token = str(payload.get("value") or "").strip()
    if not token:
        raise RuntimeError("GitHub OIDC response did not contain a token")
    return token


class SupabaseRest:
    def __init__(self, base_url: str, service_key: str | None):
        self.project_base = base_url.rstrip("/")
        self.base = self.project_base + "/rest/v1"
        self.key = service_key or ""
        self.gateway_token = github_oidc_token()
        self.gateway_url = os.environ.get(
            "DATASEC_INGEST_GATEWAY_URL",
            self.project_base + "/functions/v1/github-ingest",
        )
        if not self.key and not self.gateway_token:
            raise RuntimeError("No Supabase backend key or GitHub OIDC ingest token is available")

    def request(
        self,
        table: str,
        *,
        method: str = "GET",
        query: str = "",
        payload: object | None = None,
        prefer: str | None = None,
    ) -> object | None:
        if self.gateway_token:
            envelope = {
                "table": table,
                "method": method,
                "query": query,
                "payload": payload,
                "prefer": prefer,
            }
            data = json.dumps(envelope, separators=(",", ":")).encode("utf-8")
            req = urllib.request.Request(
                self.gateway_url,
                data=data,
                headers={
                    "User-Agent": USER_AGENT,
                    "Authorization": f"Bearer {self.gateway_token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as response:
                    body = response.read()
                    if not body:
                        return None
                    return json.loads(body.decode("utf-8"))
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                raise RuntimeError(
                    f"OIDC ingest gateway {method} {table} failed: HTTP {exc.code}: {body}"
                ) from exc

        url = f"{self.base}/{table}"
        if query:
            url += "?" + query
        headers = {
            "User-Agent": USER_AGENT,
            "apikey": self.key,
            "Content-Type": "application/json",
        }
        if not self.key.startswith("sb_secret_"):
            headers["Authorization"] = f"Bearer {self.key}"
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

    def stage(
        self,
        run_id: str,
        entity_type: str,
        rows: list[dict[str, object]],
        item_key,
    ) -> None:
        staged = [
            {
                "ingestion_run_id": run_id,
                "entity_type": entity_type,
                "item_key": str(item_key(row)),
                "payload": row,
            }
            for row in rows
        ]
        self.upsert(
            "ingestion_staging",
            staged,
            "ingestion_run_id,entity_type,item_key",
            batch=200,
        )


def persist(
    month: str,
    rows: list[dict[str, str]],
    areas: list[dict[str, object]],
    aggregates: dict[tuple[str, str], int],
    category_map: dict[str, str],
    unmatched: int,
    checksum: str,
    boundary_checksum: str,
    ward_borough_lookup: dict[str, dict[str, str]],
    ward_borough_checksum: str,
) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        raise RuntimeError("SUPABASE_URL is required unless --dry-run is used")

    db = SupabaseRest(url, key)
    run_id = str(uuid.uuid4())
    period_start = f"{month}-01"
    year, month_number = (int(part) for part in month.split("-"))
    period_end = f"{month}-{calendar.monthrange(year, month_number)[1]:02d}"

    db.upsert("countries", [{"code": COUNTRY_CODE, "name": "United Kingdom"}], "code")
    db.upsert(
        "cities",
        [{"slug": CITY_SLUG, "country_code": COUNTRY_CODE, "name": "London", "timezone": "Europe/London"}],
        "slug",
    )
    db.upsert(
        "sources",
        [
            {
                "slug": SOURCE_SLUG,
                "authority": "Single Online Home National Digital Team / UK Police",
                "source_url": "https://data.police.uk/",
                "licence": "Open Government Licence v3.0",
                "update_frequency": "monthly",
                "source_type": "police-recorded street-level crime",
                "granularity": "anonymised point locations and neighbourhood policing boundaries",
                "notes": "Locations are approximate; recorded crime is not equivalent to personal risk.",
            },
            {
                "slug": ONS_WARD_LAD_SOURCE_SLUG,
                "authority": "Office for National Statistics",
                "source_url": ONS_WARD_LAD_URL,
                "licence": "Open Government Licence v3.0",
                "update_frequency": "static 2022 geography lookup",
                "source_type": "administrative geography lookup",
                "granularity": "electoral ward to local authority district",
                "notes": "Used only to label London police neighbourhoods with their borough/local authority.",
            },
        ],
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
            "diagnostics": {
                "unmatched_rows": unmatched,
                "crime_zip_sha256": checksum,
                "boundary_zip_sha256": boundary_checksum,
                "boundary_model": "same_month_police_neighbourhood_archive",
                "ward_borough_lookup_sha256": ward_borough_checksum,
                "ward_borough_lookup_version": "December 2022",
                "borough_count": len({item["lad_code"] for item in ward_borough_lookup.values()}),
            },
        }],
        "id",
    )

    try:
        boroughs = {
            item["lad_code"]: item["lad_name"]
            for item in ward_borough_lookup.values()
        }
        borough_rows = [
            {
                "id": f"gb-london-borough:{lad_code}",
                "city_slug": CITY_SLUG,
                "source_slug": ONS_WARD_LAD_SOURCE_SLUG,
                "source_area_id": lad_code,
                "parent_area_id": None,
                "area_type": "london_borough",
                "slug": slugify(lad_name),
                "name": lad_name,
                "population": None,
                "active": True,
            }
            for lad_code, lad_name in sorted(boroughs.items())
        ]
        if borough_rows:
            db.upsert("areas", borough_rows, "id", batch=100)

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
        db.stage(run_id, "metric", metric_rows, lambda row: row["slug"])

        area_rows: list[dict[str, object]] = []
        boundary_rows: list[dict[str, object]] = []
        for area in areas:
            source_id = str(area["source_area_id"])
            area_id = f"gb-london-metropolitan:{source_id}"
            name = str(area["name"])
            base_code = source_id.removesuffix("N")
            borough = ward_borough_lookup.get(base_code)
            if borough is None:
                raise RuntimeError(f"Missing borough lookup for London area {source_id}")
            area_rows.append(
                {
                    "id": area_id,
                    "city_slug": CITY_SLUG,
                    "source_slug": SOURCE_SLUG,
                    "source_area_id": source_id,
                    "parent_area_id": f"gb-london-borough:{borough['lad_code']}",
                    "area_type": "police_neighbourhood",
                    "slug": slugify(name),
                    "name": name,
                    "population": None,
                    "active": True,
                }
            )
            polygons = area["polygons"]  # type: ignore[assignment]
            wkt = multipolygon_wkt(polygons)
            boundary_rows.append(
                {
                    "area_id": area_id,
                    "source_slug": SOURCE_SLUG,
                    "period_start": period_start,
                    "geometry": wkt,
                    "source_hash": hashlib.sha256(wkt.encode("utf-8")).hexdigest(),
                }
            )

        db.stage(run_id, "area", area_rows, lambda row: row["id"])
        db.stage(
            run_id,
            "boundary",
            boundary_rows,
            lambda row: f"{row['area_id']}|{row['period_start']}",
        )

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
                        "period_end": period_end,
                        "value": value,
                        "unit": "count",
                        "numerator": value,
                        "denominator": None,
                        "provenance": {
                            "source_month": month,
                            "location_model": "anonymised_point_assigned_to_same_month_police_neighbourhood_boundary",
                        },
                    }
                )
        db.stage(
            run_id,
            "observation",
            observation_rows,
            lambda row: (
                f"{row['area_id']}|{row['metric_slug']}|{row['period_start']}|"
                f"{row['period_end']}|{row['unit']}"
            ),
        )

        db.request(
            "rpc/publish_ingestion_run",
            method="POST",
            payload={"p_run_id": run_id},
            prefer="return=representation",
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

    month = args.month or latest_month()
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise SystemExit("--month must be YYYY-MM")

    log(f"dataSec London ingest: {month}")
    blob = custom_download(month)
    checksum = hashlib.sha256(blob).hexdigest()
    rows = parse_crime_zip(blob, month)
    log(f"Loaded {len(rows):,} Metropolitan street-crime rows")

    categories = source_categories(month)
    areas, boundary_checksum = fetch_neighbourhoods(month)
    ward_borough_lookup, ward_borough_checksum = fetch_ward_borough_lookup(areas)
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
            "crime_zip_sha256": checksum,
            "boundary_zip_sha256": boundary_checksum,
            "ward_borough_lookup_sha256": ward_borough_checksum,
            "boroughs": len({item["lad_code"] for item in ward_borough_lookup.values()}),
        }, indent=2))
        return 0

    persist(
        month,
        rows,
        areas,
        aggregates,
        categories,
        unmatched,
        checksum,
        boundary_checksum,
        ward_borough_lookup,
        ward_borough_checksum,
    )
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
