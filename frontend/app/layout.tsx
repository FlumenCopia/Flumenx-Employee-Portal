import type { Metadata } from "next";
import { Jost } from "next/font/google";
import { AppInitialLoader } from "@/components/AppInitialLoader";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "FLUMENX · Employee Portal",
  description: "A connected workplace, built around people.",
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
