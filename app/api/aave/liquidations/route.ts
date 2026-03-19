// app/api/aave/liquidations/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_LIQUIDATIONS } from '@/lib/aave/queries';

const cache = new Map<string, { data: any; lastFetched: number }>();

function transformLiquidations(data: any, chain: string) {
    return data.liquidates.map((liquidation: any) => ({
        id: `${chain}-${liquidation.id}`,
        hash: liquidation.hash,
        timestamp: liquidation.timestamp,
        date: new Date(liquidation.timestamp * 1000).toISOString(),
        chain,
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
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const chain = searchParams.get('chain') || 'all';

    const skip = (page - 1) * pageSize;
    const cacheKey = `liquidations-${chain}-${page}-${pageSize}`;

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_LIQUIDATIONS || '300', 10) * 1000;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const queryOpts = {
            query: GET_LIQUIDATIONS,
            variables: { first: pageSize, skip },
            fetchPolicy: 'network-only' as const,
        };

        let allLiquidations: any[] = [];

        if (chain !== 'all' && chain in CHAINS) {
            const client = getSubgraphClient(chain as ChainId);
            const { data } = await client.query(queryOpts);
            allLiquidations = transformLiquidations(data, chain);
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
                    allLiquidations.push(...transformLiquidations(result.value.data, result.value.chainId));
                }
            }
        }

        // Sort by timestamp descending
        allLiquidations.sort((a, b) => b.timestamp - a.timestamp);

        // Calculate aggregations
        const byAsset = allLiquidations.reduce((acc: any, liq: any) => {
            const symbol = liq.asset.symbol;
            if (!acc[symbol]) {
                acc[symbol] = { symbol, totalUSD: 0, count: 0 };
            }
            acc[symbol].totalUSD += liq.amountUSD;
            acc[symbol].count += 1;
            return acc;
        }, {});

        const responseData = {
            liquidations: allLiquidations,
            aggregations: {
                byAsset: Object.values(byAsset),
                totalLiquidatedUSD: allLiquidations.reduce((sum: number, liq: any) => sum + liq.amountUSD, 0),
                totalCount: allLiquidations.length,
            },
            page,
            pageSize,
            hasMore: allLiquidations.length >= pageSize,
        };

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
