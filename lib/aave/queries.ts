// lib/aave/queries.ts
import { gql } from '@apollo/client';

/**
 * Lightweight query for total pool count only.
 * Used by the overview page (TVL/revenue data now comes from DeFi Llama).
 */
export const GET_POOL_COUNT = gql`
  query GetPoolCount {
    lendingProtocols(first: 1) {
      totalPoolCount
    }
  }
`;

/**
 * Query for protocol metrics used by the Wallets page.
 * Fetches TVL, borrow balance, and unique user count.
 */
export const GET_PROTOCOL_METRICS = gql`
  query GetProtocolMetrics {
    lendingProtocols(first: 1) {
      totalValueLockedUSD
      totalBorrowBalanceUSD
      cumulativeUniqueUsers
    }
  }
`;

/**
 * Query for all lending markets used on the Markets page
 * Fetches market details including rates, TVL, and token information
 */
export const GET_MARKETS = gql`
  query GetMarkets {
    markets(first: 100, orderBy: totalValueLockedUSD, orderDirection: desc) {
      id
      name
      inputToken {
        id
        name
        symbol
        decimals
      }
      totalValueLockedUSD
      totalBorrowBalanceUSD
      totalDepositBalanceUSD
      inputTokenPriceUSD
      rates {
        rate
        side
        type
      }
    }
  }
`;

/**
 * Query for user accounts and their positions used on the Wallets page
 * Supports pagination with $first and $skip parameters
 */
export const GET_ACCOUNTS = gql`
  query GetAccounts($first: Int!, $skip: Int!) {
    accounts(first: $first, skip: $skip, orderBy: id, orderDirection: asc) {
      id
      positionCount
      openPositionCount
      positions(where: { balance_gt: "0" }) {
        id
        balance
        side
        market {
          id
          name
          inputToken {
            id
            symbol
            decimals
          }
          inputTokenPriceUSD
        }
      }
    }
  }
`;

/**
 * Query for liquidation events used on the Liquidations page
 * Supports pagination with $first and $skip parameters
 */
export const GET_LIQUIDATIONS = gql`
  query GetLiquidations($first: Int!, $skip: Int!) {
    liquidates(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
      id
      hash
      timestamp
      amount
      amountUSD
      profitUSD
      liquidator {
        id
      }
      liquidatee {
        id
      }
      asset {
        id
        symbol
        name
      }
      market {
        id
        name
      }
    }
  }
`;

// ──────────────────────────────────────────────
// Aave Official Subgraph Queries
// Used for chains without Messari subgraphs (BNB, Gnosis, Linea)
// ──────────────────────────────────────────────

export const GET_AAVE_MARKETS = gql`
  query GetAaveMarkets {
    reserves(first: 100, orderBy: totalLiquidity, orderDirection: desc) {
      id
      symbol
      name
      decimals
      totalLiquidity
      totalCurrentVariableDebt
      availableLiquidity
      liquidityRate
      variableBorrowRate
      reserveLiquidationThreshold
      price {
        priceInEth
      }
    }
  }
`;

export const GET_AAVE_ACCOUNTS = gql`
  query GetAaveAccounts($first: Int!, $skip: Int!) {
    users(first: $first, skip: $skip, orderBy: id, orderDirection: asc) {
      id
      reserves(where: { currentATokenBalance_gt: "0" }) {
        currentATokenBalance
        currentVariableDebt
        reserve {
          symbol
          name
          decimals
          price {
            priceInEth
          }
          reserveLiquidationThreshold
        }
      }
    }
  }
`;

export const GET_AAVE_LIQUIDATIONS = gql`
  query GetAaveLiquidations($first: Int!, $skip: Int!) {
    liquidationCalls(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
      id
      txHash
      timestamp
      collateralAmount
      principalAmount
      collateralReserve {
        symbol
        name
        decimals
        price {
          priceInEth
        }
      }
      principalReserve {
        symbol
        name
      }
      liquidator
      user {
        id
      }
      collateralAssetPriceUSD
      borrowAssetPriceUSD
    }
  }
`;

export const GET_AAVE_POOL_COUNT = gql`
  query GetAavePoolCount {
    reserves {
      id
    }
  }
`;
