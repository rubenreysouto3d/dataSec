import unittest

from scripts.ingest_london import build_grid, locate_area, point_in_ring, polygon_wkt, slugify


class SpatialTests(unittest.TestCase):
    def setUp(self):
        self.square = [
            (-0.20, 51.49),
            (-0.10, 51.49),
            (-0.10, 51.55),
            (-0.20, 51.55),
            (-0.20, 51.49),
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
            "ring": self.square,
            "bbox": (-0.20, 51.49, -0.10, 51.55),
        }]
        grid = build_grid(areas)
        self.assertEqual(locate_area(-0.15, 51.52, areas, grid), "TEST")
        self.assertIsNone(locate_area(-0.25, 51.52, areas, grid))

    def test_slugify(self):
        self.assertEqual(slugify("St. John's & Área"), "st-john-s-area")

    def test_polygon_wkt_is_multipolygon(self):
        wkt = polygon_wkt(self.square)
        self.assertTrue(wkt.startswith("MULTIPOLYGON((("))
        self.assertTrue(wkt.endswith(")))"))


if __name__ == "__main__":
    unittest.main()
