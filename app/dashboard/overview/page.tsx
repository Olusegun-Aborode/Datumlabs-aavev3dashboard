// app/dashboard/overview/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import TuiPanel, { TuiDivider } from '@/components/aave-dashboard/TuiPanel';
import ChartWrapper from '@/components/aave-dashboard/ChartWrapper';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/aave/helpers';

async function getOverviewData(chain?: string) {
    const params = chain && chain !== 'all' ? `?chain=${chain}` : '';
    const res = await fetch(`/api/aave/overview${params}`);
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
}

export default function OverviewPage() {
    const [timeRange, setTimeRange] = useState(90);
    const [chain, setChain] = useState<string>('all');

    const { data, isLoading, error } = useQuery({
        queryKey: ['overviewData', chain],
        queryFn: () => getOverviewData(chain),
    });

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message="Failed to load overview data. Please try again." />;

    const filteredData = data.historicalData.slice(-timeRange);

    const oldSnapshot = data.historicalData[data.historicalData.length - timeRange] || data.historicalData[0];
    const latestSnapshot = data.historicalData[data.historicalData.length - 1];

    const tvlChange = oldSnapshot
        ? ((latestSnapshot.tvl - oldSnapshot.tvl) / oldSnapshot.tvl) * 100
        : 0;

    const borrowChange = oldSnapshot
        ? ((latestSnapshot.borrows - oldSnapshot.borrows) / oldSnapshot.borrows) * 100
        : 0;

    const counters = [
        { label: 'Total Supply', value: formatCurrency(data.totalValueLockedUSD), accent: true },
        { label: 'Total Borrow', value: formatCurrency(data.totalBorrowBalanceUSD), accent: false },
        { label: 'Net TVL', value: formatCurrency(data.tvl), accent: false, sub: 'Supply − Borrow' },
        { label: 'Total Markets', value: data.totalMarkets.toString(), accent: false },
    ];

    return (
        <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--foreground)" }}>
                    Protocol Overview
                </h2>
                <div className="flex items-center gap-2">
                    {/* Chain selector */}
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

            {/* Counter row */}
            <div className="tui-panel">
                <div className="tui-panel-header">
                    <span className="tui-panel-title">Key Metrics</span>
                    <div className="flex items-center gap-3">
                        <span className="tui-panel-badge">
                            Updated {new Date(data.lastUpdated).toLocaleTimeString()}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-orange)" }} />
                            LIVE
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4">
                    {counters.map((c, i) => (
                        <div
                            key={c.label}
                            className={`p-4 lg:p-5 ${i < counters.length - 1 ? "border-r" : ""}`}
                            style={{ borderColor: "var(--border)" }}
                        >
                            <p className="counter-label">{c.label}</p>
                            <p
                                className="counter-value"
                                style={{ color: c.accent ? "var(--accent-orange)" : "var(--foreground)" }}
                            >
                                {c.value}
                            </p>
                            {c.sub && (
                                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{c.sub}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Change indicators */}
            <div className="grid grid-cols-2 gap-3">
                <div className="tui-panel">
                    <div className="p-3 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                            Supply Δ ({timeRange}d)
                        </span>
                        <span className="text-sm font-bold" style={{ color: tvlChange >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                            {tvlChange >= 0 ? '↑' : '↓'} {Math.abs(tvlChange).toFixed(2)}%
                        </span>
                    </div>
                </div>
                <div className="tui-panel">
                    <div className="p-3 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                            Borrow Δ ({timeRange}d)
                        </span>
                        <span className="text-sm font-bold" style={{ color: borrowChange >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                            {borrowChange >= 0 ? '↑' : '↓'} {Math.abs(borrowChange).toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <ChartWrapper
                title="Supply vs Borrow Trend"
                badge={`Last ${timeRange} days`}
                timeRanges={[30, 90, 180]}
                selectedRange={timeRange}
                onRangeChange={setTimeRange}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSupply" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorBorrow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(value) => {
                                const date = new Date(value);
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                            tick={{ fontSize: 10, fill: '#6B7280' }}
                            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={(value) => formatCurrency(value)}
                            tick={{ fontSize: 10, fill: '#6B7280' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                background: 'var(--card)',
                                border: '1px solid var(--border-bright)',
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: 'var(--foreground)',
                            }}
                            formatter={(value: number | undefined) => [formatCurrency(Number(value ?? 0)), '']}
                            labelFormatter={(label) => {
                                const date = new Date(label);
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            }}
                        />
                        <Area type="monotone" dataKey="tvl" stroke="#10B981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSupply)" name="Total Supply" />
                        <Area type="monotone" dataKey="borrows" stroke="#F59E0B" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBorrow)" name="Total Borrow" />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartWrapper>

            <TuiDivider label="Revenue" />

            {/* Revenue */}
            <div className="grid grid-cols-2 gap-3">
                <TuiPanel title="Supply-Side Revenue" badge="Cumulative">
                    <p className="counter-value" style={{ color: "var(--accent-green)" }}>
                        {formatCurrency(data.supplyRevenueUSD)}
                    </p>
                    <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>Earned by depositors</p>
                </TuiPanel>
                <TuiPanel title="Protocol Revenue" badge="90d">
                    <p className="counter-value" style={{ color: "var(--accent-blue)" }}>
                        {formatCurrency(data.protocolRevenueUSD)}
                    </p>
                    <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>Earned by the protocol</p>
                </TuiPanel>
            </div>
        </div>
    );
}
