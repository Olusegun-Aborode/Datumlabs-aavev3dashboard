// app/dashboard/layout.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import EmailGate from '@/components/aave-dashboard/EmailGate';
import VersionSwitcher from '@/components/aave-dashboard/VersionSwitcher';
import { useAaveVersion } from '@/components/aave-dashboard/useAaveVersion';
import { parseVersion } from '@/lib/aave/version';

const navItems = [
    { href: '/dashboard/overview', label: 'Overview' },
    { href: '/dashboard/markets', label: 'Markets' },
    { href: '/dashboard/wallets', label: 'Wallets' },
    { href: '/dashboard/liquidations', label: 'Liquidations' },
    { href: '/dashboard/insights', label: 'Insights' },
];

function VersionTitle() {
    const { version } = useAaveVersion();
    const label = version === 'all' ? 'V3 + V4' : version.toUpperCase();
    return <>Aave {label} Risk Terminal</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const version = parseVersion(searchParams.get('version'));

    // Preserve the active ?version= across nav clicks so users don't fall back
    // to the default (v3) every time they navigate between pages.
    const withVersion = (href: string) =>
        version === 'v3' ? href : `${href}?version=${version}`;

    return (
        <div className="min-h-screen font-mono flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>
            {/* Top Navigation Bar */}
            <nav style={{ borderBottom: "1px solid var(--border)", background: "var(--panel-header)" }}>
                <div className="max-w-[1400px] mx-auto px-4 lg:px-6 flex items-center justify-between h-10">
                    <div className="flex items-center gap-3">
                        <Image src="/branding/icon.png" alt="Datum Labs" width={22} height={22} className="rounded-sm" />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>|</span>
                        <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
                            <Suspense fallback={<>Aave Risk Terminal</>}>
                                <VersionTitle />
                            </Suspense>
                        </span>
                        <Suspense fallback={null}>
                            <VersionSwitcher />
                        </Suspense>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Nav Links */}
                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={withVersion(item.href)}
                                        className="px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] rounded transition-colors"
                                        style={{
                                            color: isActive ? "var(--accent-orange)" : "var(--text-muted)",
                                            background: isActive ? "rgba(255, 107, 53, 0.08)" : "transparent",
                                            borderBottom: isActive ? "1px solid var(--accent-orange)" : "1px solid transparent",
                                        }}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-orange)" }} />
                            CONNECTED
                        </span>
                    </div>
                </div>
            </nav>

            {/* Mobile Nav */}
            <div className="md:hidden flex items-center gap-1 px-4 py-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)", background: "var(--panel-header)" }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={withVersion(item.href)}
                            className="px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] rounded whitespace-nowrap transition-colors"
                            style={{
                                color: isActive ? "var(--accent-orange)" : "var(--text-muted)",
                                background: isActive ? "rgba(255, 107, 53, 0.08)" : "transparent",
                            }}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>

            {/* Main Content */}
            <main className="flex-1">
                <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-5">
                    <EmailGate>
                        {children}
                    </EmailGate>
                </div>
            </main>

            {/* Status Bar */}
            <div className="flex items-center justify-between px-4 lg:px-6 h-7 text-[11px]" style={{ borderTop: "1px solid var(--border)", background: "var(--panel-header)", color: "var(--text-muted)" }}>
                <div className="flex items-center gap-1.5">
                    <span style={{ color: "var(--accent-orange)" }}>&gt;</span>
                    <span>datumlabs.xyz/aave-terminal</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="hidden sm:inline">Networks: ETH + ARB + BASE + OP + POLY + AVAX</span>
                    <span className="hidden sm:inline">Cache: 5m</span>
                    <span>Powered by The Graph</span>
                </div>
            </div>
        </div>
    );
}
