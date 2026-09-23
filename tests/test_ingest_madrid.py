import unittest

from scripts.ingest_madrid import (
    build_area_index,
    decode_topology_arc,
    geometry_polygons,
    match_incident_area,
    metric_slug,
    normalize_name,
    parse_resource_month,
    stitch_ring,
)


class MadridSourceTests(unittest.TestCase):
    def test_parse_spanish_resource_month(self):
        resource = {"name": "Incidencias agosto 2026", "description": ""}
        self.assertEqual(parse_resource_month(resource), "2026-08")

    def test_name_normalization_handles_accents_and_punctuation(self):
        self.assertEqual(normalize_name("Fuencarral - El Pardo"), "FUENCARRAL EL PARDO")
        self.assertEqual(normalize_name("Los Ángeles"), "LOS ANGELES")

    def test_area_match_accepts_missing_leading_article(self):
        areas = [{
            "COD_BAR": "171",
            "NOMDIS": "Villaverde",
            "NOMBRE": "Los Ángeles",
            "BARRIO_MAY": "LOS ANGELES",
            "BARRIO_MT": "LOS ANGELES",
        }]
        index, _ = build_area_index(areas)
        row = {"Distrito": "VILLAVERDE", "Barrio": "ANGELES"}
        self.assertEqual(match_incident_area(row, index)["COD_BAR"], "171")

    def test_metric_slugs_are_namespaced(self):
        self.assertEqual(
            metric_slug("RUIDOS MOLESTOS"),
            "madrid-dispatch-ruidos-molestos",
        )


class MadridTopologyTests(unittest.TestCase):
    def setUp(self):
        self.topology = {
            "type": "Topology",
            "transform": {
                "scale": [0.1, 0.1],
                "translate": [-4.0, 40.0],
            },
            "arcs": [
                [[0, 0], [10, 0], [0, 10]],
                [[10, 10], [-10, 0], [0, -10]],
            ],
        }

    def test_decode_arc_applies_delta_and_transform(self):
        decoded = decode_topology_arc(
            [[0, 0], [10, 0], [0, 10]],
            [0.1, 0.1],
            [-4.0, 40.0],
        )
        self.assertEqual(decoded, [(-4.0, 40.0), (-3.0, 40.0), (-3.0, 41.0)])

    def test_negative_arc_reverses_source_arc(self):
        ring = stitch_ring(self.topology, [0, -2])
        self.assertEqual(ring[0], (-4.0, 40.0))
        self.assertEqual(ring[-1], ring[0])
        self.assertGreaterEqual(len(ring), 4)

    def test_polygon_geometry_is_converted_to_shared_shape(self):
        geometry = {"type": "Polygon", "arcs": [[0, -2]], "properties": {"COD_BAR": "011"}}
        polygons = geometry_polygons(self.topology, geometry)
        self.assertEqual(len(polygons), 1)
        self.assertEqual(polygons[0]["holes"], [])
        self.assertEqual(polygons[0]["outer"][0], polygons[0]["outer"][-1])


if __name__ == "__main__":
    unittest.main()
