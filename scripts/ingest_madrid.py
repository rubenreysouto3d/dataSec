#!/usr/bin/env python3
"""Ingest Madrid Municipal Police dispatch incidents into dataSec.

The source is operational dispatch activity, not a crime-only dataset.
Rows already include district and neighbourhood labels. Official current
neighbourhood geometry comes from Madrid Geoportal TopoJSON.
"""

from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import Counter
from typing import Any

try:
    from scripts.ingest_london import SupabaseRest, multipolygon_wkt, slugify
except ModuleNotFoundError:
    from ingest_london import SupabaseRest, multipolygon_wkt, slugify

USER_AGENT = "dataSec-madrid-ingest/0.1 (+https://github.com/rubenreysouto3d/dataSec)"
CKAN_API = "https://datos.madrid.es/api/3/action"
DATASET_ID = "837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal"
AREA_RESOURCE_ID = "300496-4-barrios-madrid"
BOUNDARY_URL = (
    "https://geoportal.madrid.es/fsdescargas/IDEAM_WBGEOPORTAL/"
    "LIMITES_ADMINISTRATIVOS/Barrios/TopoJSON/Barrios.json"
)
SOURCE_SLUG = "madrid-police-dispatch-incidents"
CITY_SLUG = "madrid"
COUNTRY_CODE = "ES"

SPANISH_MONTHS = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

REQUIRED_INCIDENT_FIELDS = {
    "Dia de creacion",
    "Hora de creacion",
    "Distrito",
    "Barrio",
    "Origen",
    "Incidentes",
    "Descripcion tipo de apertura",
}

REQUIRED_AREA_FIELDS = {
    "CODDIS",
    "NOMDIS",
    "COD_BAR",
    "NOMBRE",
    "COD_DIS_TX",
    "BARRIO_MAY",
    "COD_DISBAR",
}


def log(message: str) -> None:
    print(message, flush=True)


def fetch_json(url: str, *, timeout: int = 120) -> tuple[Any, bytes]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            blob = response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {body[:500]}") from exc
    return json.loads(blob.decode("utf-8")), blob


def ckan_action(name: str, params: dict[str, str]) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    body, _ = fetch_json(f"{CKAN_API}/{name}?{query}")
    if not body.get("success"):
        raise RuntimeError(f"Madrid CKAN action failed: {name}")
    result = body.get("result")
    if not isinstance(result, dict):
        raise RuntimeError(f"Madrid CKAN action returned invalid result: {name}")
    return result


def parse_resource_month(resource: dict[str, Any]) -> str | None:
    text = f"{resource.get('name', '')} {resource.get('description', '')}".lower()
    year_match = re.search(r"\b(20\d{2})\b", text)
    if not year_match:
        return None
    for name, month in SPANISH_MONTHS.items():
        if name in text:
            return f"{year_match.group(1)}-{month:02d}"
    return None


def monthly_resources() -> dict[str, dict[str, Any]]:
    package = ckan_action("package_show", {"id": DATASET_ID})
    found: dict[str, dict[str, Any]] = {}
    for resource in package.get("resources", []):
        if str(resource.get("format", "")).upper() != "CSV":
            continue
        month = parse_resource_month(resource)
        if month:
            found[month] = resource
    if not found:
        raise RuntimeError("No monthly Madrid incident CSV resources found")
    return found


def latest_month() -> str:
    return max(monthly_resources())


def fetch_datastore_rows(resource_id: str, *, page_size: int = 5_000) -> tuple[list[dict[str, Any]], list[str]]:
    first = ckan_action(
        "datastore_search",
        {"resource_id": resource_id, "limit": "1", "offset": "0"},
    )
    total = int(first.get("total") or 0)
    fields = [str(field["id"]) for field in first.get("fields", [])]
    rows: list[dict[str, Any]] = []
    for offset in range(0, total, page_size):
        page = ckan_action(
            "datastore_search",
            {
                "resource_id": resource_id,
                "limit": str(page_size),
                "offset": str(offset),
            },
        )
        records = page.get("records", [])
        if not isinstance(records, list):
            raise RuntimeError("Madrid CKAN records payload is not a list")
        rows.extend(records)
    if len(rows) != total:
        raise RuntimeError(f"Madrid CKAN pagination mismatch: expected {total}, got {len(rows)}")
    return rows, fields


def normalize_name(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^A-Za-z0-9]+", " ", text.upper()).strip()
    return re.sub(r"\s+", " ", text)


def strip_article(value: str) -> str:
    words = value.split()
    if words and words[0] in {"EL", "LA", "LOS", "LAS"}:
        return " ".join(words[1:])
    return value


