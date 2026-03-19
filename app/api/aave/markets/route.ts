// app/api/aave/markets/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_MARKETS } from '@/lib/aave/queries';

const cache = new Map<string, { data: any; lastFetched: number }>();

function transformMarkets(data: any, chain: string) {
    return data.markets.map((market: any) => {
        const supplyRate = market.rates.find((r: any) => r.side === 'LENDER');
        const borrowRate = market.rates.find((r: any) => r.side === 'BORROWER' && r.type === 'VARIABLE');

        const tvl = parseFloat(market.totalValueLockedUSD);
        const borrows = parseFloat(market.totalBorrowBalanceUSD);
        const deposits = parseFloat(market.totalDepositBalanceUSD);
        const utilization = tvl > 0 ? borrows / tvl : 0;

        return {
            id: `${chain}-${market.id}`,
            name: market.inputToken.name,
            chain,
            inputToken: {
                symbol: market.inputToken.symbol,
                name: market.inputToken.name,
            },
            totalValueLockedUSD: tvl,
            totalBorrowBalanceUSD: borrows,
            totalDepositBalanceUSD: deposits,
            inputTokenPriceUSD: parseFloat(market.inputTokenPriceUSD),
            rates: [
                { side: 'LENDER', rate: supplyRate ? parseFloat(supplyRate.rate) : 0 },
                { side: 'BORROWER', rate: borrowRate ? parseFloat(borrowRate.rate) : 0 },
            ],
            utilization: utilization * 100,
        };
    });
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
        const queryOpts = { query: GET_MARKETS, fetchPolicy: 'network-only' as const };
        let allMarkets: any[] = [];

        if (chain !== 'all' && chain in CHAINS) {
            const client = getSubgraphClient(chain as ChainId);
            const { data } = await client.query(queryOpts);
            allMarkets = transformMarkets(data, chain);
        } else {
            const results = await Promise.allSettled(
                CHAIN_IDS.map((chainId) =>
                    getSubgraphClient(chainId).query(queryOpts).then((res: any) => ({
                        data: res.data,
                        chainId,
                    }))
                )
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allMarkets.push(...transformMarkets(result.value.data, result.value.chainId));
                }
            }
        }

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
