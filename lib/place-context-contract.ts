import type { CityCapability, CityMapMetric, CitySlug, MonthlySummary } from "@/lib/data";
import type { StreetContext } from "@/lib/street-context";

export type PlaceLens =
  | "choosing_stay"
  | "arriving_late"
  | "around_me"
  | "tonight"
  | "living_here"
  | "living_with_family";

export type EvidenceConfidenceLevel = "strong" | "limited" | "contextual";

export type EvidenceConfidence = {
  level: EvidenceConfidenceLevel;
  reasons: string[];
};

export type PlaceFinding = {
  id: string;
  domain: "incidents" | "after_dark" | "mobility" | "daily_life" | "coverage";
  importance: "info" | "notice" | "attention" | "official-alert";
  statement: string;
  implication?: string;
  observedPeriod: { start: string | null; end: string | null };
  geography: {
    kind: "approximate_point" | "neighbourhood" | "district" | "unknown";
    label: string;
    precisionNote?: string;
  };
  confidence: EvidenceConfidence;
  evidence: Array<{
    source: string;
    metric?: string;
    value?: number;
    unit?: string;
    note?: string;
  }>;
  methodVersion: string;
};

export type DomainEvidence = {
  id: string;
  label: string;
  status: "observed" | "context" | "not_available" | "research";
  summary: string;
  sourceSlugs: string[];
};

export type PlaceContext = {
  place: {
    label: string;
    coordinate: { latitude: number; longitude: number };
    city: CitySlug;
    area: {
      id: string;
      name: string;
      parentName: string | null;
      areaType: string;
    };
  };
  lens: PlaceLens;
  capabilities: CityCapability[];
  findings: PlaceFinding[];
  domains: DomainEvidence[];
  evidence: {
    latestMonthlySummary: MonthlySummary | null;
    areaMetric: CityMapMetric | null;
    temporal: {
      available: boolean;
      months: string[];
      byHour: Array<{ hour: number; count: number }>;
    };
    street: StreetContext;
  };
  coverage: {
    street: "available" | "area_only" | "unsupported";
    timeOfDay: "available" | "pipeline_ready" | "unavailable";
    limitations: string[];
  };
};

export const placeLensLabels:Record<PlaceLens,string>={
  choosing_stay:"Elegir alojamiento",
  arriving_late:"Llegar tarde",
  around_me:"Ahora, aquí",
  tonight:"Esta noche",
  living_here:"Vivir aquí",
  living_with_family:"Vivir aquí · familia",
};

export const placeLensPurpose:Record<PlaceLens,"visitor"|"resident">={
  choosing_stay:"visitor",
  arriving_late:"visitor",
  around_me:"visitor",
  tonight:"visitor",
  living_here:"resident",
  living_with_family:"resident",
};
