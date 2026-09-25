#!/usr/bin/env python3
"""Run multiple Madrid monthly ingests in chronological order."""

from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys

try:
    from .ingest_madrid import latest_month
except ImportError:
    from ingest_madrid import latest_month


def shift_month(month: str, delta: int) -> str:
    year, value = (int(part) for part in month.split("-"))
    index = year * 12 + (value - 1) + delta
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--count",
        type=int,
        default=6,
        help="Number of consecutive months ending at the latest source month",
    )
    parser.add_argument(
        "--latest",
        help="Override latest month (YYYY-MM), mainly for reproducible backfills",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Process every month without writing to Supabase",
    )
    args = parser.parse_args()

    if not 1 <= args.count <= 24:
        raise SystemExit("--count must be between 1 and 24")

    latest = args.latest or latest_month()
    months = [shift_month(latest, -offset) for offset in range(args.count - 1, -1, -1)]
    ingester = pathlib.Path(__file__).with_name("ingest_madrid.py")

    print(f"dataSec Madrid backfill: {', '.join(months)}", flush=True)
    for month in months:
        command = [sys.executable, str(ingester), "--month", month]
        if args.dry_run:
            command.append("--dry-run")
        print(f"\n=== {month} ===", flush=True)
        subprocess.run(command, check=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
