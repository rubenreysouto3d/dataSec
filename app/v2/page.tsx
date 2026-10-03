import { getNeighbourhoods } from "@/lib/data";
import V2Home from "./V2Home";

export const dynamic = "force-dynamic";

export default async function ProductHome() {
  let areas: Awaited<ReturnType<typeof getNeighbourhoods>> = [];
  let available = true;
  try {
    areas = await getNeighbourhoods();
  } catch {
    available = false;
  }
  return <V2Home areas={areas.map(a => ({
    id: a.id, name: a.name, parentName: a.parentName, citySlug: a.citySlug,
  }))} available={available}/>;
}
