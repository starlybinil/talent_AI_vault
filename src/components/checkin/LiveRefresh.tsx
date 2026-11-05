"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** While check-in is open, refresh the page whenever someone new checks in (polls every 4 seconds). */
export function LiveRefresh({ windowId }: { windowId: string }) {
  const router = useRouter();
  const last = React.useRef<number | null>(null);
  React.useEffect(() => {
    const supabase = createClient();
    let stop = false;
    const tick = async () => {
      const { data } = await supabase.rpc("checkin_status", { p_window: windowId });
      const s = data as { checked_in: number; open: boolean } | null;
      if (stop || !s) return;
      if (last.current !== null && (s.checked_in !== last.current || !s.open)) router.refresh();
      last.current = s.checked_in;
      if (!s.open) stop = true;
    };
    tick();
    const t = setInterval(() => !stop && tick(), 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [windowId, router]);
  return null;
}
