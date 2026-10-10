export const PAGE_COPY = Object.freeze({
  dashboard: Object.freeze({ title: '装运决策简报', subtitle: '当前 Case、装载结果、准入缺口与下一步行动的一页式判断。' }),
  cargo: Object.freeze({ title: '货物数据集编辑器', subtitle: '确认本票货物的尺寸、重量、包装、港序与工程约束。' }),
  container: Object.freeze({ title: '装载规划', subtitle: 'Route 与 Equipment 上下文驱动的设备决策矩阵、实箱覆写和策略组合。' }),
  twin: Object.freeze({ title: '三维数字孪生', subtitle: '真实 placement 坐标驱动的作业回放，六模式装载分析一屏尽览。' }),
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
