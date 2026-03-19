// components/aave-dashboard/ChartWrapper.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

interface ChartWrapperProps {
    title: string;
    badge?: string;
    children: React.ReactNode;
    timeRanges?: number[];
    selectedRange?: number;
    onRangeChange?: (range: number) => void;
    height?: string;
}

export default function ChartWrapper({
    title,
    badge,
    children,
    timeRanges,
    selectedRange,
    onRangeChange,
    height = 'h-72 lg:h-80',
}: ChartWrapperProps) {
    const [expanded, setExpanded] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    const handleScreenshot = useCallback(async () => {
        if (!chartRef.current) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(chartRef.current, {
                backgroundColor: '#0B0D0F',
                scale: 2,
            });
            const link = document.createElement('a');
            link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-chart.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch {
            alert('Screenshot requires html2canvas. Install with: npm i html2canvas');
        }
    }, [title]);

    return (
        <>
            {/* Backdrop when expanded */}
            {expanded && (
                <div
                    className="fixed inset-0 z-40 bg-black/60"
                    onClick={() => setExpanded(false)}
                />
            )}

            <div
                ref={chartRef}
                className={expanded ? 'fixed inset-4 z-50 flex flex-col rounded' : ''}
                style={{
                    background: 'var(--card)',
                    borderRadius: '4px',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{ background: 'var(--panel-header)' }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--accent-orange)' }}>
                            {title}
                        </span>
                        {badge && (
                            <span className="text-[10px] tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                                {badge}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* Time range selectors */}
                        {timeRanges && onRangeChange && (
                            <div className="flex items-center gap-0.5 mr-2">
                                {timeRanges.map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => onRangeChange(range)}
                                        className={`time-btn ${selectedRange === range ? 'active' : ''}`}
                                    >
                                        {range}D
                                    </button>
                                ))}
                            </div>
                        )}
                        {/* Screenshot — camera icon */}
                        <button
                            onClick={handleScreenshot}
                            className="p-1 rounded transition-colors hover:bg-white/5"
                            title="Screenshot"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                            </svg>
                        </button>
                        {/* Expand — fullscreen the entire chart */}
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="p-1 rounded transition-colors hover:bg-white/5"
                            title={expanded ? 'Collapse' : 'Expand'}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                                {expanded ? (
                                    <>
                                        <polyline points="4 14 10 14 10 20" />
                                        <polyline points="20 10 14 10 14 4" />
                                        <line x1="14" y1="10" x2="21" y2="3" />
                                        <line x1="3" y1="21" x2="10" y2="14" />
                                    </>
                                ) : (
                                    <>
                                        <polyline points="15 3 21 3 21 9" />
                                        <polyline points="9 21 3 21 3 15" />
                                        <line x1="21" y1="3" x2="14" y2="10" />
                                        <line x1="3" y1="21" x2="10" y2="14" />
                                    </>
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Chart area with watermark */}
                <div className={`relative ${expanded ? 'flex-1' : height}`}>
                    {children}
                    {/* Watermark — centered like Blockworks */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Image
                            src="/branding/logo-horizontal.png"
                            alt=""
                            width={180}
                            height={45}
                            className="select-none opacity-[0.06]"
                            draggable={false}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
