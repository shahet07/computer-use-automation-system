# Architecture

Relay is a small, single-process control plane built around a durable boundary: a **capability artifact** describes intent, while a surface adapter performs the physical action. This implementation uses Playwright against a local legacy-style web surface because it provides a real browser session, screenshots, and accessibility-aware targeting. The executor has no planning capability: discovery is the only phase allowed to generate an artifact. A production deployment would move sessions and evidence to worker/storage services, but doing so here would obscure the important seam.

# Artifact schema

`src/capability.js` validates every capability with Zod. The artifact has a schema version, vendor/surface fingerprint, typed inputs and outputs, ordered typed steps, a success checkpoint, risk class, and tenant override slot. Each target carries an ordered locator bundle plus a rationale. That makes the capability reviewable by both a human and a calling agent and allows vendor defaults to be specialized per tenant without cloning the whole flow. Inputs are marked sensitive; no concrete member number belongs in the artifact.

# Determinism & error handling

Replay walks the saved steps in order, waits for each assertion, and does not ask a model for a next action. A label or role locator is tried before its fallback CSS locator. The result contract distinguishes `success`, `business_outcome` (the target's `MEMBER_NOT_FOUND` alert), and `failure` with step ID, observed state, and screenshot. A locator miss, app error, or timeout is a hard failure. The local example has no recoverable interstitial; in a production adapter, known dismiss/wait/retry handlers would be explicit artifact steps with bounded retry budgets, never ad hoc model recovery.

# Heterogeneity & multi-tenant

The artifact addresses abstract actions (`fill`, `click`, `assert`, `extract`) and locator strategies, not Playwright calls. A legacy browser adapter can emphasize text, DOM, and screenshots; a desktop adapter can interpret the same strategy taxonomy through accessibility roles or coordinate anchors. Capabilities are keyed by vendor fingerprint and can hold a narrow `tenantOverrides` object for route/branding/locator differences. Fingerprint mismatch and repeated fallback use are drift signals that should route a run to review rather than silently rewrite a capability.

# Escalation & handoff

On a hard failure the executor pauses the run, saves a screenshot, and invokes the handoff callback with capability, current step, reason, and live URL. The server materializes this as `waiting_for_human` at `/api/handoffs`; the operator works the same displayed target session and posts the actions they took to `/resume`. This demo has a real control-state transition and audit record, while full live co-browsing is deliberately out of scope. Production would retain the browser context in a session worker and attach it to an authenticated operator console before resuming from an explicit checkpoint.

# Safety

The artifact is a policy boundary: only known local routes/actions are accepted, risky actions are blocked before execution, and identifiers are redacted from failure messages. Raw screenshots remain local demo evidence. A bank deployment needs tenant policy evaluation before every navigation/action, approval rules for irreversible operations, encrypted retention-controlled evidence, and secret injection outside the artifact/logging path.

# Cuts

The target is local rather than a vendor sandbox; there is no authenticated live co-browsing stream; and the checked-in evidence uses a clearly labelled planner fixture because no model key is included. Next I would run the included Gemini structured-output discovery runner, add browser-context persistence for true handoff/resume, approval workflow (`draft -> approved`), and per-tenant drift metrics. These cuts preserve the core executable replay and error model while making the demonstration safe and reproducible.
