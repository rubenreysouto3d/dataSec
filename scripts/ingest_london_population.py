#!/usr/bin/env python3
"""Ingest official ONS ward population for London police neighbourhoods.

The Metropolitan Police neighbourhood IDs used by data.police.uk are GSS ward
codes (E050...). ONS publishes mid-year resident population estimates using
those electoral-ward codes, which lets dataSec use a real resident denominator
instead of falling back to geographic density.
"""

from __future__ import annotations

import argparse
import io
import os
import re
import time
import urllib.request
import uuid
from typing import Any

try:
    import openpyxl
except ModuleNotFoundError as exc:
    raise SystemExit("openpyxl is required: pip install openpyxl") from exc

try:
    from scripts.ingest_london import SupabaseRest, USER_AGENT
except ModuleNotFoundError:
    from ingest_london import SupabaseRest, USER_AGENT

SOURCE_SLUG = "ons-ward-population"
SOURCE_URL = (
    "https://www.ons.gov.uk/file?uri=%2Fpeoplepopulationandcommunity%2F"
    "populationandmigration%2Fpopulationestimates%2Fdatasets%2F"
    "wardlevelmidyearpopulationestimatesexperimental%2Fmid2021andmid2022%2F"
    "sapewardstablefinal.xlsx"
)
PERIOD_START = "2022-06-30"
GSS_RE = re.compile(r"^E05\d{6}$")


def log(message: str) -> None:
    print(message, flush=True)


def request_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read()


