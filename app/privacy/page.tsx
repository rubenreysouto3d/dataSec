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
    title: tr(locale, "Privacy", "Privacidad"),
    description: tr(
      locale,
      "How dataSec and the stay-context browser extension handle location, listing and request data.",
      "Cómo gestionan dataSec y la extensión de contexto para alojamientos los datos de ubicación, fichas y solicitudes.",
    ),
  };
}

export default async function PrivacyPage({ searchParams }: Props) {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);

  return (
    <main className="method-page method-page-clean">
      <Link className="back" href={localeHref(locale, "/")}>
        ← {tr(locale, "Home", "Inicio")}
      </Link>

      <div className="eyebrow">{tr(locale, "Privacy", "Privacidad")}</div>
      <h1>
        {tr(
          locale,
          "Use the minimum data needed.",
          "Usar solo los datos necesarios.",
        )}
      </h1>
      <p className="method-lead">
        {tr(
          locale,
          "dataSec is designed to provide local context without requiring an account or building a behavioural profile of the user.",
          "dataSec está diseñado para ofrecer contexto local sin exigir una cuenta ni crear un perfil de comportamiento del usuario.",
        )}
      </p>

      <section className="method-core">
        <article>
          <span>01</span>
          <div>
            <h2>{tr(locale, "Public website", "Web pública")}</h2>
            <p>
              {tr(
                locale,
                "The public explorer does not require a user account. When you use location-based features, the coordinates needed for that request are sent to the public data service so they can be matched to an official stored area boundary.",
                "El explorador público no exige una cuenta. Cuando usas funciones basadas en ubicación, las coordenadas necesarias para esa solicitud se envían al servicio público de datos para asociarlas con un límite oficial de zona almacenado.",
              )}
            </p>
          </div>
        </article>

        <article>
          <span>02</span>
          <div>
            <h2>{tr(locale, "Browser extension", "Extensión del navegador")}</h2>
            <p>
              {tr(
                locale,
                "The stay-context extension only runs its resolution flow on supported accommodation detail pages while the extension is enabled. It reads address information exposed by the current listing page. If the address is not precise enough, it does not guess a neighbourhood.",
                "La extensión de contexto para alojamientos solo ejecuta su flujo de resolución en fichas de alojamiento compatibles mientras está activada. Lee la información de dirección expuesta por la ficha actual. Si la dirección no es suficientemente precisa, no intenta adivinar el barrio.",
              )}
            </p>
          </div>
        </article>

        <article>
          <span>03</span>
          <div>
            <h2>{tr(locale, "Network requests", "Solicitudes de red")}</h2>
            <p>
              {tr(
                locale,
                "For an address that is precise enough, the extension sends the address to OpenStreetMap Nominatim for geocoding, then sends the resulting coordinates to the public dataSec Supabase point-in-boundary function. The resolved area widget is loaded from data-sec.vercel.app.",
                "Cuando una dirección es suficientemente precisa, la extensión envía la dirección a OpenStreetMap Nominatim para geocodificarla y después envía las coordenadas resultantes a la función pública de Supabase de dataSec que identifica la zona. El widget de la zona resuelta se carga desde data-sec.vercel.app.",
              )}
            </p>
          </div>
        </article>

        <article>
          <span>04</span>
          <div>
            <h2>{tr(locale, "Local cache", "Caché local")}</h2>
            <p>
              {tr(
                locale,
                "Resolved listing-address matches are cached in the browser's extension storage for up to seven days to avoid repeated geocoding requests. The extension also stores whether it is enabled or disabled.",
                "Las asociaciones ya resueltas entre direcciones y zonas se guardan en el almacenamiento local de la extensión durante un máximo de siete días para evitar repetir solicitudes de geocodificación. La extensión también guarda si está activada o desactivada.",
              )}
            </p>
          </div>
        </article>

        <article>
          <span>05</span>
          <div>
            <h2>{tr(locale, "What dataSec does not deliberately collect", "Lo que dataSec no recopila deliberadamente")}</h2>
            <p>
              {tr(
                locale,
                "The current product does not use advertising trackers, does not require an account, and does not deliberately upload browsing history, account identifiers or a list of visited accommodation pages into the dataSec application database.",
                "El producto actual no usa rastreadores publicitarios, no exige una cuenta y no sube deliberadamente al sistema de datos de dataSec el historial de navegación, identificadores de cuenta ni una lista de fichas de alojamiento visitadas.",
              )}
            </p>
          </div>
        </article>

        <article>
          <span>06</span>
          <div>
            <h2>{tr(locale, "Infrastructure logs", "Registros de infraestructura")}</h2>
            <p>
              {tr(
                locale,
                "Like most web services, infrastructure providers used by dataSec can process ordinary request metadata such as IP address, timestamp, URL and technical headers as part of operating and securing their services. Their own privacy terms also apply.",
                "Como en la mayoría de servicios web, los proveedores de infraestructura utilizados por dataSec pueden procesar metadatos habituales de las solicitudes, como dirección IP, fecha y hora, URL y cabeceras técnicas, para operar y proteger sus servicios. También se aplican sus propias condiciones de privacidad.",
              )}
            </p>
          </div>
        </article>
      </section>

      <section className="method-limits">
        <div>
          <span>{tr(locale, "THIRD PARTIES", "TERCEROS")}</span>
          <h2>{tr(locale, "Services used by the current prototype", "Servicios usados por el prototipo actual")}</h2>
        </div>
        <div>
          <p>OpenStreetMap Nominatim · Supabase · Vercel</p>
          <p>
            {tr(
              locale,
              "Booking and Airbnb are pages where the extension can run; they are not dataSec data providers or sponsors.",
              "Booking y Airbnb son páginas en las que puede ejecutarse la extensión; no son proveedores de datos ni patrocinadores de dataSec.",
            )}
          </p>
        </div>
      </section>

      <p className="density-caution">
        {tr(
          locale,
          "This page describes the current dataSec prototype. If analytics, user accounts, partner keys or other data-processing features are introduced later, this notice must be updated before those features are released.",
          "Esta página describe el prototipo actual de dataSec. Si más adelante se introducen analítica, cuentas de usuario, claves para partners u otras funciones que procesen datos, este aviso deberá actualizarse antes de publicar esas funciones.",
        )}
      </p>

      <div className="city-intent-footer-links">
        <Link href={localeHref(locale, "/disclaimer")}>
          {tr(locale, "Use and limitations →", "Uso y limitaciones →")}
        </Link>
        <Link href={localeHref(locale, "/methodology")}>
          {tr(locale, "Methodology →", "Metodología →")}
        </Link>
      </div>
    </main>
  );
}
