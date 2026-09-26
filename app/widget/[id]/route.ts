import { areaHref, areaIdFromPath } from "@/lib/area-route";
import {
  areaDisplayName,
  getAreaProfile,
  getCityMapMetrics,
  getCitySafetySignals,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";
import { buildVisitorPercentileMap } from "@/lib/map-filters";
import { bandNumber, metricForLayer, relativeBand } from "@/lib/map-view";

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

  try {
    const area = await getAreaProfile(areaId);
    if (!area) {
      return htmlResponse("<!doctype html><title>Area not found</title><p>Area not found.</p>", 404);
    }

    const cityAreas = await getNeighbourhoods(area.citySlug);
    const areaIds = cityAreas.map((item) => item.id);
    const metrics = await getCityMapMetrics(area.citySlug, areaIds);
    const safetySignals = await getCitySafetySignals(area.citySlug, areaIds, metrics);

    const metricById = new Map(metrics.map((metric) => [metric.areaId, metric]));
    const safetyById = new Map(safetySignals.map((signal) => [signal.areaId, signal]));
    const visitorById = buildVisitorPercentileMap(metrics);

    const selected = metricForLayer(
      metricById.get(area.id),
      view === "visitor" ? "visitor-context" : "contextual-overview",
      safetyById.get(area.id),
      visitorById.get(area.id),
    );

    const level = bandNumber(selected.percentile);
    const band = relativeBand(selected.percentile, view);
    const percentile =
      selected.percentile === null || !Number.isFinite(selected.percentile)
        ? null
        : Math.round(selected.percentile * 100);
    const latestMonth = metrics.reduce(
      (latest, metric) => (!latest || metric.month > latest ? metric.month : latest),
      "",
    );

    const origin = url.origin;
    const fullUrl = `${origin}${areaHref(area.id)}`;
    const title = areaDisplayName(area);
    const viewLabel = view === "visitor" ? "Visitor" : "Resident";

    const body = `<!doctype html>
<html lang="en">
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
    <div class="view">${viewLabel} · local context</div>
  </div>
  <div class="place">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(area.cityName)}${latestMonth ? ` · ${escapeHtml(monthLabel(latestMonth))}` : ""}</p>
  </div>
  <div class="signal">
    <div class="level">${level ?? "—"}<small>level / 5</small></div>
    <div>
      <strong>${escapeHtml(band)}</strong>
      <span>${percentile === null ? "Local percentile unavailable" : `${percentile}th percentile within ${escapeHtml(area.cityName)}`}</span>
    </div>
  </div>
  <div class="foot">
    <div class="note">Official-source context only. Not a prediction or guarantee of personal safety.</div>
    <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer">Full context →</a>
  </div>
</article>
</body>
</html>`;

    return htmlResponse(body);
  } catch (error) {
    console.error(error);
    return htmlResponse("<!doctype html><title>Unavailable</title><p>Context temporarily unavailable.</p>", 503);
  }
}
