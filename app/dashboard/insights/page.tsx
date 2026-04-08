// app/dashboard/insights/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import TuiPanel, { TuiDivider } from '@/components/aave-dashboard/TuiPanel';
import { formatCurrency, formatPercentage } from '@/lib/aave/helpers';
import { useAaveVersion } from '@/components/aave-dashboard/useAaveVersion';
import { type AaveVersion } from '@/lib/aave/version';

function withVersion(url: string, version: AaveVersion) {
    if (version === 'v3') return url;
    return url.includes('?') ? `${url}&version=${version}` : `${url}?version=${version}`;
}

async function getOverviewData(version: AaveVersion) {
    const res = await fetch(withVersion('/api/aave/overview', version));
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
}

async function getMarketsData(version: AaveVersion) {
    const res = await fetch(withVersion('/api/aave/markets', version));
    if (!res.ok) throw new Error('Failed to fetch markets data');
    return res.json();
}

async function getWalletsData(version: AaveVersion) {
    const res = await fetch(withVersion('/api/aave/wallets?page=1&pageSize=100', version));
    if (!res.ok) throw new Error('Failed to fetch wallets data');
    return res.json();
}

export default function InsightsPage() {
    const { version } = useAaveVersion();

    const { data: overviewData, isLoading: overviewLoading } = useQuery({
        queryKey: ['overviewData', version],
        queryFn: () => getOverviewData(version),
    });

    const { data: marketsData, isLoading: marketsLoading } = useQuery({
        queryKey: ['marketsData', version],
        queryFn: () => getMarketsData(version),
    });

    const { data: walletsData, isLoading: walletsLoading } = useQuery({
        queryKey: ['walletsDataInsights', version],
        queryFn: () => getWalletsData(version),
    });

    if (overviewLoading || marketsLoading || walletsLoading) return <LoadingState />;
    if (!overviewData || !marketsData || !walletsData) return <ErrorState message="Failed to load insights data." />;

    const markets = marketsData?.markets || [];
    const accounts = walletsData?.accounts || [];
    const totalValueLockedUSD = overviewData.totalMarketSize || 0;
    const totalBorrowBalanceUSD = overviewData.totalBorrows || 0;
    const utilization = totalValueLockedUSD > 0
        ? totalBorrowBalanceUSD / totalValueLockedUSD
        : 0;

    const topMarkets = [...markets]
        .sort((a: any, b: any) => b.totalDepositBalanceUSD - a.totalDepositBalanceUSD)
        .slice(0, 5);

    const highRiskWallets = accounts.filter((a: any) => a.healthFactor && a.healthFactor < 1.5);
    const atRiskValue = highRiskWallets.reduce((sum: number, w: any) => sum + (w.totalCollateralUSD || 0), 0);

    const healthyCount = accounts.filter((a: any) => !a.healthFactor || a.healthFactor >= 2).length;
    const atRiskCount = accounts.filter((a: any) => a.healthFactor && a.healthFactor >= 1.5 && a.healthFactor < 2).length;
    const nearLiquidation = accounts.filter((a: any) => a.healthFactor && a.healthFactor < 1.2).length;

    const chainLabels: Record<string, string> = { ethereum: 'ETH', arbitrum: 'ARB', base: 'BASE', optimism: 'OP', polygon: 'POLY', avalanche: 'AVAX' };

    // Per-version descriptive content. v4 has the hub-and-spoke architecture
    // and launched on Ethereum only; v3 has the historical multi-chain footprint.
    const versionCopy = version === 'v4'
        ? {
            title: 'About Aave V4',
            blurb: 'Aave V4 is the latest major release of the decentralised lending protocol, built around a hub-and-spoke architecture. Liquidity is pooled into hubs while spokes expose that liquidity to borrowers across markets, enabling unified liquidity and more flexible risk parameters.',
            networks: 'ETH',
            versionLabel: 'V4',
        }
        : version === 'all'
        ? {
            title: 'About Aave V3 + V4',
            blurb: 'Aave is a decentralised lending protocol. V3 runs across many EVM chains with isolated markets per deployment; V4 introduces a hub-and-spoke architecture with unified liquidity. This view aggregates both versions.',
            networks: 'ETH + ARB + BASE + OP + POLY + AVAX + ...',
            versionLabel: 'V3 + V4',
        }
        : {
            title: 'About Aave V3',
            blurb: 'Aave V3 is a decentralised lending protocol deployed across Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche and several other EVM chains. Users deposit crypto assets to earn interest, creating liquidity pools that others can borrow from. Borrowers must provide overcollateralised positions to ensure lender safety.',
            networks: 'ETH + ARB + BASE + OP + POLY + AVAX',
            versionLabel: 'V3',
        };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--foreground)" }}>
                    Datum Labs Insights
                </h2>
                <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                    Comprehensive protocol analysis
                </span>
            </div>

            {/* About */}
            <TuiPanel title={versionCopy.title} badge="Protocol">
                <div className="space-y-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    <p>{versionCopy.blurb}</p>
                    <p>
                        Interest rates adjust automatically based on supply and demand. The protocol uses a
                        <span style={{ color: "var(--foreground)" }}> health factor</span> system to manage risk —
                        positions below 1.0 are eligible for liquidation.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                        { label: 'Networks', value: versionCopy.networks },
                        { label: 'Version', value: versionCopy.versionLabel },
                        { label: 'Markets', value: markets.length.toString() },
                    ].map((item) => (
                        <div key={item.label} className="p-3" style={{ background: "var(--background)", borderRadius: "4px" }}>
                            <p className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                            <p className="text-sm font-bold mt-1">{item.value}</p>
                        </div>
                    ))}
                </div>
            </TuiPanel>

            <TuiDivider label="Key Metrics" />

            {/* Metrics */}
            <div className="tui-panel">
                <div className="tui-panel-header">
                    <span className="tui-panel-title">High-Level Metrics</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Total Value Locked', value: formatCurrency(totalValueLockedUSD), color: 'var(--accent-orange)', change: `${overviewData.totalReserves || 0} markets` },
                        { label: 'Total Borrowed', value: formatCurrency(totalBorrowBalanceUSD), color: 'var(--accent-yellow)', change: formatCurrency(overviewData.totalAvailable || 0) + ' available' },
                        { label: 'Utilization Rate', value: formatPercentage(utilization * 100), color: 'var(--foreground)', change: utilization > 0.7 ? 'High' : utilization > 0.4 ? 'Moderate' : 'Low' },
                        { label: 'Supply Revenue', value: overviewData.revenueAvailable === false ? 'N/A' : formatCurrency(overviewData.supplyRevenueUSD || 0), color: 'var(--accent-blue)', change: overviewData.revenueAvailable === false ? 'Not split by version' : 'Cumulative' },
                    ].map((m, i) => (
                        <div key={m.label} className={`p-4 lg:p-5 ${i < 3 ? 'border-r' : ''}`} style={{ borderColor: "var(--border)" }}>
                            <p className="counter-label">{m.label}</p>
                            <p className="counter-value" style={{ color: m.color }}>{m.value}</p>
                            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{m.change}</span>
                        </div>
                    ))}
                </div>
            </div>

            <TuiDivider label="Top Markets" />

            {/* Top Markets */}
            <TuiPanel title="Top Markets by Supply" badge="Top 5" noPadding>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Market</th>
                                <th className="text-right">Supply</th>
                                <th className="text-right">Borrow</th>
                                <th className="text-right">Supply APY</th>
                                <th className="text-right">Utilization</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topMarkets.map((market: any) => {
                                const supplyRate = market.rates?.find((r: any) => r.side === 'LENDER');
                                const util = market.totalDepositBalanceUSD > 0
                                    ? (market.totalBorrowBalanceUSD / market.totalDepositBalanceUSD) * 100
                                    : 0;
                                return (
                                    <tr key={market.id}>
                                        <td>
                                            <span className="font-semibold">{market.inputToken.symbol}</span>
                                            {market.chain && (
                                                <span className="ml-1.5 text-[9px] uppercase" style={{ color: "var(--accent-blue)" }}>
                                                    [{chainLabels[market.chain] || market.chain}]
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right">{formatCurrency(market.totalDepositBalanceUSD)}</td>
                                        <td className="text-right">{formatCurrency(market.totalBorrowBalanceUSD)}</td>
                                        <td className="text-right" style={{ color: "var(--accent-green)" }}>{formatPercentage(supplyRate?.rate || 0)}</td>
                                        <td className="text-right">{formatPercentage(util)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </TuiPanel>

            <TuiDivider label="Risk Analysis" />

            {/* Risk Analysis */}
            <div className="tui-panel">
                <div className="tui-panel-header">
                    <span className="tui-panel-title">Wallet Risk Distribution</span>
                </div>
                <div className="grid grid-cols-3">
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: "var(--border)" }}>
                        <p className="counter-label">Healthy (≥2.0)</p>
                        <p className="counter-value risk-safe">{healthyCount}</p>
                    </div>
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: "var(--border)" }}>
                        <p className="counter-label">At Risk (1.5-2.0)</p>
                        <p className="counter-value risk-moderate">{atRiskCount}</p>
                    </div>
                    <div className="p-4 lg:p-5">
                        <p className="counter-label">High Risk ({'<'}1.5)</p>
                        <p className="counter-value risk-high">{highRiskWallets.length}</p>
                    </div>
                </div>
            </div>

            {highRiskWallets.length > 0 && (
                <div className="tui-panel">
                    <div className="p-4 flex items-start gap-2" style={{ borderLeft: "2px solid var(--accent-red)" }}>
                        <span style={{ color: "var(--accent-red)" }}>!</span>
                        <div>
                            <p className="text-xs font-bold" style={{ color: "var(--accent-red)" }}>Risk Alert</p>
                            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                                {formatCurrency(atRiskValue)} in collateral at risk across {highRiskWallets.length} positions
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Liquidation Info */}
            <TuiPanel title="Liquidation Risk Overview">
                <div className="space-y-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    <p>
                        <span style={{ color: "var(--foreground)" }}>Liquidation</span> protects the protocol&apos;s solvency.
                        When a borrower&apos;s health factor drops below 1.0, a liquidator can repay part of the debt
                        and claim collateral at a 5-10% discount.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="p-3" style={{ background: "var(--background)", borderRadius: "4px" }}>
                        <p className="counter-label">Near Liquidation</p>
                        <p className="text-xl font-bold" style={{ color: "var(--accent-red)" }}>{nearLiquidation}</p>
                        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Health Factor {'<'} 1.2</span>
                    </div>
                    <div className="p-3" style={{ background: "var(--background)", borderRadius: "4px" }}>
                        <p className="counter-label">Total at Risk</p>
                        <p className="text-xl font-bold">{formatCurrency(atRiskValue)}</p>
                        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Collateral value</span>
                    </div>
                </div>
            </TuiPanel>

            <TuiDivider label="Methodology" />

            {/* Methodology */}
            <TuiPanel title="Data Methodology" badge="Transparency">
                <div className="space-y-4 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.1em] font-bold mb-1" style={{ color: "var(--foreground)" }}>Data Source</p>
                        <p>
                            All data is sourced from <span style={{ color: "var(--foreground)" }}>The Graph&apos;s decentralised indexing protocol</span> using
                            Messari&apos;s standardised lending protocol subgraphs. Data is queried in real-time from on-chain smart contract events
                            across all six supported networks.
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.1em] font-bold mb-1" style={{ color: "var(--foreground)" }}>TVL & Supply</p>
                        <p>
                            Total Value Locked (TVL) represents the net value of assets deposited minus outstanding borrows.
                            Total Supply is the gross value of all deposited collateral. Values are denominated in USD using
                            on-chain oracle prices at the time of each snapshot.
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.1em] font-bold mb-1" style={{ color: "var(--foreground)" }}>Revenue</p>
                        <p>
                            Supply-side revenue reflects cumulative interest earned by depositors. Protocol revenue is computed
                            from daily financial snapshots (sum of <code style={{ color: "var(--accent-blue)" }}>dailyProtocolSideRevenueUSD</code>)
                            when cumulative fields exceed sanity thresholds, ensuring data accuracy.
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.1em] font-bold mb-1" style={{ color: "var(--foreground)" }}>Health Factor</p>
                        <p>
                            Health Factor = (Total Collateral × Weighted Avg Liquidation Threshold) / Total Debt.
                            A value below 1.0 makes a position eligible for liquidation. We use an average liquidation
                            threshold of 0.85 as a weighted approximation across Aave V3 markets.
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.1em] font-bold mb-1" style={{ color: "var(--foreground)" }}>Refresh & Caching</p>
                        <p>
                            Overview data refreshes every 5 minutes. Market and wallet data refreshes every 2 minutes.
                            Liquidation data refreshes every 3 minutes. All queries use <code style={{ color: "var(--accent-blue)" }}>network-only</code> fetch
                            policy to bypass Apollo Client cache and serve fresh subgraph data.
                        </p>
                    </div>
                </div>
            </TuiPanel>

            {/* Footer */}
            <div className="text-center text-[10px] pt-2" style={{ color: "var(--text-muted)" }}>
                Powered by <span style={{ color: "var(--accent-orange)" }}>Datum Labs</span> · Real-time Aave V3 Protocol Data
            </div>
        </div>
    );
}
