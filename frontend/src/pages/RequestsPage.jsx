
import { GitBranch, Send } from "lucide-react";

export default function RequestsPage({
  requestForm,
  onUpdateRequestForm,
  onSubmitRoute,
  routing,
  routeResult,
}) {
  return (
    <div>
      <div className="two-col">
        {/* Route form */}
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Route an Inference Request</div>
              <div className="panel-subtitle">Test how a scheduling policy selects a worker.</div>
            </div>
          </div>

          {/* Decision flow */}
          <div
            className={`decision-flow${routing ? " is-active" : ""}${routeResult ? " is-complete" : ""}`}
            aria-live="polite"
          >
            <div className="flow-line" aria-hidden="true" />
            {[
              ["01", "Request",    "received"],
              ["02", "Candidates", routing ? "evaluating" : routeResult ? "evaluated" : "ready"],
              ["03", "Constraints",routing ? "checking"   : routeResult ? "checked"   : "pending"],
              ["04", "Decision",   routing ? "in progress": routeResult ? "recorded"  : "pending"],
            ].map(([num, label, state]) => (
              <div key={num} className={`flow-step flow-${state.replace(" ", "-")}`}>
                <span className="flow-marker">{num}</span>
                <div className="flow-copy">
                  <strong>{label}</strong>
                  <small>{state}</small>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmitRoute} className="form-grid">
            <label className="form-label">
              Request ID
              <input name="request_id" value={requestForm.request_id} onChange={onUpdateRequestForm} required />
            </label>
            <label className="form-label">
              Model
              <input name="model" value={requestForm.model} onChange={onUpdateRequestForm} required />
            </label>
            <label className="form-label">
              Input Tokens
              <input type="number" name="input_tokens" min="1" value={requestForm.input_tokens} onChange={onUpdateRequestForm} required />
            </label>
            <label className="form-label">
              Output Tokens
              <input type="number" name="output_tokens" min="1" value={requestForm.output_tokens} onChange={onUpdateRequestForm} required />
            </label>
            <label className="form-label">
              Arrival Time (ms)
              <input type="number" name="arrival_time_ms" min="0" value={requestForm.arrival_time_ms} onChange={onUpdateRequestForm} required />
            </label>
            <label className="form-label">
              Deadline (ms)
              <input type="number" name="deadline_ms" min="1" value={requestForm.deadline_ms} onChange={onUpdateRequestForm} required />
            </label>
            <label className="form-label">
              Deadline Mode
              <select name="deadline_mode" value={requestForm.deadline_mode} onChange={onUpdateRequestForm}>
                <option value="soft">Soft</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="form-label">
              Scheduling Policy
              <select name="policy" value={requestForm.policy} onChange={onUpdateRequestForm}>
                <option value="astrapulse">AstraPulse</option>
                <option value="round_robin">Round-Robin</option>
                <option value="least_loaded">Least-Loaded</option>
              </select>
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={routing}
            >
              {routing ? <><div className="spinner sm" /> Routing…</> : <><Send size={14} /> Route Request</>}
            </button>
          </form>
        </section>

        {/* Result */}
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Routing Result</div>
              <div className="panel-subtitle">Decision outcome and prediction details</div>
            </div>
          </div>

          {!routeResult ? (
            <div className="empty-state">
              <GitBranch size={36} />
              <p className="empty-state-title">No decision yet</p>
              <p className="empty-state-text">Submit a request on the left to see the routing decision and candidate evaluation here.</p>
            </div>
          ) : (
            <div className={`result-box${routeResult.status === "no_eligible_worker" ? " warning" : ""}`}>
              <h3 style={{ marginBottom: 12 }}>Routing Result</h3>
              <div className="result-grid">
                <div className="result-value"><span>Status</span><strong>{routeResult.status}</strong></div>
                <div className="result-value"><span>Policy</span><strong>{routeResult.policy}</strong></div>
                <div className="result-value"><span>Selected Worker</span><strong>{routeResult.selected_worker || "None"}</strong></div>
                {routeResult.prediction && (
                  <>
                    <div className="result-value"><span>Queue Delay</span><strong>{routeResult.prediction.queue_delay_ms} ms</strong></div>
                    <div className="result-value"><span>Service Time</span><strong>{routeResult.prediction.service_time_ms} ms</strong></div>
                    <div className="result-value"><span>Completion</span><strong>{routeResult.prediction.completion_time_ms} ms</strong></div>
                    <div className="result-value"><span>Est. Cost</span><strong>{routeResult.prediction.estimated_cost?.toFixed?.(4)}</strong></div>
                    <div className="result-value"><span>Deadline Risk</span><strong>{routeResult.prediction.deadline_risk != null ? `${(routeResult.prediction.deadline_risk * 100).toFixed(1)}%` : "—"}</strong></div>
                    <div className="result-value"><span>Predicted Miss</span><strong>{routeResult.prediction.predicted_deadline_miss ? "Yes" : "No"}</strong></div>
                  </>
                )}
              </div>

              {Array.isArray(routeResult.explanation) && routeResult.explanation.length > 0 && (
                <>
                  <h4 style={{ marginTop: 16, marginBottom: 8 }}>Why this decision?</h4>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-muted)", fontSize: "0.86rem" }}>
                    {routeResult.explanation.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </>
              )}

              {Array.isArray(routeResult.stages) && routeResult.stages.length > 0 && (
                <div className="stage-list">
                  <h4>Routing Stages</h4>
                  {routeResult.stages.map(s => (
                    <div key={s.name} className="stage-row">
                      <span className={`stage-badge ${s.status}`}>{s.status}</span>
                      <span>
                        <strong>{s.name.replaceAll("_", " ")}</strong>
                        <small>{s.explanation}</small>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(routeResult.candidates) && (
                <div className="candidate-list">
                  <h4>Candidate Workers</h4>
                  {routeResult.candidates.map(c => (
                    <div key={c.worker_id} className="candidate-row">
                      <span>
                        <strong>{c.worker_id}</strong>
                        <span className={`candidate-state ${c.eligible ? "eligible" : "excluded"}`}>
                          {c.eligible ? "eligible" : "excluded"}
                        </span>
                      </span>
                      <small>
                        {c.eligible
                          ? `completion ${c.prediction?.completion_time_ms ?? "—"} ms · score ${c.prediction?.score?.toFixed?.(3) ?? "—"}`
                          : c.reason}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
