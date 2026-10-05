import "server-only";

import {
  getAreaProfile,
  getCityCapabilities,
  getCityHarmTrends,
  getCityMapMetrics,
  getMonthlySummaries,
  getNeighbourhoods,
  getTemporalObservations,
  type CityCapability,
  type CityMapMetric,
  type CitySlug,
  type MonthlySummary,
  type TemporalObservation,
} from "@/lib/data";
import { locateAreaByCoordinates } from "@/lib/public-data-client";
import { getStreetContext, type StreetContext, type StreetSignal } from "@/lib/street-context";

import type {
  DomainEvidence,
  EvidenceConfidence,
  PlaceContext,
  PlaceFinding,
  PlaceLens,
} from "@/lib/place-context-contract";

const validLenses = new Set<PlaceLens>([
  "choosing_stay","arriving_late","around_me","tonight","living_here","living_with_family",
]);

export function parsePlaceLens(value:string|null|undefined):PlaceLens{
  return validLenses.has(value as PlaceLens)?value as PlaceLens:"around_me";
}

function sumSignal(context:StreetContext,signal:StreetSignal){
  if(context.availability!=="street")return {total:0,repeated:0,points:0};
  let total=0,repeated=0,points=0;
  for(const item of context.hotspots){
    const count=item.signals[signal]??0;
    if(count<=0)continue;
    total+=count;points+=1;
    if(item.repeated)repeated+=1;
  }
  return {total,repeated,points};
}

function temporalSummary(rows:TemporalObservation[]){
  const months=[...new Set(rows.map(row=>row.periodStart.slice(0,7)))].sort();
  const counts=new Map<number,number>();
  for(const row of rows){
    counts.set(row.hourStart,(counts.get(row.hourStart)??0)+row.value);
  }
  return {
    available:rows.length>0,
    months,
    byHour:Array.from({length:24},(_,hour)=>({hour,count:counts.get(hour)??0})),
  };
}

function confidenceForStreet(context:StreetContext):EvidenceConfidence{
  if(context.availability!=="street"){
    return {level:"limited",reasons:["La fuente no permite una lectura defendible a nivel de calle en este punto."]};
  }
  const reasons=[
    "Fuente policial oficial.",
    "Se usan varios meses publicados cuando están disponibles.",
    "Las ubicaciones están anonimizadas y son aproximadas.",
  ];
  if(context.partial)reasons.push("Falta al menos uno de los meses solicitados.");
  return {level:context.partial?"limited":"strong",reasons};
}

