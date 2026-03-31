import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aave V3 Risk Terminal — Datum Labs",
  description: "Real-time risk analytics and monitoring for Aave V3 on Ethereum & Arbitrum",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${mono.variable} font-mono antialiased`}
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
