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

// v4 historical TVL + borrow series, straight from AaveKit (no DeFi Llama).
// protocolHistory doesn't accept a chain filter — it's already protocol-wide,
// which for v4 means Ethereum only at launch. Currency fixed to USD; window
// of LAST_YEAR gives enough data to cover the dashboard's 30/90/180 selectors.
const V4_HISTORY_QUERY = `
  query V4History($window: TimeWindow!) {
    protocolHistory(request: { currency: USD, window: $window }) {
      date
      deposits { value }
      borrows { value }
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

type HistoryEntry = { date: string; tvl: number; borrows: number };

/**
 * Fetch v4 TVL + borrow history from AaveKit's protocolHistory query.
 * Returns entries in the same shape as DeFi Llama's buildHistoricalData output
 * so downstream merging and chart rendering doesn't care about the source.
 */
async function fetchV4History(): Promise<HistoryEntry[]> {
    const res = await fetch(AAVEKIT_URLS.v4, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: V4_HISTORY_QUERY,
            variables: { window: 'LAST_YEAR' },
        }),
    });
    if (!res.ok) throw new Error(`AaveKit v4 protocolHistory error: ${res.status}`);
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors[0]?.message || 'v4 protocolHistory error');

    return (data?.protocolHistory || []).map((p: any) => ({
        date: new Date(p.date).toISOString().split('T')[0],
        tvl: parseFloat(p.deposits?.value || '0'),
        borrows: parseFloat(p.borrows?.value || '0'),
    }));
}

/**
 * Sum two historical series by date. Used for the 'all' view where we need to
 * combine v3 (DeFi Llama) and v4 (AaveKit protocolHistory) into a single chart.
 */
function mergeHistoriesByDate(a: HistoryEntry[], b: HistoryEntry[]): HistoryEntry[] {
    const map = new Map<string, { tvl: number; borrows: number }>();
    for (const e of a) map.set(e.date, { tvl: e.tvl, borrows: e.borrows });
    for (const e of b) {
        const existing = map.get(e.date);
        if (existing) {
            existing.tvl += e.tvl;
            existing.borrows += e.borrows;
        } else {
            map.set(e.date, { tvl: e.tvl, borrows: e.borrows });
        }
    }
    return Array.from(map.entries())
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([date, v]) => ({ date, ...v }));
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

        // Metrics: per-version parallel fetch, summed across requested versions.
        // Historical data:
        //   - v3 uses DeFi Llama (/protocol/aave-v3) since AaveKit v3 has no
        //     equivalent time-series endpoint.
        //   - v4 uses AaveKit's protocolHistory directly — first-party data and
        //     actually covers v4's full history, unlike DeFi Llama which only
        //     started indexing aave-v4 recently.
        //   - all: fetch both in parallel, merge by date.
        // Revenue: DeFi Llama fees endpoint aggregates across all Aave versions.
        //   For v3/all that aggregate is fair. For v4-only we return zeros and
        //   flag revenueAvailable=false so the UI shows a notice.
        const metricsPromises = targets.map(v => fetchAaveKitMetrics(v, chain));
        const shouldFetchRevenue = version !== 'v4';
        const wantsV3History = version === 'v3' || version === 'all';
        const wantsV4History = version === 'v4' || version === 'all';

        const [metricsResults, v3ProtocolData, v4History, revenueData] = await Promise.all([
            Promise.allSettled(metricsPromises),
            wantsV3History ? fetchProtocolData('v3') : Promise.resolve(null),
            wantsV4History ? fetchV4History().catch(() => []) : Promise.resolve([]),
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

        let historicalData: HistoryEntry[] = [];
        if (version === 'v4') {
            historicalData = v4History;
        } else if (version === 'v3') {
            historicalData = buildHistoricalData(v3ProtocolData, chain).historicalData;
        } else {
            // all: merge v3 (DeFi Llama) with v4 (AaveKit) by date
            const v3Hist = buildHistoricalData(v3ProtocolData, chain).historicalData;
            historicalData = mergeHistoriesByDate(v3Hist, v4History);
        }

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