def build_area_index(area_rows: list[dict[str, Any]]) -> tuple[dict[tuple[str, str], dict[str, Any]], dict[str, dict[str, Any]]]:
    aliases: dict[tuple[str, str], list[dict[str, Any]]] = {}
    by_code: dict[str, dict[str, Any]] = {}

    for row in area_rows:
        code = str(row.get("COD_BAR") or "").strip()
        district = normalize_name(row.get("NOMDIS"))
        if not code or not district:
            raise RuntimeError(f"Invalid Madrid area catalog row: {row}")
        if code in by_code:
            raise RuntimeError(f"Duplicate Madrid neighbourhood code: {code}")
        by_code[code] = row

        names = {
            normalize_name(row.get("NOMBRE")),
            normalize_name(row.get("BARRIO_MAY")),
            normalize_name(row.get("BARRIO_MT")),
        }
        names |= {strip_article(name) for name in names if name}
        for name in names:
            if name:
                aliases.setdefault((district, name), []).append(row)

    unique: dict[tuple[str, str], dict[str, Any]] = {}
    for key, matches in aliases.items():
        codes = {str(row["COD_BAR"]).strip() for row in matches}
        if len(codes) == 1:
            unique[key] = matches[0]
    return unique, by_code


def match_incident_area(
    row: dict[str, Any],
    area_index: dict[tuple[str, str], dict[str, Any]],
) -> dict[str, Any] | None:
    district = normalize_name(row.get("Distrito"))
    neighbourhood = normalize_name(row.get("Barrio"))
    for name in (neighbourhood, strip_article(neighbourhood)):
        area = area_index.get((district, name))
        if area is not None:
            return area
    return None


def metric_slug(category: str) -> str:
    return f"madrid-dispatch-{slugify(category)}"


def decode_topology_arc(
    encoded_arc: list[list[int | float]],
    scale: list[float],
    translate: list[float],
) -> list[tuple[float, float]]:
    x = 0.0
    y = 0.0
    decoded: list[tuple[float, float]] = []
    for delta in encoded_arc:
        if len(delta) < 2:
            raise RuntimeError("Invalid Madrid TopoJSON arc coordinate")
        x += float(delta[0])
        y += float(delta[1])
        decoded.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
    return decoded


def topology_arc(topology: dict[str, Any], index: int) -> list[tuple[float, float]]:
    arcs = topology.get("arcs")
    transform = topology.get("transform") or {}
    scale = transform.get("scale")
    translate = transform.get("translate")
    if not isinstance(arcs, list) or not isinstance(scale, list) or not isinstance(translate, list):
        raise RuntimeError("Madrid TopoJSON missing arcs/transform")
    source_index = index if index >= 0 else ~index
    points = decode_topology_arc(arcs[source_index], scale, translate)
    return points if index >= 0 else list(reversed(points))


def stitch_ring(topology: dict[str, Any], arc_indices: list[int]) -> list[tuple[float, float]]:
    ring: list[tuple[float, float]] = []
    for index in arc_indices:
        points = topology_arc(topology, int(index))
        if ring and points and ring[-1] == points[0]:
            points = points[1:]
        ring.extend(points)
    if len(ring) < 3:
        raise RuntimeError("Madrid TopoJSON produced a degenerate ring")
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def geometry_polygons(topology: dict[str, Any], geometry: dict[str, Any]) -> list[dict[str, Any]]:
    geometry_type = geometry.get("type")
    arcs = geometry.get("arcs")
    if geometry_type == "Polygon":
        polygon_arcs = [arcs]
    elif geometry_type == "MultiPolygon":
        polygon_arcs = arcs
    else:
        raise RuntimeError(f"Unsupported Madrid boundary geometry: {geometry_type}")

    polygons: list[dict[str, Any]] = []
    for polygon in polygon_arcs:
        if not polygon:
            continue
        rings = [stitch_ring(topology, [int(index) for index in ring]) for ring in polygon]
        if not rings:
            continue
        polygons.append({"outer": rings[0], "holes": rings[1:]})
    if not polygons:
        raise RuntimeError("Madrid boundary geometry has no polygons")
    return polygons


