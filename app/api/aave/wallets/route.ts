// app/api/aave/wallets/route.ts
import { NextResponse } from 'next/server';
import { subgraphClient } from '@/lib/aave/graphql-client';
import { GET_ACCOUNTS } from '@/lib/aave/queries';
import { calculateHealthFactor } from '@/lib/aave/helpers';

const cache = new Map<string, { data: any; lastFetched: number }>();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);

    const skip = (page - 1) * pageSize;
    const cacheKey = `${page}-${pageSize}`;

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_WALLETS || '120', 10) * 1000;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const { data } = await subgraphClient.query<any>({
            query: GET_ACCOUNTS,
            variables: {
                first: pageSize,
                skip,
            },
            fetchPolicy: 'network-only',
        });

        // Transform account data and calculate metrics
        const accounts = data.accounts.map((account: any) => {
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

        const responseData = {
            accounts,
            page,
            pageSize,
            hasMore: accounts.length === pageSize,
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
