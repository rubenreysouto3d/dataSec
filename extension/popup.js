function locale() {
  return String(navigator.language || "").toLowerCase().startsWith("es") ? "es" : "en";
}

const strings = {
  en: {
    intro: "Shows Visitor context on supported Booking and Airbnb accommodation pages when the listing exposes a precise enough address.",
    enabled: "Extension enabled",
    enabledCopy: "Show context on supported listings.",
    coverage: "Current coverage",
    coverageCopy: "London and Madrid · official-source neighbourhood context.",
    open: "Open dataSec →",
  },
  es: {
    intro: "Muestra contexto de Visitante en fichas compatibles de Booking y Airbnb cuando el alojamiento expone una dirección suficientemente precisa.",
    enabled: "Extensión activada",
    enabledCopy: "Mostrar contexto en alojamientos compatibles.",
    coverage: "Cobertura actual",
    coverageCopy: "Londres y Madrid · contexto por barrios con fuentes oficiales.",
    open: "Abrir dataSec →",
  },
};

async function init() {
  const lang = locale();
  const copy = strings[lang];
  document.documentElement.lang = lang;
  document.getElementById("intro").textContent = copy.intro;
  document.getElementById("toggle-title").textContent = copy.enabled;
  document.getElementById("toggle-copy").textContent = copy.enabledCopy;
  document.getElementById("coverage-title").textContent = copy.coverage;
  document.getElementById("coverage-copy").textContent = copy.coverageCopy;
  document.getElementById("open-site").textContent = copy.open;
  document.getElementById("open-site").href =
    lang === "es" ? "https://data-sec.vercel.app/es" : "https://data-sec.vercel.app";

  const stored = await chrome.storage.local.get({ enabled: true });
  const input = document.getElementById("enabled");
  input.checked = stored.enabled !== false;
  input.addEventListener("change", async () => {
    await chrome.storage.local.set({ enabled: input.checked });
  });
}

void init();
