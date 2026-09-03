import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppInitialLoader } from "@/components/AppInitialLoader";
import { ToastProvider } from "@/components/ToastContext";
import { WebRTCProvider } from "@/features/chat/WebRTCContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FLUMENX BOS · Enterprise Business Operating System",
  description: "FLUMENX BOS — Unified enterprise business operating system and operations management.",
  manifest: "/manifest.json",
  themeColor: "#087A5B",
  appleWebApp: {
  capable: true,
  statusBarStyle: "black-translucent",
  title: "FLUMENX BOS",
  },
  icons: {
    icon: "/flumenx-mark-only.png",
    shortcut: "/flumenx-mark-only.png",
    apple: "/flumenx-mark-only.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body className={inter.className}>
        <ToastProvider>
          <WebRTCProvider>
            <AppInitialLoader>{children}</AppInitialLoader>
          </WebRTCProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
