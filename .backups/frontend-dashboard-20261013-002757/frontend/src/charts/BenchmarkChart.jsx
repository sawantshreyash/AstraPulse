import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  AstraPulse: "#8b9cff",
  "Round-Robin": "#50d6b1",
  "Least-Loaded": "#f4bd67",
};

function labelFor(policy) {
  return policy === "astrapulse"
    ? "AstraPulse"
    : policy === "round_robin"
      ? "Round-Robin"
      : "Least-Loaded";
}

export default function BenchmarkChart({ results }) {
  const data = results.map((result) => ({
    policy: labelFor(result.policy),
    p50: result.p50_latency_ms ?? 0,
    p95: result.p95_latency_ms ?? 0,
    missRate: Number((result.deadline_miss_rate * 100).toFixed(2)),
  }));

  return (
    <div className="chart-shell" aria-label="Benchmark latency chart">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#273653" vertical={false} />
          <XAxis dataKey="policy" tick={{ fill: "#aab7d1", fontSize: 12 }} />
          <YAxis tick={{ fill: "#8492ad", fontSize: 12 }} unit=" ms" />
          <Tooltip
            contentStyle={{
              background: "#121a2c",
              border: "1px solid #344361",
              borderRadius: 8,
              color: "#e8edf8",
            }}
          />
          <Legend />
          <Bar dataKey="p50" name="p50 latency" fill="#8b9cff" radius={[4, 4, 0, 0]} />
          <Bar dataKey="p95" name="p95 latency" fill="#50d6b1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="chart-note">Measured simulated latency; lower is better.</p>
    </div>
  );
}