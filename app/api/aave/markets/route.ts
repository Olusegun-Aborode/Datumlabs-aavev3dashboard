// app/api/aave/markets/route.ts
// Routes markets queries to AaveKit v3 or v4 endpoints based on ?version= param.
import { NextResponse } from 'next/server';
import {
  AAVEKIT_URLS,
  V4_CHAIN_IDS,
  parseVersion,
  versionsToQuery,
  type AaveVersion,
} from '@/lib/aave/version';

// All supported chains with their AaveKit chain IDs
const AAVEKIT_CHAINS: Record<string, { chainId: number; name: string; shortName: string }> = {
    ethereum: { chainId: 1, name: 'Ethereum', shortName: 'ETH' },
    arbitrum: { chainId: 42161, name: 'Arbitrum', shortName: 'ARB' },
    avalanche: { chainId: 43114, name: 'Avalanche', shortName: 'AVAX' },
    base: { chainId: 8453, name: 'Base', shortName: 'BASE' },
    optimism: { chainId: 10, name: 'Optimism', shortName: 'OP' },
    polygon: { chainId: 137, name: 'Polygon', shortName: 'POLY' },
    bnb: { chainId: 56, name: 'BNB Chain', shortName: 'BNB' },
    gnosis: { chainId: 100, name: 'Gnosis', shortName: 'GNOSIS' },
    linea: { chainId: 59144, name: 'Linea', shortName: 'LINEA' },
    plasma: { chainId: 9745, name: 'Plasma', shortName: 'PLASMA' },
    mantle: { chainId: 5000, name: 'Mantle', shortName: 'MANTLE' },
    scroll: { chainId: 534352, name: 'Scroll', shortName: 'SCROLL' },
    sonic: { chainId: 146, name: 'Sonic', shortName: 'SONIC' },
    celo: { chainId: 42220, name: 'Celo', shortName: 'CELO' },
    zksync: { chainId: 324, name: 'zkSync', shortName: 'ZKSYNC' },
    ink: { chainId: 57073, name: 'Ink', shortName: 'INK' },
    metis: { chainId: 1088, name: 'Metis', shortName: 'METIS' },
    soneium: { chainId: 1868, name: 'Soneium', shortName: 'SONEIUM' },
    megaeth: { chainId: 4326, name: 'MegaETH', shortName: 'MEGAETH' },
    xlayer: { chainId: 196, name: 'X Layer', shortName: 'XLAYER' },
};

// v3 schema: /markets endpoint returns an array of Markets, each containing reserves.
const MARKETS_QUERY_V3 = `
  query GetMarkets($chainIds: [ChainId!]!) {
    markets(request: { chainIds: $chainIds }) {
      name
      chain { name chainId }
      totalMarketSize
      reserves {
        underlyingToken { symbol name decimals }
        size { usdPerToken amount { value } usd }
        supplyInfo {
          apy { value }
          total { value }
          liquidationThreshold { value }
        }
        borrowInfo {
          apy { value }
          total { amount { value } usd }
          utilizationRate { value }
        }
      }
    }
  }
`;

// v4 uses hub-and-spoke architecture: reserves are queried directly with a
// different request shape, and amounts come nested under summary.supplied/borrowed
// with Erc20Amount.exchange.value as the USD figure.
const MARKETS_QUERY_V4 = `
  query GetV4Reserves($chainIds: [Int!]!) {
    reserves(request: {
      query: { chainIds: $chainIds },
      filter: ALL,
      orderBy: { supplyAvailable: DESC }
    }) {
      id
      chain { name chainId }
      asset {
        underlying {
          info { name symbol decimals }
        }
      }
      summary {
        supplied { amount { value } exchange { value } }
        borrowed { amount { value } exchange { value } }
        supplyApy { value }
        borrowApy { value }
      }
    }
  }
`;

// Reverse lookup: chainId -> our chain key
const CHAIN_ID_TO_KEY: Record<number, string> = {};
for (const [key, config] of Object.entries(AAVEKIT_CHAINS)) {
    CHAIN_ID_TO_KEY[config.chainId] = key;
}

const cache = new Map<string, { data: any; lastFetched: number }>();

