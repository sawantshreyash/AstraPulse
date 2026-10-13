
import { RefreshCw } from "lucide-react";

const PAGE_TITLES = {
  overview:   { eyebrow: "DASHBOARD", title: "Overview", subtitle: "System health and performance at a glance" },
  live:       { eyebrow: "REAL-TIME", title: "Live Monitor", subtitle: "Simulation time, routing decisions and worker registry" },
  workers:    { eyebrow: "INFRASTRUCTURE", title: "Workers", subtitle: "Manage worker nodes, capacity and lifecycle" },
  requests:   { eyebrow: "INGESTION", title: "Incoming Requests", subtitle: "Route inference requests through the scheduling pipeline" },
  scheduling: { eyebrow: "PIPELINE", title: "Scheduling Decisions", subtitle: "Policy comparison and benchmark execution" },
  testing:    { eyebrow: "VALIDATION", title: "Testing Phase", subtitle: "Run scenarios and the automated scenario lab" },
  shockwave:  { eyebrow: "DIAGNOSTICS", title: "Queue Shockwave", subtitle: "Worker queue pressure and burst visualization" },
  analytics:  { eyebrow: "ANALYSIS", title: "Analytics", subtitle: "Performance trends and policy comparison charts" },
  costs:      { eyebrow: "FINANCIAL", title: "Cost Analysis", subtitle: "Estimated synthetic compute costs by policy" },
  alerts:     { eyebrow: "ALERTS", title: "Alerts", subtitle: "System notifications and status warnings" },
};

export default function WorkspaceHeader({
  activePage,
  health,
  refreshing,
  onRefresh,
}) {
  const meta = PAGE_TITLES[activePage] || PAGE_TITLES.overview;

  return (
    <header className="workspace-header">
      <div>
        <div className="workspace-breadcrumb">{meta.eyebrow}</div>
        <div className="workspace-title">{meta.title}</div>
      </div>

      <div className="workspace-header-right">
        <div className={`api-status-chip${health === "online" ? " online" : ""}`}>
          <span className="status-dot" />
          <span>API {health === "checking" ? "…" : health}</span>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh data"
        >
          <RefreshCw size={13} className={refreshing ? "spin-icon" : ""} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>
    </header>
  );
}
