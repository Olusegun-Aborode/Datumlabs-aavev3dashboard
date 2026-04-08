// app/api/aave/liquidations/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_LIQUIDATIONS, GET_AAVE_LIQUIDATIONS } from '@/lib/aave/queries';
import { parseVersion } from '@/lib/aave/version';
import { AAVEKIT_URLS, V4_CHAIN_IDS } from '@/lib/aave/version';

// AaveKit v4 exposes liquidations through the generic activities(types: [LIQUIDATED])
// query. It's cursor-paginated and returns 10 or 50 items per page.
const V4_LIQUIDATIONS_QUERY = `
  query V4Liquidations($chainIds: [Int!]!, $pageSize: PageSize!, $cursor: Cursor) {
    activities(request: {
      query: { chainIds: $chainIds }
      types: [LIQUIDATED]
      pageSize: $pageSize
      cursor: $cursor
    }) {
      items {
        __typename
        ... on LiquidatedActivity {
          id
          user
          liquidator
          timestamp
          txHash
          chain { chainId name }
          collateralReserve {
            asset {
              underlying { info { symbol name decimals } }
            }
          }
          collateral { amount { value } exchange { value } }
          debt { amount { value } exchange { value } }
        }
      }
      pageInfo { next }
    }
  }
`;

async function fetchV4Liquidations(pageSize: number) {
    // AaveKit PageSize only supports TEN or FIFTY — round up whatever the caller asked for.
    const pageSizeEnum = pageSize <= 10 ? 'TEN' : 'FIFTY';

    const res = await fetch(AAVEKIT_URLS.v4, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: V4_LIQUIDATIONS_QUERY,
            variables: { chainIds: V4_CHAIN_IDS, pageSize: pageSizeEnum },
        }),
    });

    if (!res.ok) throw new Error(`AaveKit v4 liquidations error: ${res.status}`);
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors[0]?.message || 'v4 liquidations query error');

    const items = data?.activities?.items || [];
    return items.map((liq: any) => {
        const info = liq.collateralReserve?.asset?.underlying?.info || {};
        const collateralTokenAmt = parseFloat(liq.collateral?.amount?.value || '0');
        const amountUSD = parseFloat(liq.collateral?.exchange?.value || '0');
        const chainKey = (liq.chain?.name || 'ethereum').toLowerCase();
        const tsSeconds = Math.floor(new Date(liq.timestamp).getTime() / 1000);

        return {
            id: `v4-${chainKey}-${liq.id}`,
            hash: liq.txHash,
            timestamp: tsSeconds,
            date: liq.timestamp,
            chain: chainKey,
            version: 'v4',
            amount: collateralTokenAmt,
            amountUSD,
            profitUSD: 0,
            liquidator: liq.liquidator,
            liquidatee: liq.user,
            asset: {
                id: info.symbol || '',
                symbol: info.symbol || '',
                name: info.name || '',
            },
            market: `Aave V4 ${liq.chain?.name || ''}`.trim(),
        };
    });
}

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
    const version = parseVersion(searchParams.get('version'));

    const skip = (page - 1) * pageSize;
    const cacheKey = `liquidations-${version}-${chain}-${page}-${pageSize}`;

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_LIQUIDATIONS || '300', 10) * 1000;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        let allLiquidations: any[] = [];

        // v4: fetch from AaveKit activities(LIQUIDATED). v3: use subgraphs.
        // 'all': union both.
        const wantsV3 = version === 'v3' || version === 'all';
        const wantsV4 = version === 'v4' || version === 'all';

        if (wantsV3) {
            if (chain !== 'all' && chain in CHAINS) {
                allLiquidations = allLiquidations.concat(
                    await fetchChainLiquidations(chain as ChainId, pageSize, skip)
                );
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
        }

        if (wantsV4) {
            try {
                const v4Liqs = await fetchV4Liquidations(pageSize);
                // v4 is Ethereum-only today; if user filtered to a non-Ethereum chain
                // under the 'all' view, skip v4 results.
                if (chain === 'all' || chain === 'ethereum') {
                    allLiquidations.push(...v4Liqs);
                }
            } catch (e) {
                console.error('v4 liquidations fetch failed:', e);
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
            ...(version === 'v4' && allLiquidations.length === 0 ? {
                notice: 'No Aave v4 liquidations yet. The protocol launched recently and no positions have been liquidated so far.',
            } : {}),
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
