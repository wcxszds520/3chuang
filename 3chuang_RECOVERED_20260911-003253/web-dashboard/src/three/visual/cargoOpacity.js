// Analysis fading multiplies the authored GLB alpha; it must not make film opaque.
export function rememberCargoOpacity(material) {
  material.userData.cargoSurfaceAlpha ??= {
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite
  };
  return material.userData.cargoSurfaceAlpha;
}

export function applyCargoOpacity(material, factor = 1) {
  const source = rememberCargoOpacity(material);
  const opacity = source.opacity * factor;
  const transparent = source.transparent || opacity < .999;
  if (material.transparent !== transparent) material.needsUpdate = true;
  material.opacity = opacity;
  material.transparent = transparent;
  material.depthWrite = transparent ? false : source.depthWrite;
}
