// app/api/aave/markets/route.ts
import { NextResponse } from 'next/server';
import { subgraphClient } from '@/lib/aave/graphql-client';
import { GET_MARKETS } from '@/lib/aave/queries';

const cache = {
    data: null as any,
    lastFetched: 0,
};

export async function GET() {
    const now = Date.now();
    // Reduced cache TTL to 30 seconds for more reliable data fetching
    const cacheTTL = parseInt(process.env.CACHE_TTL_MARKETS || '30', 10) * 1000;

    // Return cached data if still fresh
    if (cache.data && now - cache.lastFetched < cacheTTL) {
        return NextResponse.json(cache.data);
    }

    try {
        const { data } = await subgraphClient.query<any>({
            query: GET_MARKETS,
            fetchPolicy: 'network-only',
        });

        // Transform market data
        const markets = data.markets.map((market: any) => {
            // Find supply and borrow rates
            const supplyRate = market.rates.find((r: any) => r.side === 'LENDER' && r.type === 'VARIABLE');
            const borrowRate = market.rates.find((r: any) => r.side === 'BORROWER' && r.type === 'VARIABLE');

            const tvl = parseFloat(market.totalValueLockedUSD);
            const borrows = parseFloat(market.totalBorrowBalanceUSD);
            const deposits = parseFloat(market.totalDepositBalanceUSD);
            const utilization = tvl > 0 ? borrows / tvl : 0;

            return {
                id: market.id,
                name: market.inputToken.name,
                inputToken: {
                    symbol: market.inputToken.symbol,
                    name: market.inputToken.name,
                },
                totalValueLockedUSD: tvl,
                totalBorrowBalanceUSD: borrows,
                totalDepositBalanceUSD: deposits,
                inputTokenPriceUSD: parseFloat(market.inputTokenPriceUSD),
                rates: [
                    {
                        side: 'LENDER',
                        rate: supplyRate ? parseFloat(supplyRate.rate) / 1e25 : 0,
                    },
                    {
                        side: 'BORROWER',
                        rate: borrowRate ? parseFloat(borrowRate.rate) / 1e25 : 0,
                    }
                ],
                utilization: utilization * 100, // Convert to percentage
            };
        });

        const response = { markets };
        cache.data = response;
        cache.lastFetched = now;

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching markets data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch markets data', markets: [] },
            { status: 500 }
        );
    }
}
