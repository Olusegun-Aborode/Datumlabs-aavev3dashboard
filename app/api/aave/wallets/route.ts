// app/api/aave/wallets/route.ts
import { NextResponse } from 'next/server';
import { getSubgraphClient, CHAINS, CHAIN_IDS, type ChainId } from '@/lib/aave/graphql-client';
import { GET_ACCOUNTS, GET_PROTOCOL_METRICS, GET_AAVE_ACCOUNTS, GET_AAVE_MARKETS } from '@/lib/aave/queries';
import { calculateHealthFactor } from '@/lib/aave/helpers';
import { parseVersion } from '@/lib/aave/version';
import { AAVEKIT_URLS, V4_CHAIN_IDS } from '@/lib/aave/version';

// AaveKit v4 doesn't expose a "list all users" endpoint. Instead we derive the
// active-user set from the recent activities feed (SUPPLY + BORROW), then fan
// out to userSummary for each unique address. This gives us the N most-recently
// active wallets, which matches what the v3 subgraph query returns in practice.
const V4_ACTIVE_USERS_QUERY = `
  query V4ActiveUsers($chainIds: [Int!]!, $pageSize: PageSize!) {
    activities(request: {
      query: { chainIds: $chainIds }
      types: [SUPPLY, BORROW]
      pageSize: $pageSize
    }) {
      items {
        __typename
        ... on SupplyActivity { user chain { chainId name } }
        ... on BorrowActivity { user chain { chainId name } }
      }
    }
  }
`;

const V4_USER_SUMMARY_QUERY = `
  query V4UserSummary($user: EvmAddress!) {
    userSummary(request: { user: $user }) {
      totalPositions
      totalCollateral { value }
      totalDebt { value }
      lowestHealthFactor
    }
  }
`;

async function fetchV4ActiveUsers(): Promise<{ address: string; chain: string }[]> {
    const res = await fetch(AAVEKIT_URLS.v4, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: V4_ACTIVE_USERS_QUERY,
            variables: { chainIds: V4_CHAIN_IDS, pageSize: 'FIFTY' },
        }),
    });

    if (!res.ok) throw new Error(`AaveKit v4 activities error: ${res.status}`);
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors[0]?.message || 'v4 activities query error');

    // Dedupe by address while preserving first-seen order.
    const seen = new Set<string>();
    const users: { address: string; chain: string }[] = [];
    for (const item of data?.activities?.items || []) {
        if (!item?.user || seen.has(item.user)) continue;
        seen.add(item.user);
        users.push({
            address: item.user,
            chain: (item.chain?.name || 'ethereum').toLowerCase(),
        });
    }
    return users;
}

async function fetchV4UserSummary(address: string) {
    const res = await fetch(AAVEKIT_URLS.v4, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: V4_USER_SUMMARY_QUERY,
            variables: { user: address },
        }),
    });
    if (!res.ok) throw new Error(`AaveKit v4 userSummary error: ${res.status}`);
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors[0]?.message || 'v4 userSummary query error');
    return data?.userSummary;
}

async function fetchV4Wallets(): Promise<{ accounts: any[]; protocol: any }> {
    const activeUsers = await fetchV4ActiveUsers();

    // Fan out userSummary calls in parallel. Up to 50 addresses → 50 concurrent
    // requests to AaveKit. Using allSettled so one bad address doesn't sink the list.
    const summaryResults = await Promise.allSettled(
        activeUsers.map(u => fetchV4UserSummary(u.address))
    );

    const accounts: any[] = [];
    let totalSupplied = 0;
    let totalBorrowed = 0;

    summaryResults.forEach((r, i) => {
        if (r.status !== 'fulfilled' || !r.value) return;
        const s = r.value;
        const collateral = parseFloat(s.totalCollateral?.value || '0');
        const debt = parseFloat(s.totalDebt?.value || '0');
        totalSupplied += collateral;
        totalBorrowed += debt;

        accounts.push({
            address: activeUsers[i].address,
            chain: activeUsers[i].chain,
            version: 'v4',
            positionCount: s.totalPositions || 0,
            openPositionCount: s.totalPositions || 0,
            totalCollateralUSD: collateral,
            totalDebtUSD: debt,
            healthFactor: s.lowestHealthFactor ? parseFloat(s.lowestHealthFactor) : null,
            positions: [],
        });
    });

    return {
        accounts,
        protocol: {
            totalSupplied,
            totalBorrowed,
            walletCount: accounts.length,
        },
    };
}

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
    const version = parseVersion(searchParams.get('version'));

    const fetchLimit = (hideEmpty || hideNoBorrow) ? pageSize * 3 : pageSize;
    const skip = (page - 1) * pageSize;

    const cacheKey = `wallets-${version}-${chain}-${page}-${pageSize}-${hideEmpty}-${hideNoBorrow}`;

    const cached = cache.get(cacheKey);
    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_WALLETS || '120', 10) * 1000;
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    // v4-only short-circuit: fetch the recent-user feed and fan out to userSummary.
    // v4 has no chain filter at this stage (Ethereum only) so we ignore the chain param.
    if (version === 'v4') {
        try {
            const { accounts, protocol } = await fetchV4Wallets();
            let filtered = accounts;
            if (hideEmpty) filtered = filtered.filter(a => a.totalCollateralUSD > 0.01 || a.totalDebtUSD > 0.01);
            if (hideNoBorrow) filtered = filtered.filter(a => a.totalDebtUSD > 0.01);
            filtered.sort((a, b) => b.totalCollateralUSD - a.totalCollateralUSD);

            const sliced = filtered.slice(skip, skip + pageSize);
            const response = {
                accounts: sliced,
                protocol,
                page,
                pageSize,
                hasMore: filtered.length > skip + pageSize,
                ...(sliced.length === 0 && filtered.length === 0 ? {
                    notice: 'No active Aave v4 wallets found yet. This view samples recent SUPPLY/BORROW activities; more positions will appear as v4 usage grows.',
                } : {}),
            };
            cache.set(cacheKey, { data: response, lastFetched: now });
            return NextResponse.json(response);
        } catch (e) {
            console.error('v4 wallets fetch failed:', e);
            return NextResponse.json({
                accounts: [],
                protocol: { totalSupplied: 0, totalBorrowed: 0, walletCount: 0 },
                page,
                pageSize,
                hasMore: false,
                notice: 'v4 wallet data temporarily unavailable.',
            });
        }
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
            ...(version === 'all' ? {
                notice: 'Combined view shows Aave v3 wallet data. Switch to V4 to see active v4 wallets (sampled from recent activity).',
            } : {}),
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
