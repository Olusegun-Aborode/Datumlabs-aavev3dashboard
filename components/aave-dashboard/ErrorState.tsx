// components/aave-dashboard/ErrorState.tsx
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
    message?: string;
}

export function ErrorState({ message = 'Failed to load data' }: ErrorStateProps) {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-2 text-center">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <h3 className="text-lg font-semibold">Error</h3>
                <p className="text-sm text-muted-foreground max-w-md">{message}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    Retry
                </button>
            </div>
        </div>
    );
}
