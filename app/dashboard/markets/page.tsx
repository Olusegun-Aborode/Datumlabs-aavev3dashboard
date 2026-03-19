// app/dashboard/markets/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import TuiPanel, { TuiDivider } from '@/components/aave-dashboard/TuiPanel';
import ChartWrapper from '@/components/aave-dashboard/ChartWrapper';
import { formatCurrency, formatPercentage } from '@/lib/aave/helpers';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#5B7FFF', '#10B981', '#F59E0B', '#B44AFF', '#00D4FF', '#FF6B35', '#EC4899', '#6366F1'];

async function getMarketsData(chain?: string) {
    const params = chain && chain !== 'all' ? `?chain=${chain}` : '';
    const res = await fetch(`/api/aave/markets${params}`);
    if (!res.ok) throw new Error('Failed to fetch markets data');
    return res.json();
}

export default function MarketsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'tvl' | 'supplyApy' | 'borrowApy' | 'utilization'>('tvl');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [chain, setChain] = useState<string>('all');

    const { data, isLoading, error } = useQuery({
        queryKey: ['marketsData', chain],
        queryFn: () => getMarketsData(chain),
    });

    const filteredMarkets = useMemo(() => {
        if (!data || !data.markets) return [];

        let filtered = data.markets.filter((market: any) =>
            market.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            market.inputToken.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filtered.sort((a: any, b: any) => {
            let aValue, bValue;
            switch (sortBy) {
                case 'tvl': aValue = a.totalValueLockedUSD; bValue = b.totalValueLockedUSD; break;
                case 'supplyApy': aValue = a.rates.find((r: any) => r.side === 'LENDER')?.rate || 0; bValue = b.rates.find((r: any) => r.side === 'LENDER')?.rate || 0; break;
                case 'borrowApy': aValue = a.rates.find((r: any) => r.side === 'BORROWER')?.rate || 0; bValue = b.rates.find((r: any) => r.side === 'BORROWER')?.rate || 0; break;
                case 'utilization': aValue = a.utilization; bValue = b.utilization; break;
                default: aValue = a.totalValueLockedUSD; bValue = b.totalValueLockedUSD;
            }
            return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
        });

        return filtered;
    }, [data, searchTerm, sortBy, sortOrder]);

    const pieChartData = useMemo(() => {
        if (!data || !data.markets) return [];
        const top8 = [...data.markets]
            .sort((a: any, b: any) => b.totalValueLockedUSD - a.totalValueLockedUSD)
            .slice(0, 8);
        return top8.map((market: any) => ({
            name: market.inputToken.symbol,
            value: market.totalValueLockedUSD,
        }));
    }, [data]);

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message="Failed to load markets data. Please try again." />;
    if (!data || !data.markets) return <ErrorState message="No market data available." />;

    const totalSupply = data.markets.reduce((sum: number, m: any) => sum + m.totalDepositBalanceUSD, 0);
    const avgUtilization = data.markets.reduce((sum: number, m: any) => sum + m.utilization, 0) / data.markets.length;
    const highestApy = Math.max(...data.markets.map((m: any) => m.rates.find((r: any) => r.side === 'LENDER')?.rate || 0));

    const handleSort = (field: typeof sortBy) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--foreground)" }}>
                    Markets
                </h2>
                <div className="flex items-center gap-2">
                    {[
                        { id: 'all', label: 'ALL' },
                        { id: 'ethereum', label: 'ETH' },
                        { id: 'arbitrum', label: 'ARB' },
                        { id: 'base', label: 'BASE' },
                        { id: 'optimism', label: 'OP' },
                        { id: 'polygon', label: 'POLY' },
                        { id: 'avalanche', label: 'AVAX' },
                    ].map((c) => (
                        <button
                            key={c.id}
                            onClick={() => setChain(c.id)}
                            className={`chain-badge ${chain === c.id ? 'active' : ''}`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary counters */}
            <div className="tui-panel">
                <div className="tui-panel-header">
                    <span className="tui-panel-title">Market Summary</span>
                    <span className="tui-panel-badge">{data.markets.length} markets</span>
                </div>
                <div className="grid grid-cols-3">
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: "var(--border)" }}>
                        <p className="counter-label">Total Supply</p>
                        <p className="counter-value" style={{ color: "var(--accent-orange)" }}>{formatCurrency(totalSupply)}</p>
                    </div>
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: "var(--border)" }}>
                        <p className="counter-label">Highest APY</p>
                        <p className="counter-value" style={{ color: "var(--accent-green)" }}>{formatPercentage(highestApy)}</p>
                    </div>
                    <div className="p-4 lg:p-5">
                        <p className="counter-label">Avg Utilization</p>
                        <p className="counter-value">{formatPercentage(avgUtilization)}</p>
                    </div>
                </div>
            </div>

            {/* Distribution chart */}
            <ChartWrapper title="TVL Distribution" badge="Top 8 markets" height="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            labelLine={false}
                        >
                            {pieChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                background: 'var(--card)',
                                border: '1px solid var(--border-bright)',
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: 'var(--foreground)',
                            }}
                            formatter={(value: number | undefined) => formatCurrency(Number(value ?? 0))}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </ChartWrapper>

            <TuiDivider label="All Markets" />

            {/* Search and table */}
            <TuiPanel title="Market Data" badge={`${filteredMarkets.length} of ${data.markets.length}`} noPadding>
                {/* Search bar inside panel header area */}
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <input
                        type="text"
                        placeholder="Search markets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-64 text-xs px-3 py-1.5 rounded outline-none"
                        style={{
                            background: "var(--background)",
                            border: "1px solid var(--border-bright)",
                            color: "var(--foreground)",
                        }}
                    />
                </div>

                {/* Data table */}
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Asset</th>
                                <th className="text-right">Price</th>
                                <th className="text-right cursor-pointer" onClick={() => handleSort('tvl')}>
                                    Total Supply {sortBy === 'tvl' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </th>
                                <th className="text-right">Total Borrow</th>
                                <th className="text-right cursor-pointer" onClick={() => handleSort('supplyApy')}>
                                    Supply APY {sortBy === 'supplyApy' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </th>
                                <th className="text-right cursor-pointer" onClick={() => handleSort('borrowApy')}>
                                    Borrow APY {sortBy === 'borrowApy' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </th>
                                <th className="text-right cursor-pointer" onClick={() => handleSort('utilization')}>
                                    Util % {sortBy === 'utilization' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMarkets.map((market: any) => {
                                const supplyRate = market.rates.find((r: any) => r.side === 'LENDER');
                                const borrowRate = market.rates.find((r: any) => r.side === 'BORROWER');

                                return (
                                    <tr key={market.id}>
                                        <td>
                                            <span className="font-semibold">{market.inputToken.symbol}</span>
                                            {market.chain && (
                                                <span className="ml-1.5 text-[9px] uppercase" style={{ color: "var(--accent-blue)" }}>
                                                    [{({ ethereum: 'ETH', arbitrum: 'ARB', base: 'BASE', optimism: 'OP', polygon: 'POLY', avalanche: 'AVAX' } as Record<string, string>)[market.chain] || market.chain}]
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right">{formatCurrency(market.inputTokenPriceUSD)}</td>
                                        <td className="text-right">{formatCurrency(market.totalDepositBalanceUSD)}</td>
                                        <td className="text-right">{formatCurrency(market.totalBorrowBalanceUSD)}</td>
                                        <td className="text-right" style={{ color: "var(--accent-green)" }}>
                                            {formatPercentage(supplyRate?.rate || 0)}
                                        </td>
                                        <td className="text-right" style={{ color: "var(--accent-blue)" }}>
                                            {formatPercentage(borrowRate?.rate || 0)}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="tui-progress w-16">
                                                    <div
                                                        className="tui-progress-fill"
                                                        style={{
                                                            width: `${Math.min(market.utilization, 100)}%`,
                                                            background: market.utilization > 80 ? 'var(--accent-red)' : market.utilization > 50 ? 'var(--accent-yellow)' : 'var(--accent-green)',
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-[11px] w-10 text-right font-mono">
                                                    {formatPercentage(market.utilization)}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </TuiPanel>
        </div>
    );
}
