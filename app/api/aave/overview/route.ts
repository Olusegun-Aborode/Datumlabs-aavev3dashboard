// app/api/aave/overview/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_PROTOCOL_DATA } from '@/lib/aave/queries';

const cache = new Map<string, { data: any; lastFetched: number }>();

function transformProtocolData(data: any) {
    const protocol = data?.lendingProtocols?.[0];
    if (!protocol) return null;

    const snapshots = data.financialsDailySnapshots || [];
    const snapshot30d = snapshots[30] || snapshots[snapshots.length - 1];

    const tvlChange = snapshot30d
        ? (parseFloat(protocol.totalValueLockedUSD) - parseFloat(snapshot30d.totalValueLockedUSD)) / parseFloat(snapshot30d.totalValueLockedUSD)
        : 0;

    const borrowChange = snapshot30d
        ? (parseFloat(protocol.totalBorrowBalanceUSD) - parseFloat(snapshot30d.totalBorrowBalanceUSD)) / parseFloat(snapshot30d.totalBorrowBalanceUSD)
        : 0;

    // Compute revenue from daily snapshots (cumulative field is unreliable on some chains)
    const supplyRevenue90d = snapshots.reduce(
        (sum: number, s: any) => sum + parseFloat(s.dailySupplySideRevenueUSD || '0'), 0
    );
    const protocolRevenue90d = snapshots.reduce(
        (sum: number, s: any) => sum + parseFloat(s.dailyProtocolSideRevenueUSD || '0'), 0
    );

    // Use cumulative supply revenue if reasonable, otherwise fall back to 90d sum
    const cumulativeSupply = parseFloat(protocol.cumulativeSupplySideRevenueUSD);
    const supplyRevenueUSD = cumulativeSupply < 1e12 ? cumulativeSupply : supplyRevenue90d;
    const cumulativeProtocol = parseFloat(protocol.cumulativeProtocolSideRevenueUSD);
    const protocolRevenueRaw = cumulativeProtocol < 1e12 ? cumulativeProtocol : protocolRevenue90d;
    // Double sanity check: if even the 90d fallback is unreasonable, zero it out
    const protocolRevenueUSD = protocolRevenueRaw < 1e12 ? protocolRevenueRaw : 0;

    return {
        totalValueLockedUSD: parseFloat(protocol.totalValueLockedUSD),
        totalBorrowBalanceUSD: parseFloat(protocol.totalBorrowBalanceUSD),
        tvl: parseFloat(protocol.totalValueLockedUSD) - parseFloat(protocol.totalBorrowBalanceUSD),
        totalMarkets: protocol.totalPoolCount,
        tvlChange,
        borrowChange,
        protocolRevenueUSD,
        supplyRevenueUSD,
        historicalData: snapshots.map((d: any) => ({
            date: new Date(d.timestamp * 1000).toISOString().split('T')[0],
            tvl: parseFloat(d.totalValueLockedUSD),
            borrows: parseFloat(d.totalBorrowBalanceUSD),
        })).reverse(),
        lastUpdated: new Date().toISOString(),
    };
}

function mergeOverviewData(results: any[]) {
    const dateMap = new Map<string, { tvl: number; borrows: number }>();

    for (const result of results) {
        for (const d of result.historicalData) {
            const existing = dateMap.get(d.date);
            if (existing) {
                existing.tvl += d.tvl;
                existing.borrows += d.borrows;
            } else {
                dateMap.set(d.date, { tvl: d.tvl, borrows: d.borrows });
            }
        }
    }

    const historicalData = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, ...vals }));

    return {
        totalValueLockedUSD: results.reduce((sum, r) => sum + r.totalValueLockedUSD, 0),
        totalBorrowBalanceUSD: results.reduce((sum, r) => sum + r.totalBorrowBalanceUSD, 0),
        tvl: results.reduce((sum, r) => sum + r.tvl, 0),
        totalMarkets: results.reduce((sum, r) => sum + r.totalMarkets, 0),
        tvlChange: results[0]?.tvlChange || 0,
        borrowChange: results[0]?.borrowChange || 0,
        protocolRevenueUSD: results.reduce((sum, r) => sum + r.protocolRevenueUSD, 0),
        supplyRevenueUSD: results.reduce((sum, r) => sum + r.supplyRevenueUSD, 0),
        historicalData,
        lastUpdated: new Date().toISOString(),
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'all';

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_OVERVIEW || '300', 10) * 1000;
    const cacheKey = `overview-${chain}`;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const queryOpts = { query: GET_PROTOCOL_DATA, fetchPolicy: 'network-only' as const };

        let responseData: any;

        if (chain !== 'all' && chain in CHAINS) {
            const client = getSubgraphClient(chain as ChainId);
            const { data } = await client.query(queryOpts);
            responseData = transformProtocolData(data);
            if (!responseData) throw new Error(`No protocol data for chain: ${chain}`);
        } else {
            // Fetch all chains in parallel, gracefully handle failures
            const results = await Promise.allSettled(
                CHAIN_IDS.map((chainId) =>
                    getSubgraphClient(chainId).query(queryOpts)
                )
            );

            const transformed = results
                .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
                .map((r) => transformProtocolData(r.value.data))
                .filter((r): r is NonNullable<typeof r> => r !== null);

            if (transformed.length === 0) {
                throw new Error('All chain queries failed');
            }

            responseData = transformed.length === 1 ? transformed[0] : mergeOverviewData(transformed);
        }

        cache.set(cacheKey, { data: responseData, lastFetched: now });
        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching overview data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch overview data' },
            { status: 500 }
        );
    }
}
