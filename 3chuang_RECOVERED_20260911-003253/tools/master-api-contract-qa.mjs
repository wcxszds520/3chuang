import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = new URL('../artifacts/master-rebuild-20260922/api/', import.meta.url);
const cases = JSON.parse(await fs.readFile(new URL('../artifacts/master-rebuild-20260922/algorithm/cases.json', import.meta.url), 'utf8'));
const bearing = cases.find(c => c.id === 'bearing-limit');
const input = { containerType: '20GP', containerMode: 'ACTUAL_CONTAINER',
  actualContainer: { ...bearing.container, maxGross: 7000, tare: 2000, source: 'SYNTHETIC_API_CONTRACT_TEST' },
  cargoList: bearing.cargoList, caseContext: { caseId: 'ISOLATED-BEARING-TEST', dataClassification: 'SYNTHETIC_BENCHMARK' },
  options: { includeAiExplanation: false, persist: false } };
const results = [];
async function call(name, path, body) {
  const response = await fetch(`http://127.0.0.1:13000/api/${path}`, body ? { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const payload = await response.json();
  await fs.writeFile(new URL(`${name}.json`, dir), JSON.stringify({ status: response.status, input: body ?? null, payload }, null, 2));
  return { status: response.status, payload };
}
const gate = await call('bearing-limit-http', 'packing/generate', input);
assert.equal(gate.status, 400);
assert.equal(gate.payload.code, 'NO_HARD_FEASIBLE_PLAN');
assert.equal(gate.payload.data.bestCandidate.loadedCount, 16);
assert.equal(gate.payload.data.bestCandidate.checks.carrying, true);
assert.ok(gate.payload.data.bestCandidate.operationBlockedCount > 0);
results.push({ name: 'limited top load respected; geometric candidate rejected by operation gate', status: 'PASS',
  loadedCandidate: 16, formalPlanReturned: false, code: gate.payload.code });
const dimensions = await call('missing-actual-dimensions-http', 'packing/generate', { ...input, actualContainer: { maxGross: 7000, tare: 2000 } });
assert.equal(dimensions.status, 400);
assert.equal(dimensions.payload.code, 'PACKING_INPUT_INVALID');
results.push({ name: 'actual dimensions cannot be inherited from reference', status: 'PASS' });
const retired = await call('retired-preset-http', 'ai-packing/demo/preset-plan');
assert.equal(retired.status, 410);
assert.equal(retired.payload.code, 'PRESET_RESULT_RETIRED');
results.push({ name: 'preset success endpoint retired', status: 'PASS' });
await fs.writeFile(new URL('http-contract-summary.json', dir), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify(results));
