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

The checked-in discovery evidence is intentionally labelled `fixture`: it exercises the same typed artifact contract without inventing a live model run. For submission, set `OPENAI_API_KEY` and run the included discovery adapter after replacing the fixture planner with the provider call; never commit that key or claim fixture evidence is LLM evidence.

## Architecture at a glance

`Surface adapter (Playwright) -> policy/locator resolver -> capability executor -> structured result + redacted evidence`.

The local app is intentionally hostile to brittle automation: it is table-based and has no test IDs. Locators prioritize accessible labels and roles, then use CSS only as a fallback. `src/capability.js` is the reviewable, versioned contract. `src/engine.js` is deterministic execution, error classification, screenshot evidence, and handoff callback. `src/server.js` owns the session boundary and exposes replay plus handoff APIs.

## Safety notes

Only the local `/target` entrypoint is permitted by the demo capability. Replay blocks any step classified `risky`, redacts long numeric identifiers from error evidence, and persists neither credentials nor request bodies. Production would additionally enforce a tenant-specific route/action allowlist before every action and use encrypted, short-lived evidence storage.

## Tests

```bash
npm test
```
