import {describe,it,expect} from 'vitest';
import {createExternalTaskSession} from './externalDatasets.js';
import {buildPackingRequest} from '../../services/packingApi.js';
import {buildPackingCasePayload} from '../../services/caseApi.js';
import {cargoTotals,validateCargo} from './cargo.js';
import {buildActivePlanViewModel} from '../plan/activePlanViewModel.js';
import {sourceContainers,externalCapabilities,businessSimulationCapabilities} from '../../../../shared/externalCapabilities.mjs';
import {saveSession,loadSession} from '../../app/session/sessionStorage.js';
const dataset={source:'orlib_thpack',displayName:'THPACK',dataClassification:'ACADEMIC_BENCHMARK'};
const instance={id:'thpack1-synthetic',family:'thpack1',items:[{externalSource:'THPACK',externalInstance:'synthetic',externalItemId:'1',name:'test',lengthMm:500,widthMm:500,heightMm:500,weightKg:null,quantity:4,orientationConstraints:{lengthVertical:true,widthVertical:true,heightVertical:true}}],container:{lengthOriginal:100,widthOriginal:100,heightOriginal:100,originalUnit:'cm'}};
describe('Source runtime capability and unknown facts',()=>{
 it('defaults to source mode with actual container and no artificial freight assignment',()=>{
  const task=createExternalTaskSession(dataset,instance);
  expect(task.solverMode).toBe('SOURCE_BENCHMARK');expect(task.sourceContainer.innerLength).toBe(1000);
  expect(task.selectedContainerType).toBe(sourceContainers(dataset.source,instance)[0].typeId);
  expect(task.datasetCapabilities).toEqual(externalCapabilities(dataset.source,instance));
  expect(task.externalBusinessContext).toBeNull();expect(task.cargo[0].destinationPort).toBeNull();expect(task.cargo[0].portSequence).toBeNull();expect(task.caseContext).toEqual({});
  expect(validateCargo(task.cargo[0]).valid).toBe(true);
 });
 it('preserves unknown weight, capacity and absent stack limit through request and storage',()=>{
  const task=createExternalTaskSession(dataset,instance),request=buildPackingRequest({solverMode:task.solverMode,externalDataset:task.externalDataset,containerType:task.selectedContainerType,cargoList:task.cargo});
  expect(request.cargoList[0].weight).toBeNull();expect(request.cargoList[0].maxStackLayers).toBeUndefined();expect(task.sourceContainer.maxWeight).toBeNull();
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};saveSession(task,storage);
  const restored=loadSession(storage);expect(restored.cargo).toEqual(task.cargo);expect(restored.sourceContainer).toEqual(task.sourceContainer);expect(restored.datasetCapabilities).toEqual(task.datasetCapabilities);
  expect(cargoTotals(restored.cargo).weight).toBeNull();
 });
 it('view model does not invent 0 kg from an all-null plan',()=>{
  const task=createExternalTaskSession(dataset,instance),plan={containerInfo:task.sourceContainer,loadedCargo:[{weight:null}],totalCargoCount:1,totalWeight:null,sourceCode:'BACKEND_SOLVED'};
  const vm=buildActivePlanViewModel({session:task,plan,container:task.sourceContainer});expect(vm.totalWeight).toBeNull();expect(vm.weightRate).toBeNull();expect(vm.longitudinalCog).toBeNull();
 });
 it('retains split solve/validation/save/benchmark/business states',()=>{
  const task=createExternalTaskSession(dataset,instance),plan={planId:'REQ_SOURCE',sourceCode:'BACKEND_SOLVED',executionStatus:{validation:'VALID',benchmark:'SOURCE_CONSTRAINTS_VALID',businessReadiness:'NOT_APPLICABLE'}};
  expect(buildPackingCasePayload({session:task,plan}).executionStatus).toEqual({solve:'COMPLETED',validation:'VALID',persistence:'SAVED',benchmark:'SOURCE_CONSTRAINTS_VALID',businessReadiness:'NOT_APPLICABLE'});
 });
 it('THPACK 8 unconfirmed units and mesh stay browse-only',()=>{
  expect(externalCapabilities('orlib_thpack',{...instance,family:'thpack8'}).canSolve).toBe(false);
  expect(externalCapabilities('esicup_irregular',instance).canSolve).toBe(false);
 });
 it('does not advertise unknown source mass/pressure or non-111 rotation as solvable',()=>{
  expect(externalCapabilities('orlib_wtpack',instance).blockingReasons).toEqual(expect.arrayContaining(['INCOMPLETE_SOURCE_MASS','INCOMPLETE_SOURCE_PRESSURE']));
  expect(externalCapabilities('ortec_alonso_2019',instance).blockingReasons).toContain('UNSUPPORTED_SOURCE_ORIENTATION');
  expect(businessSimulationCapabilities('orlib_wtpack').canSolve).toBe(false);
 });
});
