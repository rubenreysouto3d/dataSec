// Placeholder for local/dev use. Production builds overwrite this file after a successful data-store health check.
export const dataHealth = {
  ok: false,
  checkedAt: null as string | null,
  cities: [
    {
      city: "london",
      areaCount: 0,
      latestMonth: "",
      latestMonthCoverage: 0,
      coverageRatio: 0,
      ageMonths: 0,
    },
    {
      city: "madrid",
      areaCount: 0,
      latestMonth: "",
      latestMonthCoverage: 0,
      coverageRatio: 0,
      ageMonths: 0,
    },
  ],
  madridContext: {
    harmHistoryMonths: [] as string[],
    harmHistoryRows: 0,
    populationMonth: "",
    populationCoverage: 0,
    commercialMonth: "",
    commercialCoverage: 0,
  },
  pointLookup: {
    london: { areaId: "", sourceAreaId: "", name: "" },
    madrid: { areaId: "", sourceAreaId: "", name: "" },
  },
} as const;
