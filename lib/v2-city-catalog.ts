export type V2City = {
  slug: string;
  label: string;
  country: string;
  status: "live" | "source-review" | "research";
  note: string;
  source?: string;
};

export const v2Cities: V2City[] = [
  { slug: "madrid", label: "Madrid", country: "España", status: "live",
    note: "Barrios oficiales, incidencias municipales y contexto residencial.",
    source: "https://datos.madrid.es/dataset/837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal/information" },
  { slug: "london", label: "Londres", country: "Reino Unido", status: "live",
    note: "Barrios policiales y delitos registrados. Las ubicaciones son aproximadas.",
    source: "https://data.police.uk/" },
  { slug: "barcelona", label: "Barcelona", country: "España", status: "source-review",
    note: "Incidentes de Guardia Urbana disponibles; pendiente validar detalle por zona y categorías.",
    source: "https://datos.gob.es/es/catalogo/l01080193-incidentes-gestionados-por-la-guardia-urbana-en-la-ciudad-de-barcelona" },
  { slug: "birmingham", label: "Birmingham", country: "Reino Unido", status: "source-review",
    note: "Evaluar extracción regional y geografía aplicable antes de publicar.",
    source: "https://data.police.uk/data/" },
  { slug: "liverpool", label: "Liverpool", country: "Reino Unido", status: "source-review",
    note: "Evaluar extracción regional y geografía aplicable antes de publicar.",
    source: "https://data.police.uk/data/" },
  { slug: "paris", label: "París", country: "Francia", status: "source-review",
    note: "80 barrios administrativos cartografiables; pendiente indicador local compatible.",
    source: "https://opendata.paris.fr/explore/dataset/quartier_paris/" },
  { slug: "berlin", label: "Berlín", country: "Alemania", status: "research",
    note: "Fuentes geográficas y de calidad de vida en evaluación." },
  { slug: "amsterdam", label: "Ámsterdam", country: "Países Bajos", status: "research",
    note: "Fuentes por barrio en evaluación." },
  { slug: "lisbon", label: "Lisboa", country: "Portugal", status: "research",
    note: "Cobertura y derechos de uso en evaluación." },
  { slug: "rome", label: "Roma", country: "Italia", status: "research",
    note: "Cobertura y unidades geográficas en evaluación." },
  { slug: "athens", label: "Atenas", country: "Grecia", status: "research",
    note: "Cobertura en evaluación." },
  { slug: "manchester", label: "Mánchester", country: "Reino Unido", status: "research",
    note: "Police.uk no ofrece actualmente los datos de Greater Manchester; requiere fuente alternativa.",
    source: "https://data.police.uk/changelog/" },
];
