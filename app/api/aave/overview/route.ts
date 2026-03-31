// app/api/aave/overview/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_POOL_COUNT, GET_AAVE_POOL_COUNT } from '@/lib/aave/queries';
import { fetchProtocolData, fetchRevenueData, buildHistoricalData } from '@/lib/aave/defillama';

const cache = new Map<string, { data: any; lastFetched: number }>();

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
        // Fetch DeFi Llama data and pool count in parallel
        const [protocolData, revenueData, totalMarkets] = await Promise.all([
            fetchProtocolData(),
            fetchRevenueData(),
            fetchTotalMarkets(chain),
        ]);

        const { historicalData, latestTvl, latestBorrows } = buildHistoricalData(protocolData, chain);

        // Compute 30-day change from historical data
        const latest = historicalData[historicalData.length - 1];
        const thirtyDaysAgo = historicalData[historicalData.length - 31] || historicalData[0];

        const tvlChange = thirtyDaysAgo
            ? (latest.tvl - thirtyDaysAgo.tvl) / thirtyDaysAgo.tvl
            : 0;
        const borrowChange = thirtyDaysAgo
            ? (latest.borrows - thirtyDaysAgo.borrows) / thirtyDaysAgo.borrows
            : 0;

        const responseData = {
            totalValueLockedUSD: latestTvl,
            totalBorrowBalanceUSD: latestBorrows,
            tvl: latestTvl - latestBorrows,
            totalMarkets,
            tvlChange,
            borrowChange,
            protocolRevenueUSD: revenueData.protocolRevenueUSD,
            supplyRevenueUSD: revenueData.supplyRevenueUSD,
            revenueHistory: revenueData.revenueHistory,
            historicalData,
            lastUpdated: new Date().toISOString(),
        };

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

/**
 * Fetch total market count from subgraphs.
 * This is lightweight and subgraphs are reliable for this field.
 */
async function fetchChainMarketCount(chainId: ChainId): Promise<number> {
    const config = CHAINS[chainId];
    const client = getSubgraphClient(chainId);
    const isAave = config.subgraphType === 'aave';
    const query = isAave ? GET_AAVE_POOL_COUNT : GET_POOL_COUNT;
    const { data } = await client.query({ query, fetchPolicy: 'network-only' as const }) as { data: any };

    if (isAave) {
        return data?.reserves?.length || 0;
    }
    return data?.lendingProtocols?.[0]?.totalPoolCount || 0;
}

async function fetchTotalMarkets(chain: string): Promise<number> {
    try {
        if (chain !== 'all' && chain in CHAINS) {
            return await fetchChainMarketCount(chain as ChainId);
        }

        const results = await Promise.allSettled(
            CHAIN_IDS.map((chainId) => fetchChainMarketCount(chainId))
        );

        return results
            .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
            .reduce((sum, r) => sum + r.value, 0);
    } catch {
        return 0;
    }
}
