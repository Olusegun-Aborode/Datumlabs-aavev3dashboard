// app/dashboard/overview/page.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from '@/components/aave-dashboard/MetricCard';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '@/lib/aave/helpers';

async function getOverviewData() {
    const res = await fetch('/api/aave/overview');
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
}

export default function OverviewPage() {
    const [timeRange, setTimeRange] = useState<'30' | '90' | '180'>('90');

    const { data, isLoading, error } = useQuery({
        queryKey: ['overviewData'],
        queryFn: getOverviewData,
    });

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message="Failed to load overview data. Please try again." />;

    // Filter historical data based on selected time range
    const filteredData = data.historicalData.slice(-parseInt(timeRange));

    // Calculate percentage changes based on selected time range
    const oldSnapshot = data.historicalData[data.historicalData.length - parseInt(timeRange)] || data.historicalData[0];
    const latestSnapshot = data.historicalData[data.historicalData.length - 1];

    const tvlChange = oldSnapshot
        ? ((latestSnapshot.tvl - oldSnapshot.tvl) / oldSnapshot.tvl) * 100
        : 0;

    const borrowChange = oldSnapshot
        ? ((latestSnapshot.borrows - oldSnapshot.borrows) / oldSnapshot.borrows) * 100
        : 0;

    return (
        <div className="space-y-4">
            {/* Compact Time Range Selector */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Protocol Overview</h2>
                <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as '30' | '90' | '180')}>
                    <TabsList>
                        <TabsTrigger value="30">30D</TabsTrigger>
                        <TabsTrigger value="90">90D</TabsTrigger>
                        <TabsTrigger value="180">180D</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Tighter Metrics Grid */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total Supply"
                    value={formatCurrency(data.totalValueLockedUSD)}
                    change={tvlChange}
                    changeLabel={`vs ${timeRange}d ago`}
                />
                <MetricCard
                    title="Total Borrow"
                    value={formatCurrency(data.totalBorrowBalanceUSD)}
                    change={borrowChange}
                    changeLabel={`vs ${timeRange}d ago`}
                />
                <MetricCard
                    title="Net TVL"
                    value={formatCurrency(data.tvl)}
                    subtitle="Supply - Borrow"
                />
                <MetricCard
                    title="Total Markets"
                    value={data.totalMarkets.toString()}
                    subtitle={`${data.totalMarkets} active lending markets`}
                />
            </div>

            {/* Historical Chart - Compact */}
            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Supply vs Borrow Trend</CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Last {timeRange} days
                    </p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative h-80 p-6">
                        {/* Watermark - Behind */}
                        <div className="absolute inset-0 flex items-center justify-center z-0">
                            <Image
                                src="/branding/logo-horizontal.png"
                                alt="Datum Labs"
                                width={250}
                                height={50}
                                className="opacity-10"
                            />
                        </div>

                        {/* Chart - In Front */}
                        <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                            <AreaChart
                                data={filteredData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorSupply" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorBorrow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    }}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                    tickFormatter={(value) => formatCurrency(value)}
                                    tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                    formatter={(value: any) => [formatCurrency(Number(value || 0)), '']}
                                    labelFormatter={(label) => {
                                        const date = new Date(label);
                                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    }}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="tvl"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorSupply)"
                                    name="Total Supply"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="borrows"
                                    stroke="#f59e0b"
                                    fillOpacity={1}
                                    fill="url(#colorBorrow)"
                                    name="Total Borrow"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Revenue Metrics - Tighter */}
            <div className="grid gap-3 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Protocol Revenue</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Cumulative revenue earned by the protocol
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {formatCurrency(data.protocolRevenueUSD)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Supply Side Revenue</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Cumulative revenue earned by suppliers
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {formatCurrency(data.supplyRevenueUSD)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Last Updated */}
            <div className="text-xs text-muted-foreground text-right">
                Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </div>
        </div>
    );
}
