'use client';

export function LoadingState() {
    return (
        <div className="space-y-4">
            {/* Skeleton counters */}
            <div className="tui-panel">
                <div className="tui-panel-header">
                    <span className="tui-panel-title">Loading</span>
                    <span className="tui-panel-badge cursor-blink">Fetching data</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className={`p-4 lg:p-5 ${i < 3 ? "border-r" : ""}`}
                            style={{ borderColor: "var(--border)" }}
                        >
                            <div className="h-3 w-20 skeleton mb-2" />
                            <div className="h-7 w-28 skeleton" />
                        </div>
                    ))}
                </div>
            </div>
            {/* Skeleton panel */}
            <div className="tui-panel">
                <div className="tui-panel-header">
                    <div className="h-3 w-32 skeleton" />
                </div>
                <div className="p-4 lg:p-5 space-y-3">
                    <div className="h-4 w-full skeleton" />
                    <div className="h-4 w-3/4 skeleton" />
                    <div className="h-48 w-full skeleton" />
                </div>
            </div>
        </div>
    );
}
