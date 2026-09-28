import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FoundryReady · Trained today. Ready to start.",
    template: "%s · FoundryReady",
  },
  description:
    "FoundryReady: no-cost, hands-on training for entry-level semiconductor and advanced manufacturing careers, funded by government and industry and built with university and employer partners.",
  openGraph: {
    title: "FoundryReady · Trained today. Ready to start.",
    description: "No-cost, hands-on training programs that prepare you for entry-level advanced manufacturing careers, built with universities and the employers who are hiring.",
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
