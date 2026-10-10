import { describe, expect, it } from 'vitest';
import { resetCargoTableScroll, shouldShowFreightContext } from './cargoTablePresentation.js';

describe('cargo table product presentation', () => {
  it('always restores the initial horizontal position to the first identity columns', () => {
    const viewport = { scrollLeft: 817 };
    expect(resetCargoTableScroll(viewport)).toBe(0);
    expect(viewport.scrollLeft).toBe(0);
  });

  it('keeps freight context out of browse-only datasets', () => {
    expect(shouldShowFreightContext('FULLY_SUPPORTED')).toBe(true);
    expect(shouldShowFreightContext('PARTIALLY_SUPPORTED')).toBe(true);
    expect(shouldShowFreightContext('BROWSE_ONLY')).toBe(false);
  });
});
