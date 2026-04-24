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
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';

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

            {/* APY history + utilization charts side by side. They share the
                same window state, so toggling the time range updates both at once.
                On screens narrower than `lg` they stack vertically. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                height="h-64"
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

            {/* Utilization history chart — derived from APY history.
                Aave invariant: supplyAPY = borrowAPY × utilization × (1 − reserveFactor).
                Solving for utilization gives us a usable historical series even though
                AaveKit doesn't expose one directly. Clamps to [0, 1] for sanity. */}
            <ChartWrapper
                title="Utilization Rate"
                badge={`Last ${window === '7' ? 'week' : window === '30' ? 'month' : window === '180' ? '6 months' : 'year'}`}
                timeRanges={[7, 30, 180, 365]}
                selectedRange={parseInt(window, 10)}
                onRangeChange={(r) => setWindow(r.toString())}
                dataSource="Derived: utilization = supplyAPY / (borrowAPY × (1 − reserveFactor)). The reserveFactor used is the current value, so historical periods where the reserve factor differed will be slightly off."
                legend={[
                    { label: 'Utilization', color: 'var(--accent-orange)' },
                    { label: `Optimal (${optimalUsage.toFixed(0)}%)`, color: 'var(--accent-yellow)' },
                ]}
                height="h-64"
            >
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={(data.apyHistory || []).map((entry: any) => {
                            const supply = entry.supplyAPY ?? 0;
                            const borrow = entry.borrowAPY ?? 0;
                            const denom = borrow * (1 - reserveFactor / 100);
                            let util = denom > 0 ? (supply / denom) * 100 : 0;
                            // Clamp to [0, 100]. Slight overshoot can happen when supply
                            // and borrow rates briefly desync between snapshots.
                            if (util < 0) util = 0;
                            if (util > 100) util = 100;
                            return { date: entry.date, utilization: util };
                        })}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-orange)" stopOpacity={0.18} />
                                <stop offset="95%" stopColor="var(--accent-orange)" stopOpacity={0} />
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
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value.toFixed(0)}%`}
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
                            formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(2)}%`, '']}
                            labelFormatter={(label) => new Date(label).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })}
                        />
                        {/* Optimal usage threshold — above this line the kinked rate model
                            switches to slope2 and borrow rates ramp aggressively. */}
                        {optimalUsage > 0 && (
                            <ReferenceLine
                                y={optimalUsage}
                                stroke="var(--accent-yellow)"
                                strokeDasharray="4 4"
                                strokeWidth={1.5}
                                label={{
                                    value: `Optimal ${optimalUsage.toFixed(0)}%`,
                                    position: 'right',
                                    fill: 'var(--accent-yellow)',
                                    fontSize: 9,
                                }}
                            />
                        )}
                        <Area
                            type="monotone"
                            dataKey="utilization"
                            stroke="var(--accent-orange)"
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#colorUtil)"
                            name="Utilization"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartWrapper>
            </div>

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

            <InterestRateCurveChart
                baseRate={baseRate}
                slope1={slope1}
                slope2={slope2}
                optimalUsage={optimalUsage}
                reserveFactor={reserveFactor}
                currentUtilization={utilization}
            />

            <TuiDivider label="Caps" />

            <div className="grid grid-cols-2 gap-3">
                <CapUsageCard
                    label="Supply Cap"
                    current={totalSuppliedTokens}
                    cap={supplyCap}
                    symbol={symbol}
                    capReached={reserve.supplyInfo?.supplyCapReached}
                    accent="var(--accent-green)"
                />
                <CapUsageCard
                    label="Borrow Cap"
                    current={totalBorrowedTokens}
                    cap={borrowCap}
                    symbol={symbol}
                    capReached={reserve.borrowInfo?.borrowCapReached}
                    accent="var(--accent-blue)"
                />
            </div>

            <CapHistoryChart
                chainId={chainInfo.chainId}
                market={market}
                token={token}
                symbol={symbol}
                supplyCap={supplyCap}
                borrowCap={borrowCap}
            />

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

