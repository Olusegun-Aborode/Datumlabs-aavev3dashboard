// Aave dashboard — Setnel detectors.
//
// These are Aave-specific alert rules. They run server-side on a cron (see
// app/api/setnel/cron/route.ts) and post to the Setnel Hub.
//
// v1 uses absolute-threshold rules (value crosses a line) — no previous-value
// comparison. Percent-change rules ("TVL dropped 15%") are still handled by the
// central datum-monitor until snapshot support lands in the kit.

import { defineDetector } from './runtime';

// Base URL to call this dashboard's own API routes from the cron runtime.
function baseUrl(): string {
  if (process.env.SETNEL_SELF_URL) return process.env.SETNEL_SELF_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

type Overview = {
  totalMarketSize: number;
  totalAvailable: number;
  totalBorrows: number;
  totalReserves: number;
  protocolRevenueUSD: number;
  // Daily series, oldest → newest: { date, tvl, borrows }. Sourced from
  // DeFiLlama/AaveKit. Use this for change-over-time — NOT totalMarketSize,
  // which is a different (live, all-chain v3+v4) metric and isn't comparable.
  historicalData?: { date: string; tvl: number; borrows: number }[];
  // Daily revenue series, oldest → newest.
  revenueHistory?: { date: string; supplyRevenue: number; protocolRevenue: number }[];
};

type Market = {
  totalBorrowBalanceUSD?: number;
  totalValueLockedUSD?: number;
  inputTokenPriceUSD?: number;
  chain?: string;
  inputToken?: { symbol?: string; address?: string };
};
type Markets = { markets?: Market[] };

// USD stablecoins we expect to hold their $1 peg. Deliberately EXCLUDES
// yield-bearing tokens (sUSDe, sDAI, sUSDS — these accrue value, not pegged)
// and non-USD stables (EURC, EURe, agEUR — pegged to other currencies).
const STABLES = new Set([
  'USDC', 'USDT', 'DAI', 'USDS', 'GHO', 'FRAX', 'LUSD', 'sUSD', 'USDe',
  'PYUSD', 'USDC.e', 'crvUSD', 'USD₮0', 'USDtb', 'RLUSD', 'USDbC',
]);
// Ignore normal drift; a true $1 stable beyond this is a real depeg signal.
const DEPEG_PCT = 1;

// Aave chain key → DeFiLlama coins chain slug (most match; map the exceptions).
const LLAMA_CHAIN: Record<string, string> = {
  avalanche: 'avax', bnb: 'bsc', zksync: 'era',
};
const llamaChain = (c: string) => LLAMA_CHAIN[c] ?? c;

type Liquidations = {
  aggregations: { totalLiquidatedUSD: number; totalCount: number };
};

// 1) Liquidity crunch — available liquidity dips below 5% of market size.
//    Means suppliers may not be able to withdraw. Absolute, no history needed.
//    Also the sampler for the core Aave overview metrics (emitted every run).
defineDetector<Overview>({
  id: 'aave.liquidity-crunch',
  label: 'Available liquidity below 5% of market size',
  category: 'liquidity',
  severity: 'critical',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/overview`, { cache: 'no-store' });
    return r.json();
  },
  sample: (o) => ({
    'aave.market_size': o.totalMarketSize,
    'aave.borrows': o.totalBorrows,
    'aave.available': o.totalAvailable,
    'aave.revenue': o.protocolRevenueUSD,
    'aave.utilization_pct': o.totalMarketSize ? (o.totalBorrows / o.totalMarketSize) * 100 : 0,
  }),
  detect: (o) => {
    if (!o.totalMarketSize) return [];
    const ratio = o.totalAvailable / o.totalMarketSize;
    if (ratio < 0.05) {
      return [
        {
          message: `Available liquidity is ${(ratio * 100).toFixed(1)}% of market size ($${fmtM(o.totalAvailable)} of $${fmtM(o.totalMarketSize)})`,
          fingerprint: 'aave.liquidity-crunch',
          linkPath: '/',
          payload: { totalAvailable: o.totalAvailable, totalMarketSize: o.totalMarketSize, ratio },
        },
      ];
    }
    return [];
  },
});

// 2) High protocol-wide utilization — borrows above 92% of market size.
defineDetector<Overview>({
  id: 'aave.high-utilization',
  label: 'Protocol utilization above 92%',
  category: 'liquidity',
  severity: 'warning',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/overview`, { cache: 'no-store' });
    return r.json();
  },
  detect: (o) => {
    if (!o.totalMarketSize) return [];
    const util = o.totalBorrows / o.totalMarketSize;
    if (util > 0.92) {
      return [
        {
          message: `Protocol utilization at ${(util * 100).toFixed(1)}%`,
          fingerprint: 'aave.high-utilization',
          linkPath: '/',
          payload: { util, totalBorrows: o.totalBorrows },
        },
      ];
    }
    return [];
  },
});

