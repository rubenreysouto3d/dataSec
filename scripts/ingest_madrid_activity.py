#!/usr/bin/env python3
"""Ingest Madrid monthly commercial-activity context by municipal neighbourhood.

This is contextual exposure information only. It must never be used as a
population, footfall, crime or personal-risk denominator.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.parse
import uuid
from typing import Any

try:
    from scripts.ingest_london import SupabaseRest
    from scripts.ingest_madrid import (
        AREA_RESOURCE_ID,
        ckan_action,
        fetch_datastore_rows,
        monthly_resources as incident_monthly_resources,
        normalize_name,
        parse_resource_month,
    )
except ModuleNotFoundError:
    from ingest_london import SupabaseRest
    from ingest_madrid import (
        AREA_RESOURCE_ID,
        ckan_action,
        fetch_datastore_rows,
        monthly_resources as incident_monthly_resources,
        normalize_name,
        parse_resource_month,
    )

DATASET_ID = "209548-0-censo-locales-historico"
SOURCE_SLUG = "madrid-commercial-census"

REQUIRED_FIELDS = {
    "id_local",
    "id_distrito_local",
    "cod_barrio_local",
    "id_situacion_local",
    "desc_situacion_local",
    "id_seccion",
    "desc_seccion",
}


def log(message: str) -> None:
    print(message, flush=True)


def activity_resources() -> dict[str, dict[str, Any]]:
    package = ckan_action("package_show", {"id": DATASET_ID})
    found: dict[str, dict[str, Any]] = {}
    for resource in package.get("resources", []):
        if str(resource.get("format", "")).upper() != "CSV":
            continue
        text = f"{resource.get('name', '')} {resource.get('description', '')}"
        if "actividades" not in text.lower():
            continue
        month = parse_resource_month(resource)
        if month:
            found[month] = resource
    if not found:
        raise RuntimeError("No Madrid commercial-activity CSV resources found")
    return found


def fetch_activity_rows(resource_id: str, *, page_size: int = 5_000) -> tuple[list[dict[str, Any]], list[str]]:
    fields = sorted(REQUIRED_FIELDS)
    field_list = ",".join(fields)
    first = ckan_action(
        "datastore_search",
        {"resource_id": resource_id, "limit": "1", "offset": "0", "fields": field_list},
    )
    total = int(first.get("total") or 0)
    rows: list[dict[str, Any]] = []
    for offset in range(0, total, page_size):
        page = ckan_action(
            "datastore_search",
            {
                "resource_id": resource_id,
                "limit": str(page_size),
                "offset": str(offset),
                "fields": field_list,
            },
        )
        records = page.get("records", [])
        if not isinstance(records, list):
            raise RuntimeError("Madrid commercial records payload is not a list")
        rows.extend(records)
    if len(rows) != total:
        raise RuntimeError(f"Commercial pagination mismatch: expected {total}, got {len(rows)}")
    return rows, fields


def canonical_area_code(row: dict[str, Any]) -> str | None:
    district = str(row.get("id_distrito_local") or "").strip()
    neighbourhood = str(row.get("cod_barrio_local") or "").strip()
    if not district or not neighbourhood:
        return None
    return f"{int(district):02d}{int(neighbourhood)}"


def aggregate_activity(
    rows: list[dict[str, Any]],
    fields: list[str],
    official_codes: set[str],
) -> tuple[dict[str, dict[str, int]], dict[str, Any]]:
    missing = REQUIRED_FIELDS - set(fields)
    if missing:
        raise RuntimeError(f"Commercial source contract changed; missing fields: {sorted(missing)}")

    premises: dict[str, set[str]] = {code: set() for code in official_codes}
    hostelry: dict[str, set[str]] = {code: set() for code in official_codes}
    unknown_codes: set[str] = set()
    missing_geography_rows = 0
    unknown_geography_rows = 0

    for row in rows:
        code = canonical_area_code(row)
        if code is None:
            missing_geography_rows += 1
            continue
        if code not in official_codes:
            unknown_codes.add(code)
            unknown_geography_rows += 1
            continue

        situation_id = str(row.get("id_situacion_local") or "").strip()
        situation = normalize_name(row.get("desc_situacion_local"))
        if situation_id != "1" and situation != "ABIERTO":
            continue

        local_id = str(row.get("id_local") or "").strip()
        if not local_id:
            raise RuntimeError("Open commercial activity row missing id_local")

        premises[code].add(local_id)

        section_id = str(row.get("id_seccion") or "").strip().upper()
        section = normalize_name(row.get("desc_seccion"))
        if section_id == "I" or section == "HOSTELERIA":
            hostelry[code].add(local_id)

    skipped_rows = missing_geography_rows + unknown_geography_rows
    skipped_ratio = skipped_rows / max(len(rows), 1)
    if skipped_ratio > 0.05:
        raise RuntimeError(
            f"Commercial rows without usable neighbourhood exceed 5%: "
            f"{skipped_rows:,}/{len(rows):,} ({skipped_ratio:.2%}); "
            f"unknown codes={sorted(unknown_codes)[:20]}"
        )

    result = {
        code: {
            "open_premises": len(premises[code]),
            "open_hostelry": len(hostelry[code]),
        }
        for code in sorted(official_codes)
    }
    if len(result) != 131:
        raise RuntimeError(f"Expected 131 neighbourhood aggregates, got {len(result)}")

    total_open = sum(item["open_premises"] for item in result.values())
    total_hostelry = sum(item["open_hostelry"] for item in result.values())
    if not 20_000 <= total_open <= 200_000:
        raise RuntimeError(f"Implausible Madrid open-premises total: {total_open:,}")
    if not 1_000 <= total_hostelry <= 50_000:
        raise RuntimeError(f"Implausible Madrid open-hostelry total: {total_hostelry:,}")
    if total_hostelry > total_open:
        raise RuntimeError("Hostelry count exceeds open-premises count")

    diagnostics = {
        "missing_geography_rows": missing_geography_rows,
        "unknown_geography_rows": unknown_geography_rows,
        "unknown_codes": sorted(unknown_codes),
        "skipped_ratio": skipped_ratio,
    }
    return result, diagnostics


def persist(
    month: str,
    resource_id: str,
    source_rows: int,
    aggregates: dict[str, dict[str, int]],
    diagnostics: dict[str, Any],
) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    oidc_token = os.environ.get("DATASEC_INGEST_GATEWAY_TOKEN")
    if not url or not (key or oidc_token):
        raise RuntimeError(
            "SUPABASE_URL plus either a backend key or DATASEC_INGEST_GATEWAY_TOKEN are required"
        )

    db = SupabaseRest(url, key)
    run_id = str(uuid.uuid4())
    period_start = f"{month}-01"

    db.upsert(
        "sources",
        [{
            "slug": SOURCE_SLUG,
            "authority": "Ayuntamiento de Madrid — Censo de Locales y Actividades",
            "source_url": "https://datos.madrid.es/dataset/209548-0-censo-locales-historico",
            "licence": "CC BY 4.0",
            "update_frequency": "monthly",
            "source_type": "commercial_activity_register",
            "granularity": "municipal_neighbourhood",
            "notes": (
                "Open premises and hostelry counts are contextual exposure proxies only; "
                "they are not population, footfall, crime or risk denominators."
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
            "row_count": source_rows,
            "matched_row_count": source_rows - int(diagnostics["missing_geography_rows"]) - int(diagnostics["unknown_geography_rows"]),
            "diagnostics": {
                "resource_id": resource_id,
                "neighbourhood_count": len(aggregates),
                "open_premises": sum(v["open_premises"] for v in aggregates.values()),
                "open_hostelry": sum(v["open_hostelry"] for v in aggregates.values()),
                "measurement": "commercial_activity_context",
                **diagnostics,
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
                "open_premises": values["open_premises"],
                "open_hostelry": values["open_hostelry"],
                "provenance": {
                    "source_month": month,
                    "resource_id": resource_id,
                    "measurement": "open_commercial_premises_and_hostelry",
                    "interpretation": "context_only_not_exposure_denominator",
                },
            }
            for code, values in sorted(aggregates.items())
        ]
        db.upsert(
            "area_activity_context_snapshots",
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
                    "diagnostics": {"error": str(exc), "resource_id": resource_id},
                },
                prefer="return=minimal",
            )
        finally:
            raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", help="YYYY-MM; defaults to latest Madrid incident month")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--emit-json", action="store_true")
    args = parser.parse_args()

    incident_month = max(incident_monthly_resources())
    month = args.month or incident_month
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise SystemExit("--month must be YYYY-MM")

    resources = activity_resources()
    resource = resources.get(month)
    if resource is None:
        raise RuntimeError(f"Commercial activity source month {month} is not published")
    resource_id = str(resource["id"])

    area_rows, area_fields = fetch_datastore_rows(AREA_RESOURCE_ID, page_size=200)
    if "COD_BAR" not in area_fields:
        raise RuntimeError("Madrid official area catalogue no longer exposes COD_BAR")
    official_codes = {str(row.get("COD_BAR") or "").strip() for row in area_rows}
    if len(official_codes) != 131:
        raise RuntimeError(f"Expected 131 official Madrid neighbourhood codes, got {len(official_codes)}")

    log(f"dataSec Madrid commercial context ingest: {month} ({resource_id})")
    rows, fields = fetch_activity_rows(resource_id)
    log(f"Loaded {len(rows):,} commercial-activity rows")
    aggregates, diagnostics = aggregate_activity(rows, fields, official_codes)
    total_open = sum(v["open_premises"] for v in aggregates.values())
    total_hostelry = sum(v["open_hostelry"] for v in aggregates.values())
    log(
        f"Validated {len(aggregates)} neighbourhoods; "
        f"{total_open:,} open premises; {total_hostelry:,} open hostelry premises; "
        f"skipped geography {diagnostics['missing_geography_rows'] + diagnostics['unknown_geography_rows']:,} "
        f"({diagnostics['skipped_ratio']:.2%})"
    )

    if args.emit_json:
        print("ACTIVITY_JSON=" + json.dumps(aggregates, sort_keys=True, separators=(",", ":")), flush=True)

    if args.dry_run:
        log("Dry run complete; no database writes.")
        return 0

    persist(month, resource_id, len(rows), aggregates, diagnostics)
    log("Madrid commercial context snapshot persisted successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
