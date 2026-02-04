
const SUBGRAPH_URL = "https://gateway.thegraph.com/api/subgraphs/id/JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk?api_key=7b7873784f0d9c7f3c20087d251621f8";

const GET_MARKETS = `
  query GetMarkets {
    markets(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
      id
      name
      rates {
        rate
        side
        type
      }
      totalValueLockedUSD
      totalBorrowBalanceUSD
      totalDepositBalanceUSD
    }
  }
`;

async function main() {
  try {
    const response = await fetch("https://gateway.thegraph.com/api/subgraphs/id/JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 7b7873784f0d9c7f3c20087d251621f8'
      },
      body: JSON.stringify({ query: GET_MARKETS }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error("GraphQL Errors:", result.errors);
      return;
    }

    const markets = result.data.markets;
    console.log("Fetched Markets Data:");
    console.log(JSON.stringify(markets, null, 2));

  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

main();
