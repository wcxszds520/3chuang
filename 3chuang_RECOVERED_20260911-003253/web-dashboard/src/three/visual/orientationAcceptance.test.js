import { describe, it, expect } from 'vitest';
import { visualOrientationStatus } from './orientationAcceptance.js';

const cargo = { l:600, w:400, h:400, orientationId:'LWH', packagingType:'CARTON', cargoPhysicalProfile:{dimensions:{lengthMm:600,widthMm:400,heightMm:400}} };
describe('visual certification cannot grant unreviewed orientation coverage', () => {
  it('recognizes both reviewed horizontal rotations, including legacy XYZ', () => {
    expect(visualOrientationStatus(cargo)).toContain('VISUAL_ORIENTATION_VERIFIED');
    expect(visualOrientationStatus({...cargo,l:400,w:600,orientationId:'WLH'})).toContain('VISUAL_ORIENTATION_VERIFIED');
    expect(visualOrientationStatus({...cargo,orientationId:undefined,orientation:'XYZ'})).toContain('VISUAL_ORIENTATION_VERIFIED');
  });
  it('does not certify another structure variant or an unreviewed vertical rotation', () => {
    expect(visualOrientationStatus({...cargo,visualProfile:{structureVariant:'carton_strapped'}})).toContain('VISUAL_PENDING');
    expect(visualOrientationStatus({...cargo,l:400,w:400,h:600,orientationId:'HWL'})).toContain('VISUAL_PENDING');
  });
  it('rejects a contradictory physical envelope and preserves the input', () => {
    const wrong={...cargo,l:400};const before=JSON.stringify(wrong);
    expect(visualOrientationStatus(wrong)).toContain('VISUAL_PENDING');
    expect(JSON.stringify(wrong)).toBe(before);
  });
});
