import { buildPlaceContext, parsePlaceLens } from "@/lib/place-context";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const url=new URL(request.url);
  const latitude=Number(url.searchParams.get("lat"));
  const longitude=Number(url.searchParams.get("lng"));
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||
    latitude < -90||latitude > 90||longitude < -180||longitude > 180){
    return Response.json({error:"Invalid location"},{status:400});
  }

  try{
    const context=await buildPlaceContext({
      latitude,
      longitude,
      label:url.searchParams.get("label")??undefined,
      lens:parsePlaceLens(url.searchParams.get("lens")),
    });
    if(!context){
      return Response.json({error:"Unsupported location"},{status:404});
    }
    return Response.json(context,{
      headers:{
        "Cache-Control":"private, max-age=0, must-revalidate",
        "X-Robots-Tag":"noindex",
      },
    });
  }catch(error){
    console.error("Place context unavailable",error);
    return Response.json({error:"Place context temporarily unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