function makeStreetFindings(context:StreetContext,lens:PlaceLens):PlaceFinding[]{
  if(context.availability!=="street")return [];
  const findings:PlaceFinding[]=[];
  const period={start:context.months[0]??context.latestMonth,end:context.months.at(-1)??context.latestMonth};
  const geo={
    kind:"approximate_point" as const,
    label:"entorno peatonal aproximado",
    precisionNote:context.locationPrecision,
  };
  const confidence=confidenceForStreet(context);
  const theft=sumSignal(context,"theft");
  const disorder=sumSignal(context,"disorder");
  const drugs=sumSignal(context,"drugs");
  const violence=sumSignal(context,"violence");

  if(theft.repeated>0){
    findings.push({
      id:"street-theft-pattern",
      domain:"incidents",
      importance:lens==="around_me"||lens==="arriving_late"||lens==="tonight"?"attention":"notice",
      statement:"Hay focos repetidos de hurto o robo a personas publicados cerca de este punto.",
      implication:"Conviene prestar más atención a móvil, cartera, bolso y equipaje en el entorno.",
      observedPeriod:period,
      geography:geo,
      confidence,
      evidence:[{
        source:"uk-police-open-data",
        metric:"theft/robbery street signals",
        value:theft.total,
        unit:"registros en focos mostrados",
        note:`${theft.repeated} ubicaciones aproximadas aparecen en al menos dos meses.`,
      }],
      methodVersion:"place-context.street-pattern.v1",
    });
  }

  if(disorder.repeated>0){
    findings.push({
      id:"street-disorder-pattern",
      domain:"incidents",
      importance:"notice",
      statement:"También aparecen señales repetidas de desorden o conducta antisocial en el entorno.",
      observedPeriod:period,
      geography:geo,
      confidence,
      evidence:[{
        source:"uk-police-open-data",
        metric:"anti-social behaviour/public order",
        value:disorder.total,
        unit:"registros en focos mostrados",
        note:`${disorder.repeated} ubicaciones aproximadas aparecen en al menos dos meses.`,
      }],
      methodVersion:"place-context.street-pattern.v1",
    });
  }

  if(drugs.repeated>0){
    findings.push({
      id:"street-drugs-pattern",
      domain:"incidents",
      importance:"notice",
      statement:"La fuente policial también registra actividad relacionada con drogas de forma repetida cerca.",
      observedPeriod:period,
      geography:geo,
      confidence,
      evidence:[{
        source:"uk-police-open-data",
        metric:"drugs",
        value:drugs.total,
        unit:"registros en focos mostrados",
        note:`${drugs.repeated} ubicaciones aproximadas aparecen en al menos dos meses.`,
      }],
      methodVersion:"place-context.street-pattern.v1",
    });
  }

  if(violence.repeated>0){
    findings.push({
      id:"street-violence-pattern",
      domain:"incidents",
      importance:"notice",
      statement:"Hay registros repetidos de violencia en varios puntos aproximados del entorno.",
      observedPeriod:period,
      geography:geo,
      confidence,
      evidence:[{
        source:"uk-police-open-data",
        metric:"violence",
        value:violence.total,
        unit:"registros en focos mostrados",
        note:`${violence.repeated} ubicaciones aproximadas aparecen en al menos dos meses.`,
      }],
      methodVersion:"place-context.street-pattern.v1",
    });
  }

  return findings;
}

function makeTemporalFinding(
  rows:TemporalObservation[],
  areaName:string,
  lens:PlaceLens,
):PlaceFinding|null{
  if(!rows.length||!(lens==="tonight"||lens==="arriving_late"||lens==="living_here"||lens==="living_with_family"))return null;
  const hourly=temporalSummary(rows);
  const total=hourly.byHour.reduce((sum,item)=>sum+item.count,0);
  if(total<=0)return null;
  const late=hourly.byHour
    .filter(item=>item.hour>=22||item.hour<6)
    .reduce((sum,item)=>sum+item.count,0);
  const share=late/total;
  const latest=hourly.months.at(-1)??null;
  return {
    id:"madrid-after-dark-share",
    domain:"after_dark",
    importance:"info",
    statement:`Una parte ${share>=.35?"importante":share>=.2?"apreciable":"minoritaria"} de las incidencias seleccionadas de este barrio se crea entre las 22:00 y las 06:00.`,
    implication:"Es contexto horario del barrio, no una predicción sobre una calle ni sobre lo que ocurrirá esta noche.",
    observedPeriod:{start:hourly.months[0]??null,end:latest},
    geography:{kind:"neighbourhood",label:areaName},
    confidence:{
      level:"limited",
      reasons:[
        "La hora procede de la creación de la incidencia en la fuente municipal.",
        "La geografía publicada es el barrio, no la calle.",
        "Las incidencias de Policía Municipal son más amplias que delitos acreditados.",
      ],
    },
    evidence:[{
      source:"madrid-police-dispatch-incidents",
      metric:"selected safety-related dispatches by creation hour",
      value:Number((share*100).toFixed(1)),
      unit:"% entre 22:00 y 06:00",
    }],
    methodVersion:"place-context.after-dark.v1",
  };
}

