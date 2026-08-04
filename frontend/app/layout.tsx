import type { Metadata } from "next";
import { Jost, Lora } from "next/font/google";
import { AppInitialLoader } from "@/components/AppInitialLoader";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], variable: "--font-body" });
const lora = Lora({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "FLUMENX · Employee Portal",
  description: "A connected workplace, built around people.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${jost.variable} ${lora.variable}`}>
        <AppInitialLoader>{children}</AppInitialLoader>
      </body>
    </html>
  );
}
