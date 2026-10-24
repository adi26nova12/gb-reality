import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl } from "@/lib/env";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for link-preview images (WhatsApp needs them).
  metadataBase: new URL(getSiteUrl()),
  title: { default: "Clannco", template: "%s · Clannco" },
  description: "Personalised property microsites, tracked brochures and enquiry management for property sales teams.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#121614",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
