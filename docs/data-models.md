\# AstraPulse Data Models



\## 1. General Conventions



\- API payloads use `snake\_case`.

\- Timestamps and durations use milliseconds.

\- The simulation uses virtual time.

\- Costs are synthetic estimates, not actual cloud charges.

\- Worker and request identifiers must be stable within a simulation.

\- Exact API field names and response shapes must remain consistent with `docs/api-contract.md`.



\## 2. Worker



A simulated worker represents a processing resource.



Conceptual fields:



| Field | Meaning |

|---|---|

| `worker\_id` | Unique worker identifier |

| `name` | Display name |

| `healthy` | Whether the worker can receive new work |

| `capacity` | Number of concurrent service slots |

| `service\_rate` | Relative processing-speed factor |

| `cost\_per\_service\_ms` | Synthetic cost per service-time millisecond |

| `queue\_depth` | Number of requests awaiting service |

| `active\_requests` | Number of occupied service slots |

| `slot\_available\_at\_ms` | Virtual availability timestamps for capacity slots |



The implementation must follow the worker schema agreed in `docs/api-contract.md`. Additional internal fields are allowed only when they do not change the public API unexpectedly.



\## 3. Inference Request



A simulated inference request describes work that needs processing.



Conceptual fields:



| Field | Meaning |

|---|---|

| `request\_id` | Unique request identifier |

| `input\_tokens` | Simulated input token count |

| `output\_tokens` | Simulated output token count |

| `arrival\_time\_ms` | Virtual arrival timestamp |

| `deadline\_ms` | Allowed duration after arrival |

| `deadline\_mode` | `soft` or `hard` |

| `priority` | Optional request priority, if included in the agreed contract |



The implementation must not silently require optional fields that the API contract does not define as required.



\## 4. Service-Time Estimate



The initial deterministic service-time formula is:



```text

token\_work = input\_tokens + output\_tokens

base\_service\_time\_ms = 20 + (token\_work / 100)

service\_time\_ms = max(1, base\_service\_time\_ms / service\_rate)

```



Round to whole milliseconds using one consistent rounding rule. The same request and worker configuration must produce the same service-time estimate.



This is a synthetic demonstration formula, not a measured model inference benchmark.



\## 5. Candidate Worker Evaluation



For each candidate worker, calculate the values needed to predict execution:



\- Predicted start time.

\- Queue delay.

\- Service time.

\- Predicted finish time.

\- Completion time relative to arrival.

\- Deadline timestamp.

\- Deadline risk.

\- Estimated cost.

\- Normalized score components.

\- Final AstraPulse score, when applicable.

\- Eligibility and any exclusion reason.



A candidate that is unhealthy or otherwise invalid must not be selected. Hard deadline mode excludes candidates predicted to miss the deadline.



\## 6. Routing Decision



A routing decision explains the result for one request.



Conceptual fields:



\- Request identifier.

\- Scheduling policy.

\- Decision status.

\- Selected worker identifier, or `null` if none is eligible.

\- Candidate evaluations.

\- Predicted completion and queue delay.

\- Estimated cost.

\- Explanation of the selection or exclusion.

\- Deadline mode.



For no eligible worker, the API contract specifies `status: "no\_eligible\_worker"` and `selected\_worker: null`.



Use the exact response structure from `docs/api-contract.md`.



\## 7. AstraPulse Scoring



Lower scores are better.



The initial weights are:



| Component | Weight |

|---|---:|

| Normalized completion time | 0.40 |

| Normalized queue delay | 0.25 |

| Deadline risk | 0.25 |

| Normalized estimated cost | 0.10 |



```text

score =

&#x20;   w\_latency \* normalized\_completion

&#x20; + w\_queue \* normalized\_queue\_delay

&#x20; + w\_deadline \* deadline\_risk

&#x20; + w\_cost \* normalized\_estimated\_cost

```



Normalize candidate values to the range `\[0, 1]` using min-max normalization. If every candidate has the same value for a component, use zero for that component.



Resolve equal scores deterministically by ascending `worker\_id`.



These weights are initial heuristic settings, not experimentally optimized parameters.



\## 8. Deadline Risk



For soft deadline mode:



```text

completion\_budget\_ms = completion\_time\_ms

deadline\_risk = min(

&#x20;   1,

&#x20;   max(0, completion\_budget\_ms / deadline\_ms - 0.8) / 0.2

)

```



The initial heuristic assigns zero risk up to 80% of the deadline budget and increases linearly toward one at the deadline. It is not a calibrated probability of failure.



Implementation must handle invalid or zero deadline values according to the API contract.



\## 9. Estimated Cost



```text

estimated\_cost = service\_time\_ms \* cost\_per\_service\_ms

```



This value is synthetic and must be labeled as estimated cost in the UI and benchmark output.



\## 10. Request Outcome



A simulated request should have a clearly defined outcome, such as completed, failed, or rejected because no worker was eligible, following the API contract.



Deadline misses are tracked separately from other failures. A completed request can still count as a deadline miss if it finishes after its deadline.



\## 11. Metrics



The metrics collector and benchmark runner use consistent definitions:



\- Latency: completion time minus arrival time.

\- p50 and p95: nearest-rank percentiles, using rank `ceil(percentile \* sample\_count)`.

\- p50 and p95: `null` when there are no completed requests.

\- Deadline miss rate: deadline-missed requests divided by submitted requests.

\- Throughput: completed requests divided by simulated elapsed seconds.

\- Total estimated cost: sum of estimated costs.

\- Success and failure counts: calculated from explicitly defined outcomes.



Guard against empty samples and division by zero.



\## 12. Benchmark Result



A benchmark result summarizes one workload run for one scheduling policy.



It should include the policy identifier, workload settings, request counts, latency percsentiles, throughput, deadline misses, success and failure counts, estimated cost, and any contract-defined per-request details.



The benchmark comparison must use the same workload sequence and equivalent fresh initial worker state for each policy.



\## 13. Implementation Rule



These are conceptual model descriptions. The API contract is the source of truth for public JSON fields. Internal Python classes may use Pydantic models or dataclasses as appropriate, provided they preserve the agreed API and keep the initial implementation straightforward and testable.



