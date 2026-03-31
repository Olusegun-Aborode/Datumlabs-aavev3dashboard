// app/api/aave/overview/route.ts
import { NextResponse } from 'next/server';
import { fetchProtocolData, fetchRevenueData, buildHistoricalData } from '@/lib/aave/defillama';

const AAVEKIT_URL = 'https://api.v3.aave.com/graphql';

// All AaveKit chain IDs
const ALL_CHAIN_IDS = [1, 42161, 43114, 8453, 56, 42220, 100, 59144, 1088, 10, 137, 534352, 1868, 146, 324, 9745, 57073, 5000, 4326, 196];

// Map our chain keys to AaveKit chain IDs
const CHAIN_KEY_TO_ID: Record<string, number> = {
    ethereum: 1, arbitrum: 42161, avalanche: 43114, base: 8453,
    bnb: 56, celo: 42220, gnosis: 100, linea: 59144,
    metis: 1088, optimism: 10, polygon: 137, scroll: 534352,
    soneium: 1868, sonic: 146, zksync: 324, plasma: 9745,
    ink: 57073, mantle: 5000, megaeth: 4326, xlayer: 196,
};

const METRICS_QUERY = `
  query GetMetrics($chainIds: [ChainId!]!) {
    markets(request: { chainIds: $chainIds }) {
      name
      totalMarketSize
      totalAvailableLiquidity
      reserves {
        borrowInfo {
          total { usd }
        }
      }
    }
  }
`;

const cache = new Map<string, { data: any; lastFetched: number }>();

/**
 * Fetch key metrics from AaveKit API (accurate real-time data).
 */
async function fetchAaveKitMetrics(chain: string) {
    const chainIds = chain !== 'all' && chain in CHAIN_KEY_TO_ID
        ? [CHAIN_KEY_TO_ID[chain]]
        : ALL_CHAIN_IDS;

    const res = await fetch(AAVEKIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: METRICS_QUERY, variables: { chainIds } }),
    });

    if (!res.ok) throw new Error(`AaveKit API error: ${res.status}`);
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors[0]?.message || 'AaveKit query error');

    let totalMarketSize = 0;
    let totalAvailable = 0;
    let totalBorrows = 0;
    let totalReserves = 0;

    for (const market of data.markets) {
        totalMarketSize += parseFloat(market.totalMarketSize || '0');
        totalAvailable += parseFloat(market.totalAvailableLiquidity || '0');
        for (const r of market.reserves) {
            if (r.borrowInfo?.total?.usd) {
                totalBorrows += parseFloat(r.borrowInfo.total.usd);
            }
        }
        totalReserves += market.reserves.length;
    }

    return { totalMarketSize, totalAvailable, totalBorrows, totalReserves };
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
        // Fetch AaveKit metrics, DeFi Llama historical data, and revenue in parallel
        const [metrics, protocolData, revenueData] = await Promise.all([
            fetchAaveKitMetrics(chain),
            fetchProtocolData(),
            fetchRevenueData(),
        ]);

        const { historicalData } = buildHistoricalData(protocolData, chain);

        const responseData = {
            totalMarketSize: metrics.totalMarketSize,
            totalAvailable: metrics.totalAvailable,
            totalBorrows: metrics.totalBorrows,
            totalReserves: metrics.totalReserves,
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
