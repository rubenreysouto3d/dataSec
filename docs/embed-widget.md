# Embeddable dataSec widget

This document describes the current partner-facing widget prototype.

## Purpose

The widget is a lightweight integration surface for accommodation, relocation and property products. It renders the same city-local dataSec context used by the public site.

It is intentionally an iframe, not a public scoring API. This keeps the visible methodology, branding and disclaimer coupled to the result while the product model is still being validated.

## Coordinate integration

Use:

```html
<iframe
  src="https://data-sec.vercel.app/widget/point?lat=40.4168&lng=-3.7038&view=visitor&lang=en"
  title="dataSec neighbourhood context"
  loading="lazy"
  style="width:100%;max-width:420px;height:210px;border:0"
></iframe>
```

Parameters:

- `lat`: latitude, required.
- `lng`: longitude, required.
- `view`: `visitor` (default) or `resident`.
- `lang`: `en` (default) or `es`.

The point endpoint resolves coordinates against dataSec's stored official area boundaries and redirects the iframe to the stable area widget.

## Stable area integration

If an integration already stores a dataSec area ID, use:

```
/widget/<area-path-id>?view=visitor&lang=en
```

## Current coverage

- London
- Madrid

## Product guardrails

- Percentiles and levels are relative inside each city only.
- The widget does not expose a Europe-wide safety score.
- The widget remains visibly dataSec-branded.
- The widget includes a visible limitation statement.
- Partner or affiliate relationships must never alter the underlying signal.
- This prototype is not yet a contracted SLA/API product.

## Next commercial steps

Before selling this as a licensed widget:

1. define rate limits and availability targets;
2. define permitted partner use and display requirements;
3. add partner keys only if usage control is needed;
4. add aggregate usage telemetry that does not collect unnecessary end-user location data;
5. review liability wording and contractual disclaimers;
6. add more cities only after the shared methodology contract remains stable.
