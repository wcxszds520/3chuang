const fs = require('node:fs');
const { plan, session, container } = JSON.parse(fs.readFileSync('tmp/realism-baseline.json'));
const { attemptWallOrderRepair } = require('../backend/services/packing/WallOrderRepair');
const { evaluateCandidate } = require('../backend/services/HybridConstraintPackingSolverV25');
const PlanValidator = require('../backend/services/packing/PlanValidator');
const result = attemptWallOrderRepair({ baseCandidate:plan,container,evaluate:(placements,evidence)=>evaluateCandidate({candidateId:'WALL_REORDER',sourceAlgorithm:'wall-reorder',placements,unloadedCargo:plan.unloadedCargo,inheritedWarnings:[],inheritedConstraintMeta:{wallOrderRepair:evidence},cargoList:session.cargo,container,strategy:'SPACE',route:session.caseContext.route,caseContext:session.caseContext,validator:new PlanValidator()})});
fs.writeFileSync('tmp/realism-wall-result.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({promoted:result.promoted,reason:result.reason,evidence:result.evidence && {...result.evidence,wallMoves:undefined},candidate:result.candidate && {gap:Math.min(...result.candidate.loadedCargo.map(c=>c.x)),cog:result.candidate.cogOffset,hard:result.candidate.validator.hardViolationCount,operation:result.candidate.operationFeasibility.blockedCount,port:result.candidate.portAccessibility.blockedCount,rehandle:result.candidate.portAccessibility.rehandleCount,stability:result.candidate.metrics.stability.invalidCount}},null,2));
