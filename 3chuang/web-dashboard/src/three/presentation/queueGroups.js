import { classifyCargoAppearance } from '../../domain/cargo/appearance.js';

export function groupOperationQueue(queue = [], options = {}) {
  const currentIndex = Number(options.currentIndex ?? -1);
  const blockedIndex = options.blockedIndex == null ? -1 : Number(options.blockedIndex);
  const completed = new Set(options.completedIndices || []);
  const groups = [];
  let run = 0;

  queue.forEach((item, index) => {
    const baseKey = groupKey(item);
    let group = groups.at(-1);
    if (!group || group.baseKey !== baseKey) {
      run += 1;
      group = {
        key: `${baseKey}::${run}`,
        baseKey,
        sku: item.sku || item.name || '未命名货物',
        name: item.name || item.sku || '未命名货物',
        packagingLabel: classifyCargoAppearance(item).label,
        portSequence: Number(item.portSequence || 1),
        destinationPort: item.destinationPort || '未指定港口',
        batchId: item.batchId || item.batchKey || `batch_${Number(item.portSequence || 1)}`,
        batchLabel: item.batchLabel || item.batchId || item.batchKey || '未分批',
        targetZone: targetZoneFor(item),
        handlingMethod: item.handlingMethod === 'manual' ? 'manual' : 'forklift',
        risk: riskFor(item),
        firstIndex: index,
        items: [],
        completedCount: 0,
        isCurrent: false,
        isBlocked: false
      };
      groups.push(group);
    }
    group.items.push({ item, index });
    if (completed.has(index)) group.completedCount += 1;
    if (index === currentIndex) group.isCurrent = true;
    if (index === blockedIndex) group.isBlocked = true;
  });

  return groups.map(({ baseKey: _baseKey, ...group }) => group);
}

function groupKey(item) {
  const sku = item.sku || item.name || 'unknown';
  const batch = item.batchId || item.batchKey || `port-${Number(item.portSequence || 1)}`;
  const packaging = item.packagingType || classifyCargoAppearance(item).key;
  const port = item.destinationPort || `port-${Number(item.portSequence || 1)}`;
  const handling = item.handlingMethod === 'manual' ? 'manual' : 'forklift';
  return `${sku}::${batch}::${port}::${handling}::${packaging}`;
}

function targetZoneFor(item) {
  const x = Number(item.x || 0);
  if (x < 4000) return '箱内深区';
  if (x < 8500) return '箱内中区';
  return '箱内门区';
}

function riskFor(item) {
  if (item.dangerous) return '危险品';
  if (item.fragile) return '易碎';
  if (item.heavy) return '重货';
  if (!item.stackable) return '禁止堆叠';
  if (item.wooden) return 'IPPC 木包装';
  return '常规';
}
