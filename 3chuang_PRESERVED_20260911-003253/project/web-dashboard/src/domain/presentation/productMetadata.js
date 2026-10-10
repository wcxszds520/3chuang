export const PRODUCT_METADATA = Object.freeze({
  name: '智港立方',
  shortName: '智港立方',
  englishName: 'PortCube',
  subtitle: '集装箱装载数字孪生可视化平台'
});

export function getReportDocumentMetadata(dataClassification) {
  const isDemo = String(dataClassification || '').toUpperCase() === 'DEMO_DATA';
  return isDemo
    ? { type: 'COMPETITION_DEMO_REPORT', title: '竞赛演示报告', label: 'DEMO DELIVERY REPORT', classification: 'DEMO_DATA' }
    : { type: 'DELIVERY_REPORT', title: '装箱与合规报告', label: 'DELIVERY REPORT', classification: String(dataClassification || 'UNCLASSIFIED') };
}
