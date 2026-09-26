# dataSec stay-context browser extension — prototype

This is an unpacked Chrome/Brave Manifest V3 prototype for testing the accommodation workflow proposed for dataSec.

## What it does

On supported Booking and Airbnb pages, the extension:

1. looks for structured or visible listing-address data;
2. only auto-resolves the listing when the extracted address looks precise enough;
3. geocodes that address with OpenStreetMap Nominatim;
4. matches the coordinates to dataSec's stored official London/Madrid boundary;
5. injects the existing dataSec **Visitor** iframe widget.

The extension never recalculates a safety score. The visible result comes from the same dataSec widget and methodology used by the site.

If a site hides the exact address — common on Airbnb before booking — the extension does **not** assign a neighbourhood from a vague city/location label. It shows a link to the dataSec place finder instead.

## Load it locally

1. Open `chrome://extensions` in Chrome or Brave.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `extension/` directory.
5. Open a supported accommodation listing.

No store packaging or signing is included yet.

## Current host coverage

- Booking.com
- Airbnb: .com, .es, .co.uk, .fr, .de, .it, .pt, .nl

The underlying dataSec coverage remains London and Madrid.

## Privacy / network calls

For a listing with a sufficiently precise address, the prototype sends:

- the extracted address to OpenStreetMap Nominatim for geocoding;
- the resulting coordinates to dataSec's public Supabase point-in-boundary RPC;
- the resolved stable area ID to the public dataSec widget URL.

There is no analytics, affiliate tracking, account identifier, or browsing-history upload in this prototype.

## Known limitations before any store release

- Accommodation sites change DOM/structured-data markup frequently.
- Airbnb often withholds exact addresses, so fallback mode is expected.
- Nominatim should not be the long-term high-volume geocoding backend; production should use a compliant dedicated geocoder or a controlled server-side lookup service.
- Store privacy disclosures, site terms, permission minimisation and a proper QA matrix are still required.
- Affiliate links are intentionally absent. Monetisation must not affect the underlying dataSec signal or ranking.
