# Master Audit Prompt — Full-System API Audit

## Role

Act as a **Principal Software Architect** and **Senior QA Automation Engineer**. You combine deep code-reading ability with adversarial testing instincts. You think like both the developer who wrote the system and the attacker trying to break it.

## Objective

Conduct a **coverage-driven, regression-focused** audit of the entire server's API surface. The goal is threefold:

1. **Map** every registered route and its middleware chain.
2. **Verify** functional integrity, security posture, and state consistency.
3. **Prove** that changes documented in `@docs/guide/part4_final_modules.md` have not introduced regressions, side effects, or vulnerabilities.

> Scope realism note: "100% coverage" means every discovered route is exercised at least once at each applicable tier. It does **not** mean exhaustive fuzzing of every input combination — use equivalence-class partitioning and boundary-value analysis to keep the test matrix tractable.

## Pre-Flight Requirements

Before any test runs, establish the following. **Do not skip these — running tests without them invalidates the audit.**

- **Environment Isolation**: Run against a dedicated audit environment (staging or ephemeral container). Never run destructive tests against production or shared dev data.
- **Test Data Fixtures**: Create a known-good fixture set (users, tokens, parent resources). Record fixture IDs in the report so failures are reproducible.
- **Baseline Snapshot**: Capture current route inventory and DB row counts for affected tables (e.g., `orders`, `payments`) **before** testing. Compare against the same counts **after** testing to detect orphan rows.
- **Teardown Plan**: Define how test-created resources will be cleaned up (cascade delete, transaction rollback, or a cleanup script). Document the strategy in the report.
- **Rate / Concurrency Limits**: Note any rate-limit middleware and stay below it, OR explicitly document that you are stress-testing it.

## Execution Protocol

### Phase 1 — Dynamic Route Discovery

- Scan every route definition source: `app.js`, `routes/`, `controllers/`, framework loaders, and any dynamic registrations (e.g., file-system routing, plugin loaders).
- For each endpoint, capture:
  - HTTP method(s) and full URL path (with param placeholders resolved to sample values)
  - Middleware chain in execution order (auth, validation, rate-limit, etc.)
  - Handler function reference (file:line)
  - Source of truth: was the route auto-registered or explicitly declared?
- Emit the inventory as a structured artifact (`route_map.json`) so downstream phases can consume it programmatically.

### Phase 2 — Multi-Vector Payload Testing

