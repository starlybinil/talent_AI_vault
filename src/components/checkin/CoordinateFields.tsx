"use client";

import { useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Input, Label } from "@/components/ui";

/** Latitude / longitude / radius inputs for a training site, with a "use where I am now" shortcut. */
export function CoordinateFields({ id, latitude, longitude, radius }: { id: string; latitude?: number | null; longitude?: number | null; radius?: number | null }) {
  const lat = useRef<HTMLInputElement>(null);
  const lng = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) return setMsg("This browser can't share its location.");
    setMsg("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (lat.current) lat.current.value = p.coords.latitude.toFixed(6);
        if (lng.current) lng.current.value = p.coords.longitude.toFixed(6);
        setMsg(`Filled in (accurate to about ${Math.round(p.coords.accuracy)} m). Save to keep it.`);
      },
      () => setMsg("Couldn't get your location. Allow location access, or type the coordinates."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <fieldset className="grid gap-3 rounded-xl border border-ink/10 p-4 sm:col-span-3 sm:grid-cols-3">
      <legend className="px-1 text-sm font-bold">Check-in area (only used by programs that check location)</legend>
      <div>
        <Label htmlFor={`lat-${id}`}>Latitude</Label>
        <Input ref={lat} id={`lat-${id}`} name="latitude" inputMode="decimal" defaultValue={latitude ?? ""} placeholder="33.4242" />
      </div>
      <div>
        <Label htmlFor={`lng-${id}`}>Longitude</Label>
        <Input ref={lng} id={`lng-${id}`} name="longitude" inputMode="decimal" defaultValue={longitude ?? ""} placeholder="-111.9281" />
      </div>
      <div>
        <Label htmlFor={`rad-${id}`}>Allowed distance (meters)</Label>
        <Input id={`rad-${id}`} name="radius_m" type="number" min={20} max={5000} defaultValue={radius ?? 100} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="button" onClick={locate} className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-sm font-bold hover:border-maroon hover:text-maroon">
          <LocateFixed className="h-4 w-4" aria-hidden /> Use my current location
        </button>
        <span className="text-xs text-ink/60" aria-live="polite">
          {msg ?? "Stand in the classroom and tap this, or copy the coordinates from a map. The instructor's position at check-in is used if this is blank."}
        </span>
      </div>
    </fieldset>
  );
}
