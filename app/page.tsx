import {
  areaDisplayName,
  getCityHarmTrends,
  getCityMapMetrics,
  getCitySnapshot,
  getNeighbourhoods,
  monthLabel,
  type CitySlug,
} from "@/lib/data";
import { dataHealth } from "@/lib/generated-health";
import { localeFromValue, localeTag, tr } from "@/lib/i18n";
import HomeGateway from "./HomeGateway";
import "./home-gateway.css";

type PulseRow = { areaId:string; name:string; deltaRate:number };
type CityPulse = {
  slug:CitySlug;
  count:number;
  period:string|null;
  rising:PulseRow[];
  falling:PulseRow[];
  comparable:boolean;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);
  let pulses:CityPulse[]=[];
  let available=true;

  try {
    const allAreas=await getNeighbourhoods();
    pulses=await Promise.all((["madrid","london"] as CitySlug[]).map(async slug=>{
      const areas=allAreas.filter(area=>area.citySlug===slug);
      const ids=areas.map(area=>area.id);
      const [snapshot,metrics]=await Promise.all([
        getCitySnapshot(slug,ids),
        getCityMapMetrics(slug,ids),
      ]);
      const trends=await getCityHarmTrends(slug,ids,metrics);
      const names=new Map(areas.map(area=>[area.id,areaDisplayName(area)]));
      const comparableRows=(trends?.areas??[]).filter(row=>
        row.previousAverageMonthly>0 &&
        row.deltaRatePer10k!==null &&
        Number.isFinite(row.deltaRatePer10k)
      );
      const rising=[...comparableRows]
        .filter(row=>(row.deltaRatePer10k??0)>0.25)
        .sort((a,b)=>(b.deltaRatePer10k??0)-(a.deltaRatePer10k??0))
        .slice(0,3)
        .map(row=>({areaId:row.areaId,name:names.get(row.areaId)??row.areaId,deltaRate:row.deltaRatePer10k??0}));
      const falling=[...comparableRows]
        .filter(row=>(row.deltaRatePer10k??0)<-0.25)
        .sort((a,b)=>(a.deltaRatePer10k??0)-(b.deltaRatePer10k??0))
        .slice(0,3)
        .map(row=>({areaId:row.areaId,name:names.get(row.areaId)??row.areaId,deltaRate:row.deltaRatePer10k??0}));
      return {
        slug,
        count:areas.length,
        period:snapshot?monthLabel(snapshot.month,locale):null,
        rising,
        falling,
        comparable:comparableRows.length>0,
      };
    }));
  } catch (caught) {
    if (process.env.GITHUB_PAGES !== "true") throw caught;
    available=false;
  }

  const checkedLabel = dataHealth.checkedAt
    ? new Intl.DateTimeFormat(localeTag(locale), { day:"numeric",month:"short",year:"numeric" }).format(new Date(dataHealth.checkedAt))
    : tr(locale, "pending", "pendiente");

  return <HomeGateway locale={locale} pulses={pulses} checkedLabel={checkedLabel} available={available}/>;
}
