const DATASEC_ORIGIN = "https://data-sec.vercel.app";
const ROOT_ID = "datasec-stay-context-root";

let lastUrl = location.href;
let closedForUrl = false;
let running = false;
let rerunTimer = null;

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function detectLocale() {
  const pageLang = normalize(document.documentElement.lang).toLowerCase();
  const browserLang = normalize(navigator.language).toLowerCase();
  return pageLang.startsWith("es") || browserLang.startsWith("es") ? "es" : "en";
}

function copy(locale) {
  return locale === "es"
    ? {
        label: "dataSec · contexto del alojamiento",
        close: "Cerrar contexto de dataSec",
        fallbackTitle: "Consulta este alojamiento en dataSec",
        fallbackBody:
          "La ficha no muestra una dirección lo bastante precisa para asignar un barrio automáticamente. Abre el buscador de lugares.",
        fallbackLink: "Abrir buscador →",
      }
    : {
        label: "dataSec · listing context",
        close: "Close dataSec context",
        fallbackTitle: "Check this stay on dataSec",
        fallbackBody:
          "This listing does not expose a precise enough address to assign a neighbourhood automatically. Open the place finder instead.",
        fallbackLink: "Open place finder →",
      };
}

function isBookingListing() {
  return /(^|\.)booking\.com$/i.test(location.hostname) && /\/hotel\//i.test(location.pathname);
}

function isAirbnbListing() {
  return /(^|\.)airbnb\./i.test(location.hostname) && /^\/rooms\/(?:\d+|plus\/\d+)/i.test(location.pathname);
}

function isSupportedListingPage() {
  return isBookingListing() || isAirbnbListing();
}

function addressFromObject(address) {
  if (!address) return "";
  if (typeof address === "string") return normalize(address);
  if (typeof address !== "object") return "";

  return normalize([
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode,
    typeof address.addressCountry === "object"
      ? address.addressCountry?.name
      : address.addressCountry,
  ].filter(Boolean).join(", "));
}

function visitJson(value, candidates, depth = 0) {
  if (!value || depth > 10) return;
  if (Array.isArray(value)) {
    for (const item of value) visitJson(item, candidates, depth + 1);
    return;
  }
  if (typeof value !== "object") return;

  const address = addressFromObject(value.address);
  if (address) candidates.push(address);

  const locationAddress = addressFromObject(value.location?.address);
  if (locationAddress) candidates.push(locationAddress);

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") visitJson(child, candidates, depth + 1);
  }
}

function collectCandidates() {
  const candidates = [];

  const selectors = [
    '[data-testid="address"]',
    '[data-testid="property-address"]',
    '[data-testid="location"]',
    '[itemprop="address"]',
  ];

  for (const selector of selectors) {
    const value = normalize(document.querySelector(selector)?.textContent);
    if (value) candidates.push(value);
  }

  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visitJson(JSON.parse(node.textContent || "null"), candidates);
    } catch {
      // Ignore third-party JSON-LD fragments that are not valid JSON.
    }
  }

  return [...new Set(candidates)]
    .map(normalize)
    .filter(Boolean)
    .slice(0, 12);
}

function looksPrecise(candidate) {
  const text = candidate.toLowerCase();
  const hasNumber = /\b\d{1,5}[a-z]?\b/i.test(candidate);
  const hasUkPostcode = /\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(candidate);
  const hasSpanishPostcode = /\b\d{5}\b/.test(candidate);
  const hasStreetWord =
    /\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|calle|c\/?|avenida|av\.?|paseo|plaza|ronda|carrer|travessera)\b/i.test(text);

  return hasUkPostcode || hasSpanishPostcode || (hasNumber && hasStreetWord);
}

function pageFallbackQuery() {
  const candidates = collectCandidates();
  const address = candidates.find((candidate) => normalize(candidate).length > 4);
  if (address) return address;

  const heading = normalize(document.querySelector("h1")?.textContent);
  return heading || "";
}

function removePanel() {
  document.getElementById(ROOT_ID)?.remove();
}

