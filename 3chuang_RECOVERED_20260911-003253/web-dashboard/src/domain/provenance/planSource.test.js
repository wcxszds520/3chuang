import { describe, expect, it } from 'vitest';
import { getPlanSourceLabel, isBackendSolved, normalizePlanSource, PLAN_SOURCE_CODES } from './planSource.js';

describe('plan provenance', () => {
  it('normalizes legacy source values without losing the explicit data class', () => {
    expect(normalizePlanSource('backend')).toBe(PLAN_SOURCE_CODES.BACKEND_SOLVED);
    expect(normalizePlanSource({ source: 'local-preview' })).toBe(PLAN_SOURCE_CODES.LOCAL_PREVIEW);
    expect(normalizePlanSource('untrusted')).toBe(PLAN_SOURCE_CODES.UNKNOWN);
  });

  it('never labels a local preview as a backend solution', () => {
    expect(getPlanSourceLabel('local-preview')).toContain('方案预览');
    expect(isBackendSolved('local-preview')).toBe(false);
    expect(isBackendSolved('BACKEND_SOLVED')).toBe(true);
  });
});

