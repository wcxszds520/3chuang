'use strict';

module.exports = Object.freeze({
  supportRatioMin: 0.75,
  contactToleranceMm: 2,
  stability: Object.freeze({
    model: 'UNSECURED_PACKING_ASSUMPTION',
    dataClassification: 'PROJECT_POLICY',
    contactGapToleranceMm: 30,
    meaningfulContactRatio: 0.35,
    strongContactRatio: 0.60,
    warningSlenderness: 2.5,
    hardUnrestrainedSlenderness: 3.5,
    heightSliceMm: 200,
    voidVoxelMm: 250,
    narrowVoidWidthMm: 300
  }),
  heavyOnLightRatio: 2.5,
  supportLoadMultiplier: 6,
  collisionToleranceMm: 0.5,
  cog: Object.freeze({ lateralLimitPercent: 5, longitudinalLimitPercent: 10,
    normalization:'CARGO_COG_FULL_INNER_SPAN_V1',
    source:'CTU Code 2014 Annex 7 3.1.4; cargo mass excluding container tare',
    version:'2026-09-10-full-span' })
});