def normalise(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def numeric(value: object) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        result = int(value)
        return result if result >= 0 else None
    text = str(value).strip().replace(",", "")
    if not re.fullmatch(r"\d+(?:\.0+)?", text):
        return None
    return int(float(text))


def find_header_rows(sheet) -> tuple[int, dict[int, str]]:
    """Find a row containing a GSS/ward-code heading and return column labels.

    ONS workbooks sometimes use two header rows / merged cells. We combine the
    nearby header text per column so the parser is resilient to formatting-only
    workbook changes.
    """
    max_col = min(sheet.max_column, 80)
    for row_index in range(1, min(sheet.max_row, 45) + 1):
        row_values = [normalise(sheet.cell(row_index, col).value) for col in range(1, max_col + 1)]
        if not any(
            ("ward" in value and "code" in value)
            or "gss code" in value
            or value in {"geography code", "area code"}
            for value in row_values
        ):
            continue

        labels: dict[int, str] = {}
        for col in range(1, max_col + 1):
            pieces: list[str] = []
            for header_row in range(max(1, row_index - 2), min(sheet.max_row, row_index + 2) + 1):
                value = normalise(sheet.cell(header_row, col).value)
                if value and value not in pieces:
                    pieces.append(value)
            labels[col] = " | ".join(pieces)
        return row_index, labels
    raise RuntimeError(f"Could not identify ward table header in sheet {sheet.title!r}")


def identify_columns(labels: dict[int, str]) -> tuple[int, int]:
    code_candidates = [
        col for col, label in labels.items()
        if ("ward" in label and "code" in label)
        or "gss code" in label
        or "geography code" in label
        or "area code" in label
    ]
    if not code_candidates:
        raise RuntimeError("Could not identify ward-code column")

    def population_score(label: str) -> int:
        score = 0
        if "2022" in label:
            score += 8
        if "persons" in label or "person" in label:
            score += 5
        if "all ages" in label or "all age" in label:
            score += 5
        if "total" in label:
            score += 3
        if "male" in label and "female" not in label:
            score -= 8
        if "female" in label:
            score -= 8
        if any(token in label for token in ("0-4", "5-9", "10-14", "age ")):
            score -= 3
        return score

    scored = sorted(
        ((population_score(label), col, label) for col, label in labels.items()),
        reverse=True,
    )
    if not scored or scored[0][0] < 8:
        preview = "; ".join(f"{col}:{label}" for col, label in list(labels.items())[:30])
        raise RuntimeError(f"Could not identify 2022 all-person population column: {preview}")
    return code_candidates[0], scored[0][1]


def extract_populations(blob: bytes) -> dict[str, int]:
    workbook = openpyxl.load_workbook(io.BytesIO(blob), read_only=True, data_only=True)
    candidates: list[dict[str, int]] = []
    diagnostics: list[str] = []

    for sheet in workbook.worksheets:
        try:
            header_row, labels = find_header_rows(sheet)
            code_col, population_col = identify_columns(labels)
        except RuntimeError as exc:
            diagnostics.append(f"{sheet.title}: {exc}")
            continue

        totals: dict[str, int] = {}
        for row_index in range(header_row + 1, sheet.max_row + 1):
            code = str(sheet.cell(row_index, code_col).value or "").strip()
            if not GSS_RE.fullmatch(code):
                continue
            population = numeric(sheet.cell(row_index, population_col).value)
            if population is None:
                continue
            totals[code] = population

        if len(totals) >= 500:
            log(
                f"ONS sheet {sheet.title!r}: parsed {len(totals):,} wards "
                f"(code col {code_col}, population col {population_col}: {labels[population_col]!r})"
            )
            candidates.append(totals)

    if not candidates:
        raise RuntimeError(
            "No usable ONS ward population table found. "
            + " | ".join(diagnostics[:8])
        )

    return max(candidates, key=len)


def london_area_codes(db: SupabaseRest) -> set[str]:
    result = db.request(
        "areas",
        query="select=source_area_id&city_slug=eq.london&active=eq.true&limit=2000",
    )
    if not isinstance(result, list):
        raise RuntimeError("Could not read London areas from Supabase")
    codes = {
        str(row.get("source_area_id") or "").strip()
        for row in result
        if GSS_RE.fullmatch(str(row.get("source_area_id") or "").strip())
    }
    if len(codes) < 600:
        raise RuntimeError(f"Implausibly few London GSS ward codes in data store: {len(codes)}")
    return codes


def validate_match(populations: dict[str, int], london_codes: set[str]) -> dict[str, int]:
    matched = {code: populations[code] for code in london_codes if code in populations}
    coverage = len(matched) / max(len(london_codes), 1)
    missing = sorted(london_codes - set(matched))

    if coverage < 0.95:
        raise RuntimeError(
            f"ONS ward population covers only {len(matched)}/{len(london_codes)} "
            f"London areas ({coverage:.1%}); first missing: {missing[:20]}"
        )
    if min(matched.values(), default=0) <= 0:
        raise RuntimeError("ONS population contains zero/negative London ward population")

    total = sum(matched.values())
    if not 7_000_000 <= total <= 11_000_000:
        raise RuntimeError(f"Implausible matched London population total: {total:,}")

    log(
        f"Matched {len(matched)}/{len(london_codes)} London areas "
        f"({coverage:.1%}); population {total:,}"
    )
    if missing:
        log(f"Missing {len(missing)} ward codes (kept without resident denominator): {missing[:20]}")
    return matched


def persist(db: SupabaseRest, populations: dict[str, int]) -> None:
    run_id = str(uuid.uuid4())
    db.upsert(
        "sources",
        [{
            "slug": SOURCE_SLUG,
            "authority": "Office for National Statistics",
            "source_url": (
                "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/"
                "populationestimates/datasets/wardlevelmidyearpopulationestimatesexperimental"
            ),
            "licence": "Open Government Licence v3.0",
            "update_frequency": "annual",
            "source_type": "population_estimate",
            "granularity": "electoral_ward",
            "notes": (
                "Mid-2022 usual-resident population estimates for electoral wards. "
                "Used as a resident denominator/context, not as police data."
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
            "source_version": "mid-2022",
            "row_count": len(populations),
            "matched_row_count": len(populations),
            "diagnostics": {
                "measurement": "usual_resident_population",
                "reference_date": PERIOD_START,
                "matched_london_wards": len(populations),
            },
        }],
        "id",
    )

    try:
        rows = [
            {
                "area_id": f"gb-london-metropolitan:{code}",
                "source_slug": SOURCE_SLUG,
                "period_start": PERIOD_START,
                "population": population,
                "provenance": {
                    "measurement": "usual_resident_population",
                    "reference_date": PERIOD_START,
                    "geography": "electoral_ward",
                    "gss_code": code,
                },
            }
            for code, population in sorted(populations.items())
        ]
        db.upsert(
            "area_population_snapshots",
            rows,
            "area_id,source_slug,period_start",
            batch=300,
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
                    "diagnostics": {"error": str(exc)},
                },
                prefer="return=minimal",
            )
        finally:
            raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        raise RuntimeError("SUPABASE_URL is required")

    log("Downloading ONS mid-2021/mid-2022 electoral ward workbook")
    blob = request_bytes(SOURCE_URL)
    log(f"Downloaded {len(blob) / 1024 / 1024:.1f} MiB")

    populations = extract_populations(blob)
    db = SupabaseRest(url, key)
    codes = london_area_codes(db)
    matched = validate_match(populations, codes)

    if args.dry_run:
        log("Dry run complete; no database writes.")
        return 0

    persist(db, matched)
    log("London population snapshot persisted successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
