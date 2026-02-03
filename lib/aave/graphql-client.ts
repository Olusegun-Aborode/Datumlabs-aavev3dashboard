// lib/aave/graphql-client.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

// Create HTTP link for Aave's official GraphQL API
const aaveApiLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_AAVE_API_URL,
});

// Create HTTP link for The Graph subgraph with authentication
const subgraphLink = createHttpLink({
  uri: process.env.THEGRAPH_SUBGRAPH_URL,
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_THEGRAPH_API_KEY}`,
  },
});

// Apollo Client for Aave API (real-time market data)
export const aaveClient = new ApolloClient({
  link: aaveApiLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'network-only', // Always fetch fresh data
    },
  },
});

// Apollo Client for The Graph subgraph (historical data)
export const subgraphClient = new ApolloClient({
  link: subgraphLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'network-only', // Always fetch fresh data
    },
  },
});
