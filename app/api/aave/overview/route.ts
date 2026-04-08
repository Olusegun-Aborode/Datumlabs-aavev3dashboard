// app/api/aave/overview/route.ts
import { NextResponse } from 'next/server';
import { fetchProtocolData, fetchRevenueData, buildHistoricalData } from '@/lib/aave/defillama';
import {
    AAVEKIT_URLS,
    V4_CHAIN_IDS,
    V3_CHAIN_IDS,
    parseVersion,
    versionsToQuery,
    type AaveVersion,
} from '@/lib/aave/version';

// Map our chain keys to AaveKit chain IDs
const CHAIN_KEY_TO_ID: Record<string, number> = {
    ethereum: 1, arbitrum: 42161, avalanche: 43114, base: 8453,
    bnb: 56, celo: 42220, gnosis: 100, linea: 59144,
    metis: 1088, optimism: 10, polygon: 137, scroll: 534352,
    soneium: 1868, sonic: 146, zksync: 324, plasma: 9745,
    ink: 57073, mantle: 5000, megaeth: 4326, xlayer: 196,
};

const METRICS_QUERY_V3 = `
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

// v4 equivalent: derive the same four metrics from reserves. Market size =
// sum of supplied USD; available = supplied − borrowed; borrows = sum of
// borrowed USD; reserves count = list length.
const METRICS_QUERY_V4 = `
  query GetV4Metrics($chainIds: [Int!]!) {
    reserves(request: {
      query: { chainIds: $chainIds },
      filter: ALL,
      orderBy: { supplyAvailable: DESC }
    }) {
      summary {
        supplied { exchange { value } }
        borrowed { exchange { value } }
      }
    }
  }
`;

const cache = new Map<string, { data: any; lastFetched: number }>();

type Metrics = {
    totalMarketSize: number;
    totalAvailable: number;
    totalBorrows: number;
    totalReserves: number;
};

/**
 * Fetch key metrics from a specific AaveKit version endpoint.
 */
async function fetchAaveKitMetrics(
    version: Exclude<AaveVersion, 'all'>,
    chain: string,
): Promise<Metrics> {
    const allowedChainIds = version === 'v4' ? new Set(V4_CHAIN_IDS) : null;

    let chainIds: number[];
    if (chain !== 'all' && chain in CHAIN_KEY_TO_ID) {
        const id = CHAIN_KEY_TO_ID[chain];
        if (allowedChainIds && !allowedChainIds.has(id)) {
            return { totalMarketSize: 0, totalAvailable: 0, totalBorrows: 0, totalReserves: 0 };
        }
        chainIds = [id];
    } else {
        chainIds = (allowedChainIds ? [...allowedChainIds] : V3_CHAIN_IDS);
    }

    if (chainIds.length === 0) {
        return { totalMarketSize: 0, totalAvailable: 0, totalBorrows: 0, totalReserves: 0 };
    }

    const query = version === 'v4' ? METRICS_QUERY_V4 : METRICS_QUERY_V3;
    const res = await fetch(AAVEKIT_URLS[version], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { chainIds } }),
    });

    if (!res.ok) throw new Error(`AaveKit ${version} API error: ${res.status}`);
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors[0]?.message || `AaveKit ${version} query error`);

    if (version === 'v4') {
        let totalMarketSize = 0;
        let totalBorrows = 0;
        let totalReserves = 0;
        for (const r of data.reserves || []) {
            totalMarketSize += parseFloat(r.summary?.supplied?.exchange?.value || '0');
            totalBorrows += parseFloat(r.summary?.borrowed?.exchange?.value || '0');
            totalReserves += 1;
        }
        return {
            totalMarketSize,
            totalAvailable: totalMarketSize - totalBorrows,
            totalBorrows,
            totalReserves,
        };
    }

    let totalMarketSize = 0;
    let totalAvailable = 0;
    let totalBorrows = 0;
    let totalReserves = 0;

    for (const market of data.markets || []) {
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

function sumMetrics(a: Metrics, b: Metrics): Metrics {
    return {
        totalMarketSize: a.totalMarketSize + b.totalMarketSize,
        totalAvailable: a.totalAvailable + b.totalAvailable,
        totalBorrows: a.totalBorrows + b.totalBorrows,
        totalReserves: a.totalReserves + b.totalReserves,
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'all';
    const version = parseVersion(searchParams.get('version'));

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_OVERVIEW || '300', 10) * 1000;
    const cacheKey = `overview-${version}-${chain}`;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const targets = versionsToQuery(version);

        // Metrics: per-version parallel fetch, summed if multiple versions requested.
        // Protocol history: DeFi Llama fetcher handles 'all' internally by merging slugs.
        // Revenue: DeFi Llama fees endpoint aggregates across all Aave versions.
        // For v3 or all, that aggregate is a fair representation (v3 has dominated
        // historically). For v4-only we can't split it out, so we return zeros and
        // surface a notice so the UI doesn't misleadingly attribute $1.79B of
        // historical v3 revenue to a protocol that launched weeks ago.
        const metricsPromises = targets.map(v => fetchAaveKitMetrics(v, chain));
        const shouldFetchRevenue = version !== 'v4';
        const [metricsResults, protocolData, revenueData] = await Promise.all([
            Promise.allSettled(metricsPromises),
            fetchProtocolData(version),
            shouldFetchRevenue
                ? fetchRevenueData()
                : Promise.resolve({ supplyRevenueUSD: 0, protocolRevenueUSD: 0, revenueHistory: [] }),
        ]);

        let metrics: Metrics = { totalMarketSize: 0, totalAvailable: 0, totalBorrows: 0, totalReserves: 0 };
        const warnings: string[] = [];
        metricsResults.forEach((r, i) => {
            if (r.status === 'fulfilled') metrics = sumMetrics(metrics, r.value);
            else warnings.push(`${targets[i]}: ${r.reason?.message || 'fetch failed'}`);
        });

        const { historicalData } = buildHistoricalData(protocolData, chain);

        const responseData = {
            totalMarketSize: metrics.totalMarketSize,
            totalAvailable: metrics.totalAvailable,
            totalBorrows: metrics.totalBorrows,
            totalReserves: metrics.totalReserves,
            protocolRevenueUSD: revenueData.protocolRevenueUSD,
            supplyRevenueUSD: revenueData.supplyRevenueUSD,
            revenueHistory: revenueData.revenueHistory,
            revenueAvailable: shouldFetchRevenue,
            historicalData,
            version,
            warnings,
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
