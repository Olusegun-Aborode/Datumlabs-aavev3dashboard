// components/aave-dashboard/VersionSwitcher.tsx
// Pill-group selector for v3 / v4 / all. Lives in the dashboard nav bar.
'use client';

import { useAaveVersion } from './useAaveVersion';
import { AAVE_VERSIONS, type AaveVersion } from '@/lib/aave/version';

const LABELS: Record<AaveVersion, string> = {
    v3: 'V3',
    v4: 'V4',
    all: 'ALL',
};

export default function VersionSwitcher() {
    const { version, setVersion } = useAaveVersion();

    return (
        <div
            className="flex items-center rounded overflow-hidden"
            style={{ border: '1px solid var(--border-bright)' }}
            role="group"
            aria-label="Aave protocol version"
        >
            {AAVE_VERSIONS.map((v) => {
                const active = version === v;
                return (
                    <button
                        key={v}
                        type="button"
                        onClick={() => setVersion(v)}
                        className="px-2 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors"
                        style={{
                            background: active ? 'var(--accent-orange)' : 'var(--card)',
                            color: active ? '#ffffff' : 'var(--text-muted)',
                            minWidth: '32px',
                        }}
                        aria-pressed={active}
                    >
                        {LABELS[v]}
                    </button>
                );
            })}
        </div>
    );
}
