import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createInitialSession } from '../web-dashboard/src/domain/session/initialSession.js';
import { buildPackingRequest } from '../web-dashboard/src/services/packingApi.js';
import { sessionReducer, SESSION_ACTIONS } from '../web-dashboard/src/app/session/sessionReducer.js';

const dir = new URL('../artifacts/master-rebuild-20260922/api/', import.meta.url);
await fs.mkdir(dir, { recursive: true });
const session = createInitialSession();
const input = buildPackingRequest({ containerType: session.selectedContainerType, cargoList: session.cargo,
  caseContext: session.caseContext, includeAiExplanation: false });
const results = [];
async function call(name, route, body) {
  const start = performance.now();
  const response = await fetch(`http://127.0.0.1:13000/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const data = await response.json();
  await fs.writeFile(new URL(`${name}.json`, dir), JSON.stringify(data, null, 2));
  const p = data.data;
  results.push({ name, httpStatus: response.status, elapsedMs: performance.now()-start, planId: p?.planId,
    loaded: p?.loadedCargo?.length, unloaded: p?.unloadedCargo?.length, valid: p?.validator?.valid,
    method: p?.replan?.method, diff: p?.replan?.diff?.counts, persistence: p?.executionStatus?.persistence, error: response.ok ? null : data.message });
  console.log(JSON.stringify(results.at(-1)));
  await fs.writeFile(new URL('summary.json', dir), JSON.stringify(results, null, 2));
  if (!response.ok) throw new Error(data.message);
  return p;
}
await fs.writeFile(new URL('demo-input.json', dir), JSON.stringify(input, null, 2));
const original = await call('demo42-initial', 'packing/generate', input);
if (original.loadedCargo.length !== 42 || !original.validator.valid) throw new Error('42件原始案例未全部通过校核');
const updatedSession = sessionReducer(session, { type: SESSION_ACTIONS.UPDATE_CARGO, cargoId: 'worksite-1-CASE',
  patch: { width: session.cargo.find(c => c.cargoId === 'worksite-1-CASE').width + 100 } });
const changed = buildPackingRequest({ containerType: updatedSession.selectedContainerType, cargoList: updatedSession.cargo,
  caseContext: updatedSession.caseContext, includeAiExplanation: false });
const next = await call('demo42-replan-width', 'packing/replan', { ...changed, previousPlan: original, previousCargo: input.cargoList, reason: '木箱实测宽度增加100mm（设计演示输入）' });
if (!next.validator.valid) throw new Error('重规划校核失败');
const again = await call('demo42-warm', 'packing/generate', input);
if (again.loadedCargo.length !== original.loadedCargo.length) throw new Error('重复求解件数不一致');
const environment = await (await fetch('http://127.0.0.1:13000/api/capabilities')).json();
await fs.writeFile(new URL('environment.json', dir), JSON.stringify(environment, null, 2));
console.log('MASTER_API_QA_COMPLETE');
