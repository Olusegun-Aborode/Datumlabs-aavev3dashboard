// app/api/aave/markets/route.ts
// Uses AaveKit API (api.v3.aave.com) — single endpoint for all chains
import { NextResponse } from 'next/server';

const AAVEKIT_URL = 'https://api.v3.aave.com/graphql';

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

const MARKETS_QUERY = `
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

// Reverse lookup: chainId -> our chain key
const CHAIN_ID_TO_KEY: Record<number, string> = {};
for (const [key, config] of Object.entries(AAVEKIT_CHAINS)) {
    CHAIN_ID_TO_KEY[config.chainId] = key;
}

const cache = new Map<string, { data: any; lastFetched: number }>();

function transformAaveKitMarkets(marketsData: any[]) {
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
                id: `${chainKey}-${market.name}-${i}`,
                name: reserve.underlyingToken.name,
                chain: chainKey,
                market: market.name,
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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'all';

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_MARKETS || '30', 10) * 1000;
    const cacheKey = `markets-${chain}`;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        // Determine which chain IDs to query
        let chainIds: number[];
        if (chain !== 'all' && chain in AAVEKIT_CHAINS) {
            chainIds = [AAVEKIT_CHAINS[chain].chainId];
        } else {
            chainIds = Object.values(AAVEKIT_CHAINS).map(c => c.chainId);
        }

        const res = await fetch(AAVEKIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: MARKETS_QUERY, variables: { chainIds } }),
        });

        if (!res.ok) throw new Error(`AaveKit API error: ${res.status}`);
        const { data, errors } = await res.json();
        if (errors) throw new Error(errors[0]?.message || 'AaveKit query error');

        let allMarkets = transformAaveKitMarkets(data.markets);
        allMarkets.sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD);

        const response = { markets: allMarkets };
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
