import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const ReactScan = dynamic(
  () => import("@/components/dev/ReactScan").then((m) => m.ReactScan),
  { ssr: false },
);

export const metadata: Metadata = {
  title: "SentinelTwin — Physical Security Site Twin",
  description: "Model site coverage, test camera failures, review critical-zone risk, and produce security audit evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">
        {children}
        <Analytics />
        <ReactScan />
      </body>
    </html>
  );
}
