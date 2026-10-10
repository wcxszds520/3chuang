import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'web-dashboard/public/review-evidence');
await fs.mkdir(out, { recursive: true });
const specifications = [
  { id: 'contracts', title: '后端关键合同测试', source: 'artifacts/master-rebuild-20260922/final-verification.json', file: 'backend-contracts.json',
    summarize: value => ({ ...value }), result: value => `${value.uniqueSuites} 组测试，${value.passed} 项通过、${value.failed} 项失败。`, scope: '定向合同测试；不是全部历史后端测试通过。' },
  { id: 'replan', title: '42 件货物的实际求解与重排', source: 'artifacts/master-rebuild-20260922/api/summary.json', file: 'replan-api.json',
    summarize: value => value, result: value => { const item = value.find(item => item.name === 'demo42-replan-width'); return `重排后装入 ${item.loaded} 件；${item.diff.unchanged} 件位置保持、${item.diff.moved} 件移动。数据库保存：${item.persistence}。`; }, scope: '本机 API、演示货单；不代表行业平均效果或云端持久化。' },
  { id: 'browser', title: '真实浏览器端到端操作', source: 'artifacts/master-rebuild-20260922/browser/browser-qa.json', file: 'browser-flow.json',
    summarize: value => ({ startedAt: value.startedAt, channel: value.channel, checks: value.checks, console: value.console, pageErrors: value.pageErrors, failedResponses: value.failedResponses }),
    result: value => `${value.checks.filter(check => check.status === 'PASS').length} 项操作检查通过；覆盖输入变更、失效、重排、版本比较和刷新。`, scope: '历史 Chromium 实际交互记录；不等同于所有设备、所有输入均通过。' },
  { id: 'simulation', title: '连续装载模拟回放', source: 'artifacts/master-rebuild-20260922/browser/operation-browser-qa.json', file: 'operation-replay.json',
    summarize: value => ({ startedAt: value.startedAt, finishedAt: value.finishedAt, channel: value.channel, status: value.status, planId: value.planId, placementHash: value.placementHash, final: value.final, state: value.state, errors: value.errors, console: value.console }),
    result: value => `${value.final.completedCount} 件连续回放完成；现场状态仍为 UNKNOWN。`, scope: '装载模拟；未证明现场设备执行或完整卸载流程。' }
];
const checks = [];
for (const spec of specifications) {
  const bytes = await fs.readFile(path.join(root, spec.source));
  const value = JSON.parse(bytes);
  const record = { provenance: { source: spec.source, sourceSha256: createHash('sha256').update(bytes).digest('hex'), kind: 'HISTORICAL_EVIDENCE_PROJECTION', generatedAt: new Date().toISOString() }, evidence: spec.summarize(value) };
  const output = JSON.stringify(record, null, 2) + '\n';
  await fs.writeFile(path.join(out, spec.file), output);
  checks.push({ id: spec.id, title: spec.title, result: spec.result(value), scope: spec.scope, file: spec.file, sha256: createHash('sha256').update(output).digest('hex') });
}
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ schema: 'portcube-historical-evidence/v1', generatedAt: new Date().toISOString(), evidenceDate: '2026-09-26', freshness: 'Historical records; generation does not rerun tests.', checks }, null, 2) + '\n');
console.log(`Wrote ${checks.length} historical evidence projections.`);