function makeTrendFinding(
  city:CitySlug,
  areaName:string,
  trend:{
    monthStart:string;monthEnd:string;previousAverageMonthly:number;
    recentAverageMonthly:number;percentChange:number|null;
  }|null,
):PlaceFinding|null{
  if(!trend||trend.percentChange===null||trend.previousAverageMonthly<2)return null;
  if(Math.abs(trend.percentChange)<20)return null;
  const rising=trend.percentChange>0;
  return {
    id:"area-recent-change",
    domain:"incidents",
    importance:"info",
    statement:rising
      ?"La señal registrada que seguimos en esta zona ha aumentado frente a los tres meses anteriores."
      :"La señal registrada que seguimos en esta zona ha bajado frente a los tres meses anteriores.",
    implication:"Es una comparación temporal de la misma fuente; no implica por sí sola que el lugar sea seguro o peligroso.",
    observedPeriod:{start:trend.monthStart,end:trend.monthEnd},
    geography:{kind:"neighbourhood",label:areaName},
    confidence:{
      level:"limited",
      reasons:[
        "La comparación usa la misma familia de datos en dos ventanas consecutivas.",
        city==="madrid"
          ?"La fuente son incidencias de central de Policía Municipal, no delitos acreditados."
          :"La fuente son delitos registrados; la propensión a denunciar puede variar.",
      ],
    },
    evidence:[{
      source:city==="madrid"?"madrid-police-dispatch-incidents":"uk-police-open-data",
      metric:city==="madrid"?"selected personal-harm dispatches":"selected violence/property recorded crime",
      value:Number(trend.percentChange.toFixed(1)),
      unit:"% cambio de media mensual",
    }],
    methodVersion:"place-context.recent-change.v1",
  };
}

function capabilityStatus(capabilities:CityCapability[],domain:string,operation:string){
  return capabilities.find(item=>item.domain===domain&&item.operation===operation)??null;
}

