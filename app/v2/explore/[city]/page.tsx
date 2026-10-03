import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { getCityBoundaries, getCityMapMetrics, getCitySafetySignals, getNeighbourhoods, type CitySlug } from "@/lib/data";
import V2Research from "./V2Research";

export const dynamic = "force-dynamic";

export default async function V2Explore({params,searchParams}:{
  params: Promise<{city:string}>;
  searchParams: Promise<{view?:string;area?:string}>;
}) {
  const [{city},query]=await Promise.all([params,searchParams]);
  if(city!=="madrid"&&city!=="london")notFound();
  const slug=city as CitySlug;
  let areas: Awaited<ReturnType<typeof getNeighbourhoods>>=[];
  let boundaries: Awaited<ReturnType<typeof getCityBoundaries>>=[];
  let metrics: Awaited<ReturnType<typeof getCityMapMetrics>>=[];
  let signals: Awaited<ReturnType<typeof getCitySafetySignals>>=[];
  try{
    areas=await getNeighbourhoods(slug);
    const ids=areas.map(a=>a.id);
    [boundaries,metrics]=await Promise.all([getCityBoundaries(ids),getCityMapMetrics(slug,ids)]);
    signals=await getCitySafetySignals(slug,ids,metrics);
  } catch(error) {
    unstable_rethrow(error);
    return <main className="dv2-container dv2-service-error"><h1>Datos temporalmente inaccesibles.</h1>
      <p>Este entorno no sustituye los registros oficiales por cifras de demostración.</p>
      <Link href="/v2">Volver al inicio</Link></main>;
  }
  return <V2Research city={slug} areas={areas} boundaries={boundaries} metrics={metrics}
    signals={signals} initialId={areas.some(a=>a.id===query.area)?query.area||null:null}
    initialPurpose={query.view==="resident"?"resident":"visitor"}/>;
}
