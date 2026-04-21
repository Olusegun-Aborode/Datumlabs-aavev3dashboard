import AaveShell from '@/components/shell/AaveShell';
import EmailGate from '@/components/shell/EmailGate';

const DASHBOARD_NAME = 'Aave Risk Terminal';

const SECTIONS = [
  {
    label: 'Terminals',
    items: [
      { href: '/dashboard/overview', label: 'Overview', icon: '◆' },
      { href: '/dashboard/markets', label: 'Markets', icon: '▦' },
      { href: '/dashboard/wallets', label: 'Wallets', icon: '≈' },
      { href: '/dashboard/liquidations', label: 'Liquidations', icon: '▲' },
      { href: '/dashboard/insights', label: 'Insights', icon: '§' },
    ],
  },
];

/**
 * Dashboard layout — wraps every /dashboard/* route in:
 *  - EmailGate (production only; dev is never gated)
 *  - AaveShell (topbar with VersionSwitcher, sidebar with version-aware
 *    links, statusbar)
 *
 * Gate + shell read body data-attrs for theme/density, set before paint by
 * the inline boot script in app/layout.tsx.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <EmailGate
      dashboardName={DASHBOARD_NAME}
      disabled={isDev}
      features={[
        'Per-asset markets across Aave V3 & V4',
        'Wallet health-factor watchlist',
        'Live liquidation event feed',
        'Cross-version insights and comparisons',
      ]}
    >
      <AaveShell dashboardName={DASHBOARD_NAME} sections={SECTIONS}>
        {children}
      </AaveShell>
    </EmailGate>
  );
}
