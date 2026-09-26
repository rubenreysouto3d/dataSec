export type Locale = "en" | "es";

export function localeFromValue(value: string | null | undefined): Locale {
  return value === "es" ? "es" : "en";
}

export function tr(locale: Locale, en: string, es: string) {
  return locale === "es" ? es : en;
}

export function localeHref(locale: Locale, href: string) {
  if (locale === "en") return href;
  if (!href.startsWith("/")) return href;
  if (href === "/") return "/es";
  if (href.startsWith("/es/") || href === "/es") return href;
  return `/es${href}`;
}

export function localePath(locale: Locale, pathname: string) {
  const bare = pathname === "/es" || pathname.startsWith("/es/")
    ? pathname.slice(3) || "/"
    : pathname === "/en" || pathname.startsWith("/en/")
      ? pathname.slice(3) || "/"
      : pathname;
  return localeHref(locale, bare);
}

export function localeTag(locale: Locale) {
  return locale === "es" ? "es-ES" : "en-GB";
}

export function localizeCanonicalCategory(locale: Locale, label: string) {
  if (locale === "en") return label;
  const labels: Record<string, string> = {
    "Emergency assistance": "Asistencia de emergencia",
    "Traffic & road safety": "Tráfico y seguridad vial",
    "Private dispute mediation": "Mediación de conflictos privados",
    "Other police activity": "Otra actividad policial",
    "Vehicle crime": "Delitos relacionados con vehículos",
    "Burglary": "Robo con fuerza",
    "Robbery": "Robo con violencia",
    "Violence & sexual offences": "Violencia y delitos sexuales",
    "Sexual offences": "Delitos sexuales",
    "Violence & assault": "Violencia y agresiones",
    "Theft": "Hurtos",
    "Drugs": "Drogas",
    "Weapons": "Armas",
    "Criminal damage": "Daños y vandalismo",
    "Public disorder": "Desorden público",
    "Anti-social behaviour": "Conducta antisocial",
  };
  return labels[label] ?? label;
}

export const chromeCopy = {
  en: {
    cities: "Cities",
    about: "About",
    status: "Status",
    methodology: "Methodology",
    limitations: "Limitations",
    footer: "Official local safety context.",
    language: "Language",
    english: "English",
    spanish: "Español",
  },
  es: {
    cities: "Ciudades",
    about: "Acerca de",
    status: "Estado",
    methodology: "Metodología",
    limitations: "Limitaciones",
    footer: "Contexto local de seguridad con datos oficiales.",
    language: "Idioma",
    english: "English",
    spanish: "Español",
  },
} as const;
