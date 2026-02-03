// app/api/aave/overview/route.ts
import { NextResponse } from 'next/server';
import { subgraphClient } from '@/lib/aave/graphql-client';
import { GET_PROTOCOL_DATA } from '@/lib/aave/queries';

// Simple in-memory cache for development
// In production, you'd use Redis or similar
const cache = {
    data: null as any,
    lastFetched: 0,
};

export async function GET() {
    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_OVERVIEW || '300', 10) * 1000;

    // Return cached data if still fresh
    if (cache.data && now - cache.lastFetched < cacheTTL) {
        return NextResponse.json(cache.data);
    }

    try {
        // Fetch data from The Graph subgraph
        const { data } = await subgraphClient.query<any>({
            query: GET_PROTOCOL_DATA,
            fetchPolicy: 'network-only',
        });

        const protocol = data.lendingProtocols[0];
        const snapshots = data.financialsDailySnapshots;
        const latestSnapshot = snapshots[0];
        const snapshot30d = snapshots[30] || snapshots[snapshots.length - 1];

        // Calculate 30-day percentage changes
        const tvlChange = snapshot30d
            ? (parseFloat(protocol.totalValueLockedUSD) - parseFloat(snapshot30d.totalValueLockedUSD)) / parseFloat(snapshot30d.totalValueLockedUSD)
            : 0;

        const borrowChange = snapshot30d
            ? (parseFloat(protocol.totalBorrowBalanceUSD) - parseFloat(snapshot30d.totalBorrowBalanceUSD)) / parseFloat(snapshot30d.totalBorrowBalanceUSD)
            : 0;

        // Transform and structure the response data
        const responseData = {
            totalValueLockedUSD: parseFloat(protocol.totalValueLockedUSD),
            totalBorrowBalanceUSD: parseFloat(protocol.totalBorrowBalanceUSD),
            tvl: parseFloat(protocol.totalValueLockedUSD) - parseFloat(protocol.totalBorrowBalanceUSD),
            totalMarkets: protocol.totalPoolCount,
            tvlChange,
            borrowChange,
            protocolRevenueUSD: parseFloat(protocol.cumulativeProtocolSideRevenueUSD),
            supplyRevenueUSD: parseFloat(protocol.cumulativeSupplySideRevenueUSD),
            historicalData: snapshots.map((d: any) => ({
                date: new Date(d.timestamp * 1000).toISOString().split('T')[0],
                tvl: parseFloat(d.totalValueLockedUSD),
                borrows: parseFloat(d.totalBorrowBalanceUSD),
            })).reverse(), // Reverse to show oldest to newest
            lastUpdated: new Date().toISOString(),
        };

        // Update cache
        cache.data = responseData;
        cache.lastFetched = now;

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching overview data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch overview data' },
            { status: 500 }
        );
    }
}
