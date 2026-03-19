// lib/aave/helpers.ts

/**
 * Format large numbers into readable currency strings
 * Examples: 1,234,567,890 -> "$1.23B", 1,234,567 -> "$1.23M"
 */
export function formatCurrency(value: number | null | undefined): string {
    if (value == null || isNaN(value)) return '$0.00';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
}

/**
 * Format percentage values
 * Example: 0.0523 -> "5.23%"
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 2): string {
    if (value == null || isNaN(value)) return '0.00%';
    return `${value.toFixed(decimals)}%`;
}

/**
 * Format wallet addresses for display
 * Example: "0x1234...5678"
 */
export function formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Convert Ray format (27 decimals) to decimal
 * Aave uses Ray format for interest rates
 */
export function rayToDecimal(ray: string | number): number {
    const rayValue = typeof ray === 'string' ? parseFloat(ray) : ray;
    return rayValue / 1e27;
}

/**
 * Calculate health factor for a user position
 * Health Factor = (Collateral * Liquidation Threshold) / Debt
 * < 1.0 = Can be liquidated
 * > 1.0 = Safe
 */
export function calculateHealthFactor(
    collateralUSD: number,
    debtUSD: number,
    liquidationThreshold: number = 0.85
): number {
    if (debtUSD === 0) return Infinity;
    return (collateralUSD * liquidationThreshold) / debtUSD;
}

/**
 * Get health factor status and color
 */
export function getHealthFactorStatus(healthFactor: number): {
    status: string;
    color: string;
} {
    if (healthFactor === Infinity) return { status: 'No Debt', color: 'text-gray-500' };
    if (healthFactor < 1.1) return { status: 'High Risk', color: 'text-red-600' };
    if (healthFactor < 1.5) return { status: 'Moderate Risk', color: 'text-yellow-600' };
    return { status: 'Safe', color: 'text-green-600' };
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Format timestamp to readable date and time
 */
export function formatDateTime(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
