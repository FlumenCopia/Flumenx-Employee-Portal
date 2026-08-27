import type { Metadata } from "next";
import { Jost } from "next/font/google";
import { AppInitialLoader } from "@/components/AppInitialLoader";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "FLUMENX OS · Enterprise Operating System",
  description: "FLUMENX OS — Unified enterprise workspace and operations management.",
  manifest: "/manifest.json",
  themeColor: "#087A5B",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FLUMENX OS",
  },
  icons: {
    icon: "/flumen-favicon.png",
    shortcut: "/flumen-favicon.png",
    apple: "/flumen-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={jost.variable}>
        <AppInitialLoader>{children}</AppInitialLoader>
      </body>
    </html>
  );
}
