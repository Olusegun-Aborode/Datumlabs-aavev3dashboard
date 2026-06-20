import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Health probe for datum-monitor. Intentionally dependency-free — this must
// succeed even if downstream GraphQL endpoints are throttled, so the monitor
// can distinguish "dashboard is up, upstream data source flaky" from
// "dashboard is down".
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'aave-dashboard',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
