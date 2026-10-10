// Adapter-only whitelist. The backend pure resolver rejects noncanonical flags.
const flags = new Set(['lengthVertical','widthVertical','heightVertical','x','y','z']);
export function canonicalDirectionObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, flags.has(key)
    ? value[key] === 0 || value[key] === '0' ? false : value[key] === 1 || value[key] === '1' ? true : value[key]
    : value[key]]));
}

export function preserveDirectionCopies(input, output) {
  const pairs = [
    [input, output],
    [input.cargoPhysicalProfile, output.cargoPhysicalProfile],
    [input.cargoPhysicalProfile?.solverEnvelope, output.cargoPhysicalProfile?.solverEnvelope],
    [input.externalMetadata, output.externalMetadata]
  ];
  for (const [source, target] of pairs) if (source && target && Object.hasOwn(source,'orientationConstraints')) {
    target.orientationConstraints = canonicalDirectionObject(source.orientationConstraints);
  }
  const hasRule = pairs.some(([source]) => source?.orientationConstraints != null);
  if (hasRule) output.orientationPolicySource = input.orientationPolicySource
    || (input.source === 'external-dataset-copy' || (!input.orientationPolicy && !input.cargoPhysicalProfile?.orientationPolicy) ? 'DERIVED_EXTERNAL' : 'BUSINESS_HARD');
  // Do not erase a contradictory explicit fixed/upright + lying declaration.
  if (['FIXED_ORIENTATION','UPRIGHT_ONLY'].includes(input.orientationPolicy) && input.canLayFlat === true) output.canLayFlat = true;
  return output;
}
