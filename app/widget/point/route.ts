import { areaPathId } from "@/lib/area-route";
import { locateAreaByCoordinates } from "@/lib/public-data-client";
import { localeFromValue } from "@/lib/i18n";

function html(message: string, status: number) {
  return new Response(`<!doctype html><meta charset="utf-8"><title>dataSec widget</title><body style="font-family:Arial,sans-serif;padding:16px">${message}</body>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lng"));
  const view = url.searchParams.get("view") === "resident" ? "resident" : "visitor";
  const locale = localeFromValue(url.searchParams.get("lang"));

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return html(locale === "es" ? "Coordenadas no válidas." : "Invalid coordinates.", 400);
  }

  try {
    const area = await locateAreaByCoordinates(latitude, longitude);
    if (!area) {
      return html(
        locale === "es"
          ? "Este punto está fuera de la cobertura actual de dataSec."
          : "This point is outside current dataSec coverage.",
        404,
      );
    }

    const target = new URL(
      `/widget/${encodeURIComponent(areaPathId(area.id))}`,
      url.origin,
    );
    target.searchParams.set("view", view);
    target.searchParams.set("lang", locale);

    return new Response(null, {
      status: 307,
      headers: {
        Location: target.toString(),
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    console.error(error);
    return html(
      locale === "es"
        ? "El contexto no está disponible temporalmente."
        : "Context is temporarily unavailable.",
      503,
    );
  }
}
