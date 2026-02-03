// components/aave-dashboard/MetricCard.tsx
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon, TrendingUp } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string;
    change?: number;
    changeLabel?: string;
    subtitle?: string;
}

export function MetricCard({ title, value, change, changeLabel, subtitle }: MetricCardProps) {
    const hasChange = change !== undefined;
    const isPositive = change && change > 0;

    return (
        <Card className="border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="p-4">
                {/* Title */}
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {title}
                    </h3>
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    </div>
                </div>

                {/* Value - Compact */}
                <div className="text-2xl font-bold text-foreground mb-1.5">
                    {value}
                </div>

                {/* Change Indicator */}
                {hasChange && (
                    <div className="flex items-center gap-1.5">
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${isPositive
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                            {isPositive ? (
                                <ArrowUpIcon className="h-3 w-3" />
                            ) : (
                                <ArrowDownIcon className="h-3 w-3" />
                            )}
                            <span>{Math.abs(change).toFixed(2)}%</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {changeLabel || 'from 30d ago'}
                        </span>
                    </div>
                )}

                {/* Subtitle */}
                {subtitle && (
                    <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
                )}
            </CardContent>
        </Card>
    );
}
