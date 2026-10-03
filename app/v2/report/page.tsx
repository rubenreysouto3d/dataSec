import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getAreaProfile, getNeighbourhoods } from "@/lib/data";
import { locateAreaByCoordinates } from "@/lib/public-data-client";
import { readReportPoint } from "@/lib/location-report";
import { createPlaceEvidenceContext, placeEvidenceLabel, placeEvidenceExplanation, placeEvidenceSource } from "@/lib/place-evidence";
import { getCityMapMetrics, getCitySafetySignals } from "@/lib/data";
import LocationReport from "./LocationReport";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Informe de ubicación · dataSec",
  description: "Datos y contexto verificables para una ubicación concreta.",
  robots: { index: false, follow: false },
};

type Query = { lat?: string; lng?: string; place?: string; view?: string };

export default async function ReportPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const point = readReportPoint(query);
  if (!point) {
    return <main className="dv2-container drep-error">
      <h1>Necesitamos una ubicación.</h1>
      <p>Introduce una dirección en la portada y comprueba el resultado antes de generar el informe.</p>
      <Link href="/v2">Buscar una dirección →</Link>
    </main>;
  }
  try {
    // The client-provided coordinates are NOT trusted as belonging to any city.
    // PostGIS, not a submitted area ID, decides the associated official neighbourhood.
    const located = await locateAreaByCoordinates(point.latitude, point.longitude);
    if (!located) return <main className="dv2-container drep-error">
      <h1>Esta ubicación está fuera de cobertura.</h1>
      <p>Actualmente podemos contrastar ubicaciones dentro de las zonas almacenadas de Madrid y Londres.</p>
      <Link href="/v2">Buscar otro lugar →</Link>
    </main>;
    const area = await getAreaProfile(located.id);
    if (!area || area.citySlug !== located.citySlug) throw new Error("Missing source-linked area");
    const areas = await getNeighbourhoods(area.citySlug);
    const sameDistrict = areas
      .filter(a => a.id !== area.id && area.parentAreaId &&
        a.parentAreaId === area.parentAreaId)
      .sort((a,b) => a.name.localeCompare(b.name, "es"))
      .slice(0, 12);
    const ids = areas.map(a=>a.id);
    const metrics = await getCityMapMetrics(area.citySlug,ids);
    const signals = await getCitySafetySignals(area.citySlug,ids,metrics);
    const reader = createPlaceEvidenceContext(area.citySlug,metrics,signals);
    const evidence = reader.read(area.id,point.view);
    const alternatives = sameDistrict.map(a => ({
      id: a.id,
      name: a.name,
      period: reader.read(a.id,point.view).period,
      value: reader.read(a.id,point.view).value,
      available: reader.read(a.id,point.view).available,
    }));
    return <LocationReport
      point={point}
      area={area}
      evidence={evidence}
      indicator={placeEvidenceLabel(area.citySlug,point.view,reader.hasCityHarmSeries,"es")}
      explanation={placeEvidenceExplanation(area.citySlug,point.view,reader.hasCityHarmSeries,"es")}
      source={placeEvidenceSource(area.citySlug,"es")}
      alternatives={alternatives}
    />;
  } catch(error) {
    unstable_rethrow(error);
    console.error("Location report error",error);
    return <main className="dv2-container drep-error">
      <h1>No podemos completar este informe ahora.</h1>
      <p>No mostramos datos ficticios cuando falla una fuente o la consulta geográfica.</p>
      <Link href="/v2">Volver a la búsqueda →</Link>
    </main>;
  }
}
