import io
import unittest
import zipfile

from scripts.ingest_london import (
    build_grid,
    locate_area,
    multipolygon_wkt,
    parse_boundary_archive,
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


if __name__ == "__main__":
    unittest.main()
