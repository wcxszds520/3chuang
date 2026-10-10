function normalizedMethod(value) {
  const method = String(value || '').trim().toUpperCase();
  return method || null;
}

function recommendedFromProfile(profile = {}) {
  return normalizedMethod(profile.preferredEquipment)
    || normalizedMethod(profile.primaryMethod);
}

export function resolveOperationalHandling(cargo = {}) {
  const external = cargo.externalMetadata || {};
  const profile = external.operationalHandlingProfile || cargo.operationalHandlingProfile || {};
  const confirmedMethod = normalizedMethod(external.confirmedHandlingMethod || cargo.confirmedHandlingMethod);
  const sourceMethod = normalizedMethod(external.sourceHandlingMethod || cargo.sourceHandlingMethod);
  const recommendedMethod = recommendedFromProfile(profile);
  const effectiveMethod = confirmedMethod || sourceMethod || recommendedMethod || 'UNKNOWN';
  const status = confirmedMethod ? 'CONFIRMED' : sourceMethod ? 'SOURCE_CONFIRMED' : recommendedMethod ? 'RECOMMENDED_NOT_CONFIRMED' : 'UNKNOWN';
  return Object.freeze({ sourceMethod, recommendedMethod, confirmedMethod, effectiveMethod, status });
}
