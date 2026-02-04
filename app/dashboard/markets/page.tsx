// app/dashboard/markets/page.tsx
'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/aave-dashboard/LoadingState';
import { ErrorState } from '@/components/aave-dashboard/ErrorState';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatPercentage } from '@/lib/aave/helpers';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

async function getMarketsData() {
    const res = await fetch('/api/aave/markets');
    if (!res.ok) throw new Error('Failed to fetch markets data');
    return res.json();
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6', '#f97316'];

export default function MarketsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'tvl' | 'supplyApy' | 'borrowApy' | 'utilization'>('tvl');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const { data, isLoading, error } = useQuery({
        queryKey: ['marketsData'],
        queryFn: getMarketsData,
    });

    // Filter and sort markets
    const filteredMarkets = useMemo(() => {
        if (!data || !data.markets) return [];

        let filtered = data.markets.filter((market: any) =>
            market.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            market.inputToken.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filtered.sort((a: any, b: any) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'tvl':
                    aValue = a.totalValueLockedUSD;
                    bValue = b.totalValueLockedUSD;
                    break;
                case 'supplyApy':
                    aValue = a.rates.find((r: any) => r.side === 'LENDER')?.rate || 0;
                    bValue = b.rates.find((r: any) => r.side === 'LENDER')?.rate || 0;
                    break;
                case 'borrowApy':
                    aValue = a.rates.find((r: any) => r.side === 'BORROWER')?.rate || 0;
                    bValue = b.rates.find((r: any) => r.side === 'BORROWER')?.rate || 0;
                    break;
                case 'utilization':
                    aValue = a.utilization;
                    bValue = b.utilization;
                    break;
                default:
                    aValue = a.totalValueLockedUSD;
                    bValue = b.totalValueLockedUSD;
            }

            return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
        });

        return filtered;
    }, [data, searchTerm, sortBy, sortOrder]);

    // Prepare pie chart data (top 8 markets by TVL)
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
    const totalBorrow = data.markets.reduce((sum: number, m: any) => sum + m.totalBorrowBalanceUSD, 0);
    const avgUtilization = data.markets.reduce((sum: number, m: any) => sum + m.utilization, 0) / data.markets.length;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Supply
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalSupply)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across {data.markets.length} markets</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Highest Supply APY
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatPercentage(
                                Math.max(...data.markets.map((m: any) =>
                                    m.rates.find((r: any) => r.side === 'LENDER')?.rate || 0
                                ))
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Best earning rate</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Avg Utilization
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPercentage(avgUtilization)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across all markets</p>
                    </CardContent>
                </Card>
            </div>

            {/* Market Distribution Pie Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Market Distribution by TVL</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Top 8 markets by total value locked
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="relative h-80">
                        {/* Watermark Logo - Behind Chart */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                            <Image
                                src="/branding/logo-horizontal.png"
                                alt="Datum Labs"
                                width={200}
                                height={40}
                                className="opacity-10"
                            />
                        </div>

                        {/* Chart - In Front */}
                        <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                            <PieChart>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Search and Filter Controls */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>All Markets</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                {filteredMarkets.length} of {data.markets.length} markets
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search markets..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 w-full sm:w-[200px]"
                                />
                            </div>

                            {/* Sort By */}
                            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                                <SelectTrigger className="w-full sm:w-[150px]">
                                    <SelectValue placeholder="Sort by..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tvl">TVL</SelectItem>
                                    <SelectItem value="supplyApy">Supply APY</SelectItem>
                                    <SelectItem value="borrowApy">Borrow APY</SelectItem>
                                    <SelectItem value="utilization">Utilization</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Sort Order */}
                            <button
                                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                                className="px-3 py-2 border rounded-md hover:bg-muted transition-colors"
                                title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                            >
                                {sortOrder === 'desc' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Asset</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Total Supply</TableHead>
                                    <TableHead className="text-right">Total Borrow</TableHead>
                                    <TableHead className="text-right">Supply APY</TableHead>
                                    <TableHead className="text-right">Borrow APY</TableHead>
                                    <TableHead>Utilization</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMarkets.map((market: any) => {
                                    const supplyRate = market.rates.find((r: any) => r.side === 'LENDER');
                                    const borrowRate = market.rates.find((r: any) => r.side === 'BORROWER');

                                    return (
                                        <TableRow key={market.id}>
                                            <TableCell>
                                                <div>
                                                    <div className="font-semibold">{market.inputToken.symbol}</div>
                                                    <div className="text-xs text-muted-foreground">{market.name}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(market.inputTokenPriceUSD)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(market.totalDepositBalanceUSD)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(market.totalBorrowBalanceUSD)}
                                            </TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">
                                                {formatPercentage(supplyRate?.rate || 0)}
                                            </TableCell>
                                            <TableCell className="text-right text-blue-600 font-medium">
                                                {formatPercentage(borrowRate?.rate || 0)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="bg-gradient-to-r from-blue-600 to-purple-600 h-full transition-all"
                                                            style={{ width: `${Math.min(market.utilization, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium w-12 text-right">
                                                        {formatPercentage(market.utilization)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