export async function buildPlaceContext(args:{
  latitude:number;
  longitude:number;
  label?:string;
  lens?:PlaceLens;
}):Promise<PlaceContext|null>{
  const lens=args.lens??"around_me";
  const covered=await locateAreaByCoordinates(args.latitude,args.longitude);
  if(!covered)return null;

  const city=covered.citySlug;
  const [profile,areas,capabilities,monthly,street]=await Promise.all([
    getAreaProfile(covered.id),
    getNeighbourhoods(city),
    getCityCapabilities(city),
    getMonthlySummaries(covered.id,6),
    getStreetContext(args.latitude,args.longitude).catch(()=>({availability:"unsupported",hotspots:[]} as StreetContext)),
  ]);
  if(!profile)return null;

  const ids=areas.map(area=>area.id);
  const metrics=await getCityMapMetrics(city,ids);
  const areaMetric=metrics.find(item=>item.areaId===covered.id)??null;
  const trends=await getCityHarmTrends(city,ids,metrics);
  const areaTrend=trends?.areas.find(item=>item.areaId===covered.id)??null;

  const timeCapability=capabilityStatus(capabilities,"incidents","time-of-day");
  let temporalRows:TemporalObservation[]=[];
  if(city==="madrid"&&(timeCapability?.available||timeCapability?.status==="pipeline_ready")){
    temporalRows=await getTemporalObservations(covered.id,{months:3}).catch(()=>[]);
  }
  const temporal=temporalSummary(temporalRows);

  const findings:PlaceFinding[]=[
    ...makeStreetFindings(street,lens),
  ];
  const temporalFinding=makeTemporalFinding(temporalRows,profile.name,lens);
  if(temporalFinding)findings.push(temporalFinding);
  const trendFinding=makeTrendFinding(city,profile.name,areaTrend);
  if(trendFinding)findings.push(trendFinding);

  if(street.availability==="area-only"){
    findings.push({
      id:"street-precision-unavailable",
      domain:"coverage",
      importance:"info",
      statement:"En este punto no hay una fuente defendible para señalar calles conflictivas.",
      implication:"Las incidencias disponibles se interpretan a escala de barrio; DataSec no inventa precisión de calle.",
      observedPeriod:{start:areaMetric?.month??null,end:areaMetric?.month??null},
      geography:{kind:"neighbourhood",label:profile.name},
      confidence:{level:"strong",reasons:["La limitación procede de la granularidad declarada por la fuente oficial."]},
      evidence:[{
        source:profile.sourceSlug,
        note:profile.sourceGranularity??"Granularidad no especificada",
      }],
      methodVersion:"place-context.coverage.v1",
    });
  }

  const lensOrder:Record<PlaceLens,PlaceFinding["domain"][]> = {
    choosing_stay:["incidents","after_dark","mobility","daily_life","coverage"],
    arriving_late:["after_dark","mobility","incidents","coverage","daily_life"],
    around_me:["incidents","mobility","daily_life","coverage","after_dark"],
    tonight:["after_dark","incidents","mobility","coverage","daily_life"],
    living_here:["mobility","daily_life","after_dark","incidents","coverage"],
    living_with_family:["daily_life","mobility","after_dark","incidents","coverage"],
  };
  const order=lensOrder[lens];
  findings.sort((a,b)=>{
    const importance={ "official-alert":0, attention:1, notice:2, info:3 };
    return importance[a.importance]-importance[b.importance]||
      order.indexOf(a.domain)-order.indexOf(b.domain);
  });

  const latestMonthlySummary=monthly[0]??null;
  const streetCapability=capabilityStatus(capabilities,"incidents","street");

  const domains:DomainEvidence[]=[
    {
      id:"incidents",
      label:"Incidencias y delitos registrados",
      status:"observed",
      summary:street.availability==="street"
        ?"Hay evidencia de barrio y puntos policiales aproximados en el entorno."
        :"La evidencia disponible se limita a la geografía administrativa publicada.",
      sourceSlugs:streetCapability?.sourceSlugs??[profile.sourceSlug],
    },
    {
      id:"after_dark",
      label:"Después de anochecer",
      status:temporal.available?"observed":timeCapability?.status==="research"?"research":"not_available",
      summary:temporal.available
        ?"La fuente disponible conserva distribución por hora a nivel de barrio."
        :timeCapability?.status==="pipeline_ready"
          ?"La fuente contiene hora, pero el histórico aún no está publicado en el nuevo modelo."
          :"No hay evidencia horaria integrada para esta ciudad.",
      sourceSlugs:timeCapability?.sourceSlugs??[],
    },
    {
      id:"mobility",
      label:"Movilidad",
      status:capabilityStatus(capabilities,"transport","live")?.available?"observed":"research",
      summary:capabilityStatus(capabilities,"transport","live")?.available
        ?"Hay datos de transporte integrados."
        :"La movilidad oficial todavía no forma parte del contexto de lugar.",
      sourceSlugs:capabilityStatus(capabilities,"transport","live")?.sourceSlugs??[],
    },
  ];

  const limitations:string[]=[];
  if(street.availability!=="street")limitations.push("Sin evidencia de incidentes a nivel de calle.");
  if(!temporal.available)limitations.push("Sin patrón horario publicado en el nuevo modelo.");
  if(!capabilityStatus(capabilities,"transport","live")?.available)limitations.push("Sin transporte oficial integrado todavía.");

  return {
    place:{
      label:args.label?.trim().slice(0,170)||profile.name,
      coordinate:{latitude:args.latitude,longitude:args.longitude},
      city,
      area:{
        id:profile.id,
        name:profile.name,
        parentName:profile.parentName,
        areaType:profile.areaType,
      },
    },
    lens,
    capabilities,
    findings:findings.slice(0,5),
    domains,
    evidence:{
      latestMonthlySummary,
      areaMetric,
      temporal,
      street,
    },
    coverage:{
      street:street.availability==="street"?"available":street.availability==="area-only"?"area_only":"unsupported",
      timeOfDay:temporal.available?"available":timeCapability?.status==="pipeline_ready"?"pipeline_ready":"unavailable",
      limitations,
    },
  };
}
