'use strict';
const AIPackingService = require('../../services/AIPackingService');
const { DeterministicComplianceEngine } = require('../../services/compliance/DeterministicComplianceEngine');
jest.mock('axios');
const axios = require('axios');

describe('AIPacking current-fact authority', () => {
  const container = {typeId:'20GP',innerLength:6000,innerWidth:2400,innerHeight:2400,maxWeight:100};
  const cargo = {cargoId:'A',name:'A',length:100,width:100,height:100,weight:200,quantity:1,stackable:false};
  const plan = {planId:'P1',loadedCargo:[{...cargo,x:100,y:0,z:100,l:100,w:100,h:100}],unloadedCargo:[],spaceUtilization:25};
  let service;
  beforeEach(() => { service = new AIPackingService(); service.apiKey=''; service.setDemoMode(false); axios.post.mockReset(); });
  test('a model cannot override an overweight verdict', async () => {
    service._callAI=jest.fn(async()=>JSON.stringify({complianceLevel:'excellent',score:100,risks:[],explanation:'模型建议'}));
    const report=await service.validateCompliance(plan,container);
    expect(report.status).toBe('FAIL');
    expect(report.complianceLevel).toBe('fail');
    expect(report.risks.some(r=>r.key==='payload')).toBe(true);
    expect(report.aiExplanation.authority).toBe('EXPLANATION_ONLY');
  });
  test('canonical vertical y and width z are used for center of gravity', async () => {
    const report=await service.validateCompliance(plan,container);
    expect(report.metrics.cog).toEqual({x:150,y:50,z:150});
    expect(report).toMatchObject({source:'LOCAL_RULES',aiUsed:false});
    expect(axios.post).not.toHaveBeenCalled();
  });
  test('empty and missing-mass plans cannot receive a pass', async () => {
    for (const loadedCargo of [[],[{...plan.loadedCargo[0],weight:null}]]) {
      const report=await service.validateCompliance({...plan,loadedCargo},container);
      expect(report.status).not.toBe('PASS');
      expect(report.reportTable.find(r=>r.key==='payload').result).toBe('REVIEW_REQUIRED');
      expect(report.reportTable.find(r=>r.key==='cog').result).toBe('REVIEW_REQUIRED');
    }
  });
  test('offline explanation uses this plan facts, not SKU-count presets', async () => {
    service.setOfflineMode(true);
    const report=await service.explainResult({...plan,spaceUtilization:12.3,totalWeight:200});
    expect(report).toMatchObject({source:'LOCAL_RULES',aiUsed:false});
    expect(report.explanation).toContain('12.3');
    expect(report.explanation).not.toMatch(/安全可靠|完全符合|不到10秒/);
  });
  test('explanation cache changes on placement, validation, or revision and is immutable', async () => {
    const first=await service.explainResult(plan);
    first.risks.push('injected');
    const again=await service.explainResult(structuredClone(plan));
    expect(again.cacheHit).toBe(true);
    expect(again.risks).not.toContain('injected');
    for (const changed of [ {...plan,planId:'P2'}, {...plan,validator:{valid:false}}, {...plan,loadedCargo:[{...plan.loadedCargo[0],x:200}]} ]) {
      expect((await service.explainResult(changed)).cacheHit).not.toBe(true);
    }
  });
  test('strategy cache binds full container and cargo constraints', async () => {
    await service.generateStrategy([cargo],container);
    expect((await service.generateStrategy([cargo],{...container,innerWidth:2000})).cacheHit).not.toBe(true);
    expect((await service.generateStrategy([{...cargo,stackable:true}],container)).cacheHit).not.toBe(true);
  });
  test('partial hazardous declarations remain unknown', () => {
    const report=new DeterministicComplianceEngine().evaluate({loadedCargo:[{...cargo,dangerous:false},{...cargo,cargoId:'B'}]});
    expect(report.reportTable.find(r=>r.key==='dangerous').result).toBe('REVIEW_REQUIRED');
    expect(report.reportTable.find(r=>r.key==='cog').result).toBe('REVIEW_REQUIRED');
  });
});