/**
 * Plots Aave's kinked interest rate curve (borrow + supply) across the full
 * 0 → 100% utilization range. All inputs are in percent (0-100), not [0, 1].
 *
 * Borrow rate formula:
 *   U ≤ U_opt : base + (U / U_opt) × slope1
 *   U > U_opt : base + slope1 + ((U − U_opt) / (1 − U_opt)) × slope2
 *
 * Supply rate:
 *   supplyAPY = borrowAPY × utilization × (1 − reserveFactor)
 *
 * We sample every 1% of U plus an explicit point at U_opt (the kink) and the
 * current utilization so those markers sit exactly on the curves.
 */
function InterestRateCurveChart({
    baseRate, slope1, slope2, optimalUsage, reserveFactor, currentUtilization,
}: {
    baseRate: number;
    slope1: number;
    slope2: number;
    optimalUsage: number;
    reserveFactor: number;
    currentUtilization: number;
}) {
    const reserveFactorDec = reserveFactor / 100;

    function borrowAt(u: number): number {
        if (optimalUsage <= 0) return baseRate;
        if (u <= optimalUsage) {
            return baseRate + (u / optimalUsage) * slope1;
        }
        const over = (u - optimalUsage) / Math.max(1e-9, 100 - optimalUsage);
        return baseRate + slope1 + over * slope2;
    }

    function supplyAt(u: number): number {
        return borrowAt(u) * (u / 100) * (1 - reserveFactorDec);
    }

    const samples = new Set<number>();
    for (let u = 0; u <= 100; u += 1) samples.add(u);
    samples.add(Number(optimalUsage.toFixed(2)));
    samples.add(Number(currentUtilization.toFixed(2)));
    const curve = Array.from(samples)
        .filter(u => u >= 0 && u <= 100)
        .sort((a, b) => a - b)
        .map(u => ({
            utilization: u,
            borrow: borrowAt(u),
            supply: supplyAt(u),
        }));

    const currentBorrow = borrowAt(currentUtilization);
    const currentSupply = supplyAt(currentUtilization);
    const kinkBorrow = borrowAt(optimalUsage);

    return (
        <ChartWrapper
            title="Rate Curve"
            badge="Current model"
            dataSource="Synthetic: Aave's kinked rate model plotted from the reserve's current parameters (base, slope1, slope2, optimal usage, reserve factor). The kink marker is at optimal usage; the filled dot is the current utilization."
            legend={[
                { label: 'Borrow APY', color: 'var(--accent-blue)' },
                { label: 'Supply APY', color: 'var(--accent-green)' },
                { label: 'Kink (optimal)', color: 'var(--accent-yellow)' },
                { label: 'Current', color: 'var(--accent-orange)' },
            ]}
            height="h-64"
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                        dataKey="utilization"
                        type="number"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 10, fill: '#6B7280' }}
                        axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                        tickLine={false}
                        label={{ value: 'Utilization', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#6B7280' }}
                    />
                    <YAxis
                        tickFormatter={(v) => `${v.toFixed(1)}%`}
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
                        formatter={(value, name) => [
                            `${(Number(value) || 0).toFixed(3)}%`,
                            name === 'borrow' ? 'Borrow APY' : 'Supply APY',
                        ]}
                        labelFormatter={(label) => `Utilization ${Number(label).toFixed(1)}%`}
                    />
                    <ReferenceLine
                        x={optimalUsage}
                        stroke="var(--accent-yellow)"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                            value: `Kink ${optimalUsage.toFixed(0)}%`,
                            position: 'top',
                            fill: 'var(--accent-yellow)',
                            fontSize: 9,
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="borrow"
                        stroke="var(--accent-blue)"
                        strokeWidth={2}
                        dot={false}
                        name="borrow"
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="supply"
                        stroke="var(--accent-green)"
                        strokeWidth={2}
                        dot={false}
                        name="supply"
                        isAnimationActive={false}
                    />
                    {/* Kink marker — the point on the borrow curve at optimal usage */}
                    <ReferenceDot
                        x={optimalUsage}
                        y={kinkBorrow}
                        r={4}
                        fill="var(--accent-yellow)"
                        stroke="var(--background)"
                        strokeWidth={2}
                    />
                    {/* Current position — filled dot on both curves */}
                    <ReferenceDot
                        x={currentUtilization}
                        y={currentBorrow}
                        r={5}
                        fill="var(--accent-orange)"
                        stroke="var(--background)"
                        strokeWidth={2}
                    />
                    <ReferenceDot
                        x={currentUtilization}
                        y={currentSupply}
                        r={5}
                        fill="var(--accent-orange)"
                        stroke="var(--background)"
                        strokeWidth={2}
                    />
                </LineChart>
            </ResponsiveContainer>
        </ChartWrapper>
    );
}

