import io
import unittest
from unittest.mock import MagicMock, patch
import zipfile

from scripts.backfill_london import shift_month

from scripts.ingest_london import (
    SupabaseRest,
    github_oidc_token,
    build_grid,
    locate_area,
    multipolygon_wkt,
    parse_boundary_archive,
    persist,
    point_in_ring,
    slugify,
)


class SpatialTests(unittest.TestCase):
    def setUp(self):
        self.square = [
            (-0.20, 51.49),
            (-0.10, 51.49),
            (-0.10, 51.55),
            (-0.20, 51.55),
            (-0.20, 51.49),
        ]
        self.hole = [
            (-0.16, 51.51),
            (-0.14, 51.51),
            (-0.14, 51.53),
            (-0.16, 51.53),
            (-0.16, 51.51),
        ]

    def test_point_inside_polygon(self):
        self.assertTrue(point_in_ring(-0.15, 51.52, self.square))

    def test_point_outside_polygon(self):
        self.assertFalse(point_in_ring(-0.25, 51.52, self.square))

    def test_point_on_edge_is_included(self):
        self.assertTrue(point_in_ring(-0.20, 51.52, self.square))

    def test_grid_locates_area(self):
        areas = [{
            "source_area_id": "TEST",
            "name": "Test area",
            "polygons": [{"outer": self.square, "holes": []}],
            "bbox": (-0.20, 51.49, -0.10, 51.55),
        }]
        grid = build_grid(areas)
        self.assertEqual(locate_area(-0.15, 51.50, areas, grid), "TEST")
        self.assertIsNone(locate_area(-0.25, 51.52, areas, grid))

    def test_hole_is_excluded(self):
        areas = [{
            "source_area_id": "TEST",
            "name": "Test area",
            "polygons": [{"outer": self.square, "holes": [self.hole]}],
            "bbox": (-0.20, 51.49, -0.10, 51.55),
        }]
        grid = build_grid(areas)
        self.assertEqual(locate_area(-0.18, 51.52, areas, grid), "TEST")
        self.assertIsNone(locate_area(-0.15, 51.52, areas, grid))

    def test_slugify(self):
        self.assertEqual(slugify("St. John's & Área"), "st-john-s-area")

    def test_multipolygon_wkt_with_hole(self):
        wkt = multipolygon_wkt([{"outer": self.square, "holes": [self.hole]}])
        self.assertTrue(wkt.startswith("MULTIPOLYGON((("))
        self.assertIn("), (", wkt)
        self.assertTrue(wkt.endswith("))"))

    def test_monthly_boundary_archive_parser(self):
        kml = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>TEST</name>
      <description>Test Neighbourhood</description>
      <MultiGeometry>
        <Polygon>
          <outerBoundaryIs><LinearRing><coordinates>
            -0.20,51.49,0 -0.10,51.49,0 -0.10,51.55,0 -0.20,51.55,0 -0.20,51.49,0
          </coordinates></LinearRing></outerBoundaryIs>
          <innerBoundaryIs><LinearRing><coordinates>
            -0.16,51.51,0 -0.14,51.51,0 -0.14,51.53,0 -0.16,51.53,0 -0.16,51.51,0
          </coordinates></LinearRing></innerBoundaryIs>
        </Polygon>
      </MultiGeometry>
    </Placemark>
  </Document>