// 3) Liquidation spike — recent liquidation volume above $5M in the page window.
defineDetector<Liquidations>({
  id: 'aave.liquidation-spike',
  label: 'Recent liquidations above $5M',
  category: 'liquidations',
  severity: 'critical',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/liquidations?pageSize=50`, { cache: 'no-store' });
    return r.json();
  },
  detect: (l) => {
    const usd = l.aggregations?.totalLiquidatedUSD ?? 0;
    if (usd > 5_000_000) {
      return [
        {
          message: `Recent liquidations total $${fmtM(usd)} (${l.aggregations.totalCount} events)`,
          fingerprint: 'aave.liquidation-spike',
          linkPath: '/liquidations',
          payload: { totalLiquidatedUSD: usd, count: l.aggregations.totalCount },
        },
      ];
    }
    return [];
  },
});

// 4) Data integrity — overview returns zero/garbage market size. Technical, so
//    it routes to the internal channel only (not the data-alerts channel).
defineDetector<Overview>({
  id: 'aave.data-integrity',
  label: 'Overview market size is zero or missing',
  category: 'technical',
  severity: 'critical',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/overview`, { cache: 'no-store' });
    return r.json();
  },
  detect: (o) => {
    if (!o.totalMarketSize || o.totalMarketSize <= 0) {
      return [
        {
          message: `Overview returned totalMarketSize=${o.totalMarketSize} — data source likely broken`,
          fingerprint: 'aave.data-integrity',
          linkPath: '/',
          payload: { overview: o },
        },
      ];
    }
    return [];
  },
});

// Generic: change of `field` between the latest entry and `daysBack` before it.
function seriesChange<R extends Record<string, number | string>>(
  rows: R[] | undefined,
  field: keyof R,
  daysBack: number,
): { latest: number; prior: number; pct: number } | null {
  if (!rows || rows.length <= daysBack) return null;
  const latest = Number(rows[rows.length - 1]?.[field]);
  const prior = Number(rows[rows.length - 1 - daysBack]?.[field]);
  if (!latest || !prior) return null;
  return { latest, prior, pct: ((latest - prior) / prior) * 100 };
}

function tvlChange(o: Overview, daysBack: number) {
  return seriesChange(o.historicalData, 'tvl', daysBack);
}

// Herfindahl-Hirschman Index over a set of USD values. 0–10000.
// <1500 competitive · 1500–2500 moderate · >2500 concentrated.
function hhi(values: number[]): number {
  const total = values.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (total <= 0) return 0;
  return values.reduce((acc, v) => {
    if (v <= 0) return acc;
    const share = (v / total) * 100;
    return acc + share * share;
  }, 0);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// 5) TVL drop 24h — total value locked falls >10% day-over-day. The headline
//    "something happened" signal for a lending market.
defineDetector<Overview>({
  id: 'aave.tvl-drop-24h',
  label: 'TVL dropped more than 10% in 24h',
  category: 'flows',
  severity: 'critical',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/overview`, { cache: 'no-store' });
    return r.json();
  },
  detect: (o) => {
    const c = tvlChange(o, 1);
    if (c && c.pct <= -10) {
      return [
        {
          message: `TVL dropped ${c.pct.toFixed(1)}% in 24h ($${fmtM(c.prior)} → $${fmtM(c.latest)})`,
          fingerprint: 'aave.tvl-drop-24h',
          linkPath: '/',
          payload: { pct: c.pct, from: c.prior, to: c.latest, window: '24h' },
        },
      ];
    }
    return [];
  },
});

// 6) TVL move 24h — unusually large swing either direction (>20%). Catches big
//    inflows too, not just drops. Warning, since up-moves aren't always risk.
defineDetector<Overview>({
  id: 'aave.tvl-move-24h',
  label: 'TVL moved more than 20% in 24h (either direction)',
  category: 'flows',
  severity: 'warning',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/overview`, { cache: 'no-store' });
    return r.json();
  },
  detect: (o) => {
    const c = tvlChange(o, 1);
    if (c && Math.abs(c.pct) > 20) {
      const dir = c.pct > 0 ? 'rose' : 'fell';
      return [
        {
          message: `TVL ${dir} ${Math.abs(c.pct).toFixed(1)}% in 24h ($${fmtM(c.prior)} → $${fmtM(c.latest)})`,
          fingerprint: 'aave.tvl-move-24h',
          linkPath: '/',
          payload: { pct: c.pct, from: c.prior, to: c.latest, window: '24h' },
        },
      ];
    }
    return [];
  },
});

