#!/usr/bin/env python3
"""Run multiple published Madrid monthly ingests in chronological order."""

from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys

try:
    from .ingest_madrid import monthly_resources
except ImportError:
    from ingest_madrid import monthly_resources


def select_published_months(
    published_months: list[str],
    count: int,
    latest: str | None = None,
) -> list[str]:
    months = sorted(set(published_months))
    if latest is not None:
        if latest not in months:
            raise ValueError(f"Madrid source month {latest} is not published")
        months = [month for month in months if month <= latest]

    if not months:
        raise ValueError("Madrid source catalog contains no published monthly resources")

    return months[-count:]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--count",
        type=int,
        default=6,
        help="Number of published monthly resources to process, ending at the latest source month",
    )
    parser.add_argument(
        "--latest",
        help="Use this published month (YYYY-MM) as the end of the backfill",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Process every selected resource without writing to Supabase",
    )
    args = parser.parse_args()

    if not 1 <= args.count <= 24:
        raise SystemExit("--count must be between 1 and 24")

    published = sorted(monthly_resources())
    try:
        months = select_published_months(published, args.count, args.latest)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    if len(months) < args.count:
        print(
            f"Requested {args.count} Madrid months, but the official catalog only exposes "
            f"{len(months)} at or before {args.latest or months[-1]}; processing all available resources.",
            flush=True,
        )

    ingester = pathlib.Path(__file__).with_name("ingest_madrid.py")
    print(f"dataSec Madrid backfill ({len(months)} published months): {', '.join(months)}", flush=True)

    for month in months:
        command = [sys.executable, str(ingester), "--month", month]
        if args.dry_run:
            command.append("--dry-run")
        print(f"\n=== {month} ===", flush=True)
        subprocess.run(command, check=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
