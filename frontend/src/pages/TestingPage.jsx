
import { FlaskConical, Play, Zap } from "lucide-react";

export default function TestingPage({
  scenarioCatalog,
  scenarioId,
  onSetScenarioId,
  onRunScenario,
  scenarioRunning,
  scenarioResult,
  onRunAutomatedLab,
  automatedLabRunning,
  automatedLabResult,
}) {
  return (
    <div>
      <div className="two-col">
        {/* Scenario runner */}
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Scenario Lab</div>
              <div className="panel-subtitle">Run a deterministic backend scenario in an isolated simulation.</div>
            </div>
          </div>

          <form onSubmit={onRunScenario} className="form-grid">
            <label className="form-label full-width">
              Scenario
              <select
                value={scenarioId}
                onChange={e => onSetScenarioId(e.target.value)}
                disabled={!scenarioCatalog.length || scenarioRunning}
              >
                {scenarioCatalog.length === 0 ? (
                  <option>Loading scenarios…</option>
                ) : (
                  scenarioCatalog.map(s => (
                    <option key={s.scenario_id} value={s.scenario_id} disabled={!s.supported}>
                      {s.scenario_id}{!s.supported ? " (unsupported)" : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={scenarioRunning || !scenarioCatalog.length}
            >
              {scenarioRunning ? <><div className="spinner sm" /> Running scenario…</> : <><Play size={14} /> Run Scenario</>}
            </button>
          </form>

          {scenarioResult && (
            <div className="result-box">
              <h3>Scenario Result</h3>
              <div className="result-grid">
                <div className="result-value"><span>Status</span><strong>{scenarioResult.status}</strong></div>
                <div className="result-value"><span>Run ID</span><strong>{scenarioResult.run_id || "—"}</strong></div>
              </div>
              {scenarioResult.gap && <p className="result-box-notice" style={{ marginTop: 10 }}>{scenarioResult.gap}</p>}
              {scenarioResult.decisions && (
                <p style={{ marginTop: 10, fontSize: "0.86rem", color: "var(--text-muted)" }}>
                  <strong style={{ color: "var(--text)" }}>Decisions:</strong> {scenarioResult.decisions.length}
                  {" · "}
                  {scenarioResult.decisions.filter(d => d.status === "routed").length} routed
                  {" · "}
                  {scenarioResult.decisions.filter(d => d.status === "no_eligible_worker").length} no route
                </p>
              )}
              {scenarioResult.predictions_are_simulated_estimates && (
                <p className="muted-note" style={{ marginTop: 8 }}>
                  Predictions and outcomes are simulated estimates from an isolated registry.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Automated lab */}
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Automated Scenario Lab</div>
              <div className="panel-subtitle">Run the complete bounded deterministic scenario suite.</div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginBottom: 14 }}
            onClick={onRunAutomatedLab}
            disabled={automatedLabRunning}
          >
            {automatedLabRunning ? <><div className="spinner sm" /> Running lab…</> : <><Zap size={14} /> Run Automated Lab</>}
          </button>

          {automatedLabRunning && (
            <div className="result-box running" role="status">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="spinner sm" />
                Running the bounded deterministic scenario suite…
              </div>
            </div>
          )}

          {automatedLabResult && (
            <div className="result-box">
              <h3 style={{ marginBottom: 10 }}>Automated Lab Summary</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                {[
                  ["Completed", `${automatedLabResult.completed_count} / ${automatedLabResult.scenario_count}`, "blue"],
                  ["PASS", automatedLabResult.counts.PASS, "green"],
                  ["FAIL", automatedLabResult.counts.FAIL, "red"],
                  ["ERROR", automatedLabResult.counts.ERROR, "red"],
                  ["UNSUPPORTED", automatedLabResult.counts.UNSUPPORTED, "amber"],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: "0.66rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
                    <strong style={{ fontSize: "1.1rem", color: `var(--${color})` }}>{value}</strong>
                  </div>
                ))}
              </div>

              <div className="table-wrapper">
                <table className="scenario-results-table">
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th>Status</th>
                      <th>Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automatedLabResult.results.map(r => (
                      <tr key={r.scenario_id}>
                        <td><strong>{r.scenario_id}</strong></td>
                        <td>{r.expected_behavior}</td>
                        <td>{r.actual_outcome}</td>
                        <td><span className={`stage-badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                        <td style={{ maxWidth: 240, whiteSpace: "normal" }}>{r.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {automatedLabResult.policy_comparison && (
                <p className="muted-note" style={{ marginTop: 12 }}>
                  Policy comparison used one seeded workload and isolated initial state. Values are simulated benchmark results and estimated costs.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
