const DEFAULT_FILTERS = Object.freeze({
  sku: 'all',
  batch: 'all',
  port: 'all',
  sequence: 'all',
  actor: 'all',
  state: 'all',
  risk: 'all'
});

export function createOperationFilters(overrides = {}) {
  return { ...DEFAULT_FILTERS, ...overrides };
}

export function operationItemState(index, context = {}) {
  const completed = context.completedIndices instanceof Set
    ? context.completedIndices
    : new Set(context.completedIndices || []);
  if (Number(context.blockedIndex) === index) return 'blocked';
  if (completed.has(index)) return 'completed';
  if (Number(context.currentIndex) === index) return 'current';
  return 'waiting';
}

export function operationItemRisk(item = {}) {
  if (item.dangerous) return 'dangerous';
  if (item.fragile) return 'fragile';
  if (item.heavy) return 'heavy';
  if (!item.stackable) return 'nonstackable';
  if (item.wooden) return 'wooden';
  return 'normal';
}

export function matchesOperationFilters(item, index, filters = DEFAULT_FILTERS, context = {}) {
  const values = createOperationFilters(filters);
  const actor = item.handlingMethod === 'manual' ? 'manual' : 'forklift';
  const batch = item.batchId || item.batchKey || '';
  const port = item.destinationPort || '';
  const sequence = String(Number(item.portSequence || 1));
  const state = operationItemState(index, context);
  const risk = operationItemRisk(item);
  return (values.sku === 'all' || values.sku === (item.sku || item.name))
    && (values.batch === 'all' || values.batch === batch)
    && (values.port === 'all' || values.port === port)
    && (values.sequence === 'all' || values.sequence === sequence)
    && (values.actor === 'all' || values.actor === actor)
    && (values.state === 'all' || values.state === state)
    && (values.risk === 'all' || values.risk === risk);
}

export function filterOperationGroups(groups = [], filters = DEFAULT_FILTERS, context = {}) {
  return groups.flatMap((group) => {
    const items = group.items.filter(({ item, index }) => matchesOperationFilters(item, index, filters, context));
    if (!items.length) return [];
    const completed = context.completedIndices instanceof Set
      ? context.completedIndices
      : new Set(context.completedIndices || []);
    return [{
      ...group,
      items,
      firstIndex: items[0].index,
      completedCount: items.filter(({ index }) => completed.has(index)).length,
      isCurrent: items.some(({ index }) => index === Number(context.currentIndex)),
      isBlocked: items.some(({ index }) => index === Number(context.blockedIndex))
    }];
  });
}

export function buildOperationFilterOptions(queue = []) {
  const unique = (values) => [...new Set(values.filter(Boolean))];
  return {
    sku: unique(queue.map((item) => item.sku || item.name)),
    batch: unique(queue.map((item) => item.batchId || item.batchKey)),
    port: unique(queue.map((item) => item.destinationPort)),
    sequence: unique(queue.map((item) => String(Number(item.portSequence || 1)))),
    actor: ['manual', 'forklift'],
    state: ['waiting', 'current', 'completed', 'blocked'],
    risk: unique(queue.map(operationItemRisk))
  };
}

