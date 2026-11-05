"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, MapPin, XCircle } from "lucide-react";
import { checkIn, type CheckInResult } from "@/app/sessions/actions";
import { Button, Input, Label } from "@/components/ui";

/** A random ID kept on this phone, used only to spot one phone checking in two trainees. */
function deviceId(): string | null {
  try {
    let id = localStorage.getItem("fr_device");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("fr_device", id);
    }
    return id;
  } catch {
    return null;
  }
}

function getPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * Check in from a scanned QR (windowId + code from the link: checks in right away) or by typing the code
 * shown on screen (windowId null, used in the portal).
 */
export function CheckInFlow({ windowId, code: initialCode, requireLocation, auto }: { windowId: string | null; code?: string; requireLocation: boolean; auto: boolean }) {
  const [code, setCode] = React.useState(initialCode ?? "");
  const [phase, setPhase] = React.useState<"idle" | "locating" | "sending" | "done">("idle");
  const [result, setResult] = React.useState<CheckInResult | null>(null);
  const started = React.useRef(false);

  const run = React.useCallback(
    async (c: string) => {
      setResult(null);
      let pos: { lat: number; lng: number; accuracy: number } | null = null;
      if (requireLocation) {
        setPhase("locating");
        pos = await getPosition();
      }
      setPhase("sending");
      const res = await checkIn({ windowId, code: c, lat: pos?.lat, lng: pos?.lng, accuracy: pos?.accuracy, device: deviceId() });
      setResult(res);
      setPhase(res.ok ? "done" : "idle");
    },
    [windowId, requireLocation],
  );

  React.useEffect(() => {
    if (auto && initialCode && !started.current) {
      started.current = true;
      run(initialCode);
    }
  }, [auto, initialCode, run]);

  if (result?.ok) {
    const late = result.status === "late";
    return (
      <div className={`rounded-3xl p-8 text-center ${late ? "bg-amber-50" : "bg-emerald-50"}`}>
        {late ? <Clock className="mx-auto h-14 w-14 text-amber-600" /> : <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />}
        <p className="mt-4 text-2xl font-black">{result.already ? "You're already checked in" : late ? "Checked in: Late" : "You're checked in!"}</p>
        <p className="mt-1 text-ink/70">
          {result.status === "absent" ? "Your instructor recorded you as Absent for this session." : `${late ? "Late" : "Present"} · ${time(result.at)}`}
        </p>
        {result.flag && (
          <p className="mt-3 text-sm text-ink/60">
            {result.flag === "no_location"
              ? "We couldn't confirm your location, so your cohort manager may review this check-in."
              : result.flag === "outside_area"
                ? "Your phone's location looked outside the training site, so your cohort manager may review this check-in."
                : "This phone was already used to check in someone else, so your cohort manager may review this check-in."}
          </p>
        )}
        <Link href="/portal" className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-maroon">
          Go to my portal
        </Link>
      </div>
    );
  }

  const busy = phase === "locating" || phase === "sending";
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(code);
      }}
    >
      {busy ? (
        <div className="flex items-center gap-3 rounded-2xl bg-mist p-5 font-bold">
          <Loader2 className="h-5 w-5 animate-spin text-maroon" />
          {phase === "locating" ? "Checking your location… allow location if your phone asks." : "Checking you in…"}
        </div>
      ) : (
        <>
          {(!auto || result) && (
            <div>
              <Label htmlFor="ci-code">Code on the screen</Label>
              <Input
                id="ci-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7F3A9C"
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                className="font-mono text-2xl tracking-[0.3em]"
                required
              />
            </div>
          )}
          {requireLocation && (
            <p className="flex items-start gap-2 text-sm text-ink/60">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Your instructor checks that you&apos;re at the training site, so your phone will ask to share
              your location. Only the distance is saved.
            </p>
          )}
          {result && !result.ok && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {result.error}
            </p>
          )}
          {(!auto || result) && (
            <Button type="submit" size="lg">
              Check in
            </Button>
          )}
        </>
      )}
    </form>
  );
}
