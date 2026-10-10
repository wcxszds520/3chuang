import {WORKSITE_DEMO} from '../cargo/worksiteDemo.js';
import { describe, expect, it } from 'vitest';
import { cargoFromTemplate } from '../cargo/templates.js';
import { normalizeCargo } from '../cargo/cargo.js';
import { getContainer } from './catalog.js';
import { generateLocalPreview } from './localPreview.js';

const container = getContainer('40HQ');
const cargo = [
  normalizeCargo(cargoFromTemplate('heavy-equipment', { cargoId: 'heavy', quantity: 2, portSequence: 2 })),
  normalizeCargo(cargoFromTemplate('carton', { cargoId: 'carton', quantity: 8, portSequence: 1 }))
];

function geometry(plan) {
  return plan.loadedCargo.map(({ cargoId, x, y, z, l, h, w, loadingIndex }) => ({ cargoId, x, y, z, l, h, w, loadingIndex }));
}

function overlaps(a, b) {
  return a.x < b.x + b.l && a.x + a.l > b.x
    && a.y < b.y + b.h && a.y + a.h > b.y
    && a.z < b.z + b.w && a.z + a.w > b.z;
}

describe('deterministic local preview', () => {
  it('generates repeatable bounded, non-overlapping geometry', () => {
    const first = generateLocalPreview(cargo, container);
    const second = generateLocalPreview(cargo, container);

    expect(geometry(first)).toEqual(geometry(second));
    expect(first.source).toBe('local-preview');
    expect(first.constraintMeta.previewOnly).toBe(true);
    expect(first.inputFingerprint).toBe(second.inputFingerprint);
    for (const item of first.loadedCargo) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.y).toBeGreaterThanOrEqual(0);
      expect(item.z).toBeGreaterThanOrEqual(0);
      expect(item.x + item.l).toBeLessThanOrEqual(container.innerLength);
      expect(item.y + item.h).toBeLessThanOrEqual(container.innerHeight);
      expect(item.z + item.w).toBeLessThanOrEqual(container.innerWidth);
    }
    for (let a = 0; a < first.loadedCargo.length; a += 1) {
      for (let b = a + 1; b < first.loadedCargo.length; b += 1) {
        expect(overlaps(first.loadedCargo[a], first.loadedCargo[b])).toBe(false);
      }
    }
  });

  it('places earlier discharge ports closer to the high-x door', () => {
    const plan = generateLocalPreview(cargo, container);
    const firstPort = plan.loadedCargo.filter((item) => item.portSequence === 1);
    const laterPort = plan.loadedCargo.filter((item) => item.portSequence === 2);

    expect(Math.min(...firstPort.map((item) => item.x))).toBeGreaterThanOrEqual(
      Math.max(...laterPort.map((item) => item.x + item.l)) - 1
    );
    expect(plan.constraintMeta.lifoCompliant).toBe(true);
  });

  it('returns an explicit unavailable preview without a container', () => {
    const plan = generateLocalPreview(cargo, null);
    expect(plan.loadedCargo).toEqual([]);
    expect(plan.warnings[0].type).toBe('PREVIEW_UNAVAILABLE');
  });
});

it('shares floor lanes for compatible mixed units without collisions or cross-port reuse',()=>{
  const rows=WORKSITE_DEMO.items.map(normalizeCargo),plan=generateLocalPreview(rows,getContainer('20GP'));
  expect(plan.totalCargoCount).toBe(42);expect(plan.sourceCode).toBe('LOCAL_PREVIEW');
  expect(plan.constraintMeta.lifoCompliant).toBe(true);
  const boxes=plan.loadedCargo;
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    expect(a.x<b.x+b.l && b.x<a.x+a.l && a.z<b.z+b.w && b.z<a.z+a.w && a.y<b.y+b.h && b.y<a.y+a.h).toBe(false);
    if(a.x===b.x)expect(a.portSequence).toBe(b.portSequence);
  }
  expect(boxes.filter(c=>c.handlingMethod!=='manual').every(c=>c.packagingProfile.palletJackCompatible)).toBe(true);
});
