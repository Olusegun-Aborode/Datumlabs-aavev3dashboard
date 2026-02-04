// app/api/aave/wallets/route.ts
import { NextResponse } from 'next/server';
import { subgraphClient } from '@/lib/aave/graphql-client';
import { GET_ACCOUNTS, GET_PROTOCOL_DATA } from '@/lib/aave/queries';
import { calculateHealthFactor } from '@/lib/aave/helpers';

const cache = new Map<string, { data: any; lastFetched: number }>();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);
    const hideEmpty = searchParams.get('hideEmpty') === 'true';
    const hideNoBorrow = searchParams.get('hideNoBorrow') === 'true';

    // We need to fetch more items if we are filtering on the client side to maintain page size
    // fetching 3x buffer if filtering is enabled
    const fetchLimit = (hideEmpty || hideNoBorrow) ? pageSize * 3 : pageSize;
    const skip = (page - 1) * pageSize;

    // Cache key includes filter params
    const cacheKey = `${page}-${pageSize}-${hideEmpty}-${hideNoBorrow}`;

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_WALLETS || '120', 10) * 1000;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        // Fetch accounts and protocol data in parallel
        const [accountsResult, protocolResult] = await Promise.all([
            subgraphClient.query<any>({
                query: GET_ACCOUNTS,
                variables: {
                    first: fetchLimit,
                    skip,
                },
                fetchPolicy: 'network-only',
            }),
            subgraphClient.query<any>({
                query: GET_PROTOCOL_DATA,
                fetchPolicy: 'network-only',
            })
        ]);

        const { data: accountsData } = accountsResult;
        const { data: protocolDataRaw } = protocolResult;

        // Process Protocol Data
        const protocolMetrics = protocolDataRaw?.lendingProtocols?.[0] ? {
            totalSupplied: parseFloat(protocolDataRaw.lendingProtocols[0].totalValueLockedUSD),
            totalBorrowed: parseFloat(protocolDataRaw.lendingProtocols[0].totalBorrowBalanceUSD),
            walletCount: 0 // Will be estimated or passed if available, Aave subgraph doesn't give total user count easily
        } : { totalSupplied: 0, totalBorrowed: 0, walletCount: 0 };


        // Transform account data and calculate metrics
        let accounts = accountsData.accounts.map((account: any) => {
            let totalCollateralUSD = 0;
            let totalDebtUSD = 0;

            // Calculate total collateral and debt
            account.positions.forEach((position: any) => {
                const balance = parseFloat(position.balance);
                const decimals = position.market.inputToken.decimals;
                const price = parseFloat(position.market.inputTokenPriceUSD);

                // Convert balance from token units to decimal
                const balanceDecimal = balance / Math.pow(10, decimals);
                const valueUSD = balanceDecimal * price;

                if (position.side === 'COLLATERAL') {
                    totalCollateralUSD += valueUSD;
                } else if (position.side === 'BORROWER') {
                    totalDebtUSD += valueUSD;
                }
            });

            // Calculate health factor (using 0.85 as default liquidation threshold)
            const healthFactor = calculateHealthFactor(totalCollateralUSD, totalDebtUSD, 0.85);

            return {
                address: account.id,
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

        // Apply filters
        if (hideEmpty) {
            accounts = accounts.filter((a: any) => a.totalCollateralUSD > 0.01 || a.totalDebtUSD > 0.01);
        }

        if (hideNoBorrow) {
            accounts = accounts.filter((a: any) => a.totalDebtUSD > 0.01);
        }

        // Slice to requested page size after filtering
        // Note: Simple pagination with filtering on client-side-chunk can be tricky. 
        // Ideally we filter in GraphQL, but "totalCollateralUSD" is computed.
        // For now, we return what we have. If we filtered too much, the page might be short.
        const slicedAccounts = accounts.slice(0, pageSize);

        const responseData = {
            accounts: slicedAccounts,
            protocol: protocolMetrics,
            page,
            pageSize,
            hasMore: accountsData.accounts.length === fetchLimit, // Rough estimate
        };

        // Update cache
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
