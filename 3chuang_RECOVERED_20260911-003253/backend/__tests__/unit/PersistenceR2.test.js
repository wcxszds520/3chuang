const {normalizeInput,PackingCaseService,mapRow}=require('../../services/PackingCaseService');

describe('R2 task identity and source snapshot persistence',()=>{
  it('allocates a new case independently of order/source identity',()=>{
    const value=normalizeInput({cargoSnapshot:[],containerType:'SOURCE_BIN',taskIdentity:{orderId:'NB2026-0824-001',sourceCaseId:'NB2026-0824-001'}},{allowGeneratedId:true});
    expect(value.caseId).toMatch(/^CASE_[a-f0-9-]+$/);
    expect(value.contextSnapshot.taskIdentity.sourceCaseId).toBe('NB2026-0824-001');
  });
  it('preserves unknown facts and all runtime semantics through lossless JSON text',()=>{
    const input={caseId:'CASE_external',cargoSnapshot:[{cargoId:'source_1',weight:null,orientationConstraints:{lengthVertical:false,widthVertical:false,heightVertical:true}}],containerType:'SOURCE_BIN',solverMode:'SOURCE_BENCHMARK',benchmarkMode:'GEOMETRY_ONLY_BENCHMARK',sourceContainer:{innerLength:5870,innerWidth:2330,innerHeight:2200,maxWeight:null},datasetCapabilities:{weight:'NOT_PROVIDED'},executionStatus:{solve:'COMPLETED',validation:'VALID',persistence:'SAVED',benchmark:'FEASIBLE',businessReadiness:'NOT_APPLICABLE'}};
    const v=normalizeInput(input);
    const output=mapRow({case_id:v.caseId,cargo_snapshot:JSON.stringify(v.cargoSnapshot),container_type:v.containerType,context_snapshot:JSON.stringify(v.contextSnapshot)});
    expect(output.cargoSnapshot).toEqual(input.cargoSnapshot);
    expect(output.contextSnapshot).toMatchObject({solverMode:input.solverMode,benchmarkMode:input.benchmarkMode,sourceContainer:input.sourceContainer,datasetCapabilities:input.datasetCapabilities,executionStatus:input.executionStatus});
  });
  it('merges current context with explicit changes and rejects plan identity mismatch',()=>{
    expect(normalizeInput({caseId:'CASE_abc',cargoSnapshot:[],containerType:'40HQ',contextSnapshot:{solverMode:'SOURCE_BENCHMARK',actualContainer:{old:true}},actualContainer:{new:true}}).contextSnapshot).toEqual({solverMode:'SOURCE_BENCHMARK',actualContainer:{new:true}});
    expect(()=>normalizeInput({caseId:'CASE_abc',cargoSnapshot:[],containerType:'40HQ',packingPlanId:'PLAN_1',packingPlan:{planId:'PLAN_2'}})).toThrow('身份冲突');
  });
  it('update never inserts a missing case and cannot rename an existing task',async()=>{
    const db={query:jest.fn(async()=>[[]])},service=new PackingCaseService(db);
    service.schemaReady=true;
    expect(await service.update('CASE_missing',{})).toBeNull();
    expect(db.query.mock.calls.some(([sql])=>sql.includes('INSERT'))).toBe(false);
    service.get=jest.fn(async()=>({caseId:'CASE_a'}));
    await expect(service.update('CASE_a',{caseId:'CASE_b'})).rejects.toThrow('冲突');
  });
});
