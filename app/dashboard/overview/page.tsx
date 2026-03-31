// app/dashboard/overview/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import TuiPanel, { TuiDivider } from '@/components/aave-dashboard/TuiPanel';
import ChartWrapper from '@/components/aave-dashboard/ChartWrapper';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/lib/aave/helpers';

async function getOverviewData(chain?: string) {
    const params = chain && chain !== 'all' ? `?chain=${chain}` : '';
    const res = await fetch(`/api/aave/overview${params}`);
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
}

export default function OverviewPage() {
    const [timeRange, setTimeRange] = useState(90);
    const [revenueTimeRange, setRevenueTimeRange] = useState(90);
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
        { label: 'Total Market Size', value: formatCurrency(data.totalMarketSize), accent: true },
        { label: 'Total Available', value: formatCurrency(data.totalAvailable), accent: false },
        { label: 'Total Borrows', value: formatCurrency(data.totalBorrows), accent: false },
        { label: 'Total Markets', value: data.totalReserves.toString(), accent: false },
    ];

    return (
        <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--foreground)" }}>
                    Protocol Overview
                </h2>
                <select
                    value={chain}
                    onChange={(e) => setChain(e.target.value)}
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
                    <option value="plasma">Plasma</option>
                    <option value="mantle">Mantle</option>
                    <option value="bnb">BNB Chain</option>
                    <option value="linea">Linea</option>
                    <option value="gnosis">Gnosis</option>
                </select>
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
                        </div>
                    ))}
                </div>
            </div>

            {/* Change indicators */}
            <div className="grid grid-cols-2 gap-3">
                <div className="tui-panel">
                    <div className="p-3 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                            Market Size Δ ({timeRange}d)
                        </span>
                        <span className="text-sm font-bold" style={{ color: tvlChange >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                            {tvlChange >= 0 ? '↑' : '↓'} {Math.abs(tvlChange).toFixed(2)}%
                        </span>
                    </div>
                </div>
                <div className="tui-panel">
                    <div className="p-3 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                            Borrows Δ ({timeRange}d)
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
                dataSource="Source: DeFi Llama API (/protocol/aave-v3). Supply = totalLiquidityUSD per chain. Borrow = totalBorrowBalanceUSD per chain. Aggregated daily across all Aave V3 deployments."
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
                        <Legend
                            verticalAlign="top"
                            align="left"
                            iconType="line"
                            wrapperStyle={{ fontSize: '10px', paddingLeft: '10px', paddingBottom: '4px' }}
                        />
                        <Area type="monotone" dataKey="tvl" stroke="#10B981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSupply)" name="Total Supply" />
                        <Area type="monotone" dataKey="borrows" stroke="#F59E0B" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBorrow)" name="Total Borrow" />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartWrapper>

            <TuiDivider label="Revenue" />

            {/* Revenue summary */}
            <div className="grid grid-cols-2 gap-3">
                <div className="tui-panel">
                    <div className="p-3 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.1em] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            Supply-Side Revenue (All Time)
                            <span className="relative group cursor-help">
                                &#9432;
                                <span className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block w-56 p-2 rounded text-[10px] leading-relaxed"
                                    style={{ background: 'var(--card)', border: '1px solid var(--border-bright)', color: 'var(--text-muted)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                    Source: DeFi Llama totalAllTime from /summary/fees/aave?dataType=dailySupplySideRevenue. Cumulative interest earned by depositors across all Aave markets.
                                </span>
                            </span>
                        </span>
                        <span className="text-sm font-bold" style={{ color: "var(--accent-green)" }}>
                            {formatCurrency(data.supplyRevenueUSD)}
                        </span>
                    </div>
                </div>
                <div className="tui-panel">
                    <div className="p-3 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.1em] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            Protocol Revenue (All Time)
                            <span className="relative group cursor-help">
                                &#9432;
                                <span className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block w-56 p-2 rounded text-[10px] leading-relaxed"
                                    style={{ background: 'var(--card)', border: '1px solid var(--border-bright)', color: 'var(--text-muted)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                    Source: DeFi Llama totalAllTime from /summary/fees/aave?dataType=dailyRevenue. Cumulative interest retained by the Aave protocol treasury.
                                </span>
                            </span>
                        </span>
                        <span className="text-sm font-bold" style={{ color: "var(--accent-blue)" }}>
                            {formatCurrency(data.protocolRevenueUSD)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Revenue chart */}
            <ChartWrapper
                title="Daily Revenue"
                badge={`Last ${revenueTimeRange} days`}
                timeRanges={[30, 90, 180]}
                selectedRange={revenueTimeRange}
                onRangeChange={setRevenueTimeRange}
                dataSource="Source: DeFi Llama API (/summary/fees/aave). Supply-Side Revenue = interest earned by depositors (dailySupplySideRevenue). Protocol Revenue = interest retained by the protocol treasury (dailyRevenue)."
            >
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={(data.revenueHistory || []).slice(-revenueTimeRange)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSupplyRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorProtocolRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
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
                        <Legend
                            verticalAlign="top"
                            align="left"
                            iconType="line"
                            wrapperStyle={{ fontSize: '10px', paddingLeft: '10px', paddingBottom: '4px' }}
                        />
                        <Area type="monotone" dataKey="supplyRevenue" stroke="#10B981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSupplyRev)" name="Supply-Side Revenue" />
                        <Area type="monotone" dataKey="protocolRevenue" stroke="#6366F1" strokeWidth={1.5} fillOpacity={1} fill="url(#colorProtocolRev)" name="Protocol Revenue" />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartWrapper>
        </div>
    );
}
