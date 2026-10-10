'use strict';
// Direction/gate unit tests must not connect to the user's database. Real HTTP
// and persistence evidence is captured separately from the isolated backend.
jest.mock('../../config/database', () => ({ query: jest.fn(), execute: jest.fn() }));
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const rules = require('../../services/packing/OrientationConstraint');
const Validator = require('../../services/packing/PlanValidator');
const { validateOrientationConstraints: validate } = Validator;
const Orchestrator = require('../../services/AlgorithmOrchestrator');
const box = { cargoId: 'BOX', sku: 'S', length: 300, width: 200, height: 100, weight: 10, quantity: 1, stackable: true, maxStackLayers: 3 };
const hOnly = { lengthVertical: false, widthVertical: false, heightVertical: true };
const mapL = { containerX: 'L', containerY: 'H', containerZ: 'W' };
const mapW = { containerX: 'W', containerY: 'H', containerZ: 'L' };
const placement = { cargoId: 'BOX_1', sourceCargoId: 'BOX', sku: 'S', x: 0, y: 0, z: 0, l: 300, w: 200, h: 100, weight: 10, orientationId: 'LWH', axisMap: mapL, uprightOriginalAxis: 'H', stackable: true, maxStackLayers: 3 };
const container = { innerLength: 300, innerWidth: 200, innerHeight: 100, maxWeight: 1000 };
const ids = cargo => rules.resolveAllowedOrientations(cargo).flatMap(o => o.semanticVariants?.map(v => v.id) || o.equivalentIds || [o.id]).sort();
const status = cargo => rules.resolveOrientationRules?.(cargo)?.status;
const codes = (placements, cargoList = [box], unloadedCargo) => new Validator().validate({ placements, cargoList, unloadedCargo, container }).violations.map(v => v.code);

describe('R1 manual source truth tables (not resolver-derived expected)', () => {
  test.each([
    ['000', []], ['001', ['LWH','WLH']], ['010', ['LHW','HLW']], ['100', ['WHL','HWL']],
    ['011', ['LWH','WLH','LHW','HLW']], ['101', ['LWH','WLH','WHL','HWL']],
    ['110', ['LHW','HLW','WHL','HWL']], ['111', ['LWH','WLH','LHW','WHL','HLW','HWL']]
  ])('vertical L/W/H %s', (bits, expected) => {
    const orientationConstraints = Object.fromEntries(['lengthVertical','widthVertical','heightVertical'].map((k,i) => [k,bits[i]==='1']));
    expect(ids({ ...box, orientationConstraints })).toEqual([...expected].sort());
    expect(status({ ...box, orientationConstraints })).toBe(bits === '000' ? 'UNSATISFIABLE' : 'VALID');
  });
  test.each([undefined, null, {}])('legacy absent placeholder %p', orientationConstraints => expect(status({ ...box, orientationConstraints })).toBe('ABSENT'));
  test('declared external empty cannot fall back', () => expect(status({ ...box, source: 'external-dataset-copy', orientationConstraints: {} })).toBe('INVALID'));
  test('empty top does not shadow nested H-only', () => expect(ids({ ...box, canLayFlat: true, orientationConstraints: {}, cargoPhysicalProfile: { orientationConstraints: hOnly } })).toEqual(['LWH','WLH']));
  test.each([[], 2, 'FREE', {lengthVertical:true}, {mode:'FREE',containerAxisAlignment:'LENGTHWISE'}])('invalid rule %p', orientationConstraints => {
    expect(status({ ...box, orientationConstraints })).toBe('INVALID');
    expect(ids({ ...box, orientationConstraints })).toEqual([]);
  });
  test('unknown mode unsupported', () => expect(status({ ...box, orientationConstraints: {mode:'SOMERSAULT'} })).toBe('UNSUPPORTED'));
  test('physical profile cannot hide invalid or conflicting dimensions', () => {
    expect(status({...box,length:NaN,cargoPhysicalProfile:{dimensions:{lengthMm:300,widthMm:200,heightMm:100}}})).toBe('INVALID');
    expect(status({...box,cargoPhysicalProfile:{dimensions:{lengthMm:301,widthMm:200,heightMm:100}}})).toBe('INVALID');
  });
  test('real Renault adapter annotation is not a permission or an unsupported rule', () => {
    expect(ids({...box,orientationConstraints:{mode:'FREE',mappingStatus:'SUPPORTED'}})).toEqual(['LWH','WLH']);
    expect(ids({...box,orientationConstraints:{containerAxisAlignment:'WIDTHWISE',mappingStatus:'CORE_EXTENSION_PENDING_SOLVER_SUPPORT'}})).toEqual(['WLH']);
  });
  test.each([0,1,'0','1',2,-1,'false',[],{}])('pure boolean rejects %p', value => {
    expect(status({ ...box, orientationConstraints: {...hOnly,heightVertical:value} })).toBe('INVALID');
  });
  test('equivalent copies retain provenance', () => {
    const result = rules.resolveOrientationRules?.({ ...box, orientationConstraints:hOnly, externalMetadata:{orientationConstraints:{heightVertical:true,widthVertical:false,lengthVertical:false}} });
    expect(result?.status).toBe('VALID'); expect(result?.sources).toHaveLength(2);
  });
  test('conflicting copies fail with both field paths', () => {
    const result=rules.resolveOrientationRules?.({ ...box, orientationConstraints:hOnly, externalMetadata:{orientationConstraints:{...hOnly,lengthVertical:true}} });
    expect(result?.status).toBe('INVALID'); expect(JSON.stringify(result?.errors)).toContain('externalMetadata.orientationConstraints');
  });
  test('independent families intersect', () => expect(ids({...box,orientationConstraints:{...hOnly,containerAxisAlignment:'WIDTHWISE'}})).toEqual(['WLH']));
  test.each([NaN,Infinity,-1,0,'invalid','300',true,null,undefined])('invalid dimension %p', length => {
    expect(status({...box,length})).toBe('INVALID'); expect(ids({...box,length})).toEqual([]);
  });
  test.each(['000','001','010','011','100','101','110','111'])('ORTEC %s source boundary', bits => {
    expect(status({...box,orientationConstraints:{x:bits[0]==='1',y:bits[1]==='1',z:bits[2]==='1'}})).toBe(bits==='111'?'VALID':'UNSUPPORTED');
  });
  test.each([
    [300,200,'FREE',['LWH','WLH']], [200,300,'FREE',['LWH','WLH']],
    [300,200,'LENGTHWISE',['LWH']], [200,300,'LENGTHWISE',['WLH']],
    [300,200,'WIDTHWISE',['WLH']], [200,300,'WIDTHWISE',['LWH']],
    [200,200,'LENGTHWISE',['LWH','WLH']], [200,200,'WIDTHWISE',[]], [200,200,'FREE',['LWH','WLH']]
  ])('Renault checker deltaX >= deltaY %s/%s %s', (length,width,mode,expected) => expect(ids({...box,length,width,orientationConstraints:mode==='FREE'?{mode}:{containerAxisAlignment:mode}})).toEqual([...expected].sort()));
});

