\# AstraPulse Benchmark Methodology



\## 1. Purpose



This document defines the virtual-time simulation model and the rules for evaluating AstraPulse against Round-Robin and Least-Loaded.



All benchmark results are simulated results. They are not measurements of real GPUs, cloud providers, or production AI workloads.



\## 2. Scheduling Policies



The benchmark compares:



\- `astrapulse`: predictive weighted scoring.

\- `round\_robin`: cyclic assignment among eligible workers.

\- `least\_loaded`: assignment to the eligible worker with the smallest projected workload.



All policies receive the same generated request sequence and equivalent initial worker states.



\## 3. Virtual-Time Model



All simulated times use milliseconds.



For each worker execution slot:



```text

start\_time\_ms = max(arrival\_time\_ms, slot\_available\_at\_ms)



queue\_delay\_ms = start\_time\_ms - arrival\_time\_ms



finish\_time\_ms = start\_time\_ms + service\_time\_ms



completion\_time\_ms = finish\_time\_ms - arrival\_time\_ms



deadline\_at\_ms = arrival\_time\_ms + deadline\_ms

```



The slot with the earliest predicted finish is selected. Ties are resolved deterministically.



Simulation calculations must not use Python wall-clock execution time.



\## 4. Initial Service-Time Formula



For the first prototype, use this deterministic baseline:



```text

token\_work = input\_tokens + output\_tokens



base\_service\_time\_ms = 20 + (token\_work / 100)



service\_time\_ms = max(

&#x20;   1,

&#x20;   base\_service\_time\_ms / service\_rate

)

```



Round the final service time to a whole millisecond using one consistent rounding rule.



`service\_rate` must be greater than zero. Higher service rates produce shorter service times.



This is a synthetic workload formula for demonstration purposes, not a claim about real model latency.



For the first implementation, do not add random service-time variation. A seed can control generated workloads, while the service-time formula remains deterministic. Optional variation can be introduced later if the core tests pass.



\## 5. Worker Queue State



Each worker has a positive number of execution slots, determined by `capacity`.



Each slot tracks its next available virtual timestamp.



When a request is assigned:



1\. Select the slot with the earliest projected finish.

2\. Calculate the request's start, queue delay, and finish.

3\. Update that slot's availability to the request's finish timestamp.

4\. Preserve the other slots' availability.

5\. Update the worker's visible queue and activity information consistently.



For a benchmark, each scheduling policy receives a fresh copy of the same initial worker state.



\## 6. Deadline Rules



The request includes:



\- `deadline\_ms`: a positive deadline budget from arrival.

\- `deadline\_mode`: either `soft` or `hard`.



The absolute deadline timestamp is:



```text

deadline\_at\_ms = arrival\_time\_ms + deadline\_ms

```



\### Hard deadline



A worker is ineligible when its predicted completion timestamp exceeds the request's deadline timestamp.



\### Soft deadline



A worker can remain eligible even when it is predicted to miss the deadline. AstraPulse applies a deadline-risk penalty to its score.



\### Deadline-risk formula



Calculate the predicted time consumed as:



```text

completion\_budget\_ms =

&#x20;   completion\_time\_ms

```



Then calculate:



```text

deadline\_risk = min(

&#x20;   1,

&#x20;   max(

&#x20;       0,

&#x20;       completion\_budget\_ms / deadline\_ms - 0.8

&#x20;   ) / 0.2

)

```



Interpretation:



\- Risk is zero when predicted completion uses at most 80% of the deadline budget.

\- Risk rises linearly between 80% and 100% of the deadline budget.

\- Risk is one at or beyond the deadline budget.



This risk value is a heuristic indicator, not a statistically calibrated probability.



\## 7. Cost Model



Each worker has a configurable synthetic cost rate:



```text

estimated\_cost =

&#x20;   service\_time\_ms \* cost\_per\_service\_ms

```



Cost represents an arbitrary comparison unit. It does not represent real cloud billing.



Use the same formula for every scheduling policy.



\## 8. AstraPulse Scoring



Lower scores are better.



For the first prototype, use these default weights:



| Component | Weight |

|---|---:|

| Predicted completion | 0.40 |

| Queue delay | 0.25 |

| Deadline risk | 0.25 |

| Estimated cost | 0.10 |

| Total | 1.00 |