function transformV3Markets(marketsData: any[]) {
    const allMarkets: any[] = [];

    for (const market of marketsData) {
        const chainKey = CHAIN_ID_TO_KEY[market.chain.chainId] || market.chain.name.toLowerCase();

        for (let i = 0; i < market.reserves.length; i++) {
            const reserve = market.reserves[i];
            const priceUSD = parseFloat(reserve.size?.usdPerToken) || 0;
            const tvl = parseFloat(reserve.size?.usd) || 0;
            const borrows = parseFloat(reserve.borrowInfo?.total?.usd) || 0;
            const supplyRate = parseFloat(reserve.supplyInfo?.apy?.value) || 0;
            const borrowRate = parseFloat(reserve.borrowInfo?.apy?.value) || 0;
            const utilization = parseFloat(reserve.borrowInfo?.utilizationRate?.value) || 0;

            allMarkets.push({
                id: `v3-${chainKey}-${market.name}-${i}`,
                name: reserve.underlyingToken.name,
                chain: chainKey,
                market: market.name,
                version: 'v3',
                inputToken: {
                    symbol: reserve.underlyingToken.symbol,
                    name: reserve.underlyingToken.name,
                },
                totalValueLockedUSD: tvl,
                totalBorrowBalanceUSD: borrows,
                totalDepositBalanceUSD: tvl,
                inputTokenPriceUSD: priceUSD,
                rates: [
                    { side: 'LENDER', rate: supplyRate },
                    { side: 'BORROWER', rate: borrowRate },
                ],
                utilization: utilization * 100,
            });
        }
    }

    return allMarkets;
}

// v4 returns a flat list of reserves (no enclosing "markets"). Each reserve is
// one hub-asset position. Utilization is derived from supplied/borrowed since
// the v4 schema doesn't expose it as a dedicated field.
function transformV4Reserves(reservesData: any[]) {
    return reservesData.map((r: any, i: number) => {
        const chainKey = CHAIN_ID_TO_KEY[r.chain.chainId] || r.chain.name.toLowerCase();
        const info = r.asset?.underlying?.info || {};
        const suppliedTokens = parseFloat(r.summary?.supplied?.amount?.value) || 0;
        const suppliedUSD = parseFloat(r.summary?.supplied?.exchange?.value) || 0;
        const borrowedUSD = parseFloat(r.summary?.borrowed?.exchange?.value) || 0;
        const supplyRate = parseFloat(r.summary?.supplyApy?.value) || 0;
        const borrowRate = parseFloat(r.summary?.borrowApy?.value) || 0;
        const utilization = suppliedUSD > 0 ? (borrowedUSD / suppliedUSD) : 0;
        const priceUSD = suppliedTokens > 0 ? suppliedUSD / suppliedTokens : 0;

        return {
            id: `v4-${chainKey}-${r.id}-${i}`,
            name: info.name || info.symbol || 'Unknown',
            chain: chainKey,
            market: `Aave V4 ${r.chain.name}`,
            version: 'v4',
            inputToken: {
                symbol: info.symbol || '',
                name: info.name || '',
            },
            totalValueLockedUSD: suppliedUSD,
            totalBorrowBalanceUSD: borrowedUSD,
            totalDepositBalanceUSD: suppliedUSD,
            inputTokenPriceUSD: priceUSD,
            rates: [
                { side: 'LENDER', rate: supplyRate },
                { side: 'BORROWER', rate: borrowRate },
            ],
            utilization: utilization * 100,
        };
    });
}

async function fetchMarketsForVersion(
    version: Exclude<AaveVersion, 'all'>,
    chain: string,
): Promise<any[]> {
    // v4 is currently Ethereum-only. Filter any requested chainIds against the
    // version's supported set so we don't send unsupported IDs upstream.
    const allowedChainIds = version === 'v4' ? new Set(V4_CHAIN_IDS) : null;

    let chainIds: number[];
    if (chain !== 'all' && chain in AAVEKIT_CHAINS) {
        const id = AAVEKIT_CHAINS[chain].chainId;
        if (allowedChainIds && !allowedChainIds.has(id)) return [];
        chainIds = [id];
    } else {
        chainIds = Object.values(AAVEKIT_CHAINS)
            .map(c => c.chainId)
            .filter(id => !allowedChainIds || allowedChainIds.has(id));
    }

    if (chainIds.length === 0) return [];

    const query = version === 'v4' ? MARKETS_QUERY_V4 : MARKETS_QUERY_V3;
    const res = await fetch(AAVEKIT_URLS[version], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { chainIds } }),
    });

    if (!res.ok) throw new Error(`AaveKit ${version} API error: ${res.status}`);
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors[0]?.message || `AaveKit ${version} query error`);

    return version === 'v4'
        ? transformV4Reserves(data.reserves || [])
        : transformV3Markets(data.markets || []);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'all';
    const version = parseVersion(searchParams.get('version'));

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_MARKETS || '30', 10) * 1000;
    const cacheKey = `markets-${version}-${chain}`;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const targets = versionsToQuery(version);
        const results = await Promise.allSettled(
            targets.map(v => fetchMarketsForVersion(v, chain))
        );

        let allMarkets: any[] = [];
        const warnings: string[] = [];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') allMarkets.push(...r.value);
            else warnings.push(`${targets[i]}: ${r.reason?.message || 'fetch failed'}`);
        });

        allMarkets.sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD);

        const response = { markets: allMarkets, version, warnings };
        cache.set(cacheKey, { data: response, lastFetched: now });
        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching markets data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch markets data', markets: [] },
            { status: 500 }
        );
    }
}
