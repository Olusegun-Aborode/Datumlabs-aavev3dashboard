// app/api/aave/wallets/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_ACCOUNTS, GET_PROTOCOL_DATA } from '@/lib/aave/queries';
import { calculateHealthFactor } from '@/lib/aave/helpers';

const cache = new Map<string, { data: any; lastFetched: number }>();

function transformAccounts(accountsData: any, chain: string) {
    return accountsData.accounts.map((account: any) => {
        let totalCollateralUSD = 0;
        let totalDebtUSD = 0;

        account.positions.forEach((position: any) => {
            const balance = parseFloat(position.balance);
            const decimals = position.market.inputToken.decimals;
            const price = parseFloat(position.market.inputTokenPriceUSD);
            const balanceDecimal = balance / Math.pow(10, decimals);
            const valueUSD = balanceDecimal * price;

            if (position.side === 'COLLATERAL') {
                totalCollateralUSD += valueUSD;
            } else if (position.side === 'BORROWER') {
                totalDebtUSD += valueUSD;
            }
        });

        const healthFactor = calculateHealthFactor(totalCollateralUSD, totalDebtUSD, 0.85);

        return {
            address: account.id,
            chain,
            positionCount: account.positionCount,
            openPositionCount: account.openPositionCount,
            totalCollateralUSD,
            totalDebtUSD,
            healthFactor: healthFactor === Infinity ? null : healthFactor,
            positions: account.positions.map((p: any) => ({
                market: p.market.name,
                symbol: p.market.inputToken.symbol,
                side: p.side,
                balance: parseFloat(p.balance) / Math.pow(10, p.market.inputToken.decimals),
                valueUSD: (parseFloat(p.balance) / Math.pow(10, p.market.inputToken.decimals)) * parseFloat(p.market.inputTokenPriceUSD),
            })),
        };
    });
}

function transformProtocolMetrics(protocolDataRaw: any) {
    return protocolDataRaw?.lendingProtocols?.[0] ? {
        totalSupplied: parseFloat(protocolDataRaw.lendingProtocols[0].totalValueLockedUSD),
        totalBorrowed: parseFloat(protocolDataRaw.lendingProtocols[0].totalBorrowBalanceUSD),
        walletCount: parseInt(protocolDataRaw.lendingProtocols[0].cumulativeUniqueUsers || '0', 10),
    } : { totalSupplied: 0, totalBorrowed: 0, walletCount: 0 };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);
    const hideEmpty = searchParams.get('hideEmpty') === 'true';
    const hideNoBorrow = searchParams.get('hideNoBorrow') === 'true';
    const chain = searchParams.get('chain') || 'all';

    const fetchLimit = (hideEmpty || hideNoBorrow) ? pageSize * 3 : pageSize;
    const skip = (page - 1) * pageSize;

    const cacheKey = `wallets-${chain}-${page}-${pageSize}-${hideEmpty}-${hideNoBorrow}`;
    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_WALLETS || '120', 10) * 1000;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const accountQueryOpts = {
            query: GET_ACCOUNTS,
            variables: { first: fetchLimit, skip },
            fetchPolicy: 'network-only' as const,
        };
        const protocolQueryOpts = { query: GET_PROTOCOL_DATA, fetchPolicy: 'network-only' as const };

        let allAccounts: any[] = [];
        let protocolMetrics = { totalSupplied: 0, totalBorrowed: 0, walletCount: 0 };

        if (chain !== 'all' && chain in CHAINS) {
            const client = getSubgraphClient(chain as ChainId);
            const [accountsResult, protocolResult] = await Promise.all([
                client.query(accountQueryOpts),
                client.query(protocolQueryOpts),
            ]);
            allAccounts = transformAccounts(accountsResult.data, chain);
            protocolMetrics = transformProtocolMetrics(protocolResult.data);
        } else {
            // Fetch all chains in parallel
            const accountResults = await Promise.allSettled(
                CHAIN_IDS.map((chainId) =>
                    getSubgraphClient(chainId).query(accountQueryOpts).then((res: any) => ({
                        data: res.data,
                        chainId,
                    }))
                )
            );
            const protocolResults = await Promise.allSettled(
                CHAIN_IDS.map((chainId) =>
                    getSubgraphClient(chainId).query(protocolQueryOpts).then((res: any) => ({
                        data: res.data,
                    }))
                )
            );

            for (const result of accountResults) {
                if (result.status === 'fulfilled') {
                    allAccounts.push(...transformAccounts(result.value.data, result.value.chainId));
                }
            }

            for (const result of protocolResults) {
                if (result.status === 'fulfilled') {
                    const metrics = transformProtocolMetrics(result.value.data);
                    protocolMetrics.totalSupplied += metrics.totalSupplied;
                    protocolMetrics.totalBorrowed += metrics.totalBorrowed;
                    protocolMetrics.walletCount += metrics.walletCount;
                }
            }
        }

        // Apply filters
        if (hideEmpty) {
            allAccounts = allAccounts.filter((a: any) => a.totalCollateralUSD > 0.01 || a.totalDebtUSD > 0.01);
        }
        if (hideNoBorrow) {
            allAccounts = allAccounts.filter((a: any) => a.totalDebtUSD > 0.01);
        }

        const slicedAccounts = allAccounts.slice(0, pageSize);

        const responseData = {
            accounts: slicedAccounts,
            protocol: protocolMetrics,
            page,
            pageSize,
            hasMore: allAccounts.length > pageSize,
        };

        cache.set(cacheKey, { data: responseData, lastFetched: now });
        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching wallets data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch wallets data' },
            { status: 500 }
        );
    }
}
