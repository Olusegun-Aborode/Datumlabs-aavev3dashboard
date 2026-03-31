// app/api/aave/wallets/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_ACCOUNTS, GET_PROTOCOL_METRICS, GET_AAVE_ACCOUNTS, GET_AAVE_MARKETS } from '@/lib/aave/queries';
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

function transformAaveAccounts(usersData: any, chain: string) {
    return usersData.users
        .filter((user: any) => user.reserves && user.reserves.length > 0)
        .map((user: any) => {
            let totalCollateralUSD = 0;
            let totalDebtUSD = 0;
            let weightedLiqThreshold = 0;
            const positions: any[] = [];

            for (const ur of user.reserves) {
                const decimals = parseInt(ur.reserve.decimals);
                const priceUSD = parseInt(ur.reserve.price?.priceInEth || '0') / 1e8;
                if (priceUSD === 0) continue;

                const aTokenBalance = parseFloat(ur.currentATokenBalance) / Math.pow(10, decimals);
                const debtBalance = parseFloat(ur.currentVariableDebt) / Math.pow(10, decimals);
                const collateralUSD = aTokenBalance * priceUSD;
                const debtUSD = debtBalance * priceUSD;
                const liqThreshold = parseInt(ur.reserve.reserveLiquidationThreshold || '8500') / 10000;

                totalCollateralUSD += collateralUSD;
                totalDebtUSD += debtUSD;
                weightedLiqThreshold += collateralUSD * liqThreshold;

                if (aTokenBalance > 0) {
                    positions.push({
                        market: ur.reserve.name,
                        symbol: ur.reserve.symbol,
                        side: 'COLLATERAL',
                        balance: aTokenBalance,
                        valueUSD: collateralUSD,
                    });
                }
                if (debtBalance > 0) {
                    positions.push({
                        market: ur.reserve.name,
                        symbol: ur.reserve.symbol,
                        side: 'BORROWER',
                        balance: debtBalance,
                        valueUSD: debtUSD,
                    });
                }
            }

            const avgLiqThreshold = totalCollateralUSD > 0 ? weightedLiqThreshold / totalCollateralUSD : 0.85;
            const healthFactor = calculateHealthFactor(totalCollateralUSD, totalDebtUSD, avgLiqThreshold);

            return {
                address: user.id,
                chain,
                positionCount: positions.length,
                openPositionCount: positions.length,
                totalCollateralUSD,
                totalDebtUSD,
                healthFactor: healthFactor === Infinity ? null : healthFactor,
                positions,
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

function transformAaveProtocolMetrics(reservesData: any) {
    let totalSupplied = 0;
    let totalBorrowed = 0;
    for (const r of reservesData.reserves || []) {
        const decimals = parseInt(r.decimals);
        const priceUSD = parseInt(r.price?.priceInEth || '0') / 1e8;
        if (priceUSD === 0) continue;
        totalSupplied += (parseFloat(r.totalLiquidity) / Math.pow(10, decimals)) * priceUSD;
        totalBorrowed += (parseFloat(r.totalCurrentVariableDebt) / Math.pow(10, decimals)) * priceUSD;
    }
    return { totalSupplied, totalBorrowed, walletCount: 0 };
}

async function fetchChainAccounts(chainId: ChainId, fetchLimit: number, skip: number) {
    const config = CHAINS[chainId];
    const client = getSubgraphClient(chainId);
    const isAave = config.subgraphType === 'aave';

    const accountQuery = isAave ? GET_AAVE_ACCOUNTS : GET_ACCOUNTS;
    const { data: accountData } = await client.query({
        query: accountQuery,
        variables: { first: fetchLimit, skip },
        fetchPolicy: 'network-only' as const,
    }) as { data: any };

    const accounts = isAave
        ? transformAaveAccounts(accountData, chainId)
        : transformAccounts(accountData, chainId);

    return { accounts, chainId };
}

async function fetchChainProtocolMetrics(chainId: ChainId) {
    const config = CHAINS[chainId];
    const client = getSubgraphClient(chainId);
    const isAave = config.subgraphType === 'aave';

    const query = isAave ? GET_AAVE_MARKETS : GET_PROTOCOL_METRICS;
    const { data } = await client.query({ query, fetchPolicy: 'network-only' as const }) as { data: any };

    return isAave ? transformAaveProtocolMetrics(data) : transformProtocolMetrics(data);
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
        let allAccounts: any[] = [];
        let protocolMetrics = { totalSupplied: 0, totalBorrowed: 0, walletCount: 0 };

        if (chain !== 'all' && chain in CHAINS) {
            const [accountResult, metrics] = await Promise.all([
                fetchChainAccounts(chain as ChainId, fetchLimit, skip),
                fetchChainProtocolMetrics(chain as ChainId),
            ]);
            allAccounts = accountResult.accounts;
            protocolMetrics = metrics;
        } else {
            const [accountResults, metricResults] = await Promise.all([
                Promise.allSettled(CHAIN_IDS.map((chainId) => fetchChainAccounts(chainId, fetchLimit, skip))),
                Promise.allSettled(CHAIN_IDS.map((chainId) => fetchChainProtocolMetrics(chainId))),
            ]);

            for (const result of accountResults) {
                if (result.status === 'fulfilled') {
                    allAccounts.push(...result.value.accounts);
                }
            }

            for (const result of metricResults) {
                if (result.status === 'fulfilled') {
                    protocolMetrics.totalSupplied += result.value.totalSupplied;
                    protocolMetrics.totalBorrowed += result.value.totalBorrowed;
                    protocolMetrics.walletCount += result.value.walletCount;
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
