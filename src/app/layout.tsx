import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Talent-Vault — Advanced Manufacturing Training Programs",
    template: "%s · Talent-Vault",
  },
  description:
    "No-cost, hands-on training for semiconductor and advanced manufacturing careers. Apply to the ASU-TSMC Foundations for Equipment Technician Program.",
  openGraph: {
    title: "Talent-Vault — ASU-TSMC Equipment Technician Program",
    description: "$0 · 192+ hands-on hours · a guaranteed TSMC Arizona interview upon successful completion.",
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
