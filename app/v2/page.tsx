import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ProductHome() {
  redirect("/v2/explore/madrid?view=visitor");
}
