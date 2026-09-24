#!/usr/bin/env python3
"""Ingest Madrid monthly registered population by municipal neighbourhood."""

from __future__ import annotations

import argparse
import os
import re
import time
import urllib.parse
import uuid
from collections import Counter
from typing import Any

try:
    from scripts.ingest_london import SupabaseRest
    from scripts.ingest_madrid import (
        AREA_RESOURCE_ID,
        ckan_action,
        fetch_datastore_rows,
        monthly_resources as incident_monthly_resources,
        parse_resource_month,
    )
except ModuleNotFoundError:
    from ingest_london import SupabaseRest
    from ingest_madrid import (
        AREA_RESOURCE_ID,
        ckan_action,
        fetch_datastore_rows,
        monthly_resources as incident_monthly_resources,
        parse_resource_month,
    )

POPULATION_DATASET_ID = "209163-0-padron-municipal-historico"
SOURCE_SLUG = "madrid-population-register"

REQUIRED_FIELDS = {
    "COD_DISTRITO",
    "COD_DIST_BARRIO",
    "DESC_BARRIO",
    "COD_BARRIO",
    "ESPANOLESHOMBRES",
    "ESPANOLESMUJERES",
    "EXTRANJEROSHOMBRES",
    "EXTRANJEROSMUJERES",
}


def log(message: str) -> None:
    print(message, flush=True)


def population_resources() -> dict[str, dict[str, Any]]:
    package = ckan_action("package_show", {"id": POPULATION_DATASET_ID})
    found: dict[str, dict[str, Any]] = {}
    for resource in package.get("resources", []):
        if str(resource.get("format", "")).upper() != "CSV":
            continue
        month = parse_resource_month(resource)
        if month:
            found[month] = resource
    if not found:
        raise RuntimeError("No monthly Madrid population CSV resources found")
    return found


def parse_count(value: object) -> int:
    text = str(value or "").strip()
    if not text:
        return 0
    if not re.fullmatch(r"-?\d+", text):
        raise RuntimeError(f"Invalid population count {value!r}")
    result = int(text)
    if result < 0:
        raise RuntimeError(f"Negative population count {result}")
    return result


def canonical_area_code(row: dict[str, Any]) -> str:
    district = str(row.get("COD_DISTRITO") or "").strip()
    neighbourhood = str(row.get("COD_BARRIO") or "").strip()
    if not district or not neighbourhood:
        raise RuntimeError(f"Population row missing district/neighbourhood code: {row}")
    return f"{int(district):02d}{int(neighbourhood)}"


def aggregate_population(
    rows: list[dict[str, Any]],
    fields: list[str],
    official_codes: set[str],
) -> tuple[dict[str, int], Counter[str]]:
    missing = REQUIRED_FIELDS - set(fields)
    if missing:
        raise RuntimeError(f"Population source contract changed; missing fields: {sorted(missing)}")

    totals: Counter[str] = Counter()
    unmatched: Counter[str] = Counter()
    for row in rows:
        code = canonical_area_code(row)
        population = sum(
            parse_count(row.get(field))
            for field in (
                "ESPANOLESHOMBRES",
                "ESPANOLESMUJERES",
                "EXTRANJEROSHOMBRES",
                "EXTRANJEROSMUJERES",
            )
        )
        if code not in official_codes:
            unmatched[code] += population
            continue
        totals[code] += population

    if unmatched:
        raise RuntimeError(f"Population rows contain unknown neighbourhood codes: {unmatched.most_common(10)}")
    if set(totals) != official_codes:
        missing_codes = sorted(official_codes - set(totals))
        raise RuntimeError(f"Population source missing official neighbourhoods: {missing_codes}")
    if len(totals) != 131:
        raise RuntimeError(f"Expected 131 population neighbourhoods, got {len(totals)}")

    city_total = sum(totals.values())
    if not 3_000_000 <= city_total <= 4_500_000:
        raise RuntimeError(f"Implausible Madrid registered population total: {city_total:,}")
    if min(totals.values()) <= 0:
        raise RuntimeError("Population source contains a zero-population neighbourhood")

    return dict(totals), unmatched


