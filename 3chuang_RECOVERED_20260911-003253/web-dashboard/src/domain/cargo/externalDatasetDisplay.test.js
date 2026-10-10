import { describe, expect, it } from 'vitest';
import { cargoPackagingDisplay, externalClassificationLabel, externalFieldLabel, externalItemDisplayName, externalSourceName, externalStatusLabel, orientationDisplay, packagingDisplay, solverReadinessLabel, sourceAdvisory, sourceCapabilities } from './externalDatasetDisplay.js';

describe('external dataset Chinese presentation', () => {
  it('centralizes source, classification, status and field labels', () => {
    expect(externalSourceName('renault_esicup_2015')).toContain('雷诺');
    expect(externalClassificationLabel('REAL_INDUSTRIAL_LOGISTICS')).toBe('真实工业物流数据');
    expect(externalStatusLabel('ADAPTER_REQUIRED')).toBe('需人工确认适配');
    expect(externalFieldLabel('stackingGroup')).toBe('堆叠分组');
    expect(externalStatusLabel('EXTERNAL_UNKNOWN')).toBe('状态待确认');
    expect(externalFieldLabel('unmappedExternalField')).toBe('其他来源字段');
  });
  it('presents orientation semantics without exposing raw booleans', () => {
    expect(orientationDisplay({ x: true, y: false, z: true })).toBe('绕 X 轴：是；绕 Y 轴：否；绕 Z 轴：是');
    expect(orientationDisplay({ mode: 'FREE' })).toBe('自由摆放');
  });
  it('marks unsupported and adapter-required capabilities honestly', () => {
    expect(sourceAdvisory('orlib_thpack', 'thpack9').text).toContain('暂不建议正式求解');
    const states = sourceCapabilities({ source: 'orlib_wtpack' }, { features: { dimensions: true, weight: true, orientation: true } });
    expect(states.find((item) => item.name === '来源承压参数').state).toBe('adapter');
    expect(sourceCapabilities({ source: 'unknown_source' }, { features: {} }).every((item) => item.state !== 'supported')).toBe(true);
  });
  it('uses honest logistics semantics instead of inventing product identity or material', () => {
    expect(externalItemDisplayName({ externalSource: 'OR-Library WTPACK', externalItemId: '1' })).toBe('承压箱装货物类型 1');
    expect(externalItemDisplayName({ externalSource: 'ORTEC / Alonso 2019', externalItemId: '7' })).toBe('工业货物类型 7');
    expect(packagingDisplay({ externalSource: 'OR-Library THPACK' })).toBe('箱装货物');
    expect(packagingDisplay({ externalSource: 'OR-Library WTPACK' })).toBe('承压箱装货物');
    expect(packagingDisplay({ externalSource: 'Renault / ESICUP Challenge 2015', sourceFields: { 'Package material': 'METAL' } })).toBe('金属包装');
    expect(packagingDisplay({ externalSource: 'Renault / ESICUP Challenge 2015', sourceFields: { 'Package material': 'PLASTIC' } })).toBe('塑料包装');
    expect(packagingDisplay({ externalSource: 'ORTEC / Alonso 2019' })).toBe('规则工业货物单元');
    expect(solverReadinessLabel('PARTIALLY_SUPPORTED')).toBe('部分约束可求解');
    expect(solverReadinessLabel('FULLY_SUPPORTED')).toBe('完整约束可求解');
    expect(solverReadinessLabel('BROWSE_ONLY')).toBe('仅供浏览');
  });
  it('translates legacy packaging display values without changing stored values', () => {
    expect(cargoPackagingDisplay('accessory')).toBe('配件包装');
    expect(cargoPackagingDisplay('carton')).toBe('纸箱');
    expect(cargoPackagingDisplay('panel')).toBe('面板防护包装');
  });
});
