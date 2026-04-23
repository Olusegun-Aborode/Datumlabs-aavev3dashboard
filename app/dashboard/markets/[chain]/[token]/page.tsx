// app/dashboard/markets/[chain]/[token]/page.tsx
// Detail page for a single Aave V3 reserve. The route segment is the chain
// short-key + underlying token address; the market address comes via ?market=
// because some chains have multiple markets (Core / Lido / EtherFi / Horizon
// on Ethereum) sharing the same token.
'use client';

import { Suspense, useState, use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import { TuiDivider } from '@/components/aave-dashboard/TuiPanel';
import ChartWrapper from '@/components/aave-dashboard/ChartWrapper';
import { formatCurrency, formatAddress, formatPercentage } from '@/lib/aave/helpers';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const CHAIN_LABEL: Record<string, { name: string; chainId: number; explorer: string }> = {
    ethereum:  { name: 'Ethereum',  chainId: 1,      explorer: 'https://etherscan.io' },
    arbitrum:  { name: 'Arbitrum',  chainId: 42161,  explorer: 'https://arbiscan.io' },
    base:      { name: 'Base',      chainId: 8453,   explorer: 'https://basescan.org' },
    optimism:  { name: 'Optimism',  chainId: 10,     explorer: 'https://optimistic.etherscan.io' },
    polygon:   { name: 'Polygon',   chainId: 137,    explorer: 'https://polygonscan.com' },
    avalanche: { name: 'Avalanche', chainId: 43114,  explorer: 'https://snowtrace.io' },
    bnb:       { name: 'BNB Chain', chainId: 56,     explorer: 'https://bscscan.com' },
    gnosis:    { name: 'Gnosis',    chainId: 100,    explorer: 'https://gnosisscan.io' },
    linea:     { name: 'Linea',     chainId: 59144,  explorer: 'https://lineascan.build' },
    plasma:    { name: 'Plasma',    chainId: 9745,   explorer: 'https://plasmascan.to' },
    mantle:    { name: 'Mantle',    chainId: 5000,   explorer: 'https://mantlescan.xyz' },
    scroll:    { name: 'Scroll',    chainId: 534352, explorer: 'https://scrollscan.com' },
    sonic:     { name: 'Sonic',     chainId: 146,    explorer: 'https://sonicscan.org' },
    celo:      { name: 'Celo',      chainId: 42220,  explorer: 'https://celoscan.io' },
    zksync:    { name: 'zkSync',    chainId: 324,    explorer: 'https://explorer.zksync.io' },
    ink:       { name: 'Ink',       chainId: 57073,  explorer: 'https://explorer.inkonchain.com' },
    metis:     { name: 'Metis',     chainId: 1088,   explorer: 'https://andromeda-explorer.metis.io' },
    soneium:   { name: 'Soneium',   chainId: 1868,   explorer: 'https://soneium.blockscout.com' },
    megaeth:   { name: 'MegaETH',   chainId: 4326,   explorer: 'https://www.megaexplorer.xyz' },
    xlayer:    { name: 'X Layer',   chainId: 196,    explorer: 'https://www.okx.com/explorer/xlayer' },
};

async function getReserveData(chainId: number, market: string, token: string, window: string) {
    const params = new URLSearchParams({
        chainId: chainId.toString(),
        market,
        token,
        window,
    });
    const res = await fetch(`/api/aave/markets/reserve?${params}`);
    if (!res.ok) throw new Error('Failed to fetch reserve data');
    return res.json();
}

interface PageProps {
    params: Promise<{ chain: string; token: string }>;
}

export default function MarketDetailPage(props: PageProps) {
    return (
        <Suspense fallback={<LoadingState />}>
            <MarketDetailInner {...props} />
        </Suspense>
    );
}

function MarketDetailInner({ params }: PageProps) {
    const resolvedParams = use(params);
    const searchParams = useSearchParams();
    const market = searchParams.get('market') || '';
    const [window, setWindow] = useState('30');

    const chain = resolvedParams.chain.toLowerCase();
    const token = resolvedParams.token;
    const chainInfo = CHAIN_LABEL[chain];

    const { data, isLoading, error } = useQuery({
        queryKey: ['reserveDetail', chainInfo?.chainId, market, token, window],
        queryFn: () => getReserveData(chainInfo!.chainId, market, token, window),
        enabled: !!chainInfo && !!market && !!token,
    });

    if (!chainInfo) return <ErrorState message={`Unknown chain: ${chain}`} />;
    if (!market) return <ErrorState message="Missing market address. Click a market from the list." />;
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message="Failed to load reserve data. Please try again." />;

    const reserve = data?.reserve;
    if (!reserve) return <ErrorState message="No reserve data found." />;

    const explorer = chainInfo.explorer;

    // Pull out the values once so the JSX stays readable.
    const symbol = reserve.underlyingToken.symbol;
    const name = reserve.underlyingToken.name;
    const decimals = reserve.underlyingToken.decimals;
    const priceUSD = parseFloat(reserve.size?.usdPerToken || '0');
    const totalSuppliedUSD = parseFloat(reserve.size?.usd || '0');
    const totalSuppliedTokens = parseFloat(reserve.size?.amount?.value || '0');
    const totalBorrowedUSD = parseFloat(reserve.borrowInfo?.total?.usd || '0');
    const totalBorrowedTokens = parseFloat(reserve.borrowInfo?.total?.amount?.value || '0');
    const availableUSD = parseFloat(reserve.borrowInfo?.availableLiquidity?.usd || '0');
    const supplyAPY = parseFloat(reserve.supplyInfo?.apy?.value || '0') * 100;
    const borrowAPY = parseFloat(reserve.borrowInfo?.apy?.value || '0') * 100;
    const utilization = parseFloat(reserve.borrowInfo?.utilizationRate?.value || '0') * 100;
    const maxLTV = parseFloat(reserve.supplyInfo?.maxLTV?.value || '0') * 100;
    const liqThreshold = parseFloat(reserve.supplyInfo?.liquidationThreshold?.value || '0') * 100;
    const liqBonus = parseFloat(reserve.supplyInfo?.liquidationBonus?.value || '0') * 100;
    const reserveFactor = parseFloat(reserve.borrowInfo?.reserveFactor?.value || '0') * 100;
    const supplyCap = parseFloat(reserve.supplyInfo?.supplyCap?.amount?.value || '0');
    const borrowCap = parseFloat(reserve.borrowInfo?.borrowCap?.amount?.value || '0');
    const baseRate = parseFloat(reserve.borrowInfo?.baseVariableBorrowRate?.value || '0') * 100;
    const slope1 = parseFloat(reserve.borrowInfo?.variableRateSlope1?.value || '0') * 100;
    const slope2 = parseFloat(reserve.borrowInfo?.variableRateSlope2?.value || '0') * 100;
    const optimalUsage = parseFloat(reserve.borrowInfo?.optimalUsageRate?.value || '0') * 100;

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <Link href="/dashboard/markets" className="hover:underline">← Markets</Link>
                <span>/</span>
                <span className="uppercase tracking-[0.05em]">{chainInfo.name}</span>
                <span>/</span>
                <span style={{ color: 'var(--foreground)' }}>{symbol}</span>
            </div>

            {/* Header */}
            <div className="tui-panel">
                <div className="tui-panel-header">
                    <span className="tui-panel-title">{symbol} · {name}</span>
                    <div className="flex items-center gap-2">
                        <span className="tui-panel-badge uppercase">{chainInfo.name}</span>
                        {reserve.isFrozen && (
                            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--accent-yellow)', color: 'white' }}>FROZEN</span>
                        )}
                        {reserve.isPaused && (
                            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--accent-red)', color: 'white' }}>PAUSED</span>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4">
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: 'var(--border)' }}>
                        <p className="counter-label">Price</p>
                        <p className="counter-value">{formatCurrency(priceUSD)}</p>
                    </div>
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: 'var(--border)' }}>
                        <p className="counter-label">Total Supplied</p>
                        <p className="counter-value" style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalSuppliedUSD)}</p>
                        <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            {totalSuppliedTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} {symbol}
                        </p>
                    </div>
                    <div className="p-4 lg:p-5 border-r" style={{ borderColor: 'var(--border)' }}>
                        <p className="counter-label">Total Borrowed</p>
                        <p className="counter-value" style={{ color: 'var(--accent-blue)' }}>{formatCurrency(totalBorrowedUSD)}</p>
                        <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            {totalBorrowedTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} {symbol}
                        </p>
                    </div>
                    <div className="p-4 lg:p-5">
                        <p className="counter-label">Available Liquidity</p>
                        <p className="counter-value">{formatCurrency(availableUSD)}</p>
                        <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{formatPercentage(utilization)} utilized</p>
                    </div>
                </div>
            </div>

            {/* APY metrics */}
            <div className="grid grid-cols-2 gap-3">
                <div className="tui-panel">
                    <div className="p-4">
                        <p className="counter-label">Supply APY</p>
                        <p className="counter-value" style={{ color: 'var(--accent-green)' }}>{formatPercentage(supplyAPY, 3)}</p>
                    </div>
                </div>
                <div className="tui-panel">
                    <div className="p-4">
                        <p className="counter-label">Borrow APY (Variable)</p>
                        <p className="counter-value" style={{ color: 'var(--accent-blue)' }}>{formatPercentage(borrowAPY, 3)}</p>
                    </div>
                </div>
            </div>

            {/* APY history chart */}
            <ChartWrapper
                title="APY History"
                badge={`Last ${window === '7' ? 'week' : window === '30' ? 'month' : window === '180' ? '6 months' : 'year'}`}
                timeRanges={[7, 30, 180, 365]}
                selectedRange={parseInt(window, 10)}
                onRangeChange={(r) => setWindow(r.toString())}
                dataSource="Source: AaveKit API supplyAPYHistory + borrowAPYHistory queries. Time-weighted average rate at 4-hour intervals."
                legend={[
                    { label: 'Supply APY', color: 'var(--accent-green)' },
                    { label: 'Borrow APY', color: 'var(--accent-blue)' },
                ]}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.apyHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSupplyApy" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.18} />
                                <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorBorrowApy" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.18} />
                                <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            tick={{ fontSize: 10, fill: '#6B7280' }}
                            axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                            tickLine={false}
                            minTickGap={40}
                        />
                        <YAxis
                            tickFormatter={(value) => `${value.toFixed(1)}%`}
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
                            formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(3)}%`, '']}
                            labelFormatter={(label) => new Date(label).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })}
                        />
                        <Area type="monotone" dataKey="supplyAPY" stroke="var(--accent-green)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSupplyApy)" name="Supply APY" />
                        <Area type="monotone" dataKey="borrowAPY" stroke="var(--accent-blue)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBorrowApy)" name="Borrow APY" />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartWrapper>

            <TuiDivider label="Risk Parameters" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ParamCard label="Max LTV" value={formatPercentage(maxLTV)} hint="Loan-to-value ceiling" />
                <ParamCard label="Liquidation Threshold" value={formatPercentage(liqThreshold)} hint="Position liquidatable below this" />
                <ParamCard label="Liquidation Bonus" value={formatPercentage(liqBonus)} hint="Liquidator discount" />
                <ParamCard label="Reserve Factor" value={formatPercentage(reserveFactor)} hint="Protocol cut of borrow interest" />
                <ParamCard label="Can Be Collateral" value={reserve.supplyInfo?.canBeCollateral ? 'Yes' : 'No'} />
                <ParamCard label="Borrowing State" value={reserve.borrowInfo?.borrowingState || '—'} />
                <ParamCard label="Flash Loan" value={reserve.flashLoanEnabled ? 'Enabled' : 'Disabled'} />
                <ParamCard label="Status" value={reserve.isPaused ? 'Paused' : reserve.isFrozen ? 'Frozen' : 'Active'} />
            </div>

            <TuiDivider label="Interest Rate Model" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ParamCard label="Base Variable Rate" value={formatPercentage(baseRate, 3)} />
                <ParamCard label="Slope 1" value={formatPercentage(slope1, 3)} hint="Rate slope below optimal usage" />
                <ParamCard label="Slope 2" value={formatPercentage(slope2, 3)} hint="Rate slope above optimal usage" />
                <ParamCard label="Optimal Usage" value={formatPercentage(optimalUsage)} hint="Kink in the rate curve" />
            </div>

            <TuiDivider label="Caps" />

            <div className="grid grid-cols-2 gap-3">
                <ParamCard
                    label="Supply Cap"
                    value={supplyCap > 0 ? `${supplyCap.toLocaleString()} ${symbol}` : 'No cap'}
                    hint={reserve.supplyInfo?.supplyCapReached ? 'Cap reached' : undefined}
                />
                <ParamCard
                    label="Borrow Cap"
                    value={borrowCap > 0 ? `${borrowCap.toLocaleString()} ${symbol}` : 'No cap'}
                    hint={reserve.borrowInfo?.borrowCapReached ? 'Cap reached' : undefined}
                />
            </div>

            <TuiDivider label="Token Info" />

            <div className="tui-panel">
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 text-[12px]">
                    <TokenRow label="Underlying Token" symbol={symbol} address={reserve.underlyingToken.address} explorer={explorer} decimals={decimals} />
                    <TokenRow label="Market Address" symbol={reserve.acceptsNative?.symbol} address={market} explorer={explorer} />
                    {reserve.aToken && (
                        <TokenRow label="aToken" symbol={reserve.aToken.symbol} address={reserve.aToken.address} explorer={explorer} />
                    )}
                    {reserve.vToken && (
                        <TokenRow label="vToken (Variable Debt)" symbol={reserve.vToken.symbol} address={reserve.vToken.address} explorer={explorer} />
                    )}
                </div>
            </div>
        </div>
    );
}

function ParamCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="tui-panel">
            <div className="p-4">
                <p className="counter-label">{label}</p>
                <p className="text-base font-bold mt-1" style={{ color: 'var(--foreground)' }}>{value}</p>
                {hint && <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
            </div>
        </div>
    );
}

function TokenRow({
    label, symbol, address, explorer, decimals,
}: {
    label: string;
    symbol?: string;
    address?: string;
    explorer: string;
    decimals?: number;
}) {
    if (!address) return null;
    return (
        <div className="flex items-center justify-between gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
                <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="font-semibold mt-0.5">{symbol || '—'}{decimals != null ? ` · ${decimals} decimals` : ''}</p>
            </div>
            <a
                href={`${explorer}/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] hover:underline"
                style={{ color: 'var(--accent-blue)' }}
            >
                {formatAddress(address)} ↗
            </a>
        </div>
    );
}
