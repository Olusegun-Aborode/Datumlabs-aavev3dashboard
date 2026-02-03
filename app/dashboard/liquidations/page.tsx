// app/dashboard/liquidations/page.tsx
'use client';

import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { formatCurrency, formatAddress, formatDateTime } from '@/lib/aave/helpers';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

async function getLiquidationsData(page: number, pageSize: number) {
    const res = await fetch(`/api/aave/liquidations?page=${page}&pageSize=${pageSize}`);
    if (!res.ok) throw new Error('Failed to fetch liquidations data');
    return res.json();
}

export default function LiquidationsPage() {
    const [page, setPage] = useState(1);
    const pageSize = 50;

    const { data, isLoading, error } = useQuery({
        queryKey: ['liquidationsData', page, pageSize],
        queryFn: () => getLiquidationsData(page, pageSize),
    });

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message="Failed to load liquidations data. Please try again." />;

    const liquidations = data.liquidations;
    const aggregations = data.aggregations;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Liquidated (This Page)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(aggregations.totalLiquidatedUSD)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {aggregations.totalCount} liquidation events
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Most Liquidated Asset
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {aggregations.byAsset.length > 0 && (
                            <>
                                <div className="text-2xl font-bold">
                                    {aggregations.byAsset[0].symbol}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatCurrency(aggregations.byAsset[0].totalUSD)} • {aggregations.byAsset[0].count} events
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Liquidations by Asset Chart */}
            {aggregations.byAsset.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Liquidations by Asset</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Total liquidated value per asset (current page)
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={aggregations.byAsset.slice(0, 10)}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="symbol" tick={{ fontSize: 12 }} />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => `$${(value / 1e6).toFixed(1)}M`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                                        formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Total USD']}
                                    />
                                    <Bar dataKey="totalUSD" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Liquidations Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Liquidations</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Showing {liquidations.length} liquidation events (Page {page})
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Asset</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Value (USD)</TableHead>
                                    <TableHead>Liquidatee</TableHead>
                                    <TableHead>Liquidator</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {liquidations.map((liquidation: any) => (
                                    <TableRow key={liquidation.id}>
                                        <TableCell className="text-sm">
                                            {formatDateTime(liquidation.timestamp)}
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-semibold">{liquidation.asset.symbol}</div>
                                                <div className="text-xs text-muted-foreground">{liquidation.market}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {liquidation.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-red-600">
                                            {formatCurrency(liquidation.amountUSD)}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {formatAddress(liquidation.liquidatee)}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {formatAddress(liquidation.liquidator)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                            Page {page} {data.hasMore && '• More available'}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={!data.hasMore}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
