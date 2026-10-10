export function resetCargoTableScroll(element) {
  if (element) element.scrollLeft = 0;
  return element?.scrollLeft ?? 0;
}

export function shouldShowFreightContext(solverReadiness) {
  return Boolean(solverReadiness) && solverReadiness !== 'BROWSE_ONLY';
}
