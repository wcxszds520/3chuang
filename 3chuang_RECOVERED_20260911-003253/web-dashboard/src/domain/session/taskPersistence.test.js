import {describe,it,expect} from 'vitest';
import {sessionFromPackingCase} from './taskPersistence.js';
import {loadSession,saveSession} from '../../app/session/sessionStorage.js';

describe('persisted task rehydration',()=>{
  it('retains source facts, null mass, capabilities and exact placements',()=>{
    const cargo=[{cargoId:'x',quantity:1,length:100,width:200,height:300,weight:null,externalMetadata:{geometryType:'BOX'},orientationConstraints:{lengthVertical:false,widthVertical:false,heightVertical:true}}];
    const plan={planId:'PLAN_x',loadedCargo:[{cargoId:'x_1',sourceCargoId:'x',x:0,y:0,z:0,l:100,w:200,h:300,orientationId:'LWH'}]};
    const context={dataClassification:'ACADEMIC_BENCHMARK',taskIdentity:{orderId:'SOURCE_X',sessionTaskId:'TASK_x'},sourceContainer:{innerLength:1000,innerWidth:1000,innerHeight:1000,maxWeight:null},solverMode:'SOURCE_BENCHMARK',datasetCapabilities:{weight:'NOT_PROVIDED'}};
    const session=sessionFromPackingCase({caseId:'CASE_x',cargoSnapshot:cargo,containerType:'SOURCE_BIN',packingPlanId:'PLAN_x',packingPlan:plan,contextSnapshot:context});
    expect(session.dataClassification).toBe('ACADEMIC_BENCHMARK');expect(session.cargo).toEqual(cargo);expect(session.backendPlan).toEqual(plan);
    expect(session.sourceContainer).toEqual(context.sourceContainer);
    expect(session.datasetCapabilities).toEqual(context.datasetCapabilities);
    expect(session.order.orderNo).toBe('SOURCE_X');expect(session.packingCase.caseId).toBe('CASE_x');
  });
  it('rejects mismatched persisted plan ID',()=>{
    expect(()=>sessionFromPackingCase({caseId:'CASE_x',cargoSnapshot:[],packingPlanId:'A',packingPlan:{planId:'B'}})).toThrow('不一致');
  });
  it('does not manufacture cargo defaults or change input identity on refresh',()=>{
    const cargo=[{cargoId:'C1',length:100,width:200,height:300,weight:20,quantity:1}];
    const plan={planId:'PLAN_1',loadedCargo:[],sourceCode:'BACKEND_SOLVED'};
    const original=sessionFromPackingCase({caseId:'CASE_1',containerType:'40HQ',cargoSnapshot:cargo,packingPlanId:'PLAN_1',packingPlan:plan});
    const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
    expect(saveSession(original,storage)).toBe(true);
    const restored=loadSession(storage);
    expect(restored.cargo).toEqual(cargo);
    expect(restored.backendPlanFingerprint).toBe(original.backendPlanFingerprint);
  });
});
