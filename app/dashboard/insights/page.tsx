// app/dashboard/insights/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercentage } from '@/lib/aave/helpers';
import { Sparkles, TrendingUp, AlertTriangle, Wallet, DollarSign, Activity } from 'lucide-react';
import Image from 'next/image';

async function getOverviewData() {
    const res = await fetch('/api/aave/overview');
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
}

async function getMarketsData() {
    const res = await fetch('/api/aave/markets');
    if (!res.ok) throw new Error('Failed to fetch markets data');
    return res.json();
}

async function getWalletsData() {
    const res = await fetch('/api/aave/wallets?page=1&pageSize=100');
    if (!res.ok) throw new Error('Failed to fetch wallets data');
    return res.json();
}

export default function InsightsPage() {
    const { data: overviewData, isLoading: overviewLoading } = useQuery({
        queryKey: ['overviewData'],
        queryFn: getOverviewData,
    });

    const { data: marketsData, isLoading: marketsLoading } = useQuery({
        queryKey: ['marketsData'],
        queryFn: getMarketsData,
    });

    const { data: walletsData, isLoading: walletsLoading } = useQuery({
        queryKey: ['walletsDataInsights'],
        queryFn: getWalletsData,
    });

    if (overviewLoading || marketsLoading || walletsLoading) return <LoadingState />;
    if (!overviewData || !marketsData || !walletsData) return <ErrorState message="Failed to load insights data." />;

    const markets = marketsData?.markets || [];
    const accounts = walletsData?.accounts || [];
    const utilization = overviewData.totalBorrowBalanceUSD / overviewData.totalValueLockedUSD;

    // Calculate key metrics
    const topMarkets = markets
        .sort((a: any, b: any) => parseFloat(b.totalSupply) - parseFloat(a.totalSupply))
        .slice(0, 5);

    const highRiskWallets = accounts.filter((a: any) => a.healthFactor && a.healthFactor < 1.5);
    const atRiskValue = highRiskWallets.reduce((sum: number, w: any) => sum + parseFloat(w.totalCollateralUSD || 0), 0);

    return (
        <div className="space-y-4">
            {/* Header with Datum Labs Branding */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Datum Labs Insights</h2>
                        <p className="text-xs text-muted-foreground">Comprehensive protocol analysis</p>
                    </div>
                </div>
                <Image
                    src="/branding/logo-horizontal.png"
                    alt="Datum Labs"
                    width={120}
                    height={24}
                    className="opacity-60"
                />
            </div>

            {/* About the Protocol */}
            <Card className="border-primary/20">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        About Aave V3 Protocol
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Aave V3 is a <span className="font-medium text-foreground">decentralized lending protocol</span> that operates on the Ethereum blockchain.
                        Think of it as a digital bank, but without a central authority controlling it. Instead, it uses smart contracts (automated code)
                        to manage all transactions.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground">How it works:</span> Users can deposit their crypto assets (like ETH, USDC, or DAI)
                        into the protocol to earn interest. These deposits create a pool of liquidity that other users can borrow from. Borrowers must
                        provide collateral (usually worth more than what they borrow) to ensure the safety of lenders' funds. This is called
                        <span className="font-medium text-foreground"> overcollateralized lending</span>.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        The protocol automatically adjusts interest rates based on supply and demand. When many people want to borrow an asset,
                        the interest rate increases to attract more suppliers. This creates a balanced, self-regulating market.
                    </p>
                    <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="p-3 bg-primary/5 rounded-lg">
                            <div className="text-xs text-muted-foreground">Network</div>
                            <div className="text-sm font-semibold mt-1">Ethereum</div>
                        </div>
                        <div className="p-3 bg-primary/5 rounded-lg">
                            <div className="text-xs text-muted-foreground">Version</div>
                            <div className="text-sm font-semibold mt-1">V3</div>
                        </div>
                        <div className="p-3 bg-primary/5 rounded-lg">
                            <div className="text-xs text-muted-foreground">Markets</div>
                            <div className="text-sm font-semibold mt-1">{markets.length}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* High-Level Information */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                        High-Level Metrics
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        These metrics provide a snapshot of the protocol's overall health and activity. <span className="font-medium text-foreground">Total Value Locked (TVL)</span>
                        represents all the crypto assets currently deposited in the protocol. A higher TVL indicates greater trust and usage.
                        <span className="font-medium text-foreground"> Total Borrowed</span> shows how much users have borrowed, while the
                        <span className="font-medium text-foreground"> Utilization Rate</span> (Borrowed ÷ TVL) indicates how efficiently the protocol's liquidity is being used.
                    </p>
                    <div className="grid gap-3 md:grid-cols-4">
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Total Value Locked</div>
                            <div className="text-xl font-bold">{formatCurrency(overviewData.totalValueLockedUSD)}</div>
                            <div className="text-xs text-emerald-500 mt-1">
                                {overviewData.tvlChange > 0 ? '↑' : '↓'} {Math.abs(overviewData.tvlChange * 100).toFixed(2)}% (30d)
                            </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Total Borrowed</div>
                            <div className="text-xl font-bold">{formatCurrency(overviewData.totalBorrowBalanceUSD)}</div>
                            <div className="text-xs text-amber-500 mt-1">
                                {overviewData.borrowChange > 0 ? '↑' : '↓'} {Math.abs(overviewData.borrowChange * 100).toFixed(2)}% (30d)
                            </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Utilization Rate</div>
                            <div className="text-xl font-bold">{formatPercentage(utilization * 100)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {utilization > 0.7 ? 'High' : utilization > 0.4 ? 'Moderate' : 'Low'}
                            </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Protocol Revenue</div>
                            <div className="text-xl font-bold">{formatCurrency(overviewData.protocolRevenueUSD)}</div>
                            <div className="text-xs text-muted-foreground mt-1">All-time</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Markets Analysis */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-blue-500" />
                        Top Markets by Supply
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Each market represents a different cryptocurrency that can be supplied or borrowed. <span className="font-medium text-foreground">Supply APY</span>
                        (Annual Percentage Yield) is the interest rate you earn by depositing assets. <span className="font-medium text-foreground">Borrow APY</span> is what
                        borrowers pay. The difference between these rates generates revenue for the protocol and covers operational costs.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground">Utilization</span> shows what percentage of supplied assets are currently borrowed. High utilization
                        (&gt;80%) can lead to higher interest rates and potential liquidity constraints, while low utilization (&lt;30%) might indicate excess supply.
                    </p>
                    <div className="space-y-2">
                        {topMarkets.map((market: any, index: number) => {
                            const supplyAPY = parseFloat(market.supplyAPY || 0);
                            const borrowAPY = parseFloat(market.borrowAPY || 0);
                            const marketUtil = parseFloat(market.totalBorrow) / parseFloat(market.totalSupply);

                            return (
                                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm">{market.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            Supply: {formatCurrency(parseFloat(market.totalSupply))} •
                                            Borrow: {formatCurrency(parseFloat(market.totalBorrow))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-emerald-500">{formatPercentage(supplyAPY)} APY</div>
                                        <div className="text-xs text-muted-foreground">{formatPercentage(marketUtil * 100)} util</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Wallets Risk Analysis */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-purple-500" />
                        Wallet Risk Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        The <span className="font-medium text-foreground">Health Factor</span> is a critical metric that determines the safety of a borrower's position.
                        It's calculated based on the value of their collateral versus their borrowed amount. A health factor above 2.0 is considered very safe,
                        between 1.5-2.0 is moderate risk, and below 1.5 is high risk.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        When the health factor drops below 1.0, the position becomes <span className="font-medium text-foreground">eligible for liquidation</span>,
                        meaning anyone can repay part of the debt and claim the collateral at a discount. This mechanism protects lenders from losses when
                        collateral values drop.
                    </p>
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Healthy Positions</div>
                            <div className="text-2xl font-bold text-emerald-500">
                                {accounts.filter((a: any) => !a.healthFactor || a.healthFactor >= 2).length}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Health Factor ≥ 2.0</div>
                        </div>
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">At Risk</div>
                            <div className="text-2xl font-bold text-amber-500">
                                {accounts.filter((a: any) => a.healthFactor && a.healthFactor >= 1.5 && a.healthFactor < 2).length}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Health Factor 1.5-2.0</div>
                        </div>
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">High Risk</div>
                            <div className="text-2xl font-bold text-red-500">{highRiskWallets.length}</div>
                            <div className="text-xs text-muted-foreground mt-1">Health Factor &lt; 1.5</div>
                        </div>
                    </div>
                    {highRiskWallets.length > 0 && (
                        <div className="mt-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-red-500">Risk Alert</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {formatCurrency(atRiskValue)} in collateral at risk across {highRiskWallets.length} positions
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Liquidation Overview */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Liquidation Risk Overview
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground">Liquidation</span> is a protective mechanism that maintains the protocol's solvency. When a borrower's
                        collateral value falls too low (health factor &lt; 1.0), their position can be liquidated. This means a third party (liquidator) can repay
                        part of the debt and receive the collateral at a discount (usually 5-10%).
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Positions with health factors between 1.0-1.2 are at immediate risk of liquidation, especially during market volatility. Borrowers should
                        monitor their positions closely and either add more collateral or repay debt to improve their health factor before liquidation occurs.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Positions Near Liquidation</div>
                            <div className="text-2xl font-bold">
                                {accounts.filter((a: any) => a.healthFactor && a.healthFactor < 1.2).length}
                            </div>
                            <div className="text-xs text-red-500 mt-1">Health Factor &lt; 1.2</div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Total at Risk</div>
                            <div className="text-2xl font-bold">{formatCurrency(atRiskValue)}</div>
                            <div className="text-xs text-muted-foreground mt-1">Collateral value</div>
                        </div>
                    </div>
                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                        <div className="text-xs font-medium text-blue-500 mb-1">Liquidation Threshold</div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Positions are liquidated when their health factor falls below 1.0. Monitor positions with
                            health factors between 1.0-1.5 closely as they are vulnerable to price volatility.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-2">
                <p>Powered by <span className="font-semibold text-primary">Datum Labs</span> • Real-time Aave V3 Protocol Data</p>
            </div>
        </div>
    );
}
