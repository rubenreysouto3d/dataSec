# dataSec stay-context browser extension — MVP prototype

This is an unpacked Chrome/Brave Manifest V3 extension for testing the accommodation workflow proposed for dataSec.

## What it does

On a supported **accommodation detail page** on Booking or Airbnb, the extension:

1. checks that the current URL looks like an actual listing, not a search/results page;
2. looks for structured or visible listing-address data;
3. only auto-resolves the listing when the extracted address looks precise enough;
4. geocodes that address with OpenStreetMap Nominatim;
5. matches the coordinates to dataSec's stored official London/Madrid boundary;
6. injects the existing dataSec **Visitor** iframe widget.

The extension never recalculates a safety signal. The visible result comes from the same dataSec widget and methodology as the website.

If a site hides the exact address — common on Airbnb before booking — the extension does **not** guess a neighbourhood from a vague location. It shows a link to the dataSec place finder instead.

The popup includes a global Enabled/Disabled switch.

## Load it locally

1. Download or clone the repository.
2. Open `chrome://extensions` in Chrome or Brave.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `extension/` directory.
6. Open a supported accommodation detail page.

No store packaging or signing is included yet.

## Current host coverage

- Booking.com accommodation pages under `/hotel/`
- Airbnb listing pages under `/rooms/...` on:
  - .com
  - .es
  - .co.uk
  - .fr
  - .de
  - .it
  - .pt
  - .nl

The underlying dataSec data coverage remains London and Madrid.

## Language

The overlay/widget uses Spanish when the page/browser language is Spanish; otherwise it uses English.

## Privacy / network calls

When a listing exposes a sufficiently precise address, the extension sends:

- the extracted address to OpenStreetMap Nominatim for geocoding;
- the resulting coordinates to dataSec's public Supabase point-in-boundary RPC;
- the resolved stable area ID to the public dataSec widget URL.

Results are cached locally for seven days. There is no analytics, affiliate tracking, account identifier or browsing-history upload in this prototype.

The extension only runs the resolution flow on supported accommodation detail URLs.

## Guardrails

- A vague city/location string is never auto-assigned to a neighbourhood.
- Duplicate/ambiguous neighbourhood logic remains on the dataSec side.
- The injected result is Visitor context only.
- The widget states that the signal is local context, not a prediction or guarantee of personal safety.
- The extension can be disabled globally from its popup.

## Still required before a store release

- Replace public Nominatim with a geocoder/service suitable for production volume and its terms.
- Add automated DOM fixture tests for representative Booking/Airbnb pages.
- Test against live listing pages in multiple locales.
- Prepare Chrome Web Store privacy disclosures and screenshots.
- Review Booking/Airbnb terms for the final integration model.
- Minimise host permissions further if the production geocoding architecture changes.
- Add affiliate tracking only after the non-commercial context flow is stable, and never allow affiliate relationships to affect the underlying dataSec signal.
