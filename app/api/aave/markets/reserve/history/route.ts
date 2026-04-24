// app/api/aave/markets/reserve/history/route.ts
// Historical supply/borrow series for a reserve, sourced from Aave's official
// subgraph (`reserveParamsHistoryItems`). AaveKit doesn't expose this data —
// only current state — so this route exists to back the cap-history chart.
//
// The subgraph emits one entry per state-changing event, which means very
// active reserves (WETH on Ethereum, USDC) generate hundreds of entries per
// day. We downsample server-side to one point per UTC day to keep the
// payload small and the chart readable.
import { NextResponse } from 'next/server';
import { getAaveSubgraphUrl } from '@/lib/aave/aave-subgraphs';

// Ascending order so we can timestamp-paginate forward through the window.
// For very active reserves (WETH on Ethereum hits ~1000 events/day) one
// request only covers a few hours, so we loop in fetchAllInWindow below.
const HISTORY_QUERY = `
  query ReserveHistory($underlying: String!, $since: Int!, $first: Int!) {
    reserveParamsHistoryItems(
      where: { reserve_: { underlyingAsset: $underlying }, timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: asc
      first: $first
    ) {
      timestamp
      totalATokenSupply
      totalCurrentVariableDebt
      totalPrincipalStableDebt
      availableLiquidity
      reserve { decimals symbol }
    }
  }
`;

const PAGE_SIZE = 1000;
// Cap total requests to avoid runaway pagination on extremely active reserves.
// 12 × 1000 = 12k events, which is plenty even for WETH spanning months.
const MAX_PAGES = 12;

async function fetchAllInWindow(subgraphUrl: string, underlying: string, since: number) {
    const all: any[] = [];
    let cursor = since;
    let truncated = false;

    for (let page = 0; page < MAX_PAGES; page++) {
        const res = await fetch(subgraphUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: HISTORY_QUERY,
                variables: { underlying, since: cursor, first: PAGE_SIZE },
            }),
        });
        if (!res.ok) throw new Error(`Subgraph error: ${res.status}`);
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0]?.message || 'subgraph query error');

        const batch = json.data?.reserveParamsHistoryItems || [];
        if (batch.length === 0) break;

        all.push(...batch);

        // If we got a full page, there might be more. Advance cursor past
        // the last timestamp. Use +1 to avoid re-fetching the boundary entry.
        if (batch.length < PAGE_SIZE) break;

        const lastTs = batch[batch.length - 1].timestamp;
        if (lastTs <= cursor) break; // safety against infinite loop
        cursor = lastTs + 1;

        if (page === MAX_PAGES - 1) truncated = true;
    }

    return { items: all, truncated };
}

const cache = new Map<string, { data: any; lastFetched: number }>();

const WINDOW_DAYS: Record<string, number> = {
    '7':   7,
    '30':  30,
    '90':  90,
    '180': 180,
    '365': 365,
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || '';
    const token = (searchParams.get('token') || '').toLowerCase();
    const chainId = parseInt(searchParams.get('chainId') || '1', 10);
    const windowParam = searchParams.get('window') || '30';
    const days = WINDOW_DAYS[windowParam] || 30;

    if (!token || !chainId) {
        return NextResponse.json({ error: 'Missing chainId or token' }, { status: 400 });
    }

    const subgraphUrl = getAaveSubgraphUrl(chainId, market);
    if (!subgraphUrl) {
        // Chain (or market) not on the Aave official subgraphs — return an empty
        // series so the UI can render a "not available" state instead of erroring.
        return NextResponse.json({ history: [], unsupported: true });
    }

    const cacheKey = `reserve-history-${chainId}-${market}-${token}-${days}`;
    const now = Date.now();
    // Cache for 5 min — historical data only updates as new on-chain events fire.
    const cacheTTL = 5 * 60 * 1000;

    const cached = cache.get(cacheKey);
    if (cached && now - cached.lastFetched < cacheTTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const since = Math.floor(Date.now() / 1000) - days * 86400;

        const { items, truncated } = await fetchAllInWindow(subgraphUrl, token, since);

        if (items.length === 0) {
            const responseData = { history: [], unsupported: false };
            cache.set(cacheKey, { data: responseData, lastFetched: now });
            return NextResponse.json(responseData);
        }

        const decimals = parseInt(items[0].reserve?.decimals || '18', 10);
        const divisor = Math.pow(10, decimals);

        // Downsample to one entry per UTC day. Items already arrive in ascending
        // order from the paginated fetch — overwriting the day key as we iterate
        // gives us the *latest* sample per day (close-of-day style).
        const dayMap = new Map<string, any>();
        for (const item of items) {
            const day = new Date(item.timestamp * 1000).toISOString().split('T')[0];
            dayMap.set(day, item);
        }

        const history = Array.from(dayMap.entries()).map(([date, item]: [string, any]) => {
            const supplied = parseFloat(item.totalATokenSupply || '0') / divisor;
            const variableDebt = parseFloat(item.totalCurrentVariableDebt || '0') / divisor;
            const stableDebt = parseFloat(item.totalPrincipalStableDebt || '0') / divisor;
            const borrowed = variableDebt + stableDebt;
            return {
                date,
                timestamp: item.timestamp,
                supplied,
                borrowed,
                available: supplied - borrowed,
            };
        });

        const responseData = {
            history,
            unsupported: false,
            symbol: items[0].reserve?.symbol,
            decimals,
            // True if we hit the page cap. The chart may show a shorter window
            // than the user asked for (typical for very active reserves).
            truncated,
            rawEvents: items.length,
            days: history.length,
        };

        cache.set(cacheKey, { data: responseData, lastFetched: now });
        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Reserve history fetch error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'fetch failed', history: [] },
            { status: 500 }
        );
    }
}
