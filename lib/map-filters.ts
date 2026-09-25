export const MAP_AUDIENCES = [
  {
    key: "resident",
    label: "Resident",
    detail: "Living here · recurring exposure",
  },
  {
    key: "visitor",
    label: "Visitor",
    detail: "Tourism · short stay · street exposure",
  },
] as const;

export const MAP_ADVANCED_FILTERS = [
  {
    key: "violence-property",
    label: "Violence + property",
  },
  {
    key: "theft",
    label: "Theft + robbery",
  },
  {
    key: "crime-related",
    label: "All crime-related",
  },
  {
    key: "activity",
    label: "All source activity",
  },
] as const;

export const MAP_COLOR_BANDS = [
  { max: 0.2, label: "Lowest 20%", color: "#3f9b63" },
  { max: 0.4, label: "Lower", color: "#8ab85b" },
  { max: 0.6, label: "Middle", color: "#dfc64c" },
  { max: 0.8, label: "Higher", color: "#e28a43" },
  { max: 1, label: "Highest 20%", color: "#c84c3f" },
] as const;

export type MapAudienceKey = (typeof MAP_AUDIENCES)[number]["key"];
export type MapAdvancedFilterKey = (typeof MAP_ADVANCED_FILTERS)[number]["key"];
