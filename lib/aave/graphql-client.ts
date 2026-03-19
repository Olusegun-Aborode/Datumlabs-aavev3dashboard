// lib/aave/graphql-client.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

const API_KEY = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

// Chain configurations
export const CHAINS: Record<string, { name: string; shortName: string; subgraphUrl: string }> = {
  ethereum: {
    name: 'Ethereum',
    shortName: 'ETH',
    subgraphUrl: process.env.THEGRAPH_SUBGRAPH_URL || '',
  },
  arbitrum: {
    name: 'Arbitrum',
    shortName: 'ARB',
    subgraphUrl: process.env.THEGRAPH_ARBITRUM_SUBGRAPH_URL || '',
  },
  base: {
    name: 'Base',
    shortName: 'BASE',
    subgraphUrl: process.env.THEGRAPH_BASE_SUBGRAPH_URL || '',
  },
  optimism: {
    name: 'Optimism',
    shortName: 'OP',
    subgraphUrl: process.env.THEGRAPH_OPTIMISM_SUBGRAPH_URL || '',
  },
  polygon: {
    name: 'Polygon',
    shortName: 'POLY',
    subgraphUrl: process.env.THEGRAPH_POLYGON_SUBGRAPH_URL || '',
  },
  avalanche: {
    name: 'Avalanche',
    shortName: 'AVAX',
    subgraphUrl: process.env.THEGRAPH_AVALANCHE_SUBGRAPH_URL || '',
  },
};

export type ChainId = keyof typeof CHAINS;

// All chain IDs for iteration
export const CHAIN_IDS = Object.keys(CHAINS) as ChainId[];

function createSubgraphClient(url: string) {
  const link = createHttpLink({
    uri: url,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        fetchPolicy: 'network-only',
      },
    },
  });
}

// Lazily created clients cache
const clientCache = new Map<string, ApolloClient>();

export function getSubgraphClient(chain: ChainId): ApolloClient {
  if (!clientCache.has(chain)) {
    const config = CHAINS[chain];
    if (!config || !config.subgraphUrl) {
      throw new Error(`No subgraph URL configured for chain: ${chain}`);
    }
    clientCache.set(chain, createSubgraphClient(config.subgraphUrl));
  }
  return clientCache.get(chain)!;
}

// Legacy exports for backwards compat
export const subgraphClient = getSubgraphClient('ethereum');

// Aave official API client (chain-agnostic)
const aaveApiLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_AAVE_API_URL,
});

export const aaveClient = new ApolloClient({
  link: aaveApiLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'network-only',
    },
  },
});
