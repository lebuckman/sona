import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" });

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-serif", axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Sona — Understand your music",
  description: "AI-powered music insights built on your Spotify listening history",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(instrumentSans.variable, fraunces.variable)}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
