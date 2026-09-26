"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localePath, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname() || "/";

  return (
    <div className="language-switcher" aria-label={locale === "es" ? "Idioma" : "Language"}>
      <Link
        href={localePath("en", pathname)}
        className={locale === "en" ? "is-active" : ""}
        hrefLang="en"
      >
        EN
      </Link>
      <span aria-hidden="true">/</span>
      <Link
        href={localePath("es", pathname)}
        className={locale === "es" ? "is-active" : ""}
        hrefLang="es"
      >
        ES
      </Link>
    </div>
  );
}
