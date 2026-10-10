export const PAGE_COPY = Object.freeze({
  dashboard: Object.freeze({ title: '装运决策简报', subtitle: '查看本票装载进度与待办事项。' }),
  cargo: Object.freeze({ title: '货物清单', subtitle: '核对包装外尺寸、数量与交接要求。' }),
  container: Object.freeze({ title: '装载规划', subtitle: '选择箱型，安排本票装载。' }),
  twin: Object.freeze({ title: '三维数字孪生', subtitle: '查看货位、装载顺序与卸货通道。' }),
  compliance: Object.freeze({ title: '出运准备', subtitle: '把事实、条件、判断与依据组织成装箱前可复核的决策证据。' }),
  report: Object.freeze({ title: '交付工作区', subtitle: '核对数据来源、方案、合规结论与最终交付文件。' })
});

export function displayPort(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['hamburg', 'hamburg port', '汉堡'].includes(normalized)) return '汉堡港';
  if (['rotterdam', 'rotterdam port', '鹿特丹'].includes(normalized)) return '鹿特丹港';
  if (['antwerp', 'antwerp port', '安特卫普'].includes(normalized)) return '安特卫普港';
  if (['ningbo', 'ningbo port', '宁波'].includes(normalized)) return '宁波港';
  return value || '—';
}
