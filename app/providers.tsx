// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 15 * 1000, // Data is fresh for 15 seconds
                gcTime: 30 * 1000, // Cache persists for 30 seconds (formerly cacheTime)
                refetchOnWindowFocus: false, // Don't refetch when window regains focus
                retry: 1, // Retry failed requests once
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
