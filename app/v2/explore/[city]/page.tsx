import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import {
  getCityActivityContexts,
  getCityHarmTrends,
  getCityMapMetrics,
  getCitySafetySignals,
  getNeighbourhoods,
  type CitySlug,
} from "@/lib/data";
import { locateAreaByCoordinates } from "@/lib/public-data-client";
import { buildPlaceContext, parsePlaceLens } from "@/lib/place-context";
import type { PlaceContext } from "@/lib/place-context-contract";
import V2Research from "./V2Research";

export const dynamic = "force-dynamic";

export default async function V2Explore({params,searchParams}:{
  params: Promise<{city:string}>;
  searchParams: Promise<{view?:string;lens?:string;area?:string;lat?:string;lng?:string;place?:string}>;
}) {
  const [{city},query]=await Promise.all([params,searchParams]);
  if(city!=="madrid"&&city!=="london")notFound();
  const slug=city as CitySlug;

  let areas: Awaited<ReturnType<typeof getNeighbourhoods>>=[];
  let metrics: Awaited<ReturnType<typeof getCityMapMetrics>>=[];
  let signals: Awaited<ReturnType<typeof getCitySafetySignals>>=[];
  let activityContexts: Awaited<ReturnType<typeof getCityActivityContexts>>=[];
  let harmTrends: Awaited<ReturnType<typeof getCityHarmTrends>>=null;
  let initialId:string|null=null;
  let initialPoint:{latitude:number;longitude:number;label:string}|null=null;
  let initialPlaceContext:PlaceContext|null=null;

  try{
    areas=await getNeighbourhoods(slug);
    const ids=areas.map(a=>a.id);
    const cityMetrics=await getCityMapMetrics(slug,ids);
    const [citySignals,cityActivity,cityTrends]=await Promise.all([
      getCitySafetySignals(slug,ids,cityMetrics),
      getCityActivityContexts(ids),
      getCityHarmTrends(slug,ids,cityMetrics),
    ]);
    metrics=cityMetrics;
    signals=citySignals;
    activityContexts=cityActivity;
    harmTrends=cityTrends;

    initialId=areas.some(a=>a.id===query.area)?query.area||null:null;

    const latitude=Number(query.lat);
    const longitude=Number(query.lng);
    if(Number.isFinite(latitude)&&Number.isFinite(longitude)&&query.place){
      const located=await locateAreaByCoordinates(latitude,longitude);
      if(located&&located.citySlug===slug&&areas.some(a=>a.id===located.id)){
        initialId=located.id;
        initialPoint={latitude,longitude,label:query.place.trim().slice(0,170)};
        const initialLens=query.lens
          ?parsePlaceLens(query.lens)
          :query.view==="resident"?"living_here":"around_me";
        initialPlaceContext=await buildPlaceContext({
          latitude,
          longitude,
          label:initialPoint.label,
          lens:initialLens,
        });
      }
    }
  } catch(error) {
    unstable_rethrow(error);
    return <main className="dv2-container dv2-service-error"><h1>Datos temporalmente inaccesibles.</h1>
      <p>Este entorno no sustituye los registros oficiales por cifras de demostración.</p>
      <Link href="/v2">Volver al mapa</Link></main>;
  }

  return <V2Research
    city={slug}
    areas={areas}
    metrics={metrics}
    signals={signals}
    activityContexts={activityContexts}
    harmTrends={harmTrends}
    initialId={initialId}
    initialPoint={initialPoint}
    initialPlaceContext={initialPlaceContext}
    initialPurpose={query.view==="resident"?"resident":"visitor"}
    initialLens={query.lens
      ?parsePlaceLens(query.lens)
      :query.view==="resident"?"living_here":"around_me"}
  />;
}
