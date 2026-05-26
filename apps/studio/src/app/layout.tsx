import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelTwin Studio — Camera Coverage Testbed",
  description: "AI-native physical security simulation. Edit scene → recompute coverage → show security impact.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
