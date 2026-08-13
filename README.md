# Relay - computer-use automation system

Relay is a focused, local vertical slice for **record once, replay many** automation of a legacy-style member inquiry screen. It deliberately separates discovery from replay: a discovery planner produces a reviewed capability artifact; the replay executor uses only that artifact, not an LLM.

## Setup and run

```bash
npm install
npx playwright install chromium
npm start
```

In a second terminal, run the reproducible replay demo:

```bash
npm run demo
```

Open `http://localhost:3000/target` to operate the same legacy-style target surface manually. The demo writes the artifact, a successful replay, and a not-found business outcome under `/evidence`.

## Demo path

1. Start the local target plus control service with `npm start`.
2. `npm run demo` replays `lookup_member_balance` with `memberId=12345`, returning `savingsBalance`.
3. It repeats with `99999`, returning `business_outcome/MEMBER_NOT_FOUND` rather than a crash.
4. `POST /api/replay` accepts an artifact and inputs; failures create a screenshot and an intervention request is available from `GET /api/handoffs`.

## Operator handoff demo

When a replay hits a hard failure or a step marked `risky`, its browser is retained and the result contains `handoffId`. Open `http://localhost:3000/operator/<handoffId>`. The operator console shows a fresh screenshot of that exact retained page and can fill the member-number input or click Search on it. Selecting **Resume automation** verifies the original member-profile checkpoint, extracts the balance, records the human actions, and releases the browser session.

## Genuine LLM discovery run

Create a Gemini API key in Google AI Studio, export it in your local shell (never commit it), then run:

```bash
export GEMINI_API_KEY="..."
npm run discover -- "Look up member 12345 and read their current savings balance."
```

This command starts the local target, drives it through Playwright, asks Gemini for one policy-checked action at a time, and saves redacted `evidence/discovery-live.json`. Replay the resulting artifact with `npm run demo` or `POST /api/replay`.

The default model is `gemini-3-flash-preview`. Override it only when your AI Studio project provides a different current model:

```bash
export GEMINI_MODEL="your-available-model"
```

`evidence/discovery-live.json` is the genuine Gemini-driven discovery run. The retained `discovery-fixture.json` is only a no-key comparison artifact; it is never presented as LLM evidence.

`evidence/failure-member-not-found.png` is a sanitized browser screenshot captured during the expected member-not-found replay path. It is included as the richer failure signal required for review; runtime failure screenshots remain ignored by default.

## Architecture at a glance

`Surface adapter (Playwright) -> policy/locator resolver -> capability executor -> structured result + redacted evidence`.

The local app is intentionally hostile to brittle automation: it is table-based and has no test IDs. Locators prioritize accessible labels and roles, then use CSS only as a fallback. `src/capability.js` is the reviewable, versioned contract. `src/engine.js` is deterministic execution, error classification, screenshot evidence, and handoff callback. `src/server.js` owns the session boundary and exposes replay plus handoff APIs.

## Safety notes

Only the local `/target` entrypoint is permitted by the demo capability. Replay blocks any step classified `risky`, redacts long numeric identifiers from error evidence, and persists neither credentials nor request bodies. Production would additionally enforce a tenant-specific route/action allowlist before every action and use encrypted, short-lived evidence storage.

## Tests

```bash
npm test
```
