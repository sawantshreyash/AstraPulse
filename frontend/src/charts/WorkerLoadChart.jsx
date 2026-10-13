
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Cpu, Gauge, Layers } from "lucide-react";

const STATUS_COLORS = {
  healthy: "#48e0e6",
  degraded: "#ffca70",
  offline: "#ff778b",
};

const TOOLTIP_STYLE = {
  background: "#0b1b2c",
  border: "1px solid #2c5877",
  borderRadius: 12,
  color: "#edf7ff",
  padding: "10px 13px",
  boxShadow: "0 10px 30px #0008",
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div style={TOOLTIP_STYLE}>
      <div
        style={{
          fontWeight: 700,
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            fontSize: 12,
            padding: "3px 0",
          }}
        >
          <span style={{ color: entry.color }}>
            {entry.name}
          </span>

          <strong>
            {entry.value}
            {entry.dataKey === "utilization" ? "%" : ""}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="panel worker-chart-card">
      <div className="worker-chart-heading">
        <div className="worker-chart-icon">
          <Icon size={17} />
        </div>

        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="worker-chart-empty">
      <Activity size={22} />
      <span>No worker telemetry available</span>
      <small>Worker data will appear when available from the API.</small>
    </div>
  );
}

export default function WorkerLoadChart({ workers = [] }) {
  const data = workers
    .filter((worker) => worker && worker.worker_id)
    .map((worker) => {
      const capacity = Math.max(
        0,
        Number(worker.capacity) || 0
      );

      const active = Math.max(
        0,
        Number(worker.active_slots) || 0
      );

      const queued = Math.max(
        0,
        Number(worker.queued_requests) || 0
      );

      const utilization =
        capacity > 0
          ? Math.round((active / capacity) * 100)
          : 0;

      return {
        id: worker.worker_id,
        name: worker.name || worker.worker_id,
        status: worker.status || "unknown",
        capacity,
        active,
        queued,
        utilization,
        color:
          STATUS_COLORS[worker.status] || "#49aaff",
      };
    });

  const totalCapacity = data.reduce(
    (sum, worker) => sum + worker.capacity,
    0
  );

  const totalActive = data.reduce(
    (sum, worker) => sum + worker.active,
    0
  );

  const totalQueued = data.reduce(
    (sum, worker) => sum + worker.queued,
    0
  );

  const overallUtilization =
    totalCapacity > 0
      ? Math.round((totalActive / totalCapacity) * 100)
      : null;

  const chartData = [...data].sort(
    (a, b) => b.utilization - a.utilization
  );

  const queueData = [...data].sort(
    (a, b) => b.queued - a.queued
  );

  if (data.length === 0) {
    return (
      <section className="panel worker-load-panel">
        <div className="worker-load-title">
          <div>
            <div className="panel-title">Worker Intelligence</div>
            <div className="panel-subtitle">
              Capacity utilization and queue pressure
            </div>
          </div>
        </div>

        <EmptyChart />
      </section>
    );
  }

  return (
    <section className="panel worker-load-panel">
      <div className="worker-load-title">
        <div>
          <div className="worker-load-eyebrow">
            INFRASTRUCTURE TELEMETRY
          </div>

          <h2>Worker Intelligence</h2>

          <p>
            Capacity, active slots and pending workload
            across registered workers.
          </p>
        </div>

        <div className="worker-load-live">
          <span className="worker-load-live-dot" />
          API snapshot
        </div>
      </div>

      <div className="worker-load-summary">
        <div className="worker-load-stat">
          <span className="worker-load-stat-icon">
            <Cpu size={15} />
          </span>

          <div>
            <span>Workers</span>
            <strong>{data.length}</strong>
          </div>
        </div>

        <div className="worker-load-stat">
          <span className="worker-load-stat-icon">
            <Gauge size={15} />
          </span>

          <div>
            <span>Capacity used</span>
            <strong>
              {overallUtilization === null
                ? "—"
                : `${overallUtilization}%`}
            </strong>
          </div>
        </div>

        <div className="worker-load-stat">
          <span className="worker-load-stat-icon">
            <Layers size={15} />
          </span>

          <div>
            <span>Active / Capacity</span>
            <strong>
              {totalActive} / {totalCapacity}
            </strong>
          </div>
        </div>

        <div className="worker-load-stat">
          <span className="worker-load-stat-icon">
            <Activity size={15} />
          </span>

          <div>
            <span>Queued requests</span>
            <strong>{totalQueued}</strong>
          </div>
        </div>
      </div>

      <div className="worker-load-charts">
        <ChartCard
          icon={Gauge}
          title="Capacity utilization"
          subtitle="Active slots ÷ worker capacity"
        >
          <div className="worker-load-chart-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 20,
                  bottom: 5,
                  left: 4,
                }}
                barCategoryGap="25%"
              >
                <CartesianGrid
                  stroke="#294159"
                  strokeDasharray="4 5"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: "#89a8c2", fontSize: 10 }}
                  axisLine={{ stroke: "#294159" }}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={94}
                  tick={{
                    fill: "#b6cde0",
                    fontSize: 10,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "#48aaff0b" }}
                />

                <Bar
                  dataKey="utilization"
                  name="Utilization"
                  radius={[0, 5, 5, 0]}
                  maxBarSize={22}
                  background={{ fill: "#14283b" }}
                >
                  {chartData.map((worker) => (
                    <Cell
                      key={worker.id}
                      fill={
                        worker.utilization >= 90
                          ? "#ff778b"
                          : worker.utilization >= 70
                            ? "#ffca70"
                            : "#49aaff"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="worker-chart-legend">
            <span><i className="legend-blue" /> Normal</span>
            <span><i className="legend-amber" /> High ≥ 70%</span>
            <span><i className="legend-red" /> Critical ≥ 90%</span>
          </div>
        </ChartCard>

        <ChartCard
          icon={Layers}
          title="Queue pressure"
          subtitle="Pending requests by worker"
        >
          <div className="worker-load-chart-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={queueData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 20,
                  bottom: 5,
                  left: 4,
                }}
                barCategoryGap="25%"
              >
                <CartesianGrid
                  stroke="#294159"
                  strokeDasharray="4 5"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "#89a8c2", fontSize: 10 }}
                  axisLine={{ stroke: "#294159" }}
                  tickLine={false}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={94}
                  tick={{
                    fill: "#b6cde0",
                    fontSize: 10,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "#48aaff0b" }}
                />

                <Bar
                  dataKey="queued"
                  name="Queued requests"
                  radius={[0, 5, 5, 0]}
                  maxBarSize={22}
                  background={{ fill: "#14283b" }}
                >
                  {queueData.map((worker) => (
                    <Cell
                      key={worker.id}
                      fill={
                        worker.queued > 0
                          ? worker.color
                          : "#34506a"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="worker-chart-legend">
            <span>
              <i className="legend-cyan" />
              Queued requests
            </span>
            <span>
              <i className="legend-muted" />
              No queued requests
            </span>
          </div>
        </ChartCard>
      </div>

      <p className="worker-load-footnote">
        Utilization is calculated from active slots and configured
        capacity. Queue pressure represents queued requests, not
        CPU usage. These charts reflect the worker data supplied
        by the current API snapshot.
      </p>
    </section>
  );
}
