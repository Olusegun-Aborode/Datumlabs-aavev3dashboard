// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, // Data is fresh for 60 seconds
                gcTime: 5 * 60 * 1000, // Cache persists for 5 minutes
                refetchOnWindowFocus: false, // Don't refetch when window regains focus
                retry: 2, // Retry failed requests twice
                retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
