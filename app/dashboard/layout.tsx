// app/dashboard/layout.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, Wallet, AlertTriangle, Sparkles } from 'lucide-react';

const navItems = [
    { href: '/dashboard/overview', label: 'Overview', icon: BarChart3 },
    { href: '/dashboard/markets', label: 'Markets', icon: TrendingUp },
    { href: '/dashboard/wallets', label: 'Wallets', icon: Wallet },
    { href: '/dashboard/liquidations', label: 'Liquidations', icon: AlertTriangle },
    { href: '/dashboard/insights', label: 'Insights', icon: Sparkles },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-background flex">
            {/* Premium Sidebar */}
            <aside className="w-56 border-r border-sidebar-border bg-sidebar flex flex-col">
                {/* Compact Logo Header */}
                <div className="p-4 border-b border-sidebar-border">
                    <div className="flex items-center gap-2.5">
                        <Image
                            src="/branding/icon.png"
                            alt="Datum Labs"
                            width={32}
                            height={32}
                            className="rounded-lg"
                        />
                        <div>
                            <h1 className="text-base font-bold text-primary">Datum Labs</h1>
                            <p className="text-[10px] text-muted-foreground">Aave V3 Risk</p>
                        </div>
                    </div>
                </div>

                {/* Compact Navigation */}
                <nav className="flex-1 p-3">
                    <ul className="space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                                            isActive
                                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Footer Link */}
                <div className="p-4 border-t border-sidebar-border">
                    <a
                        href="https://datumlabs.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                        <span>datumlabs.xyz</span>
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-[1600px] mx-auto p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
