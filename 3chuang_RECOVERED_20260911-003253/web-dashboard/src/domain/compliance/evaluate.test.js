import { describe, expect, it } from 'vitest';
import { normalizeCargo } from '../cargo/cargo.js';
import { cargoFromTemplate } from '../cargo/templates.js';
import { getContainer } from '../container/catalog.js';
import { generateLocalPreview } from '../container/localPreview.js';
import { evaluateLocalCompliance } from './evaluate.js';

const container = getContainer('40HQ');
const cargo = [normalizeCargo(cargoFromTemplate('carton', { cargoId: 'carton', quantity: 4 }))];
const plan = generateLocalPreview(cargo, container);

describe('local deterministic compliance', () => {
  it('returns source-backed checks without claiming AI evidence', () => {
    const report = evaluateLocalCompliance({ plan, cargoList: cargo, container, vgmSubmitted: true });

    expect(report.source).toBe('local-rules');
    expect(report.rows.length).toBeGreaterThanOrEqual(6);
    expect(report.rows.every((row) => row.sourceRef && ['PASS', 'WARNING', 'FAIL'].includes(row.result))).toBe(true);
    expect(report.rows.find((row) => row.key === 'vgm').result).toBe('PASS');
    expect(report.suggestedVgm).toBe(Math.round(plan.totalWeight + container.tareWeight));
  });

  it('treats missing VGM as an explicit warning', () => {
    const report = evaluateLocalCompliance({ plan, cargoList: cargo, container, vgmSubmitted: false });
    expect(report.status).toBe('WARNING');
    expect(report.rows.find((row) => row.key === 'vgm')).toMatchObject({ result: 'WARNING', actual: '待提交 VGM' });
    expect(report.risks.join(' ')).toContain('VGM');
  });

  it('fails weight limits and does not hide unloaded items', () => {
    const overloadedPlan = { ...plan, totalWeight: 40_000, unloadedCargo: [{ cargoId: 'tail_1' }] };
    const report = evaluateLocalCompliance({ plan: overloadedPlan, cargoList: cargo, container, vgmSubmitted: true });

    expect(report.status).toBe('FAIL');
    expect(report.rows.find((row) => row.key === 'weight').result).toBe('FAIL');
    expect(report.rows.find((row) => row.key === 'completeness').result).toBe('WARNING');
  });

  it('requires IPPC evidence for wooden packaging and documentation for dangerous goods', () => {
    const sensitiveCargo = [
      normalizeCargo(cargoFromTemplate('wood-pallet', { cargoId: 'wood', riskNotes: [] })),
      normalizeCargo(cargoFromTemplate('carton', { cargoId: 'dg', dangerous: true, riskNotes: [] }))
    ];
    const sensitivePlan = generateLocalPreview(sensitiveCargo, container);
    const report = evaluateLocalCompliance({ plan: sensitivePlan, cargoList: sensitiveCargo, container, vgmSubmitted: true });

    expect(report.rows.find((row) => row.key === 'documents').result).toBe('WARNING');
    expect(report.risks.join(' ')).toContain('IPPC');
    expect(report.risks.join(' ')).toContain('MSDS');
  });
});
