import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.');
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const allTrue = object => Object.values(object || {}).every(value => value === true);
const empty = value => Array.isArray(value) && value.length === 0;

const [dataset, determinism, algorithm, three, compliance, report, core, motion, ui, visual, inspection, recovery] = await Promise.all([
  readJson('output/playwright/stage3/dataset/demo-dataset-summary.json'),
  readJson('output/playwright/stage3/algorithm/determinism-summary.json'),
  readJson('output/playwright/stage3/algorithm/single-algorithm-gate.json'),
  readJson('output/playwright/stage3/three/three-gate.json'),
  readJson('output/playwright/stage3/compliance/evidence-linkage-gate.json'),
  readJson('output/playwright/stage3/report/export-consistency.json'),
  readJson('output/playwright/core-e2e/results.json'),
  readJson('output/playwright/three-motion/results.json'),
  readJson('output/playwright/ui-states/results.json'),
  readJson('output/playwright/final/results.json'),
  readJson('output/playwright/stage3/visual-audit/visual-inspection.json'),
  readJson('output/playwright/stage3/database-recovery.json')
]);

const staleDemoPattern = [
  'NB2026', '-0418', '|\\b', String(660 + 1), '\\b|\\b', String(200 + 3), '\\b'
].join('');
const staleDocs = spawnSync('rg', [
  '-n', `${staleDemoPattern}|INCOMPLETE|尚未实现|源码尚未`,
  'docs/codex', '-g', '*.md'
], { cwd: root, encoding: 'utf8' });
const staleProduct = spawnSync('rg', [
  '-n', `${staleDemoPattern}|SKU-D22|yonggui\\.web\\.session\\.v1`,
  'web-dashboard/src', 'backend/routes/packing.js', 'backend/models/Cargo.js', 'backend/services/FastBlockPackingEngine.js',
  '-g', '!*.test.js'
], { cwd: root, encoding: 'utf8' });

const gitStatus = execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();

const assertions = {
  dataset: dataset.skuCount === 10
    && dataset.destinationPortCount === 3
    && dataset.batchCount === 7
    && dataset.attributeCoverage.length >= 6
    && dataset.manualSkus.length >= 2
    && dataset.forkliftSkus.length >= 2
    && allTrue(dataset.datasetAssertions),
  determinism: determinism.runs.length === 3
    && determinism.runs.every(run => run.loaded === 221 && run.unloaded === 0 && allTrue(run.assertions))
    && allTrue(determinism.assertions),
  algorithm: allTrue(algorithm.assertions)
    && empty(algorithm.pageErrors)
    && empty(algorithm.unexpectedResponses)
    && empty(algorithm.unexpectedConsoleErrors),
  three: allTrue(three.assertions)
    && three.actorEvidence.manual.samples >= 100
    && three.actorEvidence.forklift.samples >= 100
    && three.labelEvidence.maxOverlap === 0
    && empty(three.consoleErrors) && empty(three.pageErrors) && empty(three.responseErrors),
  compliance: allTrue(compliance.assertions)
    && compliance.pdfDocuments.length === 3
    && compliance.linkage.length >= 5
    && empty(compliance.pageErrors)
    && empty(compliance.unexpectedResponseErrors)
    && empty(compliance.unexpectedConsoleErrors),
  report: allTrue(report.assertions)
    && report.csv.rows === 221
    && report.csv.columns === 27
    && report.json.schemaVersion === 2
    && empty(report.consoleErrors) && empty(report.pageErrors) && empty(report.responseErrors),
  core: allTrue(core.assertions)
    && empty(core.consoleErrors) && empty(core.pageErrors) && empty(core.failedRequests) && empty(core.badResponses),
  motion: allTrue(motion.assertions) && empty(motion.consoleErrors) && empty(motion.pageErrors),
  uiFailures: Object.keys(ui.scenarios).length === 15
    && allTrue(ui.assertions)
    && empty(ui.unexpectedResponseErrors)
    && empty(ui.unexpectedConsoleErrors)
    && empty(ui.unexpectedFailedRequests),
  responsive: visual.captures.length === 18
    && allTrue(visual.assertions)
    && empty(visual.consoleErrors) && empty(visual.pageErrors) && empty(visual.failedRequests) && empty(visual.badResponses),
  inspected: inspection.verdict === 'PASS'
    && Object.values(inspection.checks).every(value => value === 0),
  databaseRecovered: recovery.verdict === 'RECOVERED'
    && recovery.parsedRows === 20
    && recovery.restoredRows === 20
    && recovery.readbackRows === 20,
  noStaleDocs: staleDocs.status === 1 && !staleDocs.stdout,
  noStaleProductData: staleProduct.status === 1 && !staleProduct.stdout,
  gitIdentityPreserved: branch === 'codex/sol'
    && head === 'ef47171694c44feb086d4875a95732f79ed229f9'
};

assert.equal(allTrue(assertions), true, JSON.stringify(assertions, null, 2));

const result = {
  generatedAt: new Date().toISOString(),
  verdict: 'PASS',
  assertions,
  evidenceBundles: Object.keys(assertions).length,
  git: {
    branch,
    head,
    statusEntries: gitStatus.length,
    deletedTracked: gitStatus.filter(line => line.slice(0, 2).includes('D')).length,
    modifiedTracked: gitStatus.filter(line => line.slice(0, 2).includes('M')).length,
    untracked: gitStatus.filter(line => line.startsWith('??')).length
  }
};

const output = path.join(root, 'output/playwright/stage3/final-evidence-audit.json');
await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