/**
 * Historical supplied + borrowed area chart with the current cap drawn as a
 * dashed reference line on each axis. Data comes from Aave's official
 * subgraph (`reserveParamsHistoryItems`), downsampled to one point per day
 * server-side.
 *
 * For chains we don't have a subgraph mapping for (Plasma, Mantle, etc.) the
 * chart renders a "not available" panel.
 */
function CapHistoryChart({
    chainId, market, token, symbol, supplyCap, borrowCap,
}: {
    chainId: number;
    market: string;
    token: string;
    symbol: string;
    supplyCap: number;
    borrowCap: number;
}) {
    const [window, setWindow] = useState('30');

    const { data, isLoading, error } = useQuery({
        queryKey: ['reserveHistory', chainId, market, token, window],
        queryFn: async () => {
            const params = new URLSearchParams({
                chainId: chainId.toString(),
                market,
                token,
                window,
            });
            const res = await fetch(`/api/aave/markets/reserve/history?${params}`);
            if (!res.ok) throw new Error('Failed to fetch history');
            return res.json();
        },
    });

    const history = data?.history || [];
    const unsupported = data?.unsupported;
    const truncated = data?.truncated;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ChartWrapper
                title="Supply History"
                badge={`Last ${window === '7' ? 'week' : window === '30' ? 'month' : window === '90' ? '3 months' : window === '180' ? '6 months' : 'year'}`}
                timeRanges={[7, 30, 90, 180, 365]}
                selectedRange={parseInt(window, 10)}
                onRangeChange={(r) => setWindow(r.toString())}
                dataSource="Source: Aave official subgraph (reserveParamsHistoryItems). Daily snapshot of totalATokenSupply. Dashed line = current supply cap."
                legend={[
                    { label: 'Supplied', color: 'var(--accent-green)' },
                    ...(supplyCap > 0 ? [{ label: 'Cap', color: 'var(--accent-red)' }] : []),
                ]}
                height="h-56"
            >
                {unsupported ? (
                    <UnavailableMessage reason="Aave official subgraph not configured for this chain." />
                ) : isLoading ? (
                    <ChartSpinner />
                ) : error ? (
                    <UnavailableMessage reason="Failed to load history." />
                ) : history.length === 0 ? (
                    <UnavailableMessage reason={`No history available in the last ${window} days.`} />
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="capSupplyGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.18} />
                                    <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                tick={{ fontSize: 10, fill: '#6B7280' }}
                                axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                                tickLine={false}
                                minTickGap={40}
                            />
                            <YAxis
                                tickFormatter={(v) => formatTokenAxis(v)}
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
                                formatter={(value) => [`${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`, '']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            />
                            {supplyCap > 0 && (
                                <ReferenceLine
                                    y={supplyCap}
                                    stroke="var(--accent-red)"
                                    strokeDasharray="4 4"
                                    strokeWidth={1.5}
                                    label={{
                                        value: `Cap ${formatTokenAxis(supplyCap)}`,
                                        position: 'right',
                                        fill: 'var(--accent-red)',
                                        fontSize: 9,
                                    }}
                                />
                            )}
                            <Area
                                type="monotone"
                                dataKey="supplied"
                                stroke="var(--accent-green)"
                                strokeWidth={1.5}
                                fillOpacity={1}
                                fill="url(#capSupplyGrad)"
                                name="Supplied"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </ChartWrapper>

            <ChartWrapper
                title="Borrow History"
                badge={`Last ${window === '7' ? 'week' : window === '30' ? 'month' : window === '90' ? '3 months' : window === '180' ? '6 months' : 'year'}`}
                timeRanges={[7, 30, 90, 180, 365]}
                selectedRange={parseInt(window, 10)}
                onRangeChange={(r) => setWindow(r.toString())}
                dataSource="Source: Aave official subgraph (reserveParamsHistoryItems). Daily snapshot of totalCurrentVariableDebt + totalPrincipalStableDebt. Dashed line = current borrow cap."
                legend={[
                    { label: 'Borrowed', color: 'var(--accent-blue)' },
                    ...(borrowCap > 0 ? [{ label: 'Cap', color: 'var(--accent-red)' }] : []),
                ]}
                height="h-56"
            >
                {unsupported ? (
                    <UnavailableMessage reason="Aave official subgraph not configured for this chain." />
                ) : isLoading ? (
                    <ChartSpinner />
                ) : error ? (
                    <UnavailableMessage reason="Failed to load history." />
                ) : history.length === 0 ? (
                    <UnavailableMessage reason={`No history available in the last ${window} days.`} />
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="capBorrowGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.18} />
                                    <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                tick={{ fontSize: 10, fill: '#6B7280' }}
                                axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                                tickLine={false}
                                minTickGap={40}
                            />
                            <YAxis
                                tickFormatter={(v) => formatTokenAxis(v)}
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
                                formatter={(value) => [`${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`, '']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            />
                            {borrowCap > 0 && (
                                <ReferenceLine
                                    y={borrowCap}
                                    stroke="var(--accent-red)"
                                    strokeDasharray="4 4"
                                    strokeWidth={1.5}
                                    label={{
                                        value: `Cap ${formatTokenAxis(borrowCap)}`,
                                        position: 'right',
                                        fill: 'var(--accent-red)',
                                        fontSize: 9,
                                    }}
                                />
                            )}
                            <Area
                                type="monotone"
                                dataKey="borrowed"
                                stroke="var(--accent-blue)"
                                strokeWidth={1.5}
                                fillOpacity={1}
                                fill="url(#capBorrowGrad)"
                                name="Borrowed"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </ChartWrapper>

            {truncated && (
                <p className="col-span-full text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Note: history capped at the most recent 1,000 on-chain events.
                    Very active reserves may show a shorter window than selected.
                </p>
            )}
        </div>
    );
}

// Compact axis formatter that handles both small (sub-thousand) and large (M / B) numbers.
function formatTokenAxis(v: number): string {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(0);
}

function ChartSpinner() {
    return (
        <div className="h-full flex items-center justify-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Loading…
        </div>
    );
}

function UnavailableMessage({ reason }: { reason: string }) {
    return (
        <div className="h-full flex items-center justify-center text-[11px] px-4 text-center" style={{ color: 'var(--text-muted)' }}>
            {reason}
        </div>
    );
}

/**
 * Visual progress bar for a reserve's cap — current fill + remaining headroom.
 * Pairs with CapHistoryChart below for the time series.
 * Color shifts to amber past 75% and red past 95%.
 */
function CapUsageCard({
    label, current, cap, symbol, capReached, accent,
}: {
    label: string;
    current: number;
    cap: number;
    symbol: string;
    capReached?: boolean;
    accent: string;
}) {
    const hasCap = cap > 0;
    const pct = hasCap ? Math.min(100, (current / cap) * 100) : 0;
    const remaining = hasCap ? Math.max(0, cap - current) : 0;
    const barColor = pct >= 95 ? 'var(--accent-red)' : pct >= 75 ? 'var(--accent-yellow)' : accent;

    return (
        <div className="tui-panel">
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="counter-label">{label}</p>
                    {capReached && (
                        <span className="text-[9px] px-2 py-0.5 rounded" style={{ background: 'var(--accent-red)', color: 'white' }}>
                            CAP REACHED
                        </span>
                    )}
                </div>
                {hasCap ? (
                    <>
                        <p className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                            {current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                                {' / '}
                                {cap.toLocaleString()} {symbol}
                            </span>
                        </p>
                        {/* Filled bar — width = % of cap used */}
                        <div className="mt-2 h-2 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                            <div
                                className="h-full transition-all"
                                style={{ width: `${pct}%`, background: barColor }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            <span>{pct.toFixed(2)}% used</span>
                            <span>{remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} {symbol} headroom</span>
                        </div>
                    </>
                ) : (
                    <p className="text-base font-bold" style={{ color: 'var(--foreground)' }}>No cap</p>
                )}
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
