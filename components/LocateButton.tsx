"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { locateAreaByCoordinates } from "@/lib/public-data-client";
import { areaHref } from "@/lib/area-route";
import { localeHref, tr, type Locale } from "@/lib/i18n";

export default function LocateButton({ locale = "en" }: { locale?: Locale }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [message, setMessage] = useState("");

  function locate() {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage(tr(locale, "Location is not available in this browser.", "La ubicación no está disponible en este navegador."));
      return;
    }

    setStatus("locating");
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const area = await locateAreaByCoordinates(coords.latitude, coords.longitude);
          if (!area) {
            setStatus("error");
            setMessage(tr(locale, "Your location is outside the current dataSec coverage.", "Tu ubicación está fuera de la cobertura actual de dataSec."));
            return;
          }
          router.push(localeHref(locale, areaHref(area.id)));
        } catch {
          setStatus("error");
          setMessage(tr(locale, "We could not match your location to a stored official boundary.", "No pudimos asociar tu ubicación a un límite oficial almacenado."));
        }
      },
      () => {
        setStatus("error");
        setMessage(tr(locale, "Location permission was not available.", "No se pudo obtener permiso de ubicación."));
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  return (
    <div className="locate-wrap">
      <button className="locate-button" type="button" onClick={locate} disabled={status === "locating"}>
        {status === "locating"
          ? tr(locale, "Finding your area…", "Buscando tu zona…")
          : tr(locale, "Use my location", "Usar mi ubicación")}
      </button>
      <span className="locate-note">
        {tr(
          locale,
          "Matches your coordinates to the stored official boundary. dataSec does not save them in its tables.",
          "Asocia tus coordenadas al límite oficial almacenado. dataSec no las guarda en sus tablas.",
        )}
      </span>
      {status === "error" ? <span className="locate-error">{message}</span> : null}
    </div>
  );
}
