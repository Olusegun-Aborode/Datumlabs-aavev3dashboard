// components/aave-dashboard/LoadingState.tsx
export function LoadingState() {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">Loading data...</p>
            </div>
        </div>
    );
}

export function LoadingSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 bg-muted animate-pulse rounded-lg"></div>
                ))}
            </div>
            <div className="h-96 bg-muted animate-pulse rounded-lg"></div>
        </div>
    );
}