For every discovered route, perform **3-Tiered Validation** using `node:assert` (or the project's existing assertion library — do not introduce a new one without reason).

**Tier 1 — Positive Testing (Schema Compliance)**

- Send the ideal, correctly formatted payload.
- Assert: expected 2xx status, response schema matches the documented contract, response time within an agreed baseline (e.g., P95 < 500ms for non-aggregate endpoints).
- Capture the response as the **golden contract** for diffing in future audits.

**Tier 2 — Negative / Edge Testing (Mutation Fuzzing)**
Apply the following mutation classes systematically:

- _Type Swaps_: string→number, number→string, object→array, boolean→string "true".
- _Required-Field Omission_: drop each mandatory field one at a time; assert 400 with a field-specific error message.
- _Boundary Values_: empty string, single char, max-length+1, `null`, `NaN`, negative integers, `0`, `Number.MAX_SAFE_INTEGER+1`, `Infinity`, deeply nested objects, oversized payloads (>1MB) to probe buffer handling.
- _Format Violations_: malformed UUIDs, invalid ISO-8601 dates, bad email syntax, non-Base64 in binary fields.
- _Duplicate / Conflicting Fields_: e.g., send both `id` and `uuid` pointing to different resources.

**Tier 3 — Authorization / Security Testing**

- _Anonymous Access_: no `Authorization` header → expect 401.
- _Expired / Malformed Token_: tampered JWT, wrong signature, expired `exp`, `alg: none` attack → expect 401/403.
- _IDOR / Horizontal Privilege Escalation_: authenticated as User A, attempt to read/modify User B's resources → expect 403 or 404 (never 200).
- _Vertical Privilege Escalation_: standard user attempts admin-only routes → expect 403.
- _Mass Assignment_: include privileged fields (`role`, `isAdmin`, `balance`) in an update payload → verify they are filtered, not persisted.
- _Injection Probes_: SQLi (`' OR 1=1--`), NoSQLi (`{"$gt":""}`), path traversal (`../../etc/passwd`), SSRF-shaped URLs in any field that is later fetched.
- _HTTP Method Override_: try `X-HTTP-Method-Override: DELETE` on a GET route to detect middleware bypass.

### Phase 3 — State Consistency Audit

- **Transactional Integrity**: For multi-step flows (order→payment→fulfillment), force a failure mid-flow (e.g., kill the payment stub) and verify the DB has no partial records or "ghost" entries. Assert that compensating transactions or rollbacks fire correctly.
- **Idempotency**: Replay POST/PUT requests with the same `Idempotency-Key` header (if supported). Assert the second response is a cached duplicate, not a new resource.
- **Legacy Regression**: Identify routes untouched by the Part 2 changes and run Tier 1 + a sample of Tier 2 against them. Failures here are **regressions** and must be escalated.
- **Concurrency**: For write endpoints, fire N parallel requests against the same resource. Verify optimistic-locking (e.g., `ETag` / `If-Match`) or pessimistic locks prevent lost updates.

### Phase 4 — Failure Triage & Reproduction

For every failed assertion:

1. Capture the **exact** request (method, URL, headers, body) and full response (status, headers, body).
2. Capture the server-side stack trace from logs.
3. Classify severity: `Blocker` / `Critical` / `Major` / `Minor` / `Info`.
4. Propose a remediation with a concrete code-level suggestion (file + approximate fix), not just "validate input".
5. Write a minimal reproduction script to `/repro/<route>_<testcase>.test.js` so the failure can be re-run after the fix.

## Reporting

Generate the audit report at `@docs/reports/full_server_audit_[DATE].md` AND a machine-readable companion `full_server_audit_[DATE].json` (for diffing against future audits).

### Report Structure

1. **Executive Summary** — Overall health, pass/fail/warn counts, critical findings called out in the first paragraph, regression verdict (PASS/FAIL) for Part 2 changes.
2. **Audit Metadata** — Environment, commit SHA, fixture IDs, baseline-vs-final DB row counts, test duration, total requests fired.
3. **Route Inventory** — Full table of discovered endpoints with middleware chains.
4. **Master Test Matrix** (Markdown table):

   | Route | Method | Tier | Test Case | Input Strategy | Expected | Actual | Status |
   | ----- | ------ | ---- | --------- | -------------- | -------- | ------ | ------ |

5. **Failure / Vulnerability Log** — One subsection per failure with: reproduction script path, request/response, stack trace, severity, remediation. Group by severity, highest first.
6. **State Consistency Findings** — Orphan rows detected, idempotency results, concurrency outcomes.
7. **Regression Verdict** — Explicit statement: "Part 2 changes introduced N regressions across M routes" with the affected routes listed.
8. **Appendix** — Teardown confirmation, list of test-created resources that could not be cleaned up (if any).

## Guardrails

- **Never** run destructive tests (DELETE, destructive PUT) against resources you did not create yourself.
- **Never** commit fixture data or test tokens to the repository.
- If a test would cause real-world side effects (e.g., sending an email, charging a card), use the project's mock/stub layer. If none exists, **skip the test and log it as "UNTESTED — requires mock"** rather than executing it.
- If you discover a critical vulnerability mid-audit, **pause**, document it, and continue — do not attempt live exploitation beyond the proof-of-concept request.

---

## What changed and why (quick changelog)

| Area            | Original                    | Improvement                                                                 | Rationale                                             |
| --------------- | --------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Scope           | "100% coverage"             | Equivalence-class partitioning + BVA                                        | Tractable, still rigorous                             |
| Pre-flight      | None                        | Environment isolation, fixtures, baseline snapshot, teardown                | Without these, results aren't reproducible            |
| Route discovery | "Scan files"                | Emit `route_map.json` artifact                                              | Enables programmatic downstream phases + future diffs |
| Tier 2          | 3 mutation classes          | 6 classes (added format, duplicate, oversized)                              | Catches real-world bugs the original missed           |
| Tier 3          | 3 vectors                   | 7 vectors (added mass assignment, injection, method override)               | These are the most commonly missed vulns              |
| State audit     | Mentioned briefly           | Idempotency, concurrency, compensating transactions                         | Modern API correctness depends on these               |
| Failure triage  | "Log payload + stack trace" | Reproduction scripts + severity classification + code-level fix suggestions | Actionable, not just descriptive                      |
| Reporting       | Markdown only               | Markdown + JSON companion                                                   | Enables regression diffing across audits              |
| Guardrails      | None                        | Explicit do-not-run rules                                                   | Prevents catastrophic mistakes on shared/prod data    |
