"use client";

import * as React from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/Logo";

type Status = {
  open: boolean;
  code: string | null;
  seconds_left_in_code: number;
  late_after: string;
  closes_at: string;
  roster: number;
  checked_in: number;
  late: number;
  require_location: boolean;
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Full-screen QR for the classroom display. The code (and QR) rotates every 30 seconds. */
export function Projector({ windowId, sessionId, title, subtitle }: { windowId: string; sessionId: string; title: string; subtitle: string }) {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("checkin_status", { p_window: windowId });
      if (!alive) return;
      if (error) setError(error.message);
      else setStatus(data as Status);
    };
    load();
    const poll = setInterval(load, 2500);
    const clock = setInterval(() => setNow(Date.now()), 500);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [windowId]);

  const url = status?.code ? `${window.location.origin}/checkin/${windowId}?c=${status.code}` : null;
  React.useEffect(() => {
    if (!url) return setQr(null);
    QRCode.toDataURL(url, { width: 900, margin: 1, color: { dark: "#191919", light: "#ffffff" }, errorCorrectionLevel: "M" }).then(setQr, () => setQr(null));
  }, [url]);

  const closesIn = status ? new Date(status.closes_at).getTime() - now : 0;
  const lateIn = status ? new Date(status.late_after).getTime() - now : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-white">
      <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-10">
        <Logo dark />
        <div className="text-right">
          <p className="text-lg font-black leading-tight sm:text-2xl">{title}</p>
          <p className="text-sm text-white/60">{subtitle}</p>
        </div>
        <Link href={`/sessions/${sessionId}`} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="Exit QR screen">
          <X className="h-5 w-5" />
        </Link>
      </div>
      <div className="grid flex-1 items-center gap-8 px-6 pb-8 sm:px-10 lg:grid-cols-[1fr_380px]">
        <div className="flex items-center justify-center">
          {status?.open && qr ? (
            <div className="rounded-3xl bg-white p-4 shadow-2xl sm:p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Check-in QR code" className="h-[min(62vh,640px)] w-[min(62vh,640px)]" />
            </div>
          ) : (
            <div className="rounded-3xl bg-white/5 p-12 text-center">
              <p className="text-3xl font-black">{status ? "Check-in is closed" : error ?? "Loading…"}</p>
              {status && (
                <Link href={`/sessions/${sessionId}`} className="mt-6 inline-flex rounded-full bg-gold px-6 py-3 font-black text-ink">
                  Back to attendance
                </Link>
              )}
            </div>
          )}
        </div>
        {status?.open && (
          <div className="grid gap-6 text-center lg:text-left">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Scan to check in</p>
              <p className="mt-2 text-white/70">Open your phone camera and point it at the code. Sign in with your FoundryReady account if asked.</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">Or enter this code in your portal</p>
              <p className="mt-1 font-mono text-6xl font-black tracking-[0.2em] text-gold">{status.code}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gold transition-all duration-500" style={{ width: `${(status.seconds_left_in_code / 30) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-white/50">New code every 30 seconds</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">Checked in</p>
                <p className="mt-1 text-4xl font-black tabular-nums">
                  {status.checked_in}
                  <span className="text-xl text-white/40">/{status.roster}</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">{lateIn > 0 ? "Late in" : "Closes in"}</p>
                <p className={`mt-1 text-4xl font-black tabular-nums ${lateIn > 0 ? "" : "text-gold"}`}>{mmss(lateIn > 0 ? lateIn : closesIn)}</p>
              </div>
            </div>
            {status.require_location && <p className="text-sm text-white/60">Location is checked: allow location when your phone asks.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
