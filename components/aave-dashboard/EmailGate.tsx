// components/aave-dashboard/EmailGate.tsx
'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'datumlabs_aave_unlocked';

export default function EmailGate({ children }: { children: React.ReactNode }) {
    const [unlocked, setUnlocked] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (localStorage.getItem(STORAGE_KEY) === 'true') {
            setUnlocked(true);
        }
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error ?? 'Subscription failed. Please try again.');
            }

            localStorage.setItem(STORAGE_KEY, 'true');
            setUnlocked(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    }

    if (!mounted) return null;
    if (unlocked) return <>{children}</>;

    return (
        <div className="relative">
            {/* Blurred content preview */}
            <div
                className="select-none max-h-[500px] overflow-hidden"
                style={{ filter: 'blur(6px)', pointerEvents: 'none' }}
            >
                {children}
            </div>

            {/* Gate overlay — fixed to viewport */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0D0F]/70 backdrop-blur-sm">
                <div className="tui-panel max-w-md w-full mx-4">
                    <div className="tui-panel-header">
                        <span className="tui-panel-title">Access Required</span>
                        <span className="tui-panel-badge">LOCKED</span>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="text-[11px] space-y-1" style={{ color: 'var(--text-muted)' }}>
                            <p>
                                <span style={{ color: 'var(--accent-orange)' }}>&gt;</span> Full dashboard access includes:
                            </p>
                            <p className="pl-4">- Real-time TVL & borrow analytics</p>
                            <p className="pl-4">- Multi-chain market data (6 networks)</p>
                            <p className="pl-4">- Wallet risk analysis & health factors</p>
                            <p className="pl-4">- Liquidation event tracking</p>
                            <p className="pl-4">- Protocol insights & methodology</p>
                            <p className="mt-2">
                                <span style={{ color: 'var(--accent-orange)' }}>&gt;</span> Enter email to unlock
                                <span className="cursor-blink" />
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div
                                className="flex items-center gap-2 rounded px-3 py-2.5 transition-colors"
                                style={{
                                    background: 'var(--background)',
                                    border: '1px solid var(--border-bright)',
                                }}
                            >
                                <span className="text-xs" style={{ color: 'var(--accent-orange)' }}>&gt;</span>
                                <input
                                    type="email"
                                    placeholder="you@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="flex-1 bg-transparent text-sm placeholder:text-[#6B7280] focus:outline-none"
                                    style={{ color: 'var(--foreground)' }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full font-bold rounded py-2.5 text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: 'var(--accent-orange)',
                                    color: '#0B0D0F',
                                }}
                            >
                                {submitting ? 'Authenticating...' : 'Unlock Dashboard'}
                            </button>
                        </form>

                        {error && (
                            <p className="text-[11px]" style={{ color: 'var(--accent-red)' }}>
                                <span>[ERR]</span> {error}
                            </p>
                        )}

                        <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                            Join the Datum Labs newsletter for full access
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
