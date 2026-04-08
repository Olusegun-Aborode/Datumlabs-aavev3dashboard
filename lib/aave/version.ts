// lib/aave/version.ts
// Aave protocol version routing. Threaded from the URL (?version=v3|v4|all)
// through React context into every API route so one dashboard can render
// either version or a combined view.

export type AaveVersion = 'v3' | 'v4' | 'all';

export const AAVE_VERSIONS: AaveVersion[] = ['v3', 'v4', 'all'];
export const DEFAULT_VERSION: AaveVersion = 'v3';

export function isAaveVersion(value: unknown): value is AaveVersion {
  return value === 'v3' || value === 'v4' || value === 'all';
}

export function parseVersion(value: string | null | undefined): AaveVersion {
  return isAaveVersion(value) ? value : DEFAULT_VERSION;
}

// AaveKit GraphQL endpoints — v3 and v4 live on separate hosts.
export const AAVEKIT_URLS: Record<Exclude<AaveVersion, 'all'>, string> = {
  v3: process.env.AAVEKIT_V3_API_URL || 'https://api.v3.aave.com/graphql',
  v4: process.env.AAVEKIT_V4_API_URL || 'https://api.v4.aave.com/graphql',
};

// DeFi Llama protocol slugs. Aave maintains one entry per major version.
export const DEFILLAMA_SLUGS: Record<Exclude<AaveVersion, 'all'>, string> = {
  v3: 'aave-v3',
  v4: 'aave-v4',
};

// v4 launched on Ethereum mainnet first. This list will grow as more
// spokes / chains come online — keep it in lockstep with AaveKit v4.
export const V4_CHAIN_IDS = [1];

// v3 keeps its historical chain coverage.
export const V3_CHAIN_IDS = [
  1, 42161, 43114, 8453, 10, 137, 56, 42220, 100, 59144,
  1088, 534352, 1868, 146, 324, 9745, 57073, 5000, 4326, 196,
];

export function chainIdsForVersion(version: Exclude<AaveVersion, 'all'>): number[] {
  return version === 'v4' ? V4_CHAIN_IDS : V3_CHAIN_IDS;
}

// Two-version subset helper: `all` expands to [v3, v4], others stay singleton.
export function versionsToQuery(version: AaveVersion): Array<Exclude<AaveVersion, 'all'>> {
  return version === 'all' ? ['v3', 'v4'] : [version];
}
