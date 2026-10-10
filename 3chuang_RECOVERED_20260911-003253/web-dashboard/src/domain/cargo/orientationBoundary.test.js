import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { canonicalDirectionObject } from './orientationBoundary.js';
import { normalizeCargo, cargoFingerprint } from './cargo.js';
import { orientationProjection } from './externalDatasets.js';
import { buildPackingRequest, normalizeBackendPlan } from '../../services/packingApi.js';
const require = createRequire(import.meta.url);
const { normalizeCargoPhysicalProfile } = require('../../../../backend/services/packing/PackagingProfile.js');
const { resolveOrientationRules } = require('../../../../backend/services/packing/OrientationConstraint.js');
const Cargo = require('../../../../backend/models/Cargo.js');
const box = { cargoId:'R1-SYNTHETIC',sku:'R1',name:'R1 synthetic',length:300,width:200,height:100,weight:10,quantity:1,destinationPort:'Hamburg' };
const hOnly = {lengthVertical:false,widthVertical:false,heightVertical:true};
function roundTrip(cargo) {
  const request=JSON.parse(JSON.stringify(buildPackingRequest({containerType:'40HQ',cargoList:[normalizeCargo(cargo)],includeAiExplanation:false})));
  return new Cargo(normalizeCargoPhysicalProfile(request.cargoList[0]));
}
describe('R1 adapter DTO JSON boundaries', () => {
  test.each([[0,false],[1,true],['0',false],['1',true],[false,false],[true,true]])('explicit indicator %p', (value,expected) => {
    expect(canonicalDirectionObject({heightVertical:value}).heightVertical).toBe(expected);
  });
  test.each([2,-1,'false',{},[]])('invalid indicator survives to rejection %p', value => {
    expect(()=>roundTrip({...box,orientationConstraints:{...hOnly,heightVertical:value}})).toThrow(/ORIENTATION|Orientation/);
    expect(orientationProjection({...hOnly,heightVertical:value}).status).toBe('INVALID');
  });
  test('numeric adapter and JSON/Cargo model keep H-only permissions', () => {
    const cargo=roundTrip({...box,orientationConstraints:{lengthVertical:'0',widthVertical:0,heightVertical:'1'}});
    expect(resolveOrientationRules(cargo).orientations.map(o=>o.id)).toEqual(['LWH','WLH']);
    expect(cargo.orientationConstraints).toEqual(hOnly);
  });
  test('000 fails before formal solve', () => expect(()=>roundTrip({...box,orientationConstraints:{lengthVertical:0,widthVertical:0,heightVertical:'0'}})).toThrow(/UNSATISFIABLE/));
  test('empty top with nested H-only survives normalization', () => expect(resolveOrientationRules(roundTrip({...box,orientationConstraints:{},cargoPhysicalProfile:{orientationConstraints:hOnly}})).orientations.map(o=>o.id)).toEqual(['LWH','WLH']));
  test('nested contradictory copy is not erased', () => expect(()=>roundTrip({...box,orientationConstraints:hOnly,cargoPhysicalProfile:{solverEnvelope:{orientationConstraints:{...hOnly,lengthVertical:true}}}})).toThrow(/Conflicting copies/));
  test('external metadata conflict not lost in DTO', () => expect(()=>roundTrip({...box,orientationConstraints:hOnly,externalMetadata:{orientationConstraints:{...hOnly,widthVertical:true}}})).toThrow(/Conflicting copies/));
  test('independent hard business policy is intersected', () => expect(()=>roundTrip({...box,orientationPolicy:'FIXED_ORIENTATION',orientationConstraints:{lengthVertical:true,widthVertical:false,heightVertical:false}})).toThrow(/UNSATISFIABLE/));
  test('derived external flags do not override W-only', () => expect(resolveOrientationRules(roundTrip({...box,source:'external-dataset-copy',orientationPolicySource:'DERIVED_EXTERNAL',orientationPolicy:'HORIZONTAL_ROTATION_ONLY',orientationConstraints:{lengthVertical:false,widthVertical:true,heightVertical:false}})).orientations.map(o=>o.id)).toEqual(['LHW','HLW']));
  test('ORTEC partial flags displayed unsupported', () => expect(orientationProjection({x:'0',y:'0',z:'1'}).status).toBe('UNSUPPORTED'));
  test('real Renault annotation stays supported', () => expect(orientationProjection({mode:'FREE',mappingStatus:'SUPPORTED'}).status).toBe('DIRECTLY_SUPPORTED'));
  test('changed permissions change solve input fingerprint', () => expect(cargoFingerprint([normalizeCargo({...box,orientationConstraints:hOnly})],'40HQ')).not.toBe(cargoFingerprint([normalizeCargo({...box,orientationConstraints:{...hOnly,lengthVertical:true}})],'40HQ')));
  test('original 212 historic fingerprint remains c427d060', () => {
    const original=require('../../../../artifacts/algo-repair/original-212-input.json');
    // Historical UI fingerprint is computed after hydrateCargo/normalizeCargo.
    expect(cargoFingerprint(original.cargoList.map(normalizeCargo),'40HQ')).toBe('c427d060');
  });
  test('API response reader preserves complete linked metadata', () => {
    const item={cargoId:'R1-SYNTHETIC_1',sourceCargoId:'R1-SYNTHETIC',l:300,w:200,h:100,x:0,y:0,z:0,weight:10,orientationId:'LWH',axisMap:{containerX:'L',containerY:'H',containerZ:'W'},uprightOriginalAxis:'H',orientationConstraints:hOnly};
    const plan=normalizeBackendPlan({code:200,data:{loadedCargo:[item],unloadedCargo:[],containerInfo:{typeId:'40HQ',innerLength:12032,innerWidth:2352,innerHeight:2698},metrics:{}}},{containerType:'40HQ',cargoList:[box]});
    expect(JSON.parse(JSON.stringify(plan)).loadedCargo[0]).toMatchObject(item);
  });
});
