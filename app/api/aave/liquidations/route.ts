// app/api/aave/liquidations/route.ts
import { NextResponse } from 'next/server';
import { subgraphClient } from '@/lib/aave/graphql-client';
import { GET_LIQUIDATIONS } from '@/lib/aave/queries';

const cache = new Map<string, { data: any; lastFetched: number }>();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const skip = (page - 1) * pageSize;
    const cacheKey = `${page}-${pageSize}`;

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_LIQUIDATIONS || '300', 10) * 1000;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const { data } = await subgraphClient.query<any>({
            query: GET_LIQUIDATIONS,
            variables: {
                first: pageSize,
                skip,
            },
            fetchPolicy: 'network-only',
        });

        // Transform liquidation data
        const liquidations = data.liquidates.map((liquidation: any) => ({
            id: liquidation.id,
            hash: liquidation.hash,
            timestamp: liquidation.timestamp,
            date: new Date(liquidation.timestamp * 1000).toISOString(),
            amount: parseFloat(liquidation.amount),
            amountUSD: parseFloat(liquidation.amountUSD),
            profitUSD: parseFloat(liquidation.profitUSD),
            liquidator: liquidation.liquidator.id,
            liquidatee: liquidation.liquidatee.id,
            asset: {
                id: liquidation.asset.id,
                symbol: liquidation.asset.symbol,
                name: liquidation.asset.name,
            },
            market: liquidation.market.name,
        }));

        // Calculate aggregations for charts
        const byAsset = liquidations.reduce((acc: any, liq: any) => {
            const symbol = liq.asset.symbol;
            if (!acc[symbol]) {
                acc[symbol] = {
                    symbol,
                    totalUSD: 0,
                    count: 0,
                };
            }
            acc[symbol].totalUSD += liq.amountUSD;
            acc[symbol].count += 1;
            return acc;
        }, {});

        const responseData = {
            liquidations,
            aggregations: {
                byAsset: Object.values(byAsset),
                totalLiquidatedUSD: liquidations.reduce((sum: number, liq: any) => sum + liq.amountUSD, 0),
                totalCount: liquidations.length,
            },
            page,
            pageSize,
            hasMore: liquidations.length === pageSize,
        };

        // Update cache
        cache.set(cacheKey, { data: responseData, lastFetched: now });

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching liquidations data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch liquidations data' },
            { status: 500 }
        );
    }
}
