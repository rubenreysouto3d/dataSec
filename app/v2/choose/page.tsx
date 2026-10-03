import type { Metadata } from "next";
import { getAreaProfile, getCityMapMetrics, getCitySafetySignals, getNeighbourhoods, type CitySlug } from "@/lib/data";
import { locateAreaByCoordinates } from "@/lib/public-data-client";
import { createPlaceEvidenceContext, placeEvidenceExplanation, placeEvidenceLabel, placeEvidenceSource } from "@/lib/place-evidence";
import { comparisonKind, readChoicePoint, sameExactPoint, type ChoiceSite } from "@/lib/address-choice";
import ChoiceClient from "./ChoiceClient";
import "./choose.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title:"Compara dos ubicaciones · dataSec",
  description:"Compara dos direcciones con datos comprobables de su zona y servicios cercanos.",
  robots:{index:false,follow:false},
};
type Q = Record<string,string|undefined>;
type Props = { searchParams:Promise<Q> };

export default async function ChoosePage({searchParams}:Props) {
  const query=await searchParams;
  const purpose=query.view==="resident"?"resident":"visitor";
  const first=readChoicePoint(query,"a",purpose);
  const second=readChoicePoint(query,"b",purpose);
  let sites: [ChoiceSite,ChoiceSite]|null=null;
  let failure="";
  if(first&&second) {
    if(sameExactPoint(first,second)) failure="Has seleccionado prácticamente el mismo punto dos veces.";
    else try {
      // Never trust claimed neighbourhoods, derive official area from stored PostGIS geometry.
      const matches=await Promise.all([first,second].map(p=>locateAreaByCoordinates(p.latitude,p.longitude)));
      if(matches.some(x=>!x)) failure="Una dirección está fuera de las ciudades con datos operativos.";
      else {
        const profiles=await Promise.all(matches.map(x=>getAreaProfile(x!.id)));
        if(profiles.some(x=>!x)) failure="No se ha encontrado la zona oficial de uno de los puntos.";
        else {
          const cities=[...new Set(profiles.map(x=>x!.citySlug))];
          // Load each city's full evidence context exactly once so that both points
          // receive the same city-wide indicator-selection decision.
          const contexts=await Promise.all(cities.map(async city=>{
            const areas=await getNeighbourhoods(city as CitySlug);
            const metrics=await getCityMapMetrics(city as CitySlug,areas.map(a=>a.id));
            const signals=await getCitySafetySignals(city as CitySlug,areas.map(a=>a.id),metrics);
            return [city,createPlaceEvidenceContext(city as CitySlug,metrics,signals)] as const;
          }));
          const readers=new Map(contexts);
          const items=profiles.map((area,i)=>{
            const reader=readers.get(area!.citySlug)!;
            return {
              point:[first,second][i],area:area!,
              evidence:reader.read(area!.id,purpose),
              indicator:placeEvidenceLabel(area!.citySlug,purpose,reader.hasCityHarmSeries,"es"),
              explanation:placeEvidenceExplanation(area!.citySlug,purpose,reader.hasCityHarmSeries,"es"),
              source:placeEvidenceSource(area!.citySlug,"es"),
            } satisfies ChoiceSite;
          });
          sites=items as [ChoiceSite,ChoiceSite];
        }
      }
    }catch(e) {
      console.error("Address comparison unavailable",e);
      failure="No podemos contrastar ahora los registros de las dos direcciones. Inténtalo más tarde.";
    }
  }
  return <ChoiceClient initialFirst={first} initialSecond={second} purpose={purpose}
    sites={sites} comparison={sites?comparisonKind(...sites):null} error={failure}/>;
}
