
import {
  Activity,
  BarChart3,
  ChevronRight,
  CircuitBoard,
  Cpu,
  DollarSign,
  FlaskConical,
  Gauge,
  GitBranch,
  Layers,
  Menu,
  Radio,
  X,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "overview",    label: "Overview",            icon: Gauge,        section: "MONITOR" },
  { id: "live",        label: "Live Monitor",         icon: Activity,     section: null },
  { id: "workers",     label: "Workers",              icon: Cpu,          section: null },
  { id: "requests",    label: "Incoming Requests",    icon: GitBranch,    section: null },
  { id: "scheduling",  label: "Scheduling Decisions", icon: Layers,       section: null },
  { id: "testing",     label: "Testing Phase",        icon: FlaskConical, section: "LAB" },
  { id: "shockwave",   label: "Queue Shockwave",      icon: Radio,        section: null },
  { id: "analytics",   label: "Analytics",            icon: BarChart3,    section: "INSIGHTS" },
  { id: "costs",       label: "Cost Analysis",        icon: DollarSign,   section: null },
  { id: "alerts",      label: "Alerts",               icon: Zap,          section: null },
];

export default function Sidebar({
  activePage,
  onNavigate,
  health,
  sidebarOpen,
  onToggle,
}) {
  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar${sidebarOpen ? " open" : ""}`} aria-label="Main navigation">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="sidebar-logo-icon">
              <CircuitBoard size={18} />
            </div>
            <span className="sidebar-product-name">AstraPulse</span>
          </div>
          <div className="sidebar-product-sub">AI Workload Orchestration</div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav" aria-label="Application sections">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id}>
                {item.section && (
                  <div className="sidebar-section-label">{item.section}</div>
                )}
                <button
                  className={`sidebar-item${activePage === item.id ? " active" : ""}`}
                  onClick={() => {
                    onNavigate(item.id);
                    onToggle && window.innerWidth < 768 && onToggle();
                  }}
                  aria-current={activePage === item.id ? "page" : undefined}
                >
                  <Icon />
                  <span>{item.label}</span>
                  {activePage === item.id && (
                    <ChevronRight size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Footer / status */}
        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className={`sidebar-status-dot${health === "online" ? " online" : ""}`} />
            <span>API {health === "checking" ? "connecting…" : health}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
