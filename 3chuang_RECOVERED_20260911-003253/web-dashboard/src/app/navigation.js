import { Boxes, BoxSelect, ClipboardCheck, LayoutDashboard, Route } from 'lucide-react';
import { ROUTES } from './router.js';

export const CASE_NAV = Object.freeze([
  { id: 'overview', target: ROUTES.overview, label: '工作台', icon: LayoutDashboard, match: ['^/workspace$'] },
  { id: 'cargo', target: ROUTES.cargo, label: '货物', icon: Boxes, match: ['^/workspace/cargo$'] },
  { id: 'planning', target: ROUTES.strategy, label: '规划', icon: Route, match: ['^/workspace/planning$'] },
  { id: 'twin', target: ROUTES.twin, label: '孪生', icon: BoxSelect, match: ['^/workspace/twin$'] },
  { id: 'readiness', target: ROUTES.evidence, label: '出运准备', icon: ClipboardCheck, match: ['^/workspace/(?:readiness|evidence|delivery)$', '^/(?:evidence|compliance|report|delivery)$'] }
]);

export const MARKETING_NAV = Object.freeze([
  { id: 'cargo', target: '#cargo', label: '货物' },
  { id: 'workflow', target: '#workflow', label: '工作流' },
  { id: 'twin', target: '#twin', label: '数字孪生' },
  { id: 'readiness', target: '#readiness', label: '出运准备' }
]);

export function matchNav(items, route) {
  return items.find(item => item.match?.some(pattern => new RegExp(pattern).test(route))) || null;
}
