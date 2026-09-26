import unittest

from scripts.backfill_madrid import select_published_months


class MadridBackfillSelectionTests(unittest.TestCase):
    def test_uses_published_months_instead_of_assuming_calendar_continuity(self):
        published = ["2025-09", "2025-11", "2025-12", "2026-01"]
        self.assertEqual(
            select_published_months(published, 3),
            ["2025-11", "2025-12", "2026-01"],
        )

    def test_latest_must_be_an_actual_published_resource(self):
        with self.assertRaisesRegex(ValueError, "is not published"):
            select_published_months(["2026-06", "2026-08"], 2, "2026-07")

    def test_returns_all_available_when_catalog_is_shorter_than_requested_count(self):
        self.assertEqual(
            select_published_months(["2026-05", "2026-06"], 6),
            ["2026-05", "2026-06"],
        )

    def test_deduplicates_and_sorts_catalog_months(self):
        self.assertEqual(
            select_published_months(["2026-08", "2026-06", "2026-08", "2026-07"], 2),
            ["2026-07", "2026-08"],
        )


if __name__ == "__main__":
    unittest.main()
