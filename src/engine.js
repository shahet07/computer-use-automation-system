const { chromium } = require('playwright');
const fs = require('fs/promises'); const path = require('path');
const { Capability } = require('./capability');
const redact = value => String(value).replace(/\b\d{5,}\b/g, m => `${m.slice(0,2)}***`);
const now = () => new Date().toISOString();
function event(events, type, data = {}) { events.push({ at: now(), type, ...data }); }
async function resolve(page, target) {
  const all = [target, ...(target.fallback || [])];
  for (const l of all) {
    let loc;
    if (l.strategy === 'label') loc = page.getByLabel(l.value);
    if (l.strategy === 'text') loc = page.getByText(l.value, { exact: true });
    if (l.strategy === 'role') { const [role, name] = l.value.split(':'); loc = page.getByRole(role, { name, exact: true }); }
    if (l.strategy === 'css') loc = page.locator(l.value);
    if (await loc.count()) return loc.first();
  }
  throw new Error(`LOCATOR_NOT_FOUND: ${target.value}`);
}
async function replay({ capability, inputs, baseUrl, evidenceDir = 'evidence', onHandoff }) {
  capability = Capability.parse(capability); const events = []; const outputs = {};
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  let stepId = null;
  try {
    for (const step of capability.steps) {
      stepId = step.id; event(events, 'step.started', { stepId });
      if (step.risk === 'risky') throw Object.assign(new Error('RISKY_ACTION_REQUIRES_HUMAN'), { code: 'RISKY_ACTION_REQUIRES_HUMAN' });
      if (step.kind === 'navigate') await page.goto(new URL(step.value, baseUrl).href, { waitUntil: 'domcontentloaded' });
      if (step.kind === 'fill') await (await resolve(page, step.target)).fill(String(inputs[step.parameter]));
      if (step.kind === 'click') { await (await resolve(page, step.target)).click(); await page.waitForTimeout(100); }
      if (step.kind === 'assert') {
        try { await page.getByText(step.expected, { exact: false }).waitFor({ timeout: 2500 }); }
        catch (err) { const alert = page.locator('[role="alert"]'); const observed = await alert.first().textContent().catch(() => ''); if (/not found/i.test(observed)) return { status: 'business_outcome', outcome: 'MEMBER_NOT_FOUND', detail: observed, events, outputs: {} }; throw err; }
      }
      if (step.kind === 'extract') outputs[step.output] = await (await resolve(page, step.target)).textContent();
      const banner = page.locator('[role="alert"]');
      if (await banner.count() && await banner.first().isVisible()) {
        const observed = await banner.first().textContent();
        if (/not found/i.test(observed)) return { status: 'business_outcome', outcome: 'MEMBER_NOT_FOUND', detail: observed, events, outputs: {} };
        throw Object.assign(new Error(observed), { code: 'APPLICATION_ERROR' });
      }
      event(events, 'step.completed', { stepId });
    }
    return { status: 'success', outputs, events };
  } catch (error) {
    await fs.mkdir(evidenceDir, { recursive: true }); const shot = path.join(evidenceDir, `failure-${Date.now()}.png`); await page.screenshot({ path: shot, fullPage: true });
    const failure = { status: 'failure', code: error.code || 'REPLAY_FAILED', stepId, expected: stepId, observed: redact(error.message), screenshot: shot, events };
    event(events, 'run.failed', { code: failure.code, stepId, observed: failure.observed }); if (onHandoff) await onHandoff({ ...failure, url: page.url() }); return failure;
  } finally { await browser.close(); }
}
module.exports = { replay, redact };
