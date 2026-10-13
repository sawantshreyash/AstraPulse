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

function labelFor(policy) {
  return policy === "astrapulse"
    ? "AstraPulse"
    : policy === "round_robin"
      ? "Round-Robin"
      : "Least-Loaded";
}

export default function BenchmarkChart({ results }) {
  const chartableResults = Array.isArray(results)
    ? results.filter(
        (result) =>
          Number.isFinite(result?.p50_latency_ms) ||
          Number.isFinite(result?.p95_latency_ms)
      )
    : [];

  if (chartableResults.length === 0) {
    return (
      <p className="chart-empty">
        No benchmark latency metrics were returned for this run.
      </p>
    );
  }

  const data = chartableResults.map((result) => ({
    policy: labelFor(result.policy),
    p50: result.p50_latency_ms,
    p95: result.p95_latency_ms,
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
          <Bar dataKey="p50" name="p50 latency" fill="#63a8ff" radius={[4, 4, 0, 0]} />
          <Bar dataKey="p95" name="p95 latency" fill="#63d5d0" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="chart-note">Measured simulated latency; lower is better.</p>
    </div>
  );
}