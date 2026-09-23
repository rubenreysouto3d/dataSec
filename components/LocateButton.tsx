"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { locateAreaByCoordinates } from "@/lib/public-data-client";

export default function LocateButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [message, setMessage] = useState("");

  function locate() {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("Location is not available in this browser.");
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
            setMessage("Your location is outside the current dataSec coverage.");
            return;
          }
          router.push(`/area/${encodeURIComponent(area.id)}`);
        } catch {
          setStatus("error");
          setMessage("We could not match your location to a stored official boundary.");
        }
      },
      () => {
        setStatus("error");
        setMessage("Location permission was not available.");
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
        {status === "locating" ? "Finding your area…" : "Use my location"}
      </button>
      <span className="locate-note">
        Matches your coordinates to the stored official boundary. dataSec does not save them in its tables.
      </span>
      {status === "error" ? <span className="locate-error">{message}</span> : null}
    </div>
  );
}
