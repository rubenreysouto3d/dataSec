export type CanonicalCategoryGroup = "safety" | "other";

export type CanonicalCategory = {
  label: string;
  group: CanonicalCategoryGroup;
};

function normaliseCategoryText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function humanCategory(category: string): string {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function canonicalCategory(
  metricSlug: string,
  rawLabel: string,
): CanonicalCategory {
  const text = normaliseCategoryText(`${metricSlug} ${rawLabel}`);

  // Non-crime responses stay visible, but never compete with the safety signal.
  if (/samur|summa|ambulanc|asistencia sanitaria|auxilio sanitario|emergencia sanitaria/.test(text)) {
    return { label: "Emergency assistance", group: "other" };
  }
  if (/trafico|traffic|seguridad vial|accidente.*veh|vehiculo.*averiado/.test(text)) {
    return { label: "Traffic & road safety", group: "other" };
  }
  if (/conflicto.*privad|mediacion|resolucion.*conflict/.test(text)) {
    return { label: "Private dispute mediation", group: "other" };
  }
  if (/administrativ|documentacion|identificacion|objetos perdidos|animal/.test(text)) {
    return { label: "Other police activity", group: "other" };
  }

  // Canonical safety vocabulary shared across source languages.
  if (/vehicle crime|sustraccion.*veh|robo.*veh|theft.*vehicle/.test(text)) {
    return { label: "Vehicle crime", group: "safety" };
  }
  if (/burglary|robo.*fuerza|robo.*domicilio|robo.*establecimiento/.test(text)) {
    return { label: "Burglary", group: "safety" };
  }
  if (/robbery|robo.*violencia|robo.*intimidacion/.test(text)) {
    return { label: "Robbery", group: "safety" };
  }
  if (/(violence.*sexual|sexual.*violence)/.test(text)) {
    return { label: "Violence & sexual offences", group: "safety" };
  }
  if (/sexual|violacion|abuso sexual/.test(text)) {
    return { label: "Sexual offences", group: "safety" };
  }
  if (/violence|agresion|assault|reyerta|amenaza|violencia.*genero|violencia.*familiar/.test(text)) {
    return { label: "Violence & assault", group: "safety" };
  }
  if (/hurto|theft|shoplift|pickpocket/.test(text)) {
    return { label: "Theft", group: "safety" };
  }
  if (/drug|droga|estupefaciente/.test(text)) {
    return { label: "Drugs", group: "safety" };
  }
  if (/weapon|arma/.test(text)) {
    return { label: "Weapons", group: "safety" };
  }
  if (/criminal damage|damage|danos|vandal/.test(text)) {
    return { label: "Criminal damage", group: "safety" };
  }
  if (/public order|orden publico|desorden|molestias|ruido/.test(text)) {
    return { label: "Public disorder", group: "safety" };
  }
  if (/anti-social|antisocial/.test(text)) {
    return { label: "Anti-social behaviour", group: "safety" };
  }

  // London labels are already public-facing English. Unknown Madrid dispatch
  // labels stay outside the safety ranking until explicitly mapped.
  if (!metricSlug.startsWith("madrid-dispatch-")) {
    return { label: rawLabel || humanCategory(metricSlug), group: "safety" };
  }

  return { label: "Other police activity", group: "other" };
}
