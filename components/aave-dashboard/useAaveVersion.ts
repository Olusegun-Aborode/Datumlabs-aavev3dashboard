// components/aave-dashboard/useAaveVersion.ts
// Reads/writes the active Aave protocol version from the URL search param
// (?version=v3|v4|all). Using the URL rather than React state means the
// current view is shareable and survives refreshes.
'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseVersion, type AaveVersion } from '@/lib/aave/version';

export function useAaveVersion(): {
    version: AaveVersion;
    setVersion: (next: AaveVersion) => void;
} {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const version = parseVersion(searchParams.get('version'));

    const setVersion = useCallback(
        (next: AaveVersion) => {
            const params = new URLSearchParams(searchParams.toString());
            if (next === 'v3') {
                // v3 is the default — strip the param to keep URLs clean.
                params.delete('version');
            } else {
                params.set('version', next);
            }
            const qs = params.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname);
        },
        [router, pathname, searchParams],
    );

    return { version, setVersion };
}
