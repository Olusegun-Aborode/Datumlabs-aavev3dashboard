// lib/aave/queries.ts
import { gql } from '@apollo/client';

/**
 * Query for protocol-wide data used on the Overview page
 * Fetches lending protocol metrics and 90 days of historical snapshots
 */
export const GET_PROTOCOL_DATA = gql`
  query GetProtocolData {
    lendingProtocols(first: 1) {
      id
      name
      totalValueLockedUSD
      totalBorrowBalanceUSD
      totalPoolCount
      cumulativeSupplySideRevenueUSD
      cumulativeProtocolSideRevenueUSD
    }
    financialsDailySnapshots(first: 90, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      totalValueLockedUSD
      totalBorrowBalanceUSD
      dailySupplySideRevenueUSD
      dailyProtocolSideRevenueUSD
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
