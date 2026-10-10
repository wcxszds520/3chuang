import { describe, expect, it } from 'vitest';
import { createExternalTaskSession, expandExternalCargoForSolver, externalItemToCargo, persistExternalTaskCopy } from './externalDatasets.js';
import { buildPackingRequest } from '../../services/packingApi.js';

const item = { externalSource: 'OR-Library WTPACK', externalDataset: 'wtpack1', externalInstance: '1', externalItemId: '1', name: 'box', packagingType: null, lengthMm: 1080, widthMm: 760, heightMm: 300, weightKg: 246.24, quantity: 3, orientationConstraints: { lengthVertical: false, widthVertical: false, heightVertical: true }, stackability: 'UNKNOWN', loadBearing: { lengthUpright: 0.1 }, loadBearingUnit: 'kg/cm²', loadBearingSourceDefinition: 'pressure', hazardous: null, destination: null, unknownFields: ['packagingType', 'stackability', 'hazardous', 'destination', 'normalizedLoadBearingKg'] };

describe('external dataset task copies', () => {
  it('preserves source values and never maps pressure to supported kg', () => {
    const cargo = externalItemToCargo(item, 'ACADEMIC_BENCHMARK');
    expect(cargo).toMatchObject({ name: '设备板件套装', length: 1080, width: 760, height: 300, weight: 246.24, quantity: 3, maxSupportedWeight: null, stackable: null, dangerous: null, destinationPort: null, handlingMethod: null, packagingMaterial: null });
    expect(cargo.externalMetadata.loadBearingUnit).toBe('kg/cm²');
    expect(cargo.orientationConstraints).toEqual(item.orientationConstraints);
    expect(cargo.externalMetadata.mappingSupport.unsupportedConstraints).toContain('来源承压参数（kg/cm²）');
  });
  it('expands quantities with stable independent cargo ids and conserved count', () => {
    const expanded = expandExternalCargoForSolver([externalItemToCargo(item, 'ACADEMIC_BENCHMARK')]);
    expect(expanded).toHaveLength(3);
    expect(new Set(expanded.map((entry) => entry.cargoId)).size).toBe(3);
    expanded[0].externalMetadata.name = 'changed';
    expect(expanded[1].externalMetadata.name).toBe('box');
  });
  it('creates and stores an independent task without mutating the instance', () => {
    const dataset = { source: 'orlib_wtpack', displayName: 'WTPACK', dataClassification: 'ACADEMIC_BENCHMARK', sourceNotice: 'academic' };
    const instance = { id: 'wtpack1-1', label: 'one', items: [item], container: {} };
    const before = JSON.stringify(instance);
    const task = createExternalTaskSession(dataset, instance, new Date('2026-09-11T00:00:00Z'), {solverMode:'PORTCUBE_BUSINESS_SIMULATION'});
    const map = new Map(); const storage = { getItem: (key) => map.get(key) || null, setItem: (key, value) => map.set(key, value) };
    persistExternalTaskCopy(task, storage);
    expect(task.cargo.reduce((sum, cargo) => sum + cargo.quantity, 0)).toBe(3);
    expect(task.externalDataset.solverEligibility).toBe('DATA_COMPLETE_WITH_UNSUPPORTED_CONSTRAINTS');
    expect(task.externalDataset.solverReadiness).toBe('PARTIALLY_SUPPORTED');
    expect(task.externalDataset.conservation.weightKg).toBeCloseTo(738.72);
    expect(task.cargo[0]).toMatchObject({ destinationPort: 'Hamburg', portSequence: 1, customerId: 'EXT-CUSTOMER-01', orderId: 'EXT-ORDER-01', unloadGroupLabel: '卸货组 1' });
    expect(task.cargo[0].externalMetadata.sourceFields).toEqual(item.sourceFields);
    expect(task.cargo[0].externalMetadata).toMatchObject({ cargoSource: 'orlib_wtpack', businessContextProfile: 'PROFILE_EUROPE_HAMBURG_V1', assignmentMethod: 'DETERMINISTIC_SOURCE_GROUPING' });
    expect(task.externalBusinessContext).toMatchObject({ placeOfReceipt: '宁波港前集拼仓', portOfLoading: { code: 'CNNGB' }, portOfDischarge: { code: 'DEHAM' } });
    expect(task.caseContext.carrier).toBe('UNKNOWN');
    expect(task.externalBusinessContext.routeReference.publisher).toBe('Hapag-Lloyd');
    expect(buildPackingRequest({ containerType: '40HQ', cargoList: task.cargo }).cargoList[0]).toMatchObject({
      destinationPort: 'Hamburg', portSequence: 1, batchId: task.cargo[0].batchId, handlingMethod: null,
      orientationConstraints: item.orientationConstraints
    });
    expect(JSON.stringify(instance)).toBe(before);
    expect(JSON.parse([...map.values()][0])).toHaveLength(1);
    expect(JSON.parse([...map.values()][0])[0].externalBusinessContext.profileId).toBe('PROFILE_EUROPE_HAMBURG_V1');
  });

  it('keeps Renault source facts while adding only task-level freight fields', () => {
    const renaultItem = { externalSource: 'Renault / ESICUP Challenge 2015', externalDataset: 'instancesA', externalInstance: 'R1', externalItemId: 'P-1', packagingType: 'CARTON', lengthMm: 500, widthMm: 400, heightMm: 300, weightKg: 20, quantity: 2, orientationConstraints: { mode: 'FREE' }, sourceFields: { productId: 'P-1', packageMaterial: 'CARDBOARD' }, unknownFields: [] };
    const instance = { id: 'renault-R1', group: 'instancesA', label: 'R1', items: [renaultItem] };
    const task = createExternalTaskSession({ source: 'renault_esicup_2015', displayName: 'Renault', dataClassification: 'INDUSTRIAL_SUPPLIED_BENCHMARK' }, instance, new Date('2026-09-11T00:00:00Z'), {solverMode:'PORTCUBE_BUSINESS_SIMULATION'});
    expect(task.cargo[0]).toMatchObject({ name: '家居用品套装', packagingType: 'CARTON', packagingMaterial: '纸质包装', destinationPort: 'Hamburg', orientationPolicy: 'HORIZONTAL_ROTATION_ONLY', orientationConstraints: { mode: 'FREE' } });
    expect(task.cargo[0].cargoPresentationProfile).toMatchObject({ semanticOrigin: 'SOURCE_FACT', sourceMaterial: 'CARDBOARD', visualFamily: 'SOURCE_CARTON' });
    expect(task.cargo[0].externalMetadata.sourceFields).toEqual(renaultItem.sourceFields);
    task.cargo.splice(0, 1);
    expect(instance.items).toEqual([renaultItem]);
  });

  it('keeps ORTEC deliveryDay separate from business portSequence', () => {
    const ortec = { externalSource: 'ORTEC / Alonso 2019', externalDataset: 'alonso_2019', externalInstance: 'inst3d1', externalItemId: '1', lengthMm: 254, widthMm: 186, heightMm: 171, weightKg: 4.63, quantity: 52, orientationConstraints: { x: true, y: true, z: true }, stackingGroup: 1, stackability: 'UNKNOWN', sourceFields: { deliveryDay: 0, productIdentifier: 1 }, unknownFields: ['packagingType'] };
    const task = createExternalTaskSession({ source: 'ortec_alonso_2019', displayName: 'ORTEC', dataClassification: 'REAL_INDUSTRIAL_LOGISTICS' }, { id: 'ortec-inst3d1', group: 'alonso_2019', label: 'inst3d1', items: [ortec] }, new Date('2026-09-11T00:00:00Z'), {solverMode:'PORTCUBE_BUSINESS_SIMULATION'});
    expect(task.cargo[0]).toMatchObject({ name: '家居用品套装', destinationPort: 'Hamburg', portSequence: 1 });
    expect(task.cargo[0].externalMetadata.sourceFields.deliveryDay).toBe(0);
    expect(task.cargo[0].externalMetadata.businessAssignment.portSequence).toBe(1);
  });
});
