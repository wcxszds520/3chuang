import { classifyCargoAppearance } from '../../domain/cargo/appearance.js';

const PORT_COLORS = ['#476f73', '#b16b3d', '#68745c', '#8a5b72', '#7a6845'];
const RISK_COLORS = Object.freeze({ normal: '#4d7566', attention: '#b45a43' });
const HANDLING_COLORS = Object.freeze({ manual: '#bd7640', forklift: '#2f6f68' });

export function buildProjectionItems(cargo = [], viewMode = 'sku') {
  return cargo.map((item) => {
    const appearance = classifyCargoAppearance(item);
    const risk = Boolean(item.fragile || item.dangerous || item.heavy || item.wooden || item.stackable === false);
    const portSequence = Math.max(1, Number(item.portSequence || 1));
    const sku = item.sku || item.name || '未命名 SKU';
    let groupKey = `sku-${sku}`;
    let groupLabel = sku;
    let color = appearance.color;
    let accent = appearance.accent;
    if (viewMode === 'port') {
      groupKey = `port-${portSequence}`;
      groupLabel = `港序 ${portSequence}`;
      color = PORT_COLORS[(portSequence - 1) % PORT_COLORS.length];
      accent = shade(color, -28);
    } else if (viewMode === 'risk') {
      groupKey = risk ? 'risk-attention' : 'risk-normal';
      groupLabel = risk ? '重点作业货物' : '常规货物';
      color = risk ? RISK_COLORS.attention : RISK_COLORS.normal;
      accent = shade(color, -24);
    } else if (viewMode === 'handling') {
      const handling = item.handlingMethod === 'manual' ? 'manual' : 'forklift';
      groupKey = `handling-${handling}`;
      groupLabel = handling === 'manual' ? '人工装箱' : '叉车装箱';
      color = HANDLING_COLORS[handling];
      accent = shade(color, -24);
    }
    return {
      ...item,
      visible: true,
      appearanceKey: appearance.key,
      groupKey,
      groupLabel,
      color,
      accent,
      risk
    };
  });
}

export function buildProjectionLegend(items = []) {
  const groups = new Map();
  for (const item of items) {
    const current = groups.get(item.groupKey);
    if (current) current.count += 1;
    else groups.set(item.groupKey, { key: item.groupKey, label: item.groupLabel, color: item.color, count: 1 });
  }
  return [...groups.values()];
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => Math.max(0, Math.min(255, (value >> shift & 255) + amount));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}
