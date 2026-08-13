const { z } = require('zod');

const Locator = z.object({
  strategy: z.enum(['role', 'label', 'text', 'css']),
  value: z.string(),
  fallback: z.array(z.object({ strategy: z.enum(['role', 'label', 'text', 'css']), value: z.string() })).default([]),
  rationale: z.string()
});
const Step = z.object({
  id: z.string(), kind: z.enum(['navigate', 'fill', 'click', 'assert', 'extract']),
  target: Locator.optional(), value: z.string().optional(), parameter: z.string().optional(),
  expected: z.string().optional(), output: z.string().optional(), risk: z.enum(['safe', 'risky']).default('safe')
});
const Capability = z.object({
  schemaVersion: z.literal('1.0'), id: z.string(), name: z.string(), description: z.string(),
  surface: z.object({ kind: z.literal('web'), entrypoint: z.string(), vendor: z.string(), fingerprint: z.string() }),
  inputs: z.array(z.object({ name: z.string(), type: z.enum(['string', 'integer']), sensitive: z.boolean(), required: z.boolean() })),
  outputs: z.array(z.object({ name: z.string(), type: z.string(), redaction: z.enum(['none', 'mask']) })),
  success: z.object({ text: z.string() }), steps: z.array(Step), status: z.enum(['draft', 'approved']),
  tenantOverrides: z.record(z.string(), z.unknown()).default({})
});

const lookupCapability = Capability.parse({
  schemaVersion: '1.0', id: 'lookup-member-balance', name: 'lookup_member_balance',
  description: 'Find a member by ID and return the displayed current savings balance.',
  surface: { kind: 'web', entrypoint: '/target', vendor: 'Local Legacy Core', fingerprint: 'legacy-core-v1' },
  inputs: [{ name: 'memberId', type: 'string', sensitive: true, required: true }],
  outputs: [{ name: 'savingsBalance', type: 'currency', redaction: 'none' }],
  success: { text: 'Member profile' }, status: 'approved',
  steps: [
    { id: 'open', kind: 'navigate', value: '/target', risk: 'safe' },
    { id: 'member-id', kind: 'fill', target: { strategy: 'label', value: 'Member number', fallback: [{ strategy: 'css', value: 'input[name="memberId"]' }], rationale: 'Visible label survives the intentionally table-based legacy markup; name is a secondary fallback.' }, parameter: 'memberId' },
    { id: 'search', kind: 'click', target: { strategy: 'role', value: 'button:Search', fallback: [{ strategy: 'text', value: 'Search member' }], rationale: 'Accessible name is primary, rendered text is secondary.' } },
    { id: 'profile', kind: 'assert', expected: 'Member profile' },
    { id: 'balance', kind: 'extract', target: { strategy: 'css', value: '#savings-balance', fallback: [], rationale: 'The output is an application-owned, stable id; the preceding visible label gives a reviewer semantic context.' }, output: 'savingsBalance' }
  ]
});
module.exports = { Capability, lookupCapability };
