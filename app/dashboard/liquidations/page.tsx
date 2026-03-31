// app/dashboard/liquidations/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import TuiPanel, { TuiDivider } from '@/components/aave-dashboard/TuiPanel';
import ChartWrapper from '@/components/aave-dashboard/ChartWrapper';
import { formatCurrency, formatAddress, formatDateTime } from '@/lib/aave/helpers';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

async function getLiquidationsData(page: number, pageSize: number, chain?: string) {
    const chainParam = chain && chain !== 'all' ? `&chain=${chain}` : '';
    const res = await fetch(`/api/aave/liquidations?page=${page}&pageSize=${pageSize}${chainParam}`);
    if (!res.ok) throw new Error('Failed to fetch liquidations data');
    return res.json();
}

export default function LiquidationsPage() {
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [chain, setChain] = useState<string>('all');

    const { data, isLoading, error } = useQuery({
        queryKey: ['liquidationsData', page, pageSize, chain],
        queryFn: () => getLiquidationsData(page, pageSize, chain),
    });

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message="Failed to load liquidations data. Please try again." />;

    const liquidations = data.liquidations;
    const aggregations = data.aggregations;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--foreground)" }}>
                    Liquidations
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
            <div className="tui-panel">
                <div className="tui-panel-header">
                    <span className="tui-panel-title">Liquidation Summary</span>
                    <span className="relative group cursor-help text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        &#9432;
                        <span className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block w-56 p-2 rounded text-[10px] leading-relaxed normal-case"
                            style={{ background: 'var(--card)', border: '1px solid var(--border-bright)', color: 'var(--text-muted)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            Source: The Graph subgraphs (Messari + Aave official). Liquidation events indexed from on-chain LiquidationCall events across 9 chains.
                        </span>
                    </span>
                    <span className="tui-panel-badge">Page {page}</span>
                </div>
                <div className="grid grid-cols-2">
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: "var(--border)" }}>
                        <p className="counter-label">Total Liquidated</p>
                        <p className="counter-value" style={{ color: "var(--accent-red)" }}>
                            {formatCurrency(aggregations.totalLiquidatedUSD)}
                        </p>
                        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{aggregations.totalCount} events</span>
                    </div>
                    <div className="p-4 lg:p-5">
                        <p className="counter-label">Most Liquidated</p>
                        {aggregations.byAsset.length > 0 && (
                            <>
                                <p className="counter-value" style={{ color: "var(--accent-orange)" }}>
                                    {aggregations.byAsset[0].symbol}
                                </p>
                                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                                    {formatCurrency(aggregations.byAsset[0].totalUSD)} · {aggregations.byAsset[0].count} events
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Bar chart */}
            {aggregations.byAsset.length > 0 && (
                <ChartWrapper title="Liquidations by Asset" badge="Top 10" height="h-64"
                    dataSource="Source: The Graph subgraphs. Collateral seized per liquidation event, aggregated by asset symbol. USD value from on-chain oracle prices at time of liquidation."
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aggregations.byAsset.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis
                                dataKey="symbol"
                                tick={{ fontSize: 10, fill: '#6B7280' }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#6B7280' }}
                                tickFormatter={(value) => `$${(value / 1e6).toFixed(1)}M`}
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
                                formatter={(value: number | undefined) => [formatCurrency(Number(value ?? 0)), 'Total USD']}
                            />
                            <Bar dataKey="totalUSD" fill="#FF4444" radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartWrapper>
            )}

            <TuiDivider label="Recent Events" />

            {/* Liquidation events table */}
            <TuiPanel title="Liquidation Events" badge={`${liquidations.length} events`} noPadding>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Asset</th>
                                <th className="text-right">Amount</th>
                                <th className="text-right">Value (USD)</th>
                                <th>Liquidatee</th>
                                <th>Liquidator</th>
                            </tr>
                        </thead>
                        <tbody>
                            {liquidations.map((liq: any) => (
                                <tr key={liq.id}>
                                    <td className="text-xs">{formatDateTime(liq.timestamp)}</td>
                                    <td>
                                        <span className="font-semibold">{liq.asset.symbol}</span>
                                        {liq.chain && (
                                            <span className="ml-1 text-[9px]" style={{ color: "var(--accent-blue)" }}>
                                                [{liq.chain.toUpperCase()}]
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-right font-mono">
                                        {liq.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="text-right font-bold" style={{ color: "var(--accent-red)" }}>
                                        {formatCurrency(liq.amountUSD)}
                                    </td>
                                    <td className="font-mono text-[11px]">{formatAddress(liq.liquidatee)}</td>
                                    <td className="font-mono text-[11px]">{formatAddress(liq.liquidator)}</td>
                                </tr>
                            ))}
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
