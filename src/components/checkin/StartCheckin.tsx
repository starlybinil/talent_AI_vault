"use client";

import * as React from "react";
import { MapPin, QrCode } from "lucide-react";
import { startCheckin } from "@/app/sessions/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";

/** Opens check-in. When the program checks location, the instructor can use this device's position as the classroom. */
export function StartCheckin({ sessionId, needsLocation, hasSavedLocation, windowMinutes, lateMinutes }: {
  sessionId: string;
  needsLocation: boolean;
  hasSavedLocation: boolean;
  windowMinutes: number;
  lateMinutes: number;
}) {
  const [coords, setCoords] = React.useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [locError, setLocError] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);

  function locate() {
    setLocError(null);
    if (!("geolocation" in navigator)) return setLocError("This device can't share its location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
      },
      (e) => {
        setLocating(false);
        setLocError(e.code === 1 ? "Location permission was denied." : "Couldn't get this device's location. Try again near a window.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <ActionForm action={startCheckin} className="grid gap-3">
      <input type="hidden" name="session_id" value={sessionId} />
      {coords && (
        <>
          <input type="hidden" name="lat" value={coords.lat} />
          <input type="hidden" name="lng" value={coords.lng} />
        </>
      )}
      <p className="text-sm text-ink/70">
        Opens for <strong>{windowMinutes} minutes</strong>; check-ins after <strong>{lateMinutes} minutes</strong> count as Late. The QR code changes every 30 seconds.
      </p>
      {needsLocation && (
        <div className="rounded-xl bg-mist p-3 text-sm">
          <p className="font-bold">This program checks that trainees are at the training site.</p>
          <p className="mt-1 text-ink/60">
            {coords
              ? `Using this device's location (±${Math.round(coords.acc)} m) as the classroom.`
              : hasSavedLocation
                ? "The training location's saved position is used. Or use this device's location instead:"
                : "The training location has no saved position yet. Use this device's location (stand in the classroom):"}
          </p>
          {!coords && (
            <button type="button" onClick={locate} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-bold hover:border-ink">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {locating ? "Getting location…" : "Use my current location"}
            </button>
          )}
          {locError && <p className="mt-2 text-xs font-bold text-red-700">{locError}</p>}
        </div>
      )}
      <SubmitButton size="lg" className="justify-self-start" pendingText="Opening…" disabled={needsLocation && !hasSavedLocation && !coords}>
        <QrCode className="h-5 w-5" aria-hidden /> Start QR check-in
      </SubmitButton>
    </ActionForm>
  );
}
