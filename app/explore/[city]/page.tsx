import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FieldExplorerPage from "@/app/lab/[city]/page";

// The lab stays as a noindex sandbox; this is the stable public entrypoint.
// One server implementation provides identical map metrics on both routes.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (city !== "madrid" && city !== "london") notFound();
  const name = city === "madrid" ? "Madrid" : "London";
  const enabled = process.env.NEXT_PUBLIC_INDEX_SITE === "true";
  return {
    title: name + " · Explore recorded urban context",
    description: "Find an area or address, review the official recorded indicator with its limits, and compare places within " + name + ".",
    robots: { index: enabled, follow: enabled },
    alternates: { canonical: "/explore/" + city },
  };
}

export default FieldExplorerPage;
