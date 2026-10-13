
import { AlertTriangle, Bell, CheckCircle, Info } from "lucide-react";

function AlertItem({ type, title, message, time }) {
  const icons = {
    error: <AlertTriangle size={16} style={{ color: "var(--red)" }} />,
    warning: <AlertTriangle size={16} style={{ color: "var(--amber)" }} />,
    success: <CheckCircle size={16} style={{ color: "var(--green)" }} />,
    info: <Info size={16} style={{ color: "var(--blue)" }} />,
  };
  const colors = {
    error: { border: "var(--red-dim)", bg: "#1a0808" },
    warning: { border: "var(--amber-dim)", bg: "#1a1206" },
    success: { border: "var(--green-dim)", bg: "#081a10" },
    info: { border: "var(--blue-dim)", bg: "#081420" },
  };
  const style = colors[type] || colors.info;
  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "12px 16px",
      border: `1px solid ${style.border}`,
      borderRadius: "var(--radius-sm)",
      background: style.bg,
      animation: "card-enter 300ms ease-out both",
    }}>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>{icons[type] || icons.info}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{message}</div>
      </div>
      {time && <div style={{ flexShrink: 0, fontSize: "0.72rem", color: "var(--text-xdim)", alignSelf: "flex-start" }}>{time}</div>}
    </div>
  );
}

export default function AlertsPage({ health, error, workers }) {
  const offlineWorkers = workers.filter(w => w.status === "offline");
  const degradedWorkers = workers.filter(w => w.status === "degraded");
  const overloadedWorkers = workers.filter(w => {
    const p = w.capacity > 0 ? w.queued_requests / w.capacity : 0;
    return p > 0.8;
  });

  const alerts = [];

  if (health !== "online") {
    alerts.push({ type: "error", title: "API Connection Unavailable", message: "The AstraPulse backend is not reachable. Ensure FastAPI is running on http://127.0.0.1:8000.", time: "now" });
  }
  if (error) {
    alerts.push({ type: "error", title: "Backend Error", message: error, time: "now" });
  }
  offlineWorkers.forEach(w => {
    alerts.push({ type: "error", title: `Worker Offline: ${w.name || w.worker_id}`, message: `Worker ${w.worker_id} is currently in offline state and cannot accept requests.`, time: "live" });
  });
  degradedWorkers.forEach(w => {
    alerts.push({ type: "warning", title: `Worker Degraded: ${w.name || w.worker_id}`, message: `Worker ${w.worker_id} is operating in degraded mode. Performance may be reduced.`, time: "live" });
  });
  overloadedWorkers.forEach(w => {
    const pct = Math.round((w.queued_requests / w.capacity) * 100);
    alerts.push({ type: "warning", title: `High Queue Pressure: ${w.name || w.worker_id}`, message: `Queue pressure at ${pct}% (${w.queued_requests} queued / ${w.capacity} capacity).`, time: "live" });
  });

  if (health === "online" && !error && alerts.length === 0) {
    alerts.push({ type: "success", title: "All Systems Nominal", message: "No active alerts. API is connected and all workers are operational.", time: "now" });
  }

  return (
    <div>
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">System Alerts</div>
            <div className="panel-subtitle">Active issues detected from the current system state</div>
          </div>
          <span style={{ fontSize: "0.76rem", color: "var(--text-dim)" }}>{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((a, i) => <AlertItem key={i} {...a} />)}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Monitoring Notes</div>
          </div>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", margin: 0 }}>
          AstraPulse alerts are derived from the current live state of the backend. The dashboard polls the API every 5 seconds.
          Worker status, queue depth, and API connectivity are evaluated on each refresh cycle.
          Alerts clear automatically when the underlying condition resolves.
        </p>
        <div className="info-banner" style={{ marginTop: 14, marginBottom: 0 }}>
          <Bell size={15} />
          <span>
            Alert conditions currently monitored: API connectivity, offline workers, degraded workers, high queue pressure (&gt;80% utilization).
          </span>
        </div>
      </section>
    </div>
  );
}
