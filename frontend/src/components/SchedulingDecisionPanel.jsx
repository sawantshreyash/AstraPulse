import {
  Activity,
  CheckCircle2,
  CircleHelp,
  GitCompareArrows,
  ShieldCheck,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

const firstValue = (object, keys, fallback = null) => {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return fallback;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getWorkerName = (candidate, index) =>
  String(
    firstValue(
      candidate,
      ["worker_name", "workerName", "name", "worker_id", "workerId", "id"],
      `Worker ${index + 1}`
    )
  );

const getScore = (candidate) =>
  toNumber(
    firstValue(candidate, ["score", "scheduling_score", "schedulingScore"])
  );

const getLoad = (candidate) =>
  toNumber(
    firstValue(candidate, [
      "utilization",
      "utilization_pct",
      "load_pct",
      "load",
      "cpu_percent",
    ])
  );

const getLatency = (candidate) =>
  toNumber(
    firstValue(candidate, [
      "predicted_completion_ms",
      "predictedCompletionMs",
      "latency_ms",
      "latency",
      "response_time_ms",
    ])
  );

const getReason = (candidate) =>
  firstValue(
    candidate,
    ["reason", "selection_reason", "explanation", "message"],
    null
  );

function Metric({ label, value, suffix = "" }) {
  return (
    <div className="decision-metric">
      <span>{label}</span>
      <strong>
        {value === null || value === undefined ? "—" : `${value}${suffix}`}
      </strong>
    </div>
  );
}

function StrategyCard({ icon: Icon, title, description, active = false }) {
  return (
    <article className={`strategy-card ${active ? "is-active" : ""}`}>
      <div className="strategy-card-icon">
        <Icon size={18} />
      </div>

      <div className="strategy-card-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

      {active && (
        <span className="strategy-active-label">
          Current decision
        </span>
      )}
    </article>
  );
}

export default function SchedulingDecisionPanel({
  routeResult,
  selectedWorkerId,
}) {
  const candidates = Array.isArray(routeResult?.candidates)
    ? routeResult.candidates
    : [];

  const selectedId =
    selectedWorkerId ??
    firstValue(routeResult, [
      "selected_worker_id",
      "selectedWorkerId",
      "worker_id",
      "workerId",
    ]);

  const selectedCandidate =
    candidates.find((candidate) => {
      const id = firstValue(candidate, [
        "worker_id",
        "workerId",
        "id",
      ]);
      return id != null && String(id) === String(selectedId);
    }) ??
    candidates.find((candidate) =>
      Boolean(
        firstValue(candidate, ["selected", "is_selected", "chosen"], false)
      )
    );

  const rankedCandidates = [...candidates].sort((a, b) => {
    const aScore = getScore(a);
    const bScore = getScore(b);

    if (aScore === null || bScore === null) return 0;
    return bScore - aScore;
  });

  const selectedName = selectedCandidate
    ? getWorkerName(
        selectedCandidate,
        candidates.indexOf(selectedCandidate)
      )
    : selectedId != null
      ? String(selectedId)
      : "Awaiting routing decision";

  const decisionReason =
    getReason(selectedCandidate) ??
    firstValue(routeResult, [
      "reason",
      "selection_reason",
      "explanation",
    ]);

  const hasScores = candidates.some((candidate) => getScore(candidate) !== null);

  return (
    <section className="panel scheduling-decision-panel">
      <div className="decision-heading">
        <div>
          <div className="eyebrow">
            <Activity size={14} />
            ROUTING INTELLIGENCE
          </div>
          <h2>Scheduling decision</h2>
          <p>
            Understand the latest routing result and inspect candidate workers.
          </p>
        </div>

        <span className="decision-status">
          <span className="status-dot" />
          {selectedCandidate || selectedId != null
            ? "Decision available"
            : "Waiting for route"}
        </span>
      </div>

      <div className="decision-winner">
        <div className="decision-winner-icon">
          <Trophy size={22} />
        </div>

        <div className="decision-winner-copy">
          <span>Selected worker</span>
          <strong>{selectedName}</strong>
          <p>
            {decisionReason ??
              "The routing result has not supplied a selection explanation yet."}
          </p>
        </div>

        <div className="decision-winner-badge">
          <CheckCircle2 size={16} />
          {selectedCandidate ? "Matched candidate" : "Route result"}
        </div>
      </div>

      <div className="decision-metrics">
        <Metric
          label="Candidates evaluated"
          value={candidates.length}
        />
        <Metric
          label="Selection score"
          value={getScore(selectedCandidate)}
        />
        <Metric
          label="Worker utilization"
          value={getLoad(selectedCandidate)}
          suffix={getLoad(selectedCandidate) === null ? "" : "%"}
        />
        <Metric
          label="Predicted time"
          value={getLatency(selectedCandidate)}
          suffix={getLatency(selectedCandidate) === null ? "" : " ms"}
        />
      </div>

      <div className="decision-section-heading">
        <div>
          <h3>Candidate ranking</h3>
          <p>
            {hasScores
              ? "Ranked using scores supplied by the routing result."
              : "Scores are not available; candidates retain their supplied order."}
          </p>
        </div>
        <Target size={18} />
      </div>

      {rankedCandidates.length > 0 ? (
        <div className="candidate-ranking">
          {rankedCandidates.map((candidate, index) => {
            const name = getWorkerName(candidate, index);
            const score = getScore(candidate);
            const load = getLoad(candidate);
            const latency = getLatency(candidate);
            const reason = getReason(candidate);

            const candidateId = firstValue(candidate, [
              "worker_id",
              "workerId",
              "id",
            ]);

            const isSelected =
              (selectedId != null &&
                candidateId != null &&
                String(candidateId) === String(selectedId)) ||
              candidate === selectedCandidate;

            const isEligible = firstValue(
              candidate,
              ["eligible", "is_eligible", "available"],
              null
            );

            return (
              <article
                className={`candidate-row ${isSelected ? "is-selected" : ""}`}
                key={candidateId ?? `${name}-${index}`}
              >
                <div className="candidate-rank">
                  {isSelected ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </div>

                <div className="candidate-main">
                  <div className="candidate-name-line">
                    <strong>{name}</strong>
                    {isSelected && (
                      <span className="candidate-selected-tag">
                        SELECTED
                      </span>
                    )}
                    {isEligible === false && (
                      <span className="candidate-ineligible-tag">
                        INELIGIBLE
                      </span>
                    )}
                  </div>

                  <p>
                    {reason ??
                      (isEligible === false
                        ? "Marked ineligible by the routing result."
                        : "No candidate-specific explanation was provided.")}
                  </p>
                </div>

                <div className="candidate-stats">
                  <span>
                    Score <strong>{score ?? "—"}</strong>
                  </span>
                  <span>
                    Load <strong>{load === null ? "—" : `${load}%`}</strong>
                  </span>
                  <span>
                    Time{" "}
                    <strong>{latency === null ? "—" : `${latency} ms`}</strong>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="decision-empty">
          <CircleHelp size={22} />
          <div>
            <strong>No routing candidates yet</strong>
            <p>Run a routing decision to populate this section.</p>
          </div>
        </div>
      )}

      <div className="decision-section-heading strategy-heading">
        <div>
          <h3>Strategy comparison</h3>
          <p>
            Reference strategies for evaluating the routing algorithm.
          </p>
        </div>
        <GitCompareArrows size={18} />
      </div>

      <div className="strategy-grid">
        <StrategyCard
          icon={Zap}
          title="AstraPulse"
          description="Your configured routing algorithm"
          active
        />
        <StrategyCard
          icon={GitCompareArrows}
          title="Round-Robin"
          description="Rotates requests across eligible workers"
        />
        <StrategyCard
          icon={ShieldCheck}
          title="Least-Loaded"
          description="Prefers the worker with the lowest reported load"
        />
      </div>

      <p className="decision-footnote">
        Round-Robin and Least-Loaded are reference strategies in this panel,
        not measured benchmark results. A real performance comparison requires
        running each strategy against the same workload and recording its
        outcome.
      </p>
    </section>
  );
}