def fetch_boundaries() -> tuple[dict[str, list[dict[str, Any]]], str]:
    topology, blob = fetch_json(BOUNDARY_URL)
    if topology.get("type") != "Topology":
        raise RuntimeError("Madrid boundary payload is not TopoJSON")
    geometries = ((topology.get("objects") or {}).get("Barrios") or {}).get("geometries")
    if not isinstance(geometries, list) or len(geometries) != 131:
        raise RuntimeError(f"Expected 131 Madrid boundary geometries, got {len(geometries or [])}")

    by_code: dict[str, list[dict[str, Any]]] = {}
    for geometry in geometries:
        code = str((geometry.get("properties") or {}).get("COD_BAR") or "").strip()
        if not code:
            raise RuntimeError("Madrid boundary geometry missing COD_BAR")
        if code in by_code:
            raise RuntimeError(f"Duplicate Madrid boundary code: {code}")
        by_code[code] = geometry_polygons(topology, geometry)
    return by_code, hashlib.sha256(blob).hexdigest()


def validate_and_aggregate(
    month: str,
    incident_rows: list[dict[str, Any]],
    incident_fields: list[str],
    area_rows: list[dict[str, Any]],
    area_fields: list[str],
) -> tuple[Counter[tuple[str, str]], dict[str, str], int, Counter[str]]:
    missing_incident_fields = REQUIRED_INCIDENT_FIELDS - set(incident_fields)
    if missing_incident_fields:
        raise RuntimeError(f"Missing Madrid incident fields: {sorted(missing_incident_fields)}")
    missing_area_fields = REQUIRED_AREA_FIELDS - set(area_fields)
    if missing_area_fields:
        raise RuntimeError(f"Missing Madrid area fields: {sorted(missing_area_fields)}")
    if len(area_rows) != 131:
        raise RuntimeError(f"Expected 131 Madrid neighbourhoods, got {len(area_rows)}")
    if len(incident_rows) < 1_000:
        raise RuntimeError(f"Implausibly low Madrid incident row count: {len(incident_rows)}")

    area_index, _ = build_area_index(area_rows)
    aggregates: Counter[tuple[str, str]] = Counter()
    categories: dict[str, str] = {}
    unmatched = 0
    unmatched_labels: Counter[str] = Counter()

    for row in incident_rows:
        day = str(row.get("Dia de creacion") or "")
        if not day.startswith(month + "-"):
            raise RuntimeError(f"Madrid row outside requested month {month}: {day}")

        count_text = str(row.get("Incidentes") or "").strip()
        try:
            count = int(count_text)
        except ValueError as exc:
            raise RuntimeError(f"Invalid Madrid incident count: {count_text!r}") from exc
        if count < 0:
            raise RuntimeError(f"Negative Madrid incident count: {count}")

        category = str(row.get("Descripcion tipo de apertura") or "").strip()
        if not category:
            raise RuntimeError("Madrid row with empty incident category")
        slug = metric_slug(category)
        existing = categories.get(category)
        if existing is not None and existing != slug:
            raise RuntimeError(f"Unstable Madrid category slug: {category}")
        categories[category] = slug

        area = match_incident_area(row, area_index)
        if area is None:
            unmatched += 1
            unmatched_labels[
                f"{normalize_name(row.get('Distrito'))} / {normalize_name(row.get('Barrio'))}"
            ] += 1
            continue
        code = str(area["COD_BAR"]).strip()
        aggregates[(code, slug)] += count

    if len(categories) < 5:
        raise RuntimeError(f"Implausibly low Madrid category count: {len(categories)}")
    unmatched_ratio = unmatched / max(len(incident_rows), 1)
    if unmatched_ratio > 0.01:
        raise RuntimeError(
            f"Madrid unmatched-row ratio {unmatched_ratio:.2%} exceeds 1% quality gate; "
            f"top unmatched={unmatched_labels.most_common(10)}"
        )
    return aggregates, categories, unmatched, unmatched_labels


