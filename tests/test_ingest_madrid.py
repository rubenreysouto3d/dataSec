import io
import unittest
import urllib.error
from unittest.mock import patch

from scripts.ingest_madrid import (
    build_area_index,
    fetch_json,
    geojson_geometry_polygons,
    match_incident_area,
    metric_slug,
    normalize_name,
    parse_resource_month,
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


class MadridHttpTests(unittest.TestCase):
    def test_ckan_403_uses_node_fallback(self):
        url = "https://datos.madrid.es/api/3/action/package_show?id=test"
        error = urllib.error.HTTPError(
            url,
            403,
            "Forbidden",
            {},
            io.BytesIO(b"blocked"),
        )
        expected = ({"success": True}, b'{"success":true}')
        with patch("scripts.ingest_madrid.urllib.request.urlopen", side_effect=error):
            with patch("scripts.ingest_madrid.fetch_json_via_node", return_value=expected) as fallback:
                self.assertEqual(fetch_json(url), expected)
        fallback.assert_called_once_with(url, timeout=120)

    def test_non_ckan_http_error_fails_closed(self):
        url = "https://example.com/test"
        error = urllib.error.HTTPError(
            url,
            403,
            "Forbidden",
            {},
            io.BytesIO(b"blocked"),
        )
        with patch("scripts.ingest_madrid.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(RuntimeError):
                fetch_json(url)


class MadridGeoJsonTests(unittest.TestCase):
    def test_polygon_geometry_is_converted_to_shared_shape(self):
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [-3.71, 40.40],
                [-3.70, 40.40],
                [-3.70, 40.41],
                [-3.71, 40.40],
            ]],
        }
        polygons = geojson_geometry_polygons(geometry)
        self.assertEqual(len(polygons), 1)
        self.assertEqual(polygons[0]["holes"], [])
        self.assertEqual(polygons[0]["outer"][0], polygons[0]["outer"][-1])

    def test_multipolygon_geometry_is_supported(self):
        ring = [
            [-3.71, 40.40],
            [-3.70, 40.40],
            [-3.70, 40.41],
            [-3.71, 40.40],
        ]
        polygons = geojson_geometry_polygons({
            "type": "MultiPolygon",
            "coordinates": [[ring], [ring]],
        })
        self.assertEqual(len(polygons), 2)

    def test_implausible_coordinates_fail_closed(self):
        with self.assertRaises(RuntimeError):
            geojson_geometry_polygons({
                "type": "Polygon",
                "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]],
            })


if __name__ == "__main__":
    unittest.main()
