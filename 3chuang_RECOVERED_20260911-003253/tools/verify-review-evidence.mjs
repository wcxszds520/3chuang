import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { stableSerialize } from '../web-dashboard/src/domain/plan/planRevision.js';
const file = process.argv[2];
if (!file) throw new Error('Usage: node tools/verify-review-evidence.mjs exported-evidence.json');
const { integrity, ...payload } = JSON.parse(await fs.readFile(file, 'utf8'));
const digest = value => createHash('sha256').update(stableSerialize(value)).digest('hex');
assert.equal(payload.schema, 'portcube-review-evidence/v1');
assert.equal(digest(payload), integrity.payloadSha256, 'Payload changed after export');
assert.equal(digest(payload.inputs), payload.currentInputSha256, 'Input identity mismatch');
if (payload.state !== 'CURRENT') assert.equal(payload.currentPlan, null, 'Stale or preview snapshot must not contain a current plan');
for (const revision of payload.revisions) if (revision.inputs) assert.equal(digest(revision.inputs), revision.inputSha256);
if (payload.currentRevisionId) {
  const revision = payload.revisions.find(item => item.revisionId === payload.currentRevisionId);
  assert.ok(revision?.inputBindingVerified);
  assert.equal(revision.inputSha256, payload.currentInputSha256);
  assert.equal(revision.planId, payload.currentPlan?.planId);
}
console.log(JSON.stringify({ status: 'PASS', state: payload.state, planId: payload.currentPlan?.planId ?? null,
  revisions: payload.revisions.length, boundary: 'Integrity comparison only; not a signature, provenance attestation or shipment authorization.' }, null, 2));