// 7) TVL bleed 7d — sustained outflow: TVL down >25% over a week.
defineDetector<Overview>({
  id: 'aave.tvl-drop-7d',
  label: 'TVL dropped more than 25% in 7 days',
  category: 'flows',
  severity: 'warning',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/overview`, { cache: 'no-store' });
    return r.json();
  },
  detect: (o) => {
    const c = tvlChange(o, 7);
    if (c && c.pct <= -25) {
      return [
        {
          message: `TVL down ${c.pct.toFixed(1)}% over 7 days ($${fmtM(c.prior)} → $${fmtM(c.latest)})`,
          fingerprint: 'aave.tvl-drop-7d',
          linkPath: '/',
          payload: { pct: c.pct, from: c.prior, to: c.latest, window: '7d' },
        },
      ];
    }
    return [];
  },
});

// 8) Borrows move 24h — total borrows swing >20% day-over-day. Sharp borrow
//    growth can precede utilization stress; sharp drops signal deleveraging.
defineDetector<Overview>({
  id: 'aave.borrows-move-24h',
  label: 'Total borrows moved more than 20% in 24h',
  category: 'flows',
  severity: 'warning',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/overview`, { cache: 'no-store' });
    return r.json();
  },
  detect: (o) => {
    const c = seriesChange(o.historicalData, 'borrows', 1);
    if (c && Math.abs(c.pct) > 20) {
      const dir = c.pct > 0 ? 'rose' : 'fell';
      return [
        {
          message: `Total borrows ${dir} ${Math.abs(c.pct).toFixed(1)}% in 24h ($${fmtM(c.prior)} → $${fmtM(c.latest)})`,
          fingerprint: 'aave.borrows-move-24h',
          linkPath: '/',
          payload: { pct: c.pct, from: c.prior, to: c.latest, window: '24h' },
        },
      ];
    }
    return [];
  },
});

// 9) Revenue collapse — yesterday's protocol revenue below 50% of the trailing
//    7-day average. Revenue is noisy day-to-day, so we compare to a baseline.
defineDetector<Overview>({
  id: 'aave.revenue-collapse',
  label: 'Protocol revenue below 50% of 7-day average',
  category: 'revenue',
  severity: 'warning',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/overview`, { cache: 'no-store' });
    return r.json();
  },
  detect: (o) => {
    const rh = o.revenueHistory;
    if (!rh || rh.length < 8) return [];
    const latest = rh[rh.length - 1].protocolRevenue;
    const prior7 = rh.slice(-8, -1).map((d) => d.protocolRevenue);
    const baseline = avg(prior7);
    if (baseline > 0 && latest < baseline * 0.5) {
      return [
        {
          message: `Protocol revenue $${fmtM(latest)} is ${((latest / baseline) * 100).toFixed(0)}% of the 7d avg ($${fmtM(baseline)})`,
          fingerprint: 'aave.revenue-collapse',
          linkPath: '/',
          payload: { latest, baseline7d: baseline },
        },
      ];
    }
    return [];
  },
});

// 10) Borrow concentration (HHI) — borrows concentrated across markets. A high
//     index means one asset/market dominates borrows: a depeg or rate shock
//     there becomes systemic for the protocol.
defineDetector<Markets>({
  id: 'aave.borrow-concentration',
  label: 'Borrow concentration (HHI) above 2500',
  category: 'risk-parameters',
  severity: 'warning',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/markets?pageSize=500`, { cache: 'no-store' });
    return r.json();
  },
  sample: (m) => {
    const borrows = (m.markets ?? []).map((x) => x.totalBorrowBalanceUSD ?? 0).filter((v) => v > 0);
    return { 'aave.borrow_hhi': borrows.length >= 2 ? hhi(borrows) : 0 };
  },
  detect: (m) => {
    const borrows = (m.markets ?? [])
      .map((x) => x.totalBorrowBalanceUSD ?? 0)
      .filter((v) => v > 0);
    if (borrows.length < 2) return [];
    const index = hhi(borrows);
    if (index > 2500) {
      const tier = index > 5000 ? 'highly concentrated' : 'concentrated';
      return [
        {
          message: `Borrow HHI is ${index.toFixed(0)} (${tier}) across ${borrows.length} markets`,
          fingerprint: 'aave.borrow-concentration',
          linkPath: '/',
          payload: { hhi: index, markets: borrows.length },
        },
      ];
    }
    return [];
  },
});

