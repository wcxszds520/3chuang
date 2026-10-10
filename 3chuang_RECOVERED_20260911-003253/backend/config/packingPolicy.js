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
  // Same physical limits as legacy half-span 5% / 10%; no tolerance relaxed.
  cog: Object.freeze({ lateralLimitPercent: 2.5, longitudinalLimitPercent: 5, comparisonTolerancePercent: 0.0005,
    percentageDefinition: 'ABS_DISTANCE_FROM_MIDPOINT_DIVIDED_BY_FULL_INNER_SPAN' })
});
