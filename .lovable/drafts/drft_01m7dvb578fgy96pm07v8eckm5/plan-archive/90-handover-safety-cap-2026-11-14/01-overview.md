## 90% handover safety cap
- Use one shared `WORKLOAD_CAP = 90` for allocation prompts, validation, warnings, and reassignment eligibility. Keep baseline workload inputs and percentage bars on their existing 0–100 scale.
- Teal below 80%, amber from 80% through 90%, red above 90%. Disable reassignment options exceeding the cap with “would exceed 90% cap”.
- Replace only the limit and error text in the two existing database capacity checks through an additive migration. This changes this draft now and reaches your app only when accepted.

## Technical details and verification
- Generate the migration's limit from the shared constant; retain existing atomic persistence, retry, scope and read-only rules.
- Update boundary and retry tests, run all tests, and exercise Laura’s live Distribute flow once. Report every task’s proposed buyer and final workloads, approve nothing, then reset Laura’s demo.