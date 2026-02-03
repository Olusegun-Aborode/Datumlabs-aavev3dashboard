#!/bin/bash

# Add all environment variables to Vercel production

echo "Adding environment variables to Vercel..."

# The Graph API Key (public)
echo "/aave-dashboard
7b7873784f0d9c7f3c20087d251621f8" | vercel env add NEXT_PUBLIC_THEGRAPH_API_KEY production

# Aave API URL (public)
echo "/aave-dashboard
https://api.v3.aave.com/graphql" | vercel env add NEXT_PUBLIC_AAVE_API_URL production

# The Graph Subgraph URL (server-side)
echo "/aave-dashboard
https://gateway.thegraph.com/api/subgraphs/id/JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk" | vercel env add THEGRAPH_SUBGRAPH_URL production

# Cache TTL values (server-side)
echo "/aave-dashboard
60" | vercel env add CACHE_TTL_MARKETS production

echo "/aave-dashboard
120" | vercel env add CACHE_TTL_WALLETS production

echo "/aave-dashboard
300" | vercel env add CACHE_TTL_OVERVIEW production

echo "/aave-dashboard
300" | vercel env add CACHE_TTL_LIQUIDATIONS production

echo "✅ All environment variables added!"
