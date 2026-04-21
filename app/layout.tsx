import type { Metadata } from 'next';
import { JetBrains_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-next',
});

const ibmPlex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-next',
});

export const metadata: Metadata = {
  title: 'Aave Risk Terminal — Datum Labs',
  description:
    'Real-time risk analytics and monitoring for Aave V3 & V4 across supported chains',
};

/**
 * Pre-paint script — applies saved theme / aesthetic / density body
 * data-attrs from localStorage before React mounts, so the first frame
 * matches the user's last session (no flash of default theme).
 */
const THEME_BOOT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('datumlabs.theme') || 'light';
    var a = localStorage.getItem('datumlabs.aesthetic') || 'evolved';
    var d = localStorage.getItem('datumlabs.density') || 'cozy';
    document.body.dataset.theme = t;
    document.body.dataset.aesthetic = a;
    document.body.dataset.density = d;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        data-theme="light"
        data-aesthetic="evolved"
        data-density="cozy"
        className={`${jetbrainsMono.variable} ${ibmPlex.variable} antialiased min-h-screen`}
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