function baseHost(locale) {
  const strings = copy(locale);
  removePanel();

  const host = document.createElement("div");
  host.id = ROOT_ID;
  host.style.position = "fixed";
  host.style.right = "18px";
  host.style.bottom = "18px";
  host.style.zIndex = "2147483647";
  host.style.width = "min(380px, calc(100vw - 28px))";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box}
      .shell{position:relative;padding:30px 10px 10px;background:#f3f0e9;border:1px solid rgba(23,23,20,.32);box-shadow:0 12px 34px rgba(0,0,0,.22);font-family:Arial,Helvetica,sans-serif}
      .label{position:absolute;left:11px;top:9px;font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#69675f}
      button{position:absolute;right:7px;top:4px;border:0;background:transparent;color:#171714;font-size:20px;line-height:1;cursor:pointer}
      iframe{display:block;width:100%;height:210px;border:0;background:transparent}
      .fallback{padding:15px;background:#faf8f2;border:1px solid #c9c5ba;color:#171714}
      .fallback strong{display:block;font-family:Georgia,serif;font-size:19px;font-weight:400;margin-bottom:7px}
      .fallback p{margin:0 0 10px;color:#69675f;font-size:10px;line-height:1.45}
      .fallback a{color:#171714;font-size:10px;font-weight:800}
    </style>
    <div class="shell">
      <span class="label"></span>
      <button type="button">×</button>
      <div class="body"></div>
    </div>`;

  shadow.querySelector(".label").textContent = strings.label;
  const close = shadow.querySelector("button");
  close.setAttribute("aria-label", strings.close);
  close.addEventListener("click", () => {
    closedForUrl = true;
    removePanel();
  });

  return shadow.querySelector(".body");
}

function injectWidget(result, locale) {
  const body = baseHost(locale);
  const iframe = document.createElement("iframe");
  iframe.src = result.widgetUrl;
  iframe.title =
    locale === "es"
      ? "Contexto de barrio para visitantes de dataSec"
      : "dataSec Visitor neighbourhood context";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
  body.appendChild(iframe);
}

function injectFallback(query, locale) {
  if (!query) return;

  const strings = copy(locale);
  const body = baseHost(locale);
  const wrap = document.createElement("div");
  wrap.className = "fallback";

  const title = document.createElement("strong");
  title.textContent = strings.fallbackTitle;

  const description = document.createElement("p");
  description.textContent = strings.fallbackBody;

  const link = document.createElement("a");
  const path = locale === "es" ? "/es/search" : "/search";
  link.href = `${DATASEC_ORIGIN}${path}?q=${encodeURIComponent(query)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = strings.fallbackLink;

  wrap.append(title, description, link);
  body.appendChild(wrap);
}

async function isEnabled() {
  const stored = await chrome.storage.local.get({ enabled: true });
  return stored.enabled !== false;
}

async function run() {
  if (running || closedForUrl) return;

  if (!isSupportedListingPage()) {
    removePanel();
    return;
  }

  if (!(await isEnabled())) {
    removePanel();
    return;
  }

  running = true;
  const locale = detectLocale();

  try {
    const candidates = collectCandidates();
    const precise = candidates.filter(looksPrecise).slice(0, 5);

    if (!precise.length) {
      injectFallback(pageFallbackQuery(), locale);
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "datasec:resolve-place",
      candidates: precise,
      locale,
    });

    if (response?.ok && response.result) {
      injectWidget(response.result, locale);
      return;
    }

    injectFallback(pageFallbackQuery(), locale);
  } catch (error) {
    console.warn("dataSec extension could not resolve this listing", error);
  } finally {
    running = false;
  }
}

function scheduleRun(delay = 250) {
  clearTimeout(rerunTimer);
  rerunTimer = setTimeout(() => {
    void run();
  }, delay);
}

function onPossibleNavigation() {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    closedForUrl = false;
    running = false;
    removePanel();
    scheduleRun(500);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.enabled) return;
  if (changes.enabled.newValue === false) {
    removePanel();
  } else {
    closedForUrl = false;
    scheduleRun(50);
  }
});

window.addEventListener("popstate", onPossibleNavigation);

const observer = new MutationObserver(() => {
  onPossibleNavigation();
  if (isSupportedListingPage() && !document.getElementById(ROOT_ID)) {
    scheduleRun(700);
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

setTimeout(() => void run(), 800);
setTimeout(() => void run(), 2800);
setInterval(onPossibleNavigation, 4000);