describe('R1 coherent tuple and trustworthy source', () => {
  const cube = {...box,length:100,width:100,height:100,orientationConstraints:hOnly};
  const cp = {...placement,l:100,w:100,h:100};
  test('cube WLH survives geometry dedup', () => expect(validate({...cp,orientationId:'WLH',axisMap:mapW},cube).valid).toBe(true));
  test('linked semantic variants retained', () => expect(rules.resolveAllowedOrientations(cube)[0].semanticVariants).toEqual(expect.arrayContaining([expect.objectContaining({id:'LWH',axisMap:mapL,uprightOriginalAxis:'H'}),expect.objectContaining({id:'WLH',axisMap:mapW,uprightOriginalAxis:'H'})])));
  test.each([
    {orientationId:'WLH'}, {axisMap:mapW}, {uprightOriginalAxis:'L'},
    {canonicalOrientation:'WLH'}, {orientationAxisMap:mapW}, {orientation:'YXZ'},
    {axisMap:{containerX:'L',containerY:'L',containerZ:'W'}},
    {axisMap:{containerX:'X',containerY:'H',containerZ:'W'}}, {l:101}
  ])('rejects cube mismatch %p', mutation => expect(validate({...cp,...mutation},cube).valid).toBe(false));
  test('ambiguous historical geometry is explicitly unverified', () => expect(validate({l:100,w:100,h:100},cube)).toMatchObject({valid:true,verified:false,reason:'GEOMETRY_ONLY_UNVERIFIED'}));
  test('unique historical geometry reconstruction', () => expect(validate({l:300,w:200,h:100},{...box,orientationConstraints:hOnly})).toMatchObject({valid:true,verified:true,reconstructed:expect.objectContaining({id:'LWH'})}));
  test('unknown source cannot borrow same SKU', () => expect(codes([{...placement,sourceCargoId:'MISSING'}])).toContain('UNKNOWN_SOURCE_CARGO'));
  test('arbitrary prefix is not an instance ID', () => expect(codes([{...placement,sourceCargoId:undefined,cargoId:'BOX_forgeries',sku:undefined}])).toContain('UNKNOWN_SOURCE_CARGO'));
  test('duplicate SKU cannot overwrite source', () => expect(codes([{...placement,sourceCargoId:undefined,cargoId:'unmapped'}],[box,{...box,cargoId:'SECOND'}])).toContain('AMBIGUOUS_SOURCE_CARGO'));
  test('source ID and SKU conflict', () => expect(codes([{...placement,sku:'OTHER'}],[box,{...box,cargoId:'SECOND',sku:'OTHER'}])).toContain('SOURCE_IDENTITY_CONFLICT'));
  test('source ID and physical ID conflict', () => expect(codes([{...placement,cargoId:'SECOND_1'}],[box,{...box,cargoId:'SECOND',sku:'OTHER'}])).toContain('SOURCE_IDENTITY_CONFLICT'));
  test('duplicate physical ID', () => expect(codes([placement,placement])).toContain('DUPLICATE_CARGO_ID'));
  test('source overcount', () => expect(codes([placement,{...placement,cargoId:'BOX_2'}])).toContain('SOURCE_QUANTITY_EXCEEDED'));
  test('loaded plus unloaded overlap', () => expect(codes([placement],[box],[{...placement,reason:'test'}])).toContain('LOADED_UNLOADED_ID_CONFLICT'));
  test('final quantity conservation', () => expect(codes([],[box],[])).toContain('QUANTITY_CONSERVATION'));
  test('placement cannot relax trusted source rule', () => expect(codes([{...placement,l:100,w:200,h:300,orientationConstraints:{x:true,y:true,z:true}}],[{...box,orientationConstraints:hOnly}])).toContain('ORIENTATION'));
  test('valid partial loading accounts for unplaced unit', () => expect(codes([],[box],[{cargoId:'BOX_1',sourceCargoId:'BOX',sku:'S',reason:'NO_SPACE'}])).not.toContain('QUANTITY_CONSERVATION'));
});

