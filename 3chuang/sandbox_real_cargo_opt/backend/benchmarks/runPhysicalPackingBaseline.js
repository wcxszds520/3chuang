'use strict';

const fs = require('fs');
const path = require('path');
const HybridConstraintPackingSolverV2 = require('../services/HybridConstraintPackingSolverV2');
const { analyzeLayoutQuality } = require('../services/packing/LayoutQualityAnalyzer');
const { analyzeSecuring } = require('../services/packing/SecuringAnalyzer');
const { analyzeOperationFeasibility } = require('../services/packing/CanonicalOperationFeasibility');
const { buildProjectBenchmarkCases } = require('./projectBenchmarkCases');

async function runPhysicalPackingBaseline({ outputDirectory = path.resolve(__dirname, '../../artifacts/competition-2.3') } = {}) {
  const projectCases = await buildProjectBenchmarkCases();
  const legacyReplay = await import(pathToFileUrl(path.resolve(__dirname, '../../web-dashboard/src/three/operation/geometry.js')));
  const operationMachine = await import(pathToFileUrl(path.resolve(__dirname, '../../web-dashboard/src/three/operation/operationMachine.js')));
  const datasets = {};
  const crossSectionRows = [];
  for (const benchmarkCase of projectCases) {
    const strategies = {};
    for (const strategy of ['SPACE', 'BALANCE', 'OPERATION']) {
      const result = await new HybridConstraintPackingSolverV2().generatePackingPlan(benchmarkCase.cargoList, benchmarkCase.container, { strategy });
      const layoutQuality = analyzeLayoutQuality({ placements: result.loadedCargo, container: benchmarkCase.container, cargoList: benchmarkCase.cargoList });
      const securing = analyzeSecuring({ placements: result.loadedCargo, container: benchmarkCase.container, layoutQuality });
      const operationFeasibility = analyzeOperationFeasibility({ placements: result.loadedCargo, container: benchmarkCase.container });
      const legacyOperation = analyzeLegacyReplay(result.loadedCargo, benchmarkCase.container, legacyReplay, operationMachine);
      strategies[strategy] = {
        algorithm: result.metrics.algorithm,
        placementHash: placementHash(result.loadedCargo),
        loadedCount: result.metrics.loadedCount,
        loadedVolume: result.metrics.loadedVolume,
        volumeUtilization: result.metrics.volumeUtilization,
        loadedWeight: result.metrics.loadedWeight,
        lateralCog: result.metrics.cog.lateral,
        longitudinalCog: result.metrics.cog.longitudinal,
        cogWithinPolicy: result.metrics.cog.withinPolicy,
        geometricStability: result.metrics.stability,
        legacyCompactness: result.metrics.compactness,
        operationCost: result.metrics.operation.totalCost,
        solveMs: result.metrics.solveMs,
        layoutQuality: withoutCrossSectionReport(layoutQuality),
        securing,
        actualOperationBlockedCount: legacyOperation.blockedCount,
        actualOperationFirstBlocked: legacyOperation.firstBlocked,
        canonicalOperationFeasibility: operationFeasibility,
        validator: {
          status: result.validator.status,
          hardViolationCount: result.validator.hardViolationCount,
          lifo: result.validator.checks.lifo,
          insertion: result.validator.checks.insertion
        }
      };
      for (const row of layoutQuality.crossSectionReport) crossSectionRows.push({ dataset: benchmarkCase.id, strategy, ...row });
    }
    datasets[benchmarkCase.id] = { label: benchmarkCase.label, dataClassification: benchmarkCase.dataClassification, strategies };
  }
  const report = {
    benchmarkId: 'PORTCUBE-COMPETITION-2.3-V2.1-BASELINE',
    generatedAt: new Date().toISOString(),
    solver: 'hybrid-v2',
    solverDisplayVersion: '2.1',
    coordinateContract: { lengthAxis: 'x', gravityAxis: 'y', widthAxis: 'z', doorSide: 'higher x coordinate', closedEnd: 'lower x coordinate' },
    datasets
  };
  fs.mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = path.join(outputDirectory, 'v2.1-baseline.json');
  const csvPath = path.join(outputDirectory, 'v2.1-cross-sections.csv');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(csvPath, toCsv(crossSectionRows), 'utf8');
  return { report, jsonPath, csvPath };
}

function analyzeLegacyReplay(placements, container, geometry, machine) {
  const queue = machine.buildOperationQueue(placements, container);
  const placed = [];
  const blocked = [];
  for (let index = 0; index < queue.length; index++) {
    const cargo = queue[index];
    const path = geometry.buildCargoPath(cargo, container, index);
    const result = geometry.validateCargoPath(cargo, container, placed, path.entry);
    if (!result.valid) blocked.push({ step: index + 1, cargoId: cargo.cargoId, reasons: result.reasons });
    placed.push(cargo);
  }
  return { blockedCount: blocked.length, firstBlocked: blocked[0] || null };
}

function withoutCrossSectionReport(layoutQuality) {
  const { crossSectionReport: _crossSectionReport, gapClassifications, ...summary } = layoutQuality;
  return { ...summary, gapClassificationCount: gapClassifications.length };
}

function placementHash(placements) {
  const text = placements.map((item) => `${item.cargoId}:${round(item.x)}:${round(item.y)}:${round(item.z)}:${round(item.l)}:${round(item.w)}:${round(item.h)}`).join('|');
  let hash = 2166136261;
  for (const character of text) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function toCsv(rows) {
  const headers = ['dataset', 'strategy', 'sliceIndex', 'slicePosition', 'sliceStart', 'sliceEnd', 'fillRatio', 'occupiedArea', 'internalVoid'];
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csv(row[header])).join(',')).join('\n')}\n`;
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function pathToFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return `file:///${normalized.replace(/^\//, '')}`;
}

function round(value) { return Math.round(Number(value || 0) * 1000) / 1000; }

if (require.main === module) {
  runPhysicalPackingBaseline().then(({ report, jsonPath, csvPath }) => {
    process.stdout.write(`${JSON.stringify({ benchmarkId: report.benchmarkId, jsonPath, csvPath, datasets: Object.fromEntries(Object.entries(report.datasets).map(([id, dataset]) => [id, Object.fromEntries(Object.entries(dataset.strategies).map(([strategy, result]) => [strategy, {
      loadedCount: result.loadedCount,
      volumeUtilization: result.volumeUtilization,
      internalVoidVolume: result.layoutQuality.internalVoidVolume,
      lowFillInteriorSliceCount: result.layoutQuality.lowFillInteriorSliceCount,
      largestContiguousReserve: result.layoutQuality.largestContiguousReserve,
      actualOperationBlockedCount: result.actualOperationBlockedCount,
      canonicalOperationBlockedCount: result.canonicalOperationFeasibility.blockedCount,
      solveMs: result.solveMs
    }]))])) }, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { runPhysicalPackingBaseline, placementHash };
