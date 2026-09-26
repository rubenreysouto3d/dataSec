import type { Metadata } from "next";
import Link from "next/link";
import { localeFromValue, localeHref, tr } from "@/lib/i18n";

type Props = {
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);
  return {
    title: tr(locale, "Embed dataSec neighbourhood context", "Insertar contexto de barrios de dataSec"),
    description: tr(
      locale,
      "Prototype iframe integration for showing dataSec Resident or Visitor neighbourhood context from coordinates or a stable area ID.",
      "Integración iframe de prototipo para mostrar contexto de barrio de dataSec para Residentes o Visitantes a partir de coordenadas o un ID estable.",
    ),
  };
}

export default async function EmbedPage({ searchParams }: Props) {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);
  const origin = "https://data-sec.vercel.app";
  const samplePath =
    `${origin}/widget/point?lat=40.4168&lng=-3.7038&view=visitor&lang=${locale}`;
  const snippet =
    `<iframe\n  src="${samplePath}"\n  title="dataSec neighbourhood context"\n  loading="lazy"\n  style="width:100%;max-width:420px;height:210px;border:0"\n></iframe>`;

  return (
    <main className="method-page method-page-clean embed-page">
      <Link className="back" href={localeHref(locale, "/")}>
        ← {tr(locale, "Home", "Inicio")}
      </Link>

      <div className="eyebrow">
        {tr(locale, "Partner prototype", "Prototipo para partners")}
      </div>
      <h1>
        {tr(
          locale,
          "Embed neighbourhood context.",
          "Inserta contexto de barrio.",
        )}
      </h1>
      <p className="method-lead">
        {tr(
          locale,
          "A lightweight iframe integration for accommodation, relocation and property products. The widget uses the same city-local Resident or Visitor signal as dataSec itself.",
          "Una integración iframe ligera para productos de alojamiento, relocation e inmobiliarios. El widget usa la misma señal local de Residente o Visitante que dataSec.",
        )}
      </p>

      <section className="method-limits embed-definition">
        <div>
          <span>{tr(locale, "CURRENT INPUT", "ENTRADA ACTUAL")}</span>
          <h2>{tr(locale, "Coordinates or stable area ID", "Coordenadas o ID estable de zona")}</h2>
        </div>
        <div>
          <p>
            {tr(
              locale,
              "For partner use, coordinates are the simplest integration: the widget resolves the point to dataSec's stored official boundary and then renders the same local context card.",
              "Para partners, las coordenadas son la integración más simple: el widget resuelve el punto contra el límite oficial almacenado por dataSec y renderiza la misma tarjeta de contexto local.",
            )}
          </p>
          <p>
            {tr(
              locale,
              "Current geographic coverage is London and Madrid.",
              "La cobertura geográfica actual es Londres y Madrid.",
            )}
          </p>
        </div>
      </section>

      <section className="embed-demo-grid">
        <article className="panel embed-demo-card">
          <div className="panel-head">
            <div>
              <span>{tr(locale, "LIVE DEMO", "DEMO EN VIVO")}</span>
              <h2>{tr(locale, "Visitor context from coordinates", "Contexto de Visitante por coordenadas")}</h2>
            </div>
          </div>
          <iframe
            src={samplePath}
            title={tr(locale, "dataSec embed demo", "Demo insertable de dataSec")}
            loading="lazy"
            className="embed-demo-frame"
          />
          <small>
            {tr(
              locale,
              "Demo point: central Madrid. The iframe resolves the point server-side before rendering the local neighbourhood card.",
              "Punto de demo: centro de Madrid. El iframe resuelve el punto en servidor antes de mostrar la tarjeta local del barrio.",
            )}
          </small>
        </article>

        <article className="panel embed-code-card">
          <div className="panel-head">
            <div>
              <span>{tr(locale, "EMBED CODE", "CÓDIGO DE INSERCIÓN")}</span>
              <h2>{tr(locale, "Minimal iframe", "Iframe mínimo")}</h2>
            </div>
          </div>
          <pre><code>{snippet}</code></pre>
        </article>
      </section>

      <section className="method-core embed-options">
        <article>
          <span>01</span>
          <div>
            <h2>{tr(locale, "Coordinates", "Coordenadas")}</h2>
            <p>
              <code>/widget/point?lat=…&amp;lng=…&amp;view=visitor</code>
            </p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h2>{tr(locale, "View", "Vista")}</h2>
            <p>
              <code>view=visitor</code> {tr(locale, "or", "o")} <code>view=resident</code>.
            </p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h2>{tr(locale, "Language", "Idioma")}</h2>
            <p>
              <code>lang=en</code> {tr(locale, "or", "o")} <code>lang=es</code>.
            </p>
          </div>
        </article>
        <article>
          <span>04</span>
          <div>
            <h2>{tr(locale, "Stable area ID", "ID estable de zona")}</h2>
            <p>
              <code>/widget/&lt;area-id&gt;?view=visitor&amp;lang=en</code>
            </p>
          </div>
        </article>
      </section>

      <p className="density-caution embed-disclaimer">
        {tr(
          locale,
          "Prototype integration only. The widget is branded, uses local city-relative context, and does not provide a contractual safety guarantee or a Europe-wide score.",
          "Solo integración de prototipo. El widget lleva marca, usa contexto relativo local a cada ciudad y no ofrece una garantía contractual de seguridad ni una puntuación paneuropea.",
        )}
      </p>

      <div className="city-intent-footer-links">
        <Link href={localeHref(locale, "/methodology")}>
          {tr(locale, "Methodology →", "Metodología →")}
        </Link>
        <Link href={localeHref(locale, "/disclaimer")}>
          {tr(locale, "Use and limitations →", "Uso y limitaciones →")}
        </Link>
      </div>
    </main>
  );
}