</kml>"""
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("2026-07/metropolitan/TEST.kml", kml)

        areas = parse_boundary_archive(buffer.getvalue(), "2026-07")
        self.assertEqual(len(areas), 1)
        self.assertEqual(areas[0]["source_area_id"], "TEST")
        self.assertEqual(areas[0]["name"], "Test Neighbourhood")
        polygons = areas[0]["polygons"]
        self.assertEqual(len(polygons), 1)
        self.assertEqual(len(polygons[0]["holes"]), 1)


class SupabaseAuthTests(unittest.TestCase):
    def test_secret_key_uses_apikey_without_bearer(self):
        client = SupabaseRest("https://example.supabase.co", "sb_secret_test")
        with patch("scripts.ingest_london.urllib.request.urlopen") as urlopen:
            response = urlopen.return_value.__enter__.return_value
            response.read.return_value = b"[]"
            client.request("areas")
        request = urlopen.call_args.args[0]
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(headers["apikey"], "sb_secret_test")
        self.assertNotIn("authorization", headers)

    def test_legacy_service_role_keeps_bearer_header(self):
        client = SupabaseRest("https://example.supabase.co", "legacy-jwt")
        with patch("scripts.ingest_london.urllib.request.urlopen") as urlopen:
            response = urlopen.return_value.__enter__.return_value
            response.read.return_value = b"[]"
            client.request("areas")
        request = urlopen.call_args.args[0]
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(headers["authorization"], "Bearer legacy-jwt")


class GitHubOidcTests(unittest.TestCase):
    @patch.dict(
        "scripts.ingest_london.os.environ",
        {
            "ACTIONS_ID_TOKEN_REQUEST_URL": "https://oidc.example/token?foo=bar",
            "ACTIONS_ID_TOKEN_REQUEST_TOKEN": "request-token",
        },
        clear=True,
    )
    @patch("scripts.ingest_london.urllib.request.urlopen")
    def test_github_oidc_token_is_requested_lazily(self, urlopen):
        response = urlopen.return_value.__enter__.return_value
        response.read.return_value = b'{"value":"short-lived-token"}'

        self.assertEqual(github_oidc_token(), "short-lived-token")
        request = urlopen.call_args.args[0]
        self.assertIn("audience=datasec-supabase-ingest", request.full_url)
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(headers["authorization"], "Bearer request-token")


class PersistenceGateTests(unittest.TestCase):
    @patch.dict(
        "scripts.ingest_london.os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SECRET_KEY": "sb_secret_test",
        },
        clear=False,
    )
    @patch("scripts.ingest_london.SupabaseRest")
    def test_high_unmatched_ratio_never_publishes_product_rows(self, client_class):
        client = MagicMock()
        client_class.return_value = client

        with self.assertRaisesRegex(RuntimeError, "exceeds 5% quality gate"):
            persist(
                "2026-07",
                [{} for _ in range(10)],
                [],
                {},
                {},
                1,
                "crime-checksum",
                "boundary-checksum",
            )

        written_tables = [call.args[0] for call in client.upsert.call_args_list]
        self.assertNotIn("metrics", written_tables)
        self.assertNotIn("areas", written_tables)
        self.assertNotIn("area_boundaries", written_tables)
        self.assertNotIn("observations", written_tables)
        client.stage.assert_not_called()

        quality_calls = [
            call
            for call in client.request.call_args_list
            if call.args and call.args[0] == "data_quality_flags"
        ]
        self.assertEqual(len(quality_calls), 1)


class TransactionalPublicationTests(unittest.TestCase):
    @patch.dict(
        "scripts.ingest_london.os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SECRET_KEY": "sb_secret_test",
        },
        clear=False,
    )
    @patch("scripts.ingest_london.SupabaseRest")
    def test_successful_publish_stages_then_calls_single_rpc(self, client_class):
        client = MagicMock()
        client_class.return_value = client
        square = [
            (-0.20, 51.49),
            (-0.10, 51.49),
            (-0.10, 51.55),
            (-0.20, 51.55),
            (-0.20, 51.49),
        ]

        persist(
            "2026-07",
            [{}],
            [{
                "source_area_id": "TEST",
                "name": "Test area",
                "polygons": [{"outer": square, "holes": []}],
            }],
            {("TEST", "theft"): 1},
            {"Theft": "theft"},
            0,
            "crime-checksum",
            "boundary-checksum",
        )

        staged_types = [call.args[1] for call in client.stage.call_args_list]
        self.assertCountEqual(staged_types, ["metric", "area", "boundary", "observation"])

        written_tables = [call.args[0] for call in client.upsert.call_args_list]
        for table in ("metrics", "areas", "area_boundaries", "observations"):
            self.assertNotIn(table, written_tables)

        publish_calls = [
            call
            for call in client.request.call_args_list
            if call.args and call.args[0] == "rpc/publish_ingestion_run"
        ]
        self.assertEqual(len(publish_calls), 1)
        self.assertIn("p_run_id", publish_calls[0].kwargs["payload"])


class BackfillTests(unittest.TestCase):
    def test_shift_month_within_year(self):
        self.assertEqual(shift_month("2026-07", -5), "2026-02")

    def test_shift_month_across_year(self):
        self.assertEqual(shift_month("2026-01", -1), "2025-12")


if __name__ == "__main__":
    unittest.main()
