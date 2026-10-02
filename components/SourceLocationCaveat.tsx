import type { Locale } from "@/lib/i18n";
import { tr } from "@/lib/i18n";
import type { CitySlug } from "@/lib/data";

export const MADRID_DISPATCH_SOURCE =
  "https://datos.madrid.es/dataset/837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal/information";

export function isMadridDispatchLocationCaveat(
  citySlug: CitySlug,
  areaName: string,
) {
  return citySlug === "madrid" &&
    areaName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "guindalera";
}

/**
 * The municipality explicitly warns that citizen-information cases are
 * assigned to its 092 office address in Guindalera. This applies directly to
 * all-source-activity counts. Avoid implying that a caveat fixes the entire
 * taxonomy or that any indicator estimates individual danger.
 */
export default function SourceLocationCaveat({ locale }: { locale: Locale }) {
  return (
    <aside className="source-location-caveat" aria-label={tr(locale, "Official source warning", "Advertencia de la fuente oficial")}>
      <strong>{tr(locale, "Special source caveat: Guindalera", "Aviso especial de la fuente: Guindalera")}</strong>
      <p>{tr(locale,
        "Madrid's source assigns some cases closed as citizen information to the 092 service address in Guindalera, regardless of where the original request originated. This can inflate the area's total dispatch activity. Crime-category filters intentionally exclude administrative categories, but that does not eliminate every possible source or location bias and they are not individual-risk measures.",
        "La fuente de Madrid asigna a la dirección del servicio 092 en Guindalera algunos casos cerrados como información a la ciudadanía, independientemente de dónde se originara la solicitud. Esto puede inflar la actividad policial total de este barrio. Los filtros de categorías delictivas excluyen intencionadamente las administrativas, pero eso no elimina todos los posibles sesgos de fuente o ubicación ni convierte los datos en una medida de riesgo individual.",
      )}</p>
      <a href={MADRID_DISPATCH_SOURCE} target="_blank" rel="noreferrer">
        {tr(locale, "Read the municipal source note ↗", "Leer la advertencia del Ayuntamiento ↗")}
      </a>
    </aside>
  );
}
