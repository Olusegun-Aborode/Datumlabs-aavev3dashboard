// lib/aave/graphql-client.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

const API_KEY = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;

// Chain configurations with subgraph type
export const CHAINS: Record<string, { name: string; shortName: string; subgraphUrl: string; subgraphType: 'messari' | 'aave' }> = {
  ethereum: {
    name: 'Ethereum',
    shortName: 'ETH',
    subgraphUrl: process.env.THEGRAPH_SUBGRAPH_URL || '',
    subgraphType: 'messari',
  },
  arbitrum: {
    name: 'Arbitrum',
    shortName: 'ARB',
    subgraphUrl: process.env.THEGRAPH_ARBITRUM_SUBGRAPH_URL || '',
    subgraphType: 'messari',
  },
  base: {
    name: 'Base',
    shortName: 'BASE',
    subgraphUrl: process.env.THEGRAPH_BASE_SUBGRAPH_URL || '',
    subgraphType: 'messari',
  },
  optimism: {
    name: 'Optimism',
    shortName: 'OP',
    subgraphUrl: process.env.THEGRAPH_OPTIMISM_SUBGRAPH_URL || '',
    subgraphType: 'messari',
  },
  polygon: {
    name: 'Polygon',
    shortName: 'POLY',
    subgraphUrl: process.env.THEGRAPH_POLYGON_SUBGRAPH_URL || '',
    subgraphType: 'messari',
  },
  avalanche: {
    name: 'Avalanche',
    shortName: 'AVAX',
    subgraphUrl: process.env.THEGRAPH_AVALANCHE_SUBGRAPH_URL || '',
    subgraphType: 'messari',
  },
  bnb: {
    name: 'BNB Chain',
    shortName: 'BNB',
    subgraphUrl: process.env.THEGRAPH_BNB_SUBGRAPH_URL || '',
    subgraphType: 'aave',
  },
  gnosis: {
    name: 'Gnosis',
    shortName: 'GNOSIS',
    subgraphUrl: process.env.THEGRAPH_GNOSIS_SUBGRAPH_URL || '',
    subgraphType: 'aave',
  },
  linea: {
    name: 'Linea',
    shortName: 'LINEA',
    subgraphUrl: process.env.THEGRAPH_LINEA_SUBGRAPH_URL || '',
    subgraphType: 'aave',
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