def canonical_checksum(rows: list[dict[str, Any]], resource_id: str) -> str:
    payload = {
        "resource_id": resource_id,
        "rows": sorted(rows, key=lambda row: int(row.get("_id") or 0)),
    }
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def persist(
    month: str,
    resource_id: str,
    incident_rows: list[dict[str, Any]],
    area_rows: list[dict[str, Any]],
    boundaries: dict[str, list[dict[str, Any]]],
    aggregates: Counter[tuple[str, str]],
    categories: dict[str, str],
    unmatched: int,
    unmatched_labels: Counter[str],
    checksum: str,
    boundary_checksum: str,
) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) "
            "are required unless --dry-run is used"
        )

    db = SupabaseRest(url, key)
    run_id = str(uuid.uuid4())
    period_start = f"{month}-01"
    year, month_number = (int(part) for part in month.split("-"))
    period_end = f"{month}-{calendar.monthrange(year, month_number)[1]:02d}"

    db.upsert("countries", [{"code": COUNTRY_CODE, "name": "Spain"}], "code")
    db.upsert(
        "cities",
        [{"slug": CITY_SLUG, "country_code": COUNTRY_CODE, "name": "Madrid", "timezone": "Europe/Madrid"}],
        "slug",
    )
    db.upsert(
        "sources",
        [{
            "slug": SOURCE_SLUG,
            "authority": "Dirección General de la Policía Municipal de Madrid",
            "source_url": (
                "https://datos.madrid.es/dataset/"
                "837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal"
            ),
            "licence": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
            "update_frequency": "monthly",
            "source_type": "municipal police central-dispatch incidents",
            "granularity": "official municipal neighbourhood",
            "notes": (
                "Operational incidents include citizen reports, patrol communications and alerts "
                "from other agencies; they are not equivalent to crime."
            ),
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
            "row_count": len(incident_rows),
            "matched_row_count": len(incident_rows) - unmatched,
            "checksum": checksum,
            "diagnostics": {
                "unmatched_rows": unmatched,
                "resource_id": resource_id,
                "source_sha256": checksum,
                "boundary_sha256": boundary_checksum,
                "boundary_model": "current_madrid_municipal_neighbourhood_topology",
            },
        }],
        "id",
    )

    try:
        metric_rows = [
            {
                "slug": slug,
                "label": category,
                "family": "municipal_police_dispatch",
                "description": (
                    "Incident handled by Madrid Municipal Police central dispatch; "
                    "this source is broader than crime."
                ),
                "higher_is_worse": None,
            }
            for category, slug in sorted(categories.items())
        ]
        db.upsert("metrics", metric_rows, "slug")

        district_rows: list[dict[str, object]] = []
        neighbourhood_rows: list[dict[str, object]] = []
        boundary_rows: list[dict[str, object]] = []
        seen_districts: set[str] = set()

        for row in area_rows:
            district_code = str(row["COD_DIS_TX"]).strip()
            district_name = str(row["NOMDIS"]).strip()
            district_id = f"es-madrid-district:{district_code}"
            if district_code not in seen_districts:
                seen_districts.add(district_code)
                district_rows.append({
                    "id": district_id,
                    "city_slug": CITY_SLUG,
                    "source_slug": SOURCE_SLUG,
                    "source_area_id": f"district:{district_code}",
                    "parent_area_id": None,
                    "area_type": "municipal_district",
                    "slug": slugify(district_name),
                    "name": district_name,
                    "population": None,
                    "active": True,
                })

            code = str(row["COD_BAR"]).strip()
            name = str(row["NOMBRE"]).strip()
            area_id = f"es-madrid-neighbourhood:{code}"
            neighbourhood_rows.append({
                "id": area_id,
                "city_slug": CITY_SLUG,
                "source_slug": SOURCE_SLUG,
                "source_area_id": f"neighbourhood:{code}",
                "parent_area_id": district_id,
                "area_type": "municipal_neighbourhood",
                "slug": slugify(name),
                "name": name,
                "population": None,
                "active": True,
            })

            polygons = boundaries.get(code)
            if polygons is None:
                raise RuntimeError(f"Missing Madrid boundary for neighbourhood {code}")
            wkt = multipolygon_wkt(polygons)
            boundary_rows.append({
                "area_id": area_id,
                "source_slug": SOURCE_SLUG,
                "period_start": period_start,
                "geometry": wkt,
                "source_hash": hashlib.sha256(wkt.encode("utf-8")).hexdigest(),
            })

        if len(district_rows) != 21:
            raise RuntimeError(f"Expected 21 Madrid districts, got {len(district_rows)}")
        if len(neighbourhood_rows) != 131 or len(boundary_rows) != 131:
            raise RuntimeError("Madrid area/boundary count changed before persistence")

        db.upsert("areas", district_rows, "id")
        db.upsert("areas", neighbourhood_rows, "id")
        db.upsert("area_boundaries", boundary_rows, "area_id,period_start")

        metric_slugs = sorted(set(categories.values()))
        observation_rows: list[dict[str, object]] = []
        for row in area_rows:
            code = str(row["COD_BAR"]).strip()
            area_id = f"es-madrid-neighbourhood:{code}"
            for slug in metric_slugs:
                value = aggregates.get((code, slug), 0)
                observation_rows.append({
                    "area_id": area_id,
                    "source_slug": SOURCE_SLUG,
                    "metric_slug": slug,
                    "period_start": period_start,
                    "period_end": period_end,
                    "value": value,
                    "unit": "count",
                    "numerator": value,
                    "denominator": None,
                    "provenance": {
                        "source_month": month,
                        "resource_id": resource_id,
                        "measurement": "municipal_police_central_dispatch_incidents",
                        "geography_model": "source_assigned_neighbourhood_current_official_boundary",
                    },
                })
        db.upsert(
            "observations",
            observation_rows,
            "area_id,source_slug,metric_slug,period_start,period_end,unit",
        )

        quality_flags = [{
            "ingestion_run_id": run_id,
            "severity": "warning",
            "code": "guindalera_092_source_caveat",
            "message": (
                "The official source states that Guindalera includes incidents closed as citizen "
                "information at the 092 service address, which creates an apparent local concentration."
            ),
            "details": {"neighbourhood": "Guindalera", "source_note": True},
        }]
        if unmatched:
            quality_flags.append({
                "ingestion_run_id": run_id,
                "severity": "warning",
                "code": "unmatched_madrid_rows",
                "message": f"{unmatched} Madrid source rows could not be matched to the official neighbourhood catalog.",
                "details": {
                    "ratio": unmatched / max(len(incident_rows), 1),
                    "top_unmatched": unmatched_labels.most_common(10),
                },
            })
        db.request(
            "data_quality_flags",
            method="POST",
            payload=quality_flags,
            prefer="return=minimal",
        )

        patch_query = urllib.parse.urlencode({"id": f"eq.{run_id}"})
        db.request(
            "ingestion_runs",
            method="PATCH",
            query=patch_query,
            payload={
                "status": "passed",
                "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
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
                    "diagnostics": {
                        "error": str(exc),
                        "unmatched_rows": unmatched,
                        "resource_id": resource_id,
                    },
                },
                prefer="return=minimal",
            )
        finally:
            raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", help="YYYY-MM; defaults to latest published source month")
    parser.add_argument("--dry-run", action="store_true", help="Validate everything except Supabase writes")
    args = parser.parse_args()

    resources = monthly_resources()
    month = args.month or max(resources)
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise SystemExit("--month must be YYYY-MM")
    resource = resources.get(month)
    if resource is None:
        raise RuntimeError(f"Madrid source month {month} is not published")
    resource_id = str(resource["id"])

    log(f"dataSec Madrid ingest: {month}")
    incident_rows, incident_fields = fetch_datastore_rows(resource_id)
    log(f"Loaded {len(incident_rows):,} Madrid dispatch rows from {resource_id}")
    area_rows, area_fields = fetch_datastore_rows(AREA_RESOURCE_ID, page_size=200)
    log(f"Loaded {len(area_rows)} official Madrid neighbourhoods")
    boundaries, boundary_checksum = fetch_boundaries()
    log(f"Decoded {len(boundaries)} official Madrid TopoJSON neighbourhoods")

    aggregates, categories, unmatched, unmatched_labels = validate_and_aggregate(
        month,
        incident_rows,
        incident_fields,
        area_rows,
        area_fields,
    )
    _, area_by_code = build_area_index(area_rows)
    if set(boundaries) != set(area_by_code):
        missing = sorted(set(area_by_code) - set(boundaries))
        extra = sorted(set(boundaries) - set(area_by_code))
        raise RuntimeError(f"Madrid catalog/topology mismatch: missing={missing}, extra={extra}")

    source_total = sum(
        int(str(row.get("Incidentes") or "0").strip())
        for row in incident_rows
        if match_incident_area(row, build_area_index(area_rows)[0]) is not None
    )
    aggregate_total = sum(aggregates.values())
    if source_total != aggregate_total:
        raise RuntimeError(
            f"Madrid aggregation mismatch: matched source incidents={source_total}, aggregate={aggregate_total}"
        )

    checksum = canonical_checksum(incident_rows, resource_id)
    log(
        f"Validated {len(categories)} categories; matched {len(incident_rows)-unmatched:,}/"
        f"{len(incident_rows):,} rows; aggregate incident count {aggregate_total:,}"
    )
    if unmatched:
        log(f"Unmatched rows: {unmatched} ({unmatched / len(incident_rows):.2%})")
        log(f"Top unmatched labels: {unmatched_labels.most_common(10)}")

    if args.dry_run:
        log(
            f"Dry run complete. Would persist 21 districts, 131 neighbourhoods, "
            f"131 boundaries and {131 * len(categories):,} observations."
        )
        return 0

    persist(
        month,
        resource_id,
        incident_rows,
        area_rows,
        boundaries,
        aggregates,
        categories,
        unmatched,
        unmatched_labels,
        checksum,
        boundary_checksum,
    )
    log("Madrid ingest persisted successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
