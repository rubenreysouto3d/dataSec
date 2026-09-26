const DATASEC_ORIGIN = "https://data-sec.vercel.app";
const ROOT_ID = "datasec-stay-context-root";

let lastUrl = location.href;
let closedForUrl = false;
let running = false;

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function visitJson(value, candidates) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) visitJson(item, candidates);
    return;
  }
  if (typeof value !== "object") return;

  const address = addressFromObject(value.address);
  if (address) candidates.push(address);

  const locationAddress = addressFromObject(value.location?.address);
  if (locationAddress) candidates.push(locationAddress);

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") visitJson(child, candidates);
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

  return [...new Set(candidates)].filter(Boolean).slice(0, 12);
}

function looksPrecise(candidate) {
  const text = candidate.toLowerCase();
  const hasNumber = /\b\d{1,5}[a-z]?\b/i.test(candidate);
  const hasUkPostcode = /\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(candidate);
  const hasSpanishPostcode = /\b\d{5}\b/.test(candidate);
  const hasStreetWord = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|calle|c\/?|avenida|av\.?|paseo|plaza|ronda|carrer|travessera)\b/i.test(text);
  return hasUkPostcode || hasSpanishPostcode || (hasNumber && hasStreetWord);
}

function pageFallbackQuery() {
  const address = collectCandidates()[0];
  if (address) return address;

  const heading = normalize(document.querySelector("h1")?.textContent);
  const title = normalize(document.title);
  return heading || title;
}

function removePanel() {
  document.getElementById(ROOT_ID)?.remove();
}

function baseHost() {
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
      <span class="label">dataSec · listing context</span>
      <button type="button" aria-label="Close dataSec context">×</button>
      <div class="body"></div>
    </div>`;

  shadow.querySelector("button").addEventListener("click", () => {
    closedForUrl = true;
    removePanel();
  });

  return shadow.querySelector(".body");
}

function injectWidget(result) {
  const body = baseHost();
  const iframe = document.createElement("iframe");
  iframe.src = result.widgetUrl;
  iframe.title = "dataSec Visitor neighbourhood context";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
  body.appendChild(iframe);
}

function injectFallback(query) {
  if (!query) return;
  const body = baseHost();
  const wrap = document.createElement("div");
  wrap.className = "fallback";

  const title = document.createElement("strong");
  title.textContent = "Check this stay on dataSec";
  const copy = document.createElement("p");
  copy.textContent =
    "This listing does not expose a precise enough address to assign a neighbourhood automatically. Open the place finder instead.";
  const link = document.createElement("a");
  link.href = `${DATASEC_ORIGIN}/search?q=${encodeURIComponent(query)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open place finder →";

  wrap.append(title, copy, link);
  body.appendChild(wrap);
}

async function run() {
  if (running || closedForUrl) return;
  running = true;

  try {
    const candidates = collectCandidates();
    const precise = candidates.filter(looksPrecise);

    if (!precise.length) {
      injectFallback(pageFallbackQuery());
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "datasec:resolve-place",
      candidates: precise,
    });

    if (response?.ok && response.result) {
      injectWidget(response.result);
      return;
    }

    injectFallback(pageFallbackQuery());
  } catch (error) {
    console.warn("dataSec extension could not resolve this listing", error);
  } finally {
    running = false;
  }
}

function onPossibleNavigation() {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    closedForUrl = false;
    removePanel();
  }
  run();
}

setTimeout(run, 800);
setTimeout(run, 3000);
setInterval(onPossibleNavigation, 2500);