Normalize completion time, queue delay, and estimated cost to a range from zero to one within the current eligible candidate set.



For each metric:



```text

normalized\_value =

&#x20;   (value - minimum\_candidate\_value)

&#x20;   / (maximum\_candidate\_value - minimum\_candidate\_value)

```



If all candidate values are equal, set that normalized component to zero for every candidate.



Then calculate:



```text

score =

&#x20;   0.40 \* normalized\_completion

&#x20; + 0.25 \* normalized\_queue\_delay

&#x20; + 0.25 \* deadline\_risk

&#x20; + 0.10 \* normalized\_estimated\_cost

```



Filter hard-ineligible workers before scoring. Use deterministic tie-breaking, such as ascending `worker\_id`.



These are initial heuristic weights for the demonstration. They may be revised after testing, but any changes must be documented and applied consistently.



\## 9. Baseline Policy Rules



\### Round-Robin



Cycle through eligible workers in a deterministic order.



Skip ineligible workers. Keep the pointer behavior consistent when workers become unavailable.



\### Least-Loaded



Choose the eligible worker with the smallest projected outstanding workload, using the worker's execution-slot availability.



Resolve ties by ascending `worker\_id`.



\### AstraPulse



Evaluate all eligible workers using the documented prediction model and weighted score. Select the worker with the lowest score.



If no worker is eligible, return `no\_eligible\_worker`.



\## 10. Benchmark Workload



Initially support three profiles:



\- `light`: low request volume and modest token counts.

\- `mixed`: varied request arrivals, token counts, and deadline budgets.

\- `burst`: groups of requests arriving close together to create queue pressure.



Generate each workload from the provided seed.



For each benchmark run:



1\. Generate the request sequence once.

2\. Create equivalent initial worker states for each policy.

3\. Run each policy independently against that sequence.

4\. Calculate metrics using the same definitions.

5\. Return results labeled by policy and seed.



Do not reuse mutated worker state from one policy for another.



\## 11. Metrics



\### Latency



```text

latency\_ms = completion\_time\_ms - arrival\_time\_ms

```



\### Percentiles



Use the nearest-rank percentile method over completed requests:



```text

rank = ceil(percentile \* sample\_count)

```



For example, p95 uses `ceil(0.95 \* sample\_count)`, with rank counted from one.



If there are no completed requests, return `null` for latency percentiles.



\### Deadline miss rate



```text

deadline\_miss\_rate =

&#x20;   deadline\_misses / submitted\_requests

```



Return zero when no requests were submitted, although benchmark requests must have a positive count.



\### Throughput



```text

throughput\_requests\_per\_simulated\_second =

&#x20;   completed\_requests / (simulated\_elapsed\_ms / 1000)

```



If simulated elapsed time is zero, return zero.



\### Estimated cost



```text

total\_estimated\_cost =

&#x20;   sum(estimated\_cost for completed or assigned requests)

```



Document which terminal outcomes incur cost and use that rule for every policy.



\### Failures



Count requests that cannot be assigned or completed under the defined simulation rules as failures. Keep failure counts distinct from deadline misses, and document the chosen outcome rule in implementation and tests.



\## 12. Reproducibility



Given the same:



\- workload profile,

\- request count,

\- seed,

\- initial worker state,

\- service-time model,

\- policy configuration,



the simulation must produce the same results.



Do not use real elapsed Python runtime to calculate throughput or latency.



\## 13. Required Tests



\- Service time increases as token workload increases.

\- Higher worker service rate lowers service time.

\- Service time is deterministic.

\- Queue delay reflects slot availability.

\- Completion timestamps are calculated correctly.

\- Hard deadlines exclude workers predicted to miss the deadline.

\- Soft deadlines contribute a penalty without automatically excluding workers.

\- Deadline risk stays between zero and one.

\- AstraPulse chooses the lowest-scoring eligible worker.

\- Round-Robin advances deterministically.

\- Least-Loaded chooses the least-loaded eligible worker.

\- No eligible worker produces the documented outcome.

\- Benchmarks use identical request sequences and isolated worker states.

\- Repeated runs with the same seed produce identical metrics.



\## 14. Reporting Requirements



The dashboard and README must identify results as simulated.



Show predicted routing values separately from benchmark outcomes.



Do not claim AstraPulse always outperforms the baselines. Report actual results from the implemented simulation, including cases where a baseline performs better.



