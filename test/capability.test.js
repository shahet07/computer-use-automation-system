const test = require('node:test'); const assert = require('node:assert/strict');
const { Capability, lookupCapability } = require('../src/capability'); const { redact } = require('../src/engine');
test('capability is versioned and exposes a clear invocation contract', () => { const c=Capability.parse(lookupCapability); assert.equal(c.schemaVersion,'1.0'); assert.equal(c.inputs[0].name,'memberId'); assert.equal(c.outputs[0].name,'savingsBalance'); });
test('redaction removes long account-like numbers', () => assert.equal(redact('member 12345678 failed'),'member 12*** failed'));
