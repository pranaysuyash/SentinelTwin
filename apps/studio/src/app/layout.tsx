import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelTwin — AI Security Audit Studio",
  description: "Create a site, model CCTV coverage, find blind spots, test fixes, and generate client-ready security audit reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
