// app/api/aave/liquidations/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_LIQUIDATIONS, GET_AAVE_LIQUIDATIONS } from '@/lib/aave/queries';

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

function transformAaveLiquidations(data: any, chain: string) {
    return data.liquidationCalls.map((liq: any) => {
        const decimals = parseInt(liq.collateralReserve?.decimals || '18');
        const collateralAmount = parseFloat(liq.collateralAmount) / Math.pow(10, decimals);
        const collateralPriceUSD = parseFloat(liq.collateralAssetPriceUSD || '0');
        const amountUSD = collateralPriceUSD > 0
            ? collateralAmount * collateralPriceUSD
            : (collateralAmount * (parseInt(liq.collateralReserve?.price?.priceInEth || '0') / 1e8));

        return {
            id: `${chain}-${liq.id}`,
            hash: liq.txHash,
            timestamp: parseInt(liq.timestamp),
            date: new Date(parseInt(liq.timestamp) * 1000).toISOString(),
            chain,
            amount: collateralAmount,
            amountUSD,
            profitUSD: 0,
            liquidator: liq.liquidator,
            liquidatee: liq.user?.id || '',
            asset: {
                id: liq.collateralReserve?.symbol || '',
                symbol: liq.collateralReserve?.symbol || '',
                name: liq.collateralReserve?.name || '',
            },
            market: liq.collateralReserve?.name || '',
        };
    });
}

async function fetchChainLiquidations(chainId: ChainId, pageSize: number, skip: number) {
    const config = CHAINS[chainId];
    const client = getSubgraphClient(chainId);
    const isAave = config.subgraphType === 'aave';
    const query = isAave ? GET_AAVE_LIQUIDATIONS : GET_LIQUIDATIONS;

    const { data } = await client.query({
        query,
        variables: { first: pageSize, skip },
        fetchPolicy: 'network-only' as const,
    }) as { data: any };

    return isAave ? transformAaveLiquidations(data, chainId) : transformLiquidations(data, chainId);
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
        let allLiquidations: any[] = [];

        if (chain !== 'all' && chain in CHAINS) {
            allLiquidations = await fetchChainLiquidations(chain as ChainId, pageSize, skip);
        } else {
            const results = await Promise.allSettled(
                CHAIN_IDS.map((chainId) => fetchChainLiquidations(chainId, pageSize, skip))
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allLiquidations.push(...result.value);
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
