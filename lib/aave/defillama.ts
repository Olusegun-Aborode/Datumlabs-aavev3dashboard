// lib/aave/defillama.ts
// DeFi Llama API client for Aave protocol data

const BASE_URL = 'https://api.llama.fi';

// DeFi Llama uses capitalized chain names
const CHAIN_MAP: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  base: 'Base',
  optimism: 'Optimism',
  polygon: 'Polygon',
  avalanche: 'Avalanche',
  plasma: 'Plasma',
  mantle: 'Mantle',
  bnb: 'Binance',
  linea: 'Linea',
  gnosis: 'xDai',
};

export interface HistoricalEntry {
  date: string; // YYYY-MM-DD
  tvl: number;
  borrows: number;
}

interface DefiLlamaTvlEntry {
  date: number; // unix seconds
  totalLiquidityUSD: number;
}

interface DefiLlamaBorrowEntry {
  date: number;
  totalLiquidityUSD: number; // DeFi Llama uses this field name for borrowed amounts too
}

/**
 * Fetch Aave V3 protocol data from DeFi Llama.
 * This response can be very large (10MB+), so we extract only what we need.
 */
export async function fetchProtocolData() {
  const res = await fetch(`${BASE_URL}/protocol/aave-v3`);
  if (!res.ok) throw new Error(`DeFi Llama protocol API error: ${res.status}`);
  return res.json();
}

/**
 * Fetch Aave fee/revenue data from DeFi Llama.
 * dataType controls what metric is returned:
 *   - 'dailyFees' (default) — total fees
 *   - 'dailyRevenue' — protocol revenue
 *   - 'dailySupplySideRevenue' — supply-side revenue
 */
async function fetchFees(dataType: string) {
  const res = await fetch(`${BASE_URL}/summary/fees/aave?dataType=${dataType}`);
  if (!res.ok) throw new Error(`DeFi Llama fees API error: ${res.status}`);
  return res.json();
}

function unixToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split('T')[0];
}

/**
 * Build historical TVL + borrow arrays from DeFi Llama protocol data.
 * Supports chain filtering.
 */
export function buildHistoricalData(
  protocolData: any,
  chain: string = 'all',
  maxDays: number = 400,
): { historicalData: HistoricalEntry[]; latestTvl: number; latestBorrows: number } {
  let tvlEntries: DefiLlamaTvlEntry[] = [];
  let borrowEntries: DefiLlamaBorrowEntry[] = [];

  const chainTvls = protocolData.chainTvls || {};

  if (chain === 'all') {
    // Use top-level aggregated arrays
    tvlEntries = protocolData.tvl || [];
    // Borrowed data is in the top-level "borrowed" key in chainTvls
    borrowEntries = chainTvls['borrowed']?.tvl || [];
  } else {
    const llamaChainName = CHAIN_MAP[chain];
    if (!llamaChainName) throw new Error(`Unknown chain: ${chain}`);

    const chainData = chainTvls[llamaChainName];
    if (!chainData) throw new Error(`No DeFi Llama data for chain: ${llamaChainName}`);

    tvlEntries = chainData.tvl || [];
    // Borrowed data is under "<ChainName>-borrowed" key
    borrowEntries = chainTvls[`${llamaChainName}-borrowed`]?.tvl || [];
  }

  // Trim to last N days to keep response size manageable
  tvlEntries = tvlEntries.slice(-maxDays);
  borrowEntries = borrowEntries.slice(-maxDays);

  // Merge TVL and borrow by date
  const dateMap = new Map<string, { tvl: number; borrows: number }>();
  for (const entry of tvlEntries) {
    const date = unixToDate(entry.date);
    dateMap.set(date, { tvl: entry.totalLiquidityUSD, borrows: 0 });
  }
  for (const entry of borrowEntries) {
    const date = unixToDate(entry.date);
    const existing = dateMap.get(date);
    if (existing) {
      existing.borrows = entry.totalLiquidityUSD;
    } else {
      dateMap.set(date, { tvl: 0, borrows: entry.totalLiquidityUSD });
    }
  }

  const historicalData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));

  const latest = historicalData[historicalData.length - 1];
  return {
    historicalData,
    latestTvl: latest?.tvl || 0,
    latestBorrows: latest?.borrows || 0,
  };
}

export interface RevenueHistoryEntry {
  date: string; // YYYY-MM-DD
  supplyRevenue: number;
  protocolRevenue: number;
}

/**
 * Fetch supply-side and protocol revenue from DeFi Llama fees endpoint.
 * Returns all-time totals and daily historical data for charts.
 */
export async function fetchRevenueData(maxDays: number = 400): Promise<{
  supplyRevenueUSD: number;
  protocolRevenueUSD: number;
  revenueHistory: RevenueHistoryEntry[];
}> {
  const [supplySide, protocolSide] = await Promise.all([
    fetchFees('dailySupplySideRevenue'),
    fetchFees('dailyRevenue'),
  ]);

  // Build daily revenue history from totalDataChart arrays
  const dateMap = new Map<string, { supplyRevenue: number; protocolRevenue: number }>();

  const supplyChart: [number, number][] = supplySide.totalDataChart || [];
  for (const [ts, value] of supplyChart) {
    const date = unixToDate(ts);
    const existing = dateMap.get(date);
    if (existing) {
      existing.supplyRevenue = value;
    } else {
      dateMap.set(date, { supplyRevenue: value, protocolRevenue: 0 });
    }
  }

  const protocolChart: [number, number][] = protocolSide.totalDataChart || [];
  for (const [ts, value] of protocolChart) {
    const date = unixToDate(ts);
    const existing = dateMap.get(date);
    if (existing) {
      existing.protocolRevenue = value;
    } else {
      dateMap.set(date, { supplyRevenue: 0, protocolRevenue: value });
    }
  }

  const revenueHistory = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxDays)
    .map(([date, vals]) => ({ date, ...vals }));

  return {
    supplyRevenueUSD: supplySide.totalAllTime || 0,
    protocolRevenueUSD: protocolSide.totalAllTime || 0,
    revenueHistory,
  };
}
