# Aave V3 Ethereum Risk Dashboard

A professional-grade risk analytics dashboard for Aave V3 on Ethereum, built with Next.js, React Query, and The Graph.

## 🚀 Features

- **Overview Page**: Protocol-wide metrics, historical trends, and revenue tracking
- **Markets Page**: Individual lending market analysis with APYs and utilization rates
- **Wallets Page**: User position tracking with health factor calculations
- **Liquidations Page**: Historical liquidation events and asset distribution

## 🛠️ Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: Tailwind CSS + shadcn/ui
- **Data Fetching**: React Query + Apollo Client (GraphQL)
- **Charts**: Recharts
- **Data Sources**: The Graph Subgraph + Aave API

## 📋 Prerequisites

- Node.js 18+ installed
- The Graph API key (free from https://thegraph.com/studio)

## 🔧 Setup Instructions

### 1. Get The Graph API Key

1. Visit https://thegraph.com/studio
2. Sign up or log in
3. Create a new API key
4. Copy your API key

### 2. Configure Environment Variables

Open `.env.local` and replace `your_api_key_here` with your actual API key:

```env
NEXT_PUBLIC_THEGRAPH_API_KEY="your_actual_api_key_here"
```

### 3. Run the Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see your dashboard!

## 📁 Project Structure

```
aave-dashboard/
├── app/
│   ├── api/aave/          # API routes for data fetching
│   │   ├── overview/
│   │   ├── markets/
│   │   ├── wallets/
│   │   └── liquidations/
│   ├── dashboard/         # Dashboard pages
│   │   ├── overview/
│   │   ├── markets/
│   │   ├── wallets/
│   │   └── liquidations/
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Home page (redirects to dashboard)
├── components/
│   ├── ui/                # shadcn/ui components
│   └── aave-dashboard/    # Custom dashboard components
├── lib/
│   └── aave/              # GraphQL clients, queries, and helpers
└── .env.local             # Environment variables
```

## 🎯 How It Works

### Data Flow

1. **Frontend** (React components) requests data using React Query
2. **API Routes** (Next.js) fetch from GraphQL sources with caching
3. **Data Sources**:
   - The Graph Subgraph: Historical data and events
   - Aave API: Real-time market data

### Caching Strategy

- **Client-side**: React Query caches for 15-30 seconds
- **Server-side**: In-memory cache with configurable TTLs
  - Markets: 60 seconds
  - Wallets: 120 seconds
  - Overview/Liquidations: 300 seconds

## 🔍 Key Features Explained

### Overview Page
- Total supply, borrows, and TVL metrics
- 30-day percentage changes
- 90-day historical trend charts
- Protocol and supply-side revenue

### Markets Page
- All active lending markets
- Real-time APYs (supply and borrow)
- Utilization rates with visual indicators
- Asset prices and total values

### Wallets Page
- User positions with pagination
- Health factor calculations
- Risk categorization (Safe, Moderate, High Risk)
- Collateral and debt tracking

### Liquidations Page
- Recent liquidation events
- Liquidations by asset (chart)
- Pagination for historical data
- Summary statistics

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Visit https://vercel.com
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy!

## 📊 Data Sources

- **The Graph Subgraph**: `JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk`
- **Aave API**: `https://api.v3.aave.com/graphql`

## 🤝 Contributing

This is a learning project! Feel free to:
- Add new features
- Improve the UI/UX
- Optimize performance
- Add more analytics

## 📝 License

MIT

## 🙏 Acknowledgments

- Aave Protocol for the amazing DeFi platform
- The Graph for decentralized data indexing
- shadcn/ui for beautiful components
