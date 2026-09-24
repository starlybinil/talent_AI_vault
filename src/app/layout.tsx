import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FoundryReady · Trained today. Ready on day one.",
    template: "%s · FoundryReady",
  },
  description:
    "FoundryReady: no-cost, hands-on training for semiconductor and advanced manufacturing careers, funded by government and industry. Apply to the ASU-TSMC Foundations for Equipment Technician Program.",
  openGraph: {
    title: "FoundryReady — ASU-TSMC Equipment Technician Program",
    description: "$0 · 192+ hands-on hours · a guaranteed TSMC Arizona interview upon successful completion of ASU & TSMC program milestones.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#191919",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
