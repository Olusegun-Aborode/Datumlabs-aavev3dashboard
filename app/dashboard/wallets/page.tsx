// app/dashboard/wallets/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import TuiPanel, { TuiDivider } from '@/components/aave-dashboard/TuiPanel';
import { formatCurrency, formatAddress, getHealthFactorStatus } from '@/lib/aave/helpers';
import { useAaveVersion } from '@/components/aave-dashboard/useAaveVersion';
import { type AaveVersion } from '@/lib/aave/version';

async function getWalletsData(version: AaveVersion, page: number, pageSize: number, hideEmpty: boolean, hideNoBorrow: boolean, chain?: string) {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        hideEmpty: String(hideEmpty),
        hideNoBorrow: String(hideNoBorrow),
    });
    if (chain && chain !== 'all') params.set('chain', chain);
    if (version !== 'v3') params.set('version', version);
    const res = await fetch(`/api/aave/wallets?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch wallets data');
    return res.json();
}

export default function WalletsPage() {
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [searchTerm, setSearchTerm] = useState('');
    const [riskFilter, setRiskFilter] = useState<'all' | 'safe' | 'moderate' | 'high'>('all');
    const [hideEmpty, setHideEmpty] = useState(true);
    const [hideNoBorrow, setHideNoBorrow] = useState(false);
    const [chain, setChain] = useState<string>('all');
    const { version } = useAaveVersion();

    const { data, isLoading, error } = useQuery({
        queryKey: ['walletsData', version, page, pageSize, hideEmpty, hideNoBorrow, chain],
        queryFn: () => getWalletsData(version, page, pageSize, hideEmpty, hideNoBorrow, chain),
    });

    const filteredAccounts = useMemo(() => {
        if (!data || !data.accounts) return [];

        return data.accounts.filter((account: any) => {
            const matchesSearch = account.address.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesRisk = true;
            if (riskFilter !== 'all') {
                if (riskFilter === 'safe') matchesRisk = !account.healthFactor || account.healthFactor >= 1.5;
                else if (riskFilter === 'moderate') matchesRisk = account.healthFactor && account.healthFactor >= 1.1 && account.healthFactor < 1.5;
                else if (riskFilter === 'high') matchesRisk = account.healthFactor && account.healthFactor < 1.1;
            }
            return matchesSearch && matchesRisk;
        });
    }, [data, searchTerm, riskFilter]);

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message="Failed to load wallets data. Please try again." />;

    const protocol = data.protocol || { totalSupplied: 0, totalBorrowed: 0, walletCount: 0 };

    const riskFilters = [
        { key: 'all', label: 'ALL' },
        { key: 'safe', label: 'SAFE (≥1.5)' },
        { key: 'moderate', label: 'MOD (1.1-1.5)' },
        { key: 'high', label: 'HIGH (<1.1)' },
    ] as const;

    return (
        <div className="space-y-4">
            {data.notice && (
                <div
                    className="p-3 text-[11px] rounded"
                    style={{
                        background: 'var(--card)',
                        border: '1px solid var(--accent-orange)',
                        color: 'var(--text-muted)',
                    }}
                >
                    <span style={{ color: 'var(--accent-orange)' }}>ℹ</span> {data.notice}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--foreground)" }}>
                    Wallets
                </h2>
                <select
                    value={chain}
                    onChange={(e) => { setChain(e.target.value); setPage(1); }}
                    className="text-[11px] uppercase tracking-[0.05em] px-3 py-1.5 rounded cursor-pointer outline-none"
                    style={{
                        background: 'var(--card)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border-bright)',
                    }}
                >
                    <option value="all">All Chains</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="base">Base</option>
                    <option value="optimism">Optimism</option>
                    <option value="polygon">Polygon</option>
                    <option value="avalanche">Avalanche</option>
                    <option value="bnb">BNB Chain</option>
                    <option value="gnosis">Gnosis</option>
                    <option value="linea">Linea</option>
                </select>
            </div>

            {/* Summary counters */}
            <div className="tui-panel" style={{ overflow: 'visible' }}>
                <div className="tui-panel-header">
                    <span className="tui-panel-title">Wallet Summary</span>
                    <span className="relative group cursor-help text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        &#9432;
                        <span className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block w-56 p-2 rounded text-[10px] leading-relaxed normal-case"
                            style={{ background: 'var(--card)', border: '1px solid var(--border-bright)', color: 'var(--text-muted)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            Source: The Graph subgraphs (Messari + Aave official). User positions queried per chain, health factor computed from collateral * liquidation threshold / debt.
                        </span>
                    </span>
                </div>
                <div className="grid grid-cols-3">
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: "var(--border)" }}>
                        <p className="counter-label">Wallets</p>
                        <p className="counter-value" style={{ color: "var(--accent-orange)" }}>
                            {protocol.walletCount > 0 ? protocol.walletCount.toLocaleString() : '—'}
                        </p>
                    </div>
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: "var(--border)" }}>
                        <p className="counter-label">Total Supplied</p>
                        <p className="counter-value" style={{ color: "var(--accent-green)" }}>
                            {formatCurrency(protocol.totalSupplied)}
                        </p>
                    </div>
                    <div className="p-4 lg:p-5">
                        <p className="counter-label">Total Borrowed</p>
                        <p className="counter-value" style={{ color: "var(--accent-blue)" }}>
                            {formatCurrency(protocol.totalBorrowed)}
                        </p>
                    </div>
                </div>
            </div>

            <TuiDivider label="User Positions" />

            {/* Filters + Table */}
            <TuiPanel title="Positions" badge={`Page ${page} · ${filteredAccounts.length} shown`} noPadding>
                {/* Filter bar */}
                <div className="px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <input
                        type="text"
                        placeholder="Search address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-48 text-xs px-3 py-1.5 rounded outline-none"
                        style={{
                            background: "var(--background)",
                            border: "1px solid var(--border-bright)",
                            color: "var(--foreground)",
                        }}
                    />
                    <div className="flex items-center gap-1">
                        {riskFilters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setRiskFilter(f.key)}
                                className={`time-btn ${riskFilter === f.key ? 'active' : ''}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 ml-auto">
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            <input
                                type="checkbox"
                                checked={hideEmpty}
                                onChange={(e) => { setHideEmpty(e.target.checked); setPage(1); }}
                                className="accent-[#FF6B35]"
                            />
                            Hide empty
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            <input
                                type="checkbox"
                                checked={hideNoBorrow}
                                onChange={(e) => { setHideNoBorrow(e.target.checked); setPage(1); }}
                                className="accent-[#FF6B35]"
                            />
                            Borrowers only
                        </label>
                    </div>
                </div>

                {/* Data table */}
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Address</th>
                                <th className="text-right">Collateral</th>
                                <th className="text-right">Debt</th>
                                <th className="text-right">Health Factor</th>
                                <th className="text-right">Positions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-6" style={{ color: "var(--text-muted)" }}>
                                        No wallets found matching filters
                                    </td>
                                </tr>
                            ) : (
                                filteredAccounts.map((account: any) => {
                                    const healthStatus = account.healthFactor
                                        ? getHealthFactorStatus(account.healthFactor)
                                        : { status: 'No Debt', color: 'text-gray-500' };

                                    const riskClass = !account.healthFactor ? '' :
                                        account.healthFactor < 1.1 ? 'risk-high' :
                                        account.healthFactor < 1.5 ? 'risk-moderate' : 'risk-safe';

                                    return (
                                        <tr key={account.address}>
                                            <td className="font-mono text-xs">{formatAddress(account.address)}</td>
                                            <td className="text-right">{formatCurrency(account.totalCollateralUSD)}</td>
                                            <td className="text-right">{formatCurrency(account.totalDebtUSD)}</td>
                                            <td className="text-right">
                                                <span className={riskClass}>
                                                    {account.healthFactor ? account.healthFactor.toFixed(2) : '∞'}
                                                </span>
                                                <span className="ml-1.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
                                                    {healthStatus.status}
                                                </span>
                                            </td>
                                            <td className="text-right">{account.openPositionCount}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Page {page} {data.hasMore && '· More available'}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="time-btn disabled:opacity-30"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={!data.hasMore}
                            className="time-btn disabled:opacity-30"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </TuiPanel>
        </div>
    );
}
