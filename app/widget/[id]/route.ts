import { areaHref, areaIdFromPath } from "@/lib/area-route";
import { areaDisplayName } from "@/lib/data";
import { loadPlaceEvidence } from "@/lib/place-evidence-server";
import { placeEvidenceExplanation, placeEvidenceLabel, placeEvidenceSource } from "@/lib/place-evidence";
import { bandNumber, relativeBand } from "@/lib/map-view";
import { localeFromValue, localeTag, tr } from "@/lib/i18n";

type Props = {
  params: Promise<{ id: string }>;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": status === 200
        ? "public, s-maxage=43200, stale-while-revalidate=86400"
        : "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *; base-uri 'none'; form-action 'none'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function GET(request: Request, { params }: Props) {
  const { id } = await params;
  const areaId = areaIdFromPath(id);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "visitor" ? "visitor" : "resident";
  const locale = localeFromValue(url.searchParams.get("lang"));

  try {
    const result = await loadPlaceEvidence(areaId, view);
    if (!result) {
      return htmlResponse(
        `<!doctype html><title>${tr(locale, "Area not found", "Zona no encontrada")}</title><p>${tr(locale, "Area not found.", "Zona no encontrada.")}</p>`,
        404,
      );
    }

    const { area, evidence, hasCityHarmSeries } = result;
    const level = bandNumber(evidence.percentile);
    const band = relativeBand(evidence.percentile, view, locale);
    const percentile = evidence.percentile === null ? null : Math.round(evidence.percentile * 100);
    const indicatorLabel = placeEvidenceLabel(area.citySlug, view, hasCityHarmSeries, locale);
    const source = placeEvidenceSource(area.citySlug, locale);
    const explanation = placeEvidenceExplanation(area.citySlug, view, hasCityHarmSeries, locale);
    const value = evidence.value === null
      ? tr(locale, "Not available", "Sin datos")
      : new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 1 }).format(evidence.value);

    const origin = url.origin;
    const fullUrl = new URL("/explore/" + area.citySlug, origin);
    fullUrl.searchParams.set("view", view);
    fullUrl.searchParams.set("area", area.id);
    fullUrl.searchParams.set("lang", locale);
    const title = areaDisplayName(area);
    const viewLabel =
      view === "visitor"
        ? tr(locale, "Visitor", "Visitante")
        : tr(locale, "Resident", "Residente");

    const body = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} · dataSec</title>
<style>
:root{color-scheme:light;--bg:#faf8f2;--ink:#171714;--muted:#69675f;--line:#c9c5ba;--accent:#ff5a36}
*{box-sizing:border-box}
html,body{margin:0;background:transparent;color:var(--ink);font-family:Arial,Helvetica,sans-serif}
.card{min-height:188px;border:1px solid var(--line);background:var(--bg);padding:16px;display:flex;flex-direction:column;gap:12px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{font-weight:900;font-size:14px;letter-spacing:-.04em}.brand i{font-style:normal;color:var(--accent)}
.view{font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.place{min-width:0}.place h1{margin:0;font-family:Georgia,serif;font-size:25px;line-height:1.05;font-weight:400}
.place p{margin:5px 0 0;color:var(--muted);font-size:10px}
.signal{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:11px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.level{min-width:54px;font-family:Georgia,serif;font-size:28px;line-height:1}
.level small{display:block;font-family:Arial,sans-serif;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.signal strong{display:block;font-size:11px}.signal span{display:block;margin-top:3px;color:var(--muted);font-size:9px}
.foot{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-top:auto}
.note{max-width:72%;color:var(--muted);font-size:8px;line-height:1.35}
a{color:var(--ink);font-size:9px;font-weight:800;text-decoration:none;white-space:nowrap}
a:hover{text-decoration:underline}
</style>
</head>
<body>
<article class="card" aria-label="dataSec neighbourhood context widget">
  <div class="top">
    <div class="brand">data<i>Sec</i></div>
    <div class="view">${viewLabel} · ${tr(locale, "local context", "contexto local")}</div>
  </div>
  <div class="place">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(area.cityName)} · ${escapeHtml(evidence.period ?? tr(locale, "Insufficient observations", "Observaciones insuficientes"))}</p>
  </div>
  <div class="signal">
    <div class="level">${level ?? "—"}<small>${tr(locale, "relative band", "tramo relativo")} / 5</small></div>
    <div>
      <strong>${escapeHtml(band)} · ${escapeHtml(indicatorLabel)}</strong>
      <span>${escapeHtml(value)} · ${percentile === null
        ? tr(locale, "Local percentile unavailable", "Percentil local no disponible")
        : locale === "es"
          ? `percentil ${percentile} dentro de ${escapeHtml(area.cityName)}`
          : `${percentile}th percentile within ${escapeHtml(area.cityName)}`}</span>
    </div>
  </div>
  <p style="font-size:9px;line-height:1.4;color:var(--muted);margin:0">${escapeHtml(explanation)}</p>
  <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>
  <div class="foot">
    <div class="note">${tr(
      locale,
      "Source-linked records only. No prediction or guarantee of personal safety.",
      "Solo registros con fuente identificada. No se predice ni garantiza la seguridad personal.",
    )}</div>
    <a href="${escapeHtml(fullUrl.toString())}" target="_blank" rel="noopener noreferrer">${tr(locale, "Full context →", "Contexto completo →")}</a>
  </div>
</article>
</body>
</html>`;

    return htmlResponse(body);
  } catch (error) {
    console.error(error);
    return htmlResponse(
      `<!doctype html><title>${tr(locale, "Unavailable", "No disponible")}</title><p>${tr(locale, "Context temporarily unavailable.", "Contexto no disponible temporalmente.")}</p>`,
      503,
    );
  }
}