def persist(month: str, resource_id: str, source_rows: int, totals: dict[str, int]) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required"
        )

    db = SupabaseRest(url, key)
    run_id = str(uuid.uuid4())
    period_start = f"{month}-01"

    db.upsert(
        "sources",
        [{
            "slug": SOURCE_SLUG,
            "authority": "Ayuntamiento de Madrid — Padrón Municipal",
            "source_url": "https://datos.madrid.es/dataset/209163-0-padron-municipal-historico",
            "licence": "CC BY 4.0",
            "update_frequency": "monthly",
            "source_type": "population_register",
            "granularity": "municipal_neighbourhood",
            "notes": "Monthly registered resident population used as denominator/context, not as police data.",
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
            "row_count": source_rows,
            "matched_row_count": source_rows,
            "diagnostics": {
                "resource_id": resource_id,
                "neighbourhood_count": len(totals),
                "registered_population": sum(totals.values()),
                "measurement": "registered_resident_population",
            },
        }],
        "id",
    )

    try:
        rows = [
            {
                "area_id": f"es-madrid-neighbourhood:{code}",
                "source_slug": SOURCE_SLUG,
                "period_start": period_start,
                "population": population,
                "provenance": {
                    "source_month": month,
                    "resource_id": resource_id,
                    "measurement": "registered_resident_population",
                    "temporal_semantics": "first_day_of_month",
                },
            }
            for code, population in sorted(totals.items())
        ]
        db.upsert(
            "area_population_snapshots",
            rows,
            "area_id,source_slug,period_start",
        )

        query = urllib.parse.urlencode({"id": f"eq.{run_id}"})
        db.request(
            "ingestion_runs",
            method="PATCH",
            query=query,
            payload={
                "status": "passed",
                "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
            prefer="return=minimal",
        )
    except Exception as exc:
        query = urllib.parse.urlencode({"id": f"eq.{run_id}"})
        try:
            db.request(
                "ingestion_runs",
                method="PATCH",
                query=query,
                payload={
                    "status": "failed",
                    "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "diagnostics": {
                        "error": str(exc),
                        "resource_id": resource_id,
                        "neighbourhood_count": len(totals),
                    },
                },
                prefer="return=minimal",
            )
        finally:
            raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", help="YYYY-MM; defaults to latest Madrid incident month")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    incident_month = max(incident_monthly_resources())
    month = args.month or incident_month
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise SystemExit("--month must be YYYY-MM")

    resources = population_resources()
    resource = resources.get(month)
    if resource is None:
        raise RuntimeError(f"Population source month {month} is not published")
    resource_id = str(resource["id"])

    area_rows, area_fields = fetch_datastore_rows(AREA_RESOURCE_ID, page_size=200)
    if "COD_BAR" not in area_fields:
        raise RuntimeError("Madrid official area catalogue no longer exposes COD_BAR")
    official_codes = {str(row.get("COD_BAR") or "").strip() for row in area_rows}
    if len(official_codes) != 131:
        raise RuntimeError(f"Expected 131 official Madrid neighbourhood codes, got {len(official_codes)}")

    log(f"dataSec Madrid population ingest: {month} ({resource_id})")
    rows, fields = fetch_datastore_rows(resource_id)
    log(f"Loaded {len(rows):,} population rows")
    totals, _ = aggregate_population(rows, fields, official_codes)
    city_total = sum(totals.values())
    log(f"Validated {len(totals)} neighbourhoods; registered population {city_total:,}")

    if args.dry_run:
        log("Dry run complete; no database writes.")
        return 0

    persist(month, resource_id, len(rows), totals)
    log("Madrid population snapshot persisted successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
