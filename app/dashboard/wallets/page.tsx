// app/dashboard/wallets/page.tsx
'use client';

import { useState, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatAddress, getHealthFactorStatus } from '@/lib/aave/helpers';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

async function getWalletsData(page: number, pageSize: number) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/aave/wallets?page=${page}&pageSize=${pageSize}`);
    if (!res.ok) throw new Error('Failed to fetch wallets data');
    return res.json();
}

export default function WalletsPage() {
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [searchTerm, setSearchTerm] = useState('');
    const [riskFilter, setRiskFilter] = useState<'all' | 'safe' | 'moderate' | 'high'>('all');

    const { data, isLoading, error } = useQuery({
        queryKey: ['walletsData', page, pageSize],
        queryFn: () => getWalletsData(page, pageSize),
    });

    // Filter wallets based on search and risk level
    const filteredAccounts = useMemo(() => {
        if (!data) return [];

        let filtered = data.accounts.filter((account: any) => {
            // Search filter
            const matchesSearch = account.address.toLowerCase().includes(searchTerm.toLowerCase());

            // Risk filter
            let matchesRisk = true;
            if (riskFilter !== 'all') {
                const healthStatus = account.healthFactor
                    ? getHealthFactorStatus(account.healthFactor)
                    : { status: 'No Debt', color: 'text-gray-500' };

                if (riskFilter === 'safe') {
                    matchesRisk = !account.healthFactor || account.healthFactor >= 1.5;
                } else if (riskFilter === 'moderate') {
                    matchesRisk = account.healthFactor && account.healthFactor >= 1.1 && account.healthFactor < 1.5;
                } else if (riskFilter === 'high') {
                    matchesRisk = account.healthFactor && account.healthFactor < 1.1;
                }
            }

            return matchesSearch && matchesRisk;
        });

        return filtered;
    }, [data, searchTerm, riskFilter]);

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message="Failed to load wallets data. Please try again." />;

    const accounts = data.accounts;
    const safeCount = accounts.filter((a: any) => !a.healthFactor || a.healthFactor >= 1.5).length;
    const moderateCount = accounts.filter((a: any) => a.healthFactor && a.healthFactor >= 1.1 && a.healthFactor < 1.5).length;
    const highRiskCount = accounts.filter((a: any) => a.healthFactor && a.healthFactor < 1.1).length;

    return (
        <div className="space-y-6">
            {/* Health Factor Distribution */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRiskFilter('safe')}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Safe Positions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {safeCount}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Health Factor ≥ 1.5
                        </p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRiskFilter('moderate')}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Moderate Risk
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {moderateCount}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Health Factor 1.1 - 1.5
                        </p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRiskFilter('high')}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            High Risk
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {highRiskCount}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Health Factor &lt; 1.1
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Wallets Table */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>User Positions</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Showing {filteredAccounts.length} of {accounts.length} wallets (Page {page})
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search address..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 w-full sm:w-[200px]"
                                />
                            </div>

                            {/* Risk Filter */}
                            <Select value={riskFilter} onValueChange={(value: any) => setRiskFilter(value)}>
                                <SelectTrigger className="w-full sm:w-[150px]">
                                    <SelectValue placeholder="Filter by risk..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Wallets</SelectItem>
                                    <SelectItem value="safe">Safe Only</SelectItem>
                                    <SelectItem value="moderate">Moderate Risk</SelectItem>
                                    <SelectItem value="high">High Risk</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Wallet Address</TableHead>
                                    <TableHead className="text-right">Collateral</TableHead>
                                    <TableHead className="text-right">Debt</TableHead>
                                    <TableHead className="text-right">Health Factor</TableHead>
                                    <TableHead className="text-right">Positions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No wallets found matching your filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAccounts.map((account: any) => {
                                        const healthStatus = account.healthFactor
                                            ? getHealthFactorStatus(account.healthFactor)
                                            : { status: 'No Debt', color: 'text-gray-500' };

                                        return (
                                            <TableRow key={account.address}>
                                                <TableCell className="font-mono text-sm">
                                                    {formatAddress(account.address)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(account.totalCollateralUSD)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(account.totalDebtUSD)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className={`font-semibold ${healthStatus.color}`}>
                                                            {account.healthFactor
                                                                ? account.healthFactor.toFixed(2)
                                                                : '∞'
                                                            }
                                                        </span>
                                                        <span className={`text-xs ${healthStatus.color}`}>
                                                            {healthStatus.status}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {account.openPositionCount}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
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

                    <div className="text-xs text-muted-foreground text-center mt-4">
                        Powered by <span className="font-semibold">Datum Labs</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
