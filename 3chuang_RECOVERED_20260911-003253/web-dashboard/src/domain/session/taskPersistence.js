import {createInitialSession} from './initialSession.js';
import {planningFingerprint} from '../plan/planRevision.js';
import {normalizeBackendPlan} from '../../services/packingApi.js';

export function sessionFromPackingCase(record) {
  if(!record?.caseId || !Array.isArray(record.cargoSnapshot)) throw new Error('任务快照不完整');
  const context=record.contextSnapshot || {}, rawPlan=record.packingPlan;
  if(rawPlan && rawPlan.planId!==record.packingPlanId) throw new Error('任务与方案 ID 不一致');
  const base=createInitialSession({dataset:'legacy'});
  const cargo=structuredClone(record.cargoSnapshot);
  const plan=rawPlan?.containerInfo ? normalizeBackendPlan(rawPlan,{containerType:record.containerType,cargoList:cargo}) : rawPlan;
  const session = {...base,...context,
    dataClassification:context.dataClassification ?? cargo[0]?.dataClassification ?? 'UNKNOWN',
    sessionTaskId:context.taskIdentity?.sessionTaskId || base.sessionTaskId,
    order:{orderNo:context.taskIdentity?.orderId || record.caseId},caseContext:context.caseContext||{},
    cargo,selectedContainerType:record.containerType,
    packingCase:record,backendPlan:plan || null,
    backendPlanFingerprint:null,
    strategyPlans:plan?{SPACE:plan}:{},selectedStrategy:'SPACE',planStatus:plan?'ready':'preview',
    executionStatus:{...context.executionStatus,persistence:'SAVED'},
    dataSource:{...base.dataSource,cargo:'已保存任务的原始货物快照',plan:plan?'BACKEND_SOLVED':'LOCAL_PREVIEW'}
  };
  session.backendPlanFingerprint = plan ? planningFingerprint(session) : null;
  return session;
}
