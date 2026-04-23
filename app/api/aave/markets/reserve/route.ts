// app/api/aave/markets/reserve/route.ts
// Detail endpoint for a single v3 reserve. Fetches full reserve config + supply/
// borrow APY history from AaveKit. v4 detail support can be added later by
// branching on a `version` param.
import { NextResponse } from 'next/server';
import { AAVEKIT_URLS } from '@/lib/aave/version';

const RESERVE_QUERY = `
  query ReserveDetail($market: EvmAddress!, $token: EvmAddress!, $chainId: ChainId!) {
    reserve(request: { market: $market, underlyingToken: $token, chainId: $chainId }) {
      underlyingToken { address symbol name decimals }
      aToken { address symbol }
      vToken { address symbol }
      acceptsNative { symbol }
      size { usd usdPerToken amount { value } }
      supplyInfo {
        apy { value }
        total { value }
        maxLTV { value }
        liquidationThreshold { value }
        liquidationBonus { value }
        canBeCollateral
        supplyCap { amount { value } }
        supplyCapReached
      }
      borrowInfo {
        apy { value }
        total { usd amount { value } }
        reserveFactor { value }
        availableLiquidity { usd amount { value } }
        utilizationRate { value }
        baseVariableBorrowRate { value }
        variableRateSlope1 { value }
        variableRateSlope2 { value }
        optimalUsageRate { value }
        borrowingState
        borrowCap { amount { value } }
        borrowCapReached
      }
      isFrozen
      isPaused
      flashLoanEnabled
      permitSupported
      interestRateStrategyAddress
      usdOracleAddress
    }
  }
`;

const APY_HISTORY_QUERY = `
  query ReserveAPYHistory(
    $market: EvmAddress!,
    $token: EvmAddress!,
    $chainId: ChainId!,
    $window: TimeWindow!
  ) {
    supplyAPYHistory(request: {
      market: $market, underlyingToken: $token, chainId: $chainId, window: $window
    }) { date avgRate { value } }
    borrowAPYHistory(request: {
      market: $market, underlyingToken: $token, chainId: $chainId, window: $window
    }) { date avgRate { value } }
  }
`;

const cache = new Map<string, { data: any; lastFetched: number }>();

const WINDOW_MAP: Record<string, string> = {
    '7': 'LAST_WEEK',
    '30': 'LAST_MONTH',
    '180': 'LAST_SIX_MONTHS',
    '365': 'LAST_YEAR',
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');
    const token = searchParams.get('token');
    const chainId = parseInt(searchParams.get('chainId') || '1', 10);
    const windowParam = searchParams.get('window') || '30';
    const window = WINDOW_MAP[windowParam] || 'LAST_MONTH';

    if (!market || !token || !chainId) {
        return NextResponse.json(
            { error: 'Missing required params: market, token, chainId' },
            { status: 400 }
        );
    }

    const now = Date.now();
    const cacheTTL = parseInt(process.env.CACHE_TTL_MARKETS || '60', 10) * 1000;
    const cacheKey = `reserve-${chainId}-${market}-${token}-${window}`;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        // Fan out reserve detail + APY history in parallel.
        const [reserveRes, historyRes] = await Promise.all([
            fetch(AAVEKIT_URLS.v3, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: RESERVE_QUERY,
                    variables: { market, token, chainId },
                }),
            }),
            fetch(AAVEKIT_URLS.v3, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: APY_HISTORY_QUERY,
                    variables: { market, token, chainId, window },
                }),
            }),
        ]);

        if (!reserveRes.ok) throw new Error(`Reserve query failed: ${reserveRes.status}`);
        const reserveJson = await reserveRes.json();
        if (reserveJson.errors) throw new Error(reserveJson.errors[0]?.message || 'reserve error');

        const historyJson = historyRes.ok ? await historyRes.json() : { data: {} };

        // Normalise the APY history into a shape Recharts can render directly.
        // Combine supply + borrow series by date so we can show both lines.
        const supplyMap = new Map<string, number>();
        for (const entry of historyJson.data?.supplyAPYHistory || []) {
            supplyMap.set(entry.date, parseFloat(entry.avgRate?.value || '0') * 100);
        }
        const borrowMap = new Map<string, number>();
        for (const entry of historyJson.data?.borrowAPYHistory || []) {
            borrowMap.set(entry.date, parseFloat(entry.avgRate?.value || '0') * 100);
        }
        const allDates = Array.from(new Set([...supplyMap.keys(), ...borrowMap.keys()])).sort();
        const apyHistory = allDates.map((date) => ({
            date,
            supplyAPY: supplyMap.get(date) ?? null,
            borrowAPY: borrowMap.get(date) ?? null,
        }));

        const responseData = {
            reserve: reserveJson.data?.reserve,
            apyHistory,
            window,
        };

        cache.set(cacheKey, { data: responseData, lastFetched: now });
        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Reserve detail fetch error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'fetch failed' },
            { status: 500 }
        );
    }
}
