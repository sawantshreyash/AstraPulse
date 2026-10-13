
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  astrapulse: "#49aaff",
  round_robin: "#48e0e6",
  least_loaded: "#8d9cff",
};

const POLICY_NAMES = {
  astrapulse: "AstraPulse",
  round_robin: "Round-Robin",
  least_loaded: "Least-Loaded",
};

const TOOLTIP_STYLE = {
  background: "#0b1b2c",
  border: "1px solid #2c5877",
  borderRadius: 12,
  padding: "10px 14px",
  color: "#edf7ff",
  boxShadow: "0 10px 30px #0008",
};

const AXIS_TICK = {
  fill: "#89a8c2",
  fontSize: 11,
};

const GRID_COLOR = "#294159";

function policyName(policy) {
  return POLICY_NAMES[policy] ?? policy ?? "Unknown";
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">{title}</div>
          <p className="panel-subtitle">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">No chart data available</p>
      <p className="empty-state-text">{message}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div style={TOOLTIP_STYLE}>
      <div
        style={{
          color: "#9bb8d1",
          fontSize: 11,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      {payload.map((item) => (
        <div
          key={item.dataKey}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            padding: "3px 0",
            fontSize: 12,
          }}
        >
          <span style={{ color: item.color }}>
            {item.name}
          </span>
          <strong>
            {Number.isFinite(Number(item.value))
              ? Number(item.value).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "—"}
            {item.unit ?? ""}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function BenchmarkChart({ results }) {
  const validResults = Array.isArray(results)
    ? results.filter(
        (result) =>
          result &&
          (Number.isFinite(result.p50_latency_ms) ||
            Number.isFinite(result.p95_latency_ms))
      )
    : [];

  const latencyData = validResults.map((result) => ({
    policy: policyName(result.policy),
    p50: Number.isFinite(result.p50_latency_ms)
      ? result.p50_latency_ms
      : null,
    p95: Number.isFinite(result.p95_latency_ms)
      ? result.p95_latency_ms
      : null,
  }));

  const throughputData = Array.isArray(results)
    ? results
        .filter(
          (result) =>
            result &&
            Number.isFinite(result.throughput)
        )
        .map((result) => ({
          policy: policyName(result.policy),
          throughput: result.throughput,
          color: COLORS[result.policy] ?? "#49aaff",
        }))
    : [];

  const distributionData = Array.isArray(results)
    ? results
        .filter(
          (result) =>
            result &&
            (Number.isFinite(result.p50_latency_ms) ||
              Number.isFinite(result.p95_latency_ms))
        )
        .map((result) => ({
          policy: policyName(result.policy),
          p50: Number.isFinite(result.p50_latency_ms)
            ? result.p50_latency_ms
            : null,
          p95: Number.isFinite(result.p95_latency_ms)
            ? result.p95_latency_ms
            : null,
        }))
    : [];

  if (!Array.isArray(results) || results.length === 0) {
    return (
      <EmptyChart
        message="Run a benchmark from Scheduling Decisions to populate these charts with measured simulation results."
      />
    );
  }

  return (
    <div className="benchmark-charts">
      <div className="benchmark-chart-grid">
        <ChartPanel
          title="Latency comparison"
          subtitle="Median and tail latency by scheduling policy"
        >
          {latencyData.length === 0 ? (
            <EmptyChart message="No valid latency measurements were returned." />
          ) : (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={290}>
                <BarChart
                  data={latencyData}
                  margin={{
                    top: 12,
                    right: 8,
                    left: -15,
                    bottom: 5,
                  }}
                  barGap={7}
                  barCategoryGap="25%"
                >
                  <defs>
                    <linearGradient
                      id="astraP50Gradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#63c4ff" />
                      <stop offset="100%" stopColor="#2676d0" />
                    </linearGradient>

                    <linearGradient
                      id="astraP95Gradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#70f1ed" />
                      <stop offset="100%" stopColor="#188caa" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke={GRID_COLOR}
                    strokeDasharray="4 5"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="policy"
                    tick={AXIS_TICK}
                    axisLine={{ stroke: GRID_COLOR }}
                    tickLine={false}
                    interval={0}
                  />

                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    unit=" ms"
                    width={65}
                  />

                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "#48aaff0b" }}
                  />

                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{
                      fontSize: 11,
                      paddingBottom: 18,
                    }}
                  />

                  <Bar
                    dataKey="p50"
                    name="P50 latency"
                    fill="url(#astraP50Gradient)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={42}
                  />

                  <Bar
                    dataKey="p95"
                    name="P95 latency"
                    fill="url(#astraP95Gradient)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>

              <p className="chart-note">
                Lower latency is better. P95 represents the
                95th-percentile response time.
              </p>
            </div>
          )}
        </ChartPanel>

        <ChartPanel
          title="Throughput"
          subtitle="Completed requests per simulated second"
        >
          {throughputData.length === 0 ? (
            <EmptyChart message="The latest benchmark did not provide valid throughput values." />
          ) : (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={290}>
                <BarChart
                  data={throughputData}
                  margin={{
                    top: 15,
                    right: 12,
                    left: -15,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    stroke={GRID_COLOR}
                    strokeDasharray="4 5"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="policy"
                    tick={AXIS_TICK}
                    axisLine={{ stroke: GRID_COLOR }}
                    tickLine={false}
                    interval={0}
                  />

                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />

                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "#48aaff0b" }}
                  />

                  <Bar
                    dataKey="throughput"
                    name="Requests / second"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={58}
                  >
                    {throughputData.map((entry) => (
                      <Cell
                        key={entry.policy}
                        fill={entry.color}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <p className="chart-note">
                Higher throughput is better when comparing the
                same workload and simulation conditions.
              </p>
            </div>
          )}
        </ChartPanel>
      </div>

      <ChartPanel
        title="Latency profile"
        subtitle="Compare typical response time with tail latency"
      >
        {distributionData.length === 0 ? (
          <EmptyChart message="No latency profile is available for this run." />
        ) : (
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={distributionData}
                layout="vertical"
                margin={{
                  top: 8,
                  right: 22,
                  left: 16,
                  bottom: 8,
                }}
                barGap={5}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  stroke={GRID_COLOR}
                  strokeDasharray="4 5"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  tick={AXIS_TICK}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                  unit=" ms"
                />

                <YAxis
                  type="category"
                  dataKey="policy"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />

                <Tooltip content={<ChartTooltip />} />

                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{
                    fontSize: 11,
                    paddingBottom: 18,
                  }}
                />

                <Bar
                  dataKey="p50"
                  name="P50"
                  fill="#49aaff"
                  radius={[0, 5, 5, 0]}
                  maxBarSize={22}
                />

                <Bar
                  dataKey="p95"
                  name="P95"
                  fill="#48e0e6"
                  radius={[0, 5, 5, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>

            <p className="chart-note">
              A large gap between P50 and P95 can indicate
              inconsistent response times. Evaluate this alongside
              deadline misses and workload conditions.
            </p>
          </div>
        )}
      </ChartPanel>
    </div>
  );
}
