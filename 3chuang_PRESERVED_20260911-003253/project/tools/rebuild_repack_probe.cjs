const fs = require('fs');
const { generateLaneStackCandidates } = require('../backend/services/packing/LaneStackRepacking');
const { normalizeCargoList } = require('../backend/services/packing/PackagingProfile');
const { calculateCoG } = require('../backend/services/packing/PlanMetrics');
const PlanValidator = require('../backend/services/packing/PlanValidator');
const Solver = require('../backend/services/HybridConstraintPackingSolverV25');
const input = require('../artifacts/rebuild/original-212-input.json');
const old = require('../artifacts/rebuild/original-212-baseline.json').plan;
const cargoList = normalizeCargoList(input.cargo);
const context = { cargoList, container: input.container, strategy: 'SPACE', route: input.caseContext.route, caseContext: input.caseContext, validator: new PlanValidator() };
const candidates = generateLaneStackCandidates({ basePlacements: old.loadedCargo, cargoList, container: input.container });
const output = [];
for (const [i, candidate] of candidates.entries()) {
  const validation = candidate.complete ? context.validator.validate({ placements: candidate.placements, cargoList, container: input.container }) : null;
  const summary = { i, n: candidate.placements.length, preference: { model: candidate.evidence.model, explored: candidate.evidence.exploredStates, steps: candidate.evidence.cumulativeMoves?.length, envelope: candidate.evidence.envelopeVoidM3 }, complete: candidate.complete,
    gap: Math.min(...candidate.placements.map(item => item.x)), cog: calculateCoG(candidate.placements, input.container).longitudinal,
    mixed: candidate.evidence.multiPortBinCount, hard: validation?.hardViolationCount, codes: [...new Set(validation?.violations.map(v => v.code))], pending: candidate.evidence.pendingCargoIds };
  console.log(JSON.stringify(summary));
  if (candidate.complete && validation.valid) {
    const evaluated = Solver.evaluateCandidate({ ...context, candidateId: `LAYER_REPACK_${i}`, sourceAlgorithm: 'global-layer-reinsert', placements: candidate.placements, unloadedCargo: [], inheritedWarnings: [], inheritedConstraintMeta: { layerRepacking: candidate.evidence }, handlingAssumptions: [], translationRequested: false });
    summary.operation = evaluated.operationFeasibility.blockedCount;
    summary.port = evaluated.portAccessibility.status;
    summary.internal = evaluated.layoutQuality.internalVoidVolume / 1e9;
    summary.unexplained = evaluated.voidJustification.unexplainedVoidVolume / 1e9;
    console.log(JSON.stringify(summary));
    output.push({ summary, evaluated });
  } else output.push({ summary });
}
fs.writeFileSync('artifacts/rebuild/layer-repacking-search.json', JSON.stringify(output, null, 2));