describe('R1 legacy provenance and cache', () => {
  const prior = fs.readFileSync(path.resolve(__dirname,'../../../artifacts/industrial-constraints/batch-03.1-r1-1789124627230/pre-03.1-PlanValidator.js'),'utf8');
  const functionText = prior.slice(prior.indexOf('function legalOrientations(cargo)'),prior.indexOf('function unionArea'));
  const old = vm.runInNewContext(`(function(){ const number=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0;}; ${functionText}; return legalOrientations; })()`);
  const geometry = values => JSON.parse(JSON.stringify(values.map(v=>[v.l,v.w,v.h,v.label])));
  const policies = [undefined,'FIXED_ORIENTATION','UPRIGHT_ONLY','HORIZONTAL_ROTATION_ONLY','FULL_ROTATION_ALLOWED'];
  for(const orientationPolicy of policies) for(const canRotate of [undefined,false,true]) for(const canLayFlat of [undefined,false,true]) for(const canInvert of [undefined,false,true]) {
    test(`historical ${orientationPolicy}/${canRotate}/${canLayFlat}/${canInvert}`, () => {
      const cargo={...box,orientationPolicy,canRotate,canLayFlat,canInvert};
      if(['FIXED_ORIENTATION','UPRIGHT_ONLY'].includes(orientationPolicy)&&canLayFlat===true) {
        // Pre-03.1 allowed lying despite an explicit fixed/upright declaration. Reject the contradiction.
        expect(old(cargo).length).toBeGreaterThan(1); expect(status(cargo)).toBe('INVALID');
      } else expect(geometry(rules.resolveAllowedOrientations(cargo))).toEqual(geometry(old(cargo)));
    });
  }
  test('different permitted orientations change cache identity', () => {
    const key=c=>Orchestrator.prototype._generateCacheKey({cargoList:[c],container});
    expect(key({...box,orientationConstraints:hOnly})).not.toBe(key({...box,orientationConstraints:{...hOnly,lengthVertical:true}}));
  });
  test('equivalent copies preserve cache identity', () => {
    const key=c=>Orchestrator.prototype._generateCacheKey({cargoList:[c],container});
    expect(key({...box,orientationConstraints:hOnly})).toBe(key({...box,externalMetadata:{orientationConstraints:{heightVertical:true,lengthVertical:false,widthVertical:false}}}));
  });
  test('adapter-equivalent binary forms preserve cache identity', () => {
    const key=c=>Orchestrator.prototype._generateCacheKey({cargoList:[c],container});
    expect(key({...box,orientationConstraints:hOnly})).toBe(key({...box,orientationConstraints:{heightVertical:'1',lengthVertical:0,widthVertical:'0'}}));
  });
  test.each([
    ['UNKNOWN_SOURCE_CARGO',{...placement,sourceCargoId:'missing'}],
    ['ORIENTATION',{...placement,l:100,h:300,orientationConstraints:{x:true,y:true,z:true}}]
  ])('formal orchestrator rejects dishonest solver output %s', async (code,item) => {
    const engine=new Orchestrator();engine.cache={get:async()=>null,set:async()=>{throw new Error('invalid plan cached');}};
    engine._executeHybridV25Strategy=async()=>({loadedCargo:[item],unloadedCargo:[],validator:{valid:true},hardConstraintsPass:true});
    const result=await engine.execute({cargoList:[{...box,orientationConstraints:hOnly}],container,options:{algorithmId:'hybrid-v2.5'}});
    expect(result.success).toBe(false);expect(result.error.code).toBe('PLAN_INVALID');
    expect(result.error.validator.violations.map(v=>v.code)).toContain(code);
  });
  test('every candidate provider respects empty permissions', () => {
    const cargo={...box,orientationConstraints:{lengthVertical:false,widthVertical:false,heightVertical:false}};
    const Fast=require('../../services/FastBlockPackingEngine');
    const Builder=require('../../services/packing/CrossSectionLayerBuilder');
    const Floor=require('../../services/packing/FloorExtremePointCandidate');
    expect(new Fast()._getOrientationCandidates(cargo)).toEqual([]);
    expect(new Builder().build([cargo],container).placements).toEqual([]);
    expect(new Floor().build([cargo],container)?.placements || []).toEqual([]);
  });
});
