"use client";

interface TuiPanelProps {
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function TuiPanel({
  title,
  badge,
  children,
  className = "",
  noPadding = false,
}: TuiPanelProps) {
  return (
    <div className={`tui-panel ${className}`}>
      <div className="tui-panel-header">
        <span className="tui-panel-title">{title}</span>
        {badge && <span className="tui-panel-badge">{badge}</span>}
      </div>
      <div className={noPadding ? "" : "p-4 lg:p-5"}>{children}</div>
    </div>
  );
}

export function TuiDivider({ label }: { label?: string }) {
  if (!label) {
    return <div className="tui-divider" />;
  }
  return (
    <div className="tui-divider-labeled">
      <span className="tui-divider-label">{label}</span>
    </div>
  );
}

export function TuiStatusDot({
  status = "live",
}: {
  status?: "live" | "stale" | "error";
}) {
  const colors = {
    live: "bg-[#FF6B35]",
    stale: "bg-[#FFD700]",
    error: "bg-[#FF4444]",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${colors[status]} ${status === "live" ? "animate-pulse" : ""}`}
      />
      {status === "live" ? "LIVE" : status === "stale" ? "STALE" : "ERR"}
    </span>
  );
}
