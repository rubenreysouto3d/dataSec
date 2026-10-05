import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { chromeCopy, localeFromValue, localeHref } from "@/lib/i18n";
import "./globals.css";
import "./design-refresh.css";
import "./explorer-workflow.css";

const indexSite = process.env.NEXT_PUBLIC_INDEX_SITE === "true";

export const metadata: Metadata = {
  title: {
    default: "dataSec — Understand a place with official data",
    template: "%s — dataSec",
  },
  description:
    "Explore recorded neighbourhood context for visiting or living in a city, with official sources and clear limitations.",
  robots: {
    index: indexSite,
    follow: indexSite,
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = localeFromValue(requestHeaders.get("x-datasec-locale"));
  const copy = chromeCopy[locale];

  return (
    <html lang={locale}>
      <body>
        <header className="site-header">
          <Link className="brand" href={localeHref(locale, "/")}>data<span>Sec</span></Link>
          <div className="site-header-actions">
            <nav aria-label={locale === "es" ? "Navegación principal" : "Primary navigation"}>
              <Link href={localeHref(locale, "/city/madrid")}>Madrid</Link>
              <Link href={localeHref(locale, "/city/london")}>London</Link>
              <Link href="/v2">{locale === "es" ? "Abrir app" : "Open app"}</Link>
              <Link href={localeHref(locale, "/methodology")}>{locale === "es" ? "Datos" : "Data"}</Link>
            </nav>
            <LanguageSwitcher locale={locale} />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <p><strong>dataSec</strong> · {copy.footer}</p>
          <p className="site-footer-links">
            <Link href={localeHref(locale, "/status")}>{copy.status}</Link>
            <Link href={localeHref(locale, "/methodology")}>{copy.methodology}</Link>
            <Link href={localeHref(locale, "/disclaimer")}>{copy.limitations}</Link>
            <Link href={localeHref(locale, "/privacy")}>{locale === "es" ? "Privacidad" : "Privacy"}</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