// 11) Stablecoin depeg — a stablecoin reserve's oracle price drifts from $1.
//     Uses the price Aave itself reads, so it reflects what the protocol sees.
defineDetector<Markets>({
  id: 'aave.stablecoin-depeg',
  label: 'Stablecoin price deviates from $1',
  category: 'depegging',
  severity: 'critical',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/markets?pageSize=500`, { cache: 'no-store' });
    return r.json();
  },
  detect: (m) => {
    const events = [];
    const seen = new Set<string>();
    for (const x of m.markets ?? []) {
      const sym = x.inputToken?.symbol;
      const price = x.inputTokenPriceUSD;
      const tvl = x.totalValueLockedUSD ?? 0;
      if (!sym || !STABLES.has(sym) || !price || tvl < 1_000_000) continue;
      const key = `${sym}:${x.chain}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const devPct = (price - 1) * 100;
      if (Math.abs(devPct) > DEPEG_PCT) {
        events.push({
          message: `${sym} on ${x.chain} at $${price.toFixed(4)} (${devPct > 0 ? '+' : ''}${devPct.toFixed(2)}% off peg)`,
          fingerprint: `aave.depeg:${key}`,
          linkPath: '/',
          payload: { symbol: sym, chain: x.chain, price, devPct, exposureUsd: tvl },
        });
      }
    }
    return events;
  },
});

// 12) Oracle deviation — the price Aave reads vs an independent market price
//     (DeFiLlama). A large gap means the oracle is stale or being manipulated.
//     Checks the top markets by TVL to keep external calls light.
defineDetector<Markets>({
  id: 'aave.oracle-deviation',
  label: 'Oracle price deviates from market by >2%',
  category: 'oracles',
  severity: 'warning',
  source: async () => {
    const r = await fetch(`${baseUrl()}/api/aave/markets?pageSize=500`, { cache: 'no-store' });
    return r.json();
  },
  detect: async (m) => {
    const top = (m.markets ?? [])
      .filter((x) => x.inputToken?.address && x.chain && x.inputTokenPriceUSD && (x.totalValueLockedUSD ?? 0) > 5_000_000)
      .sort((a, b) => (b.totalValueLockedUSD ?? 0) - (a.totalValueLockedUSD ?? 0))
      .slice(0, 15);
    if (top.length === 0) return [];

    const keys = top.map((x) => `${llamaChain(x.chain!)}:${x.inputToken!.address!.toLowerCase()}`);
    let prices: Record<string, { price: number; confidence?: number }> = {};
    try {
      const res = await fetch(`https://coins.llama.fi/prices/current/${keys.join(',')}`, { cache: 'no-store' });
      prices = (await res.json())?.coins ?? {};
    } catch {
      return [];
    }

    const events = [];
    for (const x of top) {
      const key = `${llamaChain(x.chain!)}:${x.inputToken!.address!.toLowerCase()}`;
      const market = prices[key];
      if (!market || !market.price || (market.confidence ?? 1) < 0.9) continue;
      const oracle = x.inputTokenPriceUSD!;
      const devPct = ((oracle - market.price) / market.price) * 100;
      if (Math.abs(devPct) > 2) {
        events.push({
          message: `${x.inputToken!.symbol} on ${x.chain}: oracle $${oracle.toFixed(2)} vs market $${market.price.toFixed(2)} (${devPct > 0 ? '+' : ''}${devPct.toFixed(1)}%)`,
          fingerprint: `aave.oracle-deviation:${x.inputToken!.symbol}:${x.chain}`,
          linkPath: '/',
          payload: { symbol: x.inputToken!.symbol, chain: x.chain, oracle, market: market.price, devPct, exposureUsd: x.totalValueLockedUSD },
        });
      }
    }
    return events;
  },
});

function fmtM(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
