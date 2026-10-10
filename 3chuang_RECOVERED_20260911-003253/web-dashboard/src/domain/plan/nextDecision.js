import { ROUTES } from '../../app/router.js';
import { isBackendSolved } from '../provenance/planSource.js';

export function nextDecision(session, planSource) {
  if (!session.cargo.length) return { route: ROUTES.cargo, label: '建立货物与包装画像', title: '先建立本票物理事实', description: '录入尺寸、重量、包装、堆码、朝向和装卸方式。' };
  if (session.stalePlan) return { route: ROUTES.strategy, label: '重新规划并对照变化', title: '输入已改变，原方案已失效', description: '历史货位已保留。重新校核可用货位，再比较移动、增加、移除和方向变化。' };
  if (!isBackendSolved(planSource)) return { route: ROUTES.strategy, label: '进入装载规划', title: '选择柜型，生成装载方案', description: '当前画面是容量预览。生成方案后，可复核每件货物的位置、余隙与出运资料。' };
  if (!session.twinReviewedAt) return { route: ROUTES.twin, label: '查看三维方案', title: '方案已生成，查看装法', description: '检查货物位置、剩余空间与卸货条件。' };
  return { route: ROUTES.evidence, label: '查看出运准备', title: '完成责任动作与外部确认', description: '只处理待补资料、责任人复核和外部未知状态；已通过项默认收起。' };
}
