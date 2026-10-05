import { getStreetContext } from "@/lib/street-context";

export const dynamic = "force-dynamic";

export async function GET(request:Request){
  const url=new URL(request.url);
  const latitude=Number(url.searchParams.get("lat"));
  const longitude=Number(url.searchParams.get("lng"));

  try{
    const context=await getStreetContext(latitude,longitude);
    if(context.availability==="unsupported"){
      return Response.json(context,{status:404,headers:{"Cache-Control":"public, s-maxage=3600","X-Robots-Tag":"noindex"}});
    }
    return Response.json(context,{
      headers:{"Cache-Control":"public, s-maxage=21600, stale-while-revalidate=21600","X-Robots-Tag":"noindex"}
    });
  }catch(error){
    if(error instanceof RangeError){
      return Response.json({error:"Invalid location"},{status:400});
    }
    console.error("Street context unavailable",error);
    return Response.json({error:"Street context temporarily unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
