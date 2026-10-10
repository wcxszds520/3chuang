'use strict';

module.exports = Object.freeze({
  cog: Object.freeze({ lateralWarningPercent: 5, longitudinalWarningPercent: 10 }),
  vgm: Object.freeze({ relativeTolerancePercent: 5, absoluteToleranceKg: 1000 }),
  containers: Object.freeze({
    '20GP': Object.freeze({ tareWeight: 2300, maxGrossWeight: 30480 }),
    '40GP': Object.freeze({ tareWeight: 3750, maxGrossWeight: 30480 }),
    '40HQ': Object.freeze({ tareWeight: 3900, maxGrossWeight: 30480 })
  }),
  score: Object.freeze({ failPenalty: 22, warningPenalty: 7, reviewPenalty: 4 })
});
