'use strict';

const { calculateCoG, normalizeContainer } = require('../packing/PlanMetrics');
const { activeRules } = require('./RuleRegistry');

function analyzeLoadDistribution({ placements = [], container: containerInput = {}, operatorEnvelope = null, caseContext = {} } = {}) {
  const container = normalizeContainer(containerInput);
  const totalMassKg = sum(placements, (item) => number(item.weight));
  const cog = calculateCoG(placements, container, totalMassKg);
  const guidanceStatus = Math.max(cog.lateral, cog.longitudinal) <= 5 + 0.001 ? 'WITHIN_GENERAL_GUIDANCE'
    : Math.max(cog.lateral, cog.longitudinal) <= 10 + 0.001 ? 'PARTICULAR_CIRCUMSTANCES_REVIEW'
      : 'OUTSIDE_GUIDANCE';
  const longitudinalSegments = massSegments(placements, 'x', 'l', container.innerLength, 6);
  const transverseSegments = massSegments(placements, 'z', 'w', container.innerWidth, 3);
  const footprints = placements.map((item) => {
    const areaM2 = number(item.l) * number(item.w) / 1e6;
    return {
      cargoId: item.cargoId, massKg: number(item.weight), loadedFootprintM2: round(areaM2),
      averageFootprintPressureKgM2: areaM2 > 0 ? round(number(item.weight) / areaM2) : null
    };
  });
  const payload = number(container.maxWeight ?? container.payload);
  const heavyThreshold = payload > 0 ? payload * 0.25 : Infinity;
  const concentratedCandidates = footprints.filter((entry) => entry.massKg >= heavyThreshold || placements.find((item) => item.cargoId === entry.cargoId)?.concentratedLoad === true);
  const envelope = operatorEnvelope && Number.isFinite(Number(operatorEnvelope.maximumFloorPressureKgM2))
    ? { maximumFloorPressureKgM2: Number(operatorEnvelope.maximumFloorPressureKgM2), sourceReference: operatorEnvelope.sourceReference || null }
    : null;
  const envelopeFailures = envelope ? footprints.filter((entry) => entry.averageFootprintPressureKgM2 > envelope.maximumFloorPressureKgM2) : [];
  const concentratedStatus = concentratedCandidates.length === 0 ? 'NO_TRIGGER_IDENTIFIED'
    : !envelope ? 'ENGINEERING_REVIEW_REQUIRED'
      : envelopeFailures.length > 0 ? 'OUTSIDE_OPERATOR_ENVELOPE' : 'WITHIN_RECORDED_OPERATOR_ENVELOPE';
  const status = guidanceStatus === 'OUTSIDE_GUIDANCE' || concentratedStatus === 'OUTSIDE_OPERATOR_ENVELOPE'
    ? 'REVIEW_REQUIRED'
    : guidanceStatus === 'PARTICULAR_CIRCUMSTANCES_REVIEW' || concentratedStatus === 'ENGINEERING_REVIEW_REQUIRED'
      ? 'CONDITIONAL' : 'WITHIN_GUIDANCE';
  return {
    model: 'PORTCUBE_LOAD_DISTRIBUTION_FULL_SPAN_V1', status, totalMassKg: round(totalMassKg),
    centreOfGravity: { xMm: round(cog.x), yMm: round(cog.y), zMm: round(cog.z), lateralOffsetPercent: round(cog.lateral), longitudinalOffsetPercent: round(cog.longitudinal), guidanceStatus, normalization:cog.normalization, offsetMm:cog.offsetMm, denominatorMm:cog.denominatorMm, legacyHalfSpanPercent:cog.legacyHalfSpanPercent },
    segments: { longitudinal: longitudinalSegments, transverse: transverseSegments },
    concentratedLoad: {
      status: concentratedStatus, trigger: payload > 0 ? 'item mass >= 25% of recorded payload or explicit cargo flag' : 'explicit cargo flag only',
      candidates: concentratedCandidates, operatorEnvelope: envelope,
      envelopeFailures, specificEnvelopeStatus: envelope ? 'RECORDED' : 'SPECIFIC_ENVELOPE_NOT_AVAILABLE'
    },
    rules: activeRules({ caseDate: caseContext.caseDate, scopes: ['LOAD_DISTRIBUTION', 'CONCENTRATED_LOAD'] }).map(compactRule),
    claim: 'ENGINEERING_GUIDANCE'
  };
}

function massSegments(placements, coordinate, size, span, count) {
  const segmentSize = span / count;
  const mass = Array(count).fill(0);
  for (const item of placements) {
    const start = number(item[coordinate]);
    const end = start + number(item[size]);
    const length = Math.max(end - start, 0);
    if (!(length > 0)) continue;
    for (let index = 0; index < count; index++) {
      const lower = index * segmentSize; const upper = (index + 1) * segmentSize;
      const overlap = Math.max(0, Math.min(end, upper) - Math.max(start, lower));
      mass[index] += number(item.weight) * overlap / length;
    }
  }
  return mass.map((value, index) => ({ index: index + 1, fromMm: round(index * segmentSize), toMm: round((index + 1) * segmentSize), massKg: round(value) }));
}

function compactRule(entry) { return { id: entry.id, title: entry.title, level: entry.level, clause: entry.clause, sourceUrl: entry.sourceUrl }; }
function sum(values, mapper) { return values.reduce((total, value) => total + mapper(value), 0); }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { analyzeLoadDistribution, massSegments };
