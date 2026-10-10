export const REGULATION_DOCUMENTS = Object.freeze([
  Object.freeze({
    documentId: 'solas-vgm',
    documentTitle: 'SOLAS公约第六章规则2 — 载货集装箱验证总质量（VGM）',
    shortTitle: 'SOLAS VGM 中文版',
    subject: 'VGM 验证总质量',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: '国际海事组织（IMO）/ 中国海事局',
    referenceNumber: 'SOLAS VI/Reg.2 + MSC.1/Circ.1475 + 海船舶〔2016〕164号',
    pdfPath: '/regulations/solas-vgm-cn.pdf',
    renderedPages: pagePaths('solas-vgm', 4)
  }),
  Object.freeze({
    documentId: 'maritime-safety-law',
    documentTitle: '中华人民共和国海上交通安全法（2021修订）',
    shortTitle: '海上交通安全法',
    subject: '上位法依据',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: '全国人民代表大会常务委员会',
    referenceNumber: '主席令第七十九号 · 2021-09-01施行',
    pdfPath: '/regulations/maritime-safety-law-cn.pdf',
    renderedPages: pagePaths('maritime-safety-law', 3)
  }),
  Object.freeze({
    documentId: 'ship-safety-supervision',
    documentTitle: '中华人民共和国船舶安全监督规则（2020修订）',
    shortTitle: '船舶安全监督规则',
    subject: 'VGM国内执行',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: '交通运输部',
    referenceNumber: '交通运输部令2020年第6号 · 第四十七条',
    pdfPath: '/regulations/ship-safety-supervision-cn.pdf',
    renderedPages: pagePaths('ship-safety-supervision', 3)
  }),
  Object.freeze({
    documentId: 'ctu-code',
    documentTitle: '货物运输单元装箱操作规则（CTU Code 中文版）',
    shortTitle: 'CTU Code 中文版',
    subject: '装箱操作规范',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: 'IMO / ILO / UNECE',
    referenceNumber: 'IMO IC284E (2014)',
    pdfPath: '/regulations/ctu-code-cn.pdf',
    renderedPages: pagePaths('ctu-code', 4)
  }),
  Object.freeze({
    documentId: 'gb-16994-4',
    documentTitle: 'GB 16994.4-2023 港口作业安全要求 第4部分：普通货物集装箱',
    shortTitle: 'GB 16994.4-2023',
    subject: '重心偏载与港口作业安全',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: '国家市场监督管理总局 / 国家标准化管理委员会',
    referenceNumber: 'GB 16994.4-2023（强制性国家标准）',
    pdfPath: '/regulations/gb-16994-4-cn.pdf',
    renderedPages: pagePaths('gb-16994-4', 3)
  }),
  Object.freeze({
    documentId: 'gb-40163',
    documentTitle: 'GB 40163-2021 海运危险货物集装箱装箱作业安全技术要求',
    shortTitle: 'GB 40163-2021',
    subject: '危险品装箱安全',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: '国家市场监督管理总局 / 国家标准化管理委员会',
    referenceNumber: 'GB 40163-2021（强制性国家标准）',
    pdfPath: '/regulations/gb-40163-cn.pdf',
    renderedPages: pagePaths('gb-40163', 3)
  }),
  Object.freeze({
    documentId: 'jtt-1187',
    documentTitle: 'JT/T 1187-2018 港口货物装卸作业安全技术要求',
    shortTitle: 'JT/T 1187-2018',
    subject: '装卸作业与堆码安全',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: '交通运输部',
    referenceNumber: 'JT/T 1187-2018（交通运输行业标准）',
    pdfPath: '/regulations/jtt-1187-cn.pdf',
    renderedPages: pagePaths('jtt-1187', 3)
  }),
  Object.freeze({
    documentId: 'ippc-ispm15',
    documentTitle: '国际贸易中木质包装材料管理准则（ISPM 15 中文版）',
    shortTitle: 'IPPC ISPM 15 中文版',
    subject: '木质包装检疫',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: 'IPPC / FAO / 中国海关总署',
    referenceNumber: 'ISPM 15 (2019) + 海关总署令第238号修订',
    pdfPath: '/regulations/ippc-ispm15-cn.pdf',
    renderedPages: pagePaths('ippc-ispm15', 4)
  }),
  Object.freeze({
    documentId: 'wood-packaging-quarantine',
    documentTitle: '进境货物木质包装检疫监督管理办法',
    shortTitle: '木质包装检疫监督管理办法',
    subject: '进境木包装海关执行',
    sourceType: 'local-regulation-excerpt',
    sourceAuthority: '中华人民共和国海关总署',
    referenceNumber: '海关总署令第238号修订（原84号令）',
    pdfPath: '/regulations/wood-packaging-quarantine-cn.pdf',
    renderedPages: pagePaths('wood-packaging-quarantine', 2)
  })
]);

const EVIDENCE_TEMPLATES = Object.freeze([
  evidence('vgm', 'VGM 重量验证', 'solas-vgm', 3, 'SOLAS VI/2.5-2.7 第三章第5条', '托运人应在装船前取得并申报载货集装箱验证总质量（VGM）。未取得有效 VGM 的载货集装箱不得装入船舶积载计划。宁波港闸口设VGM核验环节，偏差超过±5%将拒绝入场。', [8, 9, 84, 14]),
  evidence('weight', '载重与 MAX GROSS', 'solas-vgm', 3, 'SOLAS VI/2.8-2.9 第三章第7条', '验证总质量不得超过集装箱安全合格牌照标示的最大总重（MAX GROSS）。常见40HQ的MAX GROSS为30,480 kg，超过限值不得装船。', [8, 39, 84, 17]),
  evidence('lifo', 'LIFO 批次可达', 'ctu-code', 3, 'CTU Code 第三章第7条', '装箱时应考虑多港卸货的先后顺序，遵循LIFO原则：先卸港货物靠近箱门端，后卸港货物放在箱内深区，避免交叉穿插。', [8, 38, 84, 18]),
  evidence('cog', '动态重心', 'gb-16994-4', 2, 'GB 16994.4-2023 第5.2条', '集装箱重心横向偏移不得超过宽度的5%，纵向偏移不得超过长度的10%。超过阈值时给出 WARNING 并要求重新配载。', [8, 5, 84, 16]),
  evidence('stacking', '堆叠与承压', 'jtt-1187', 1, 'JT/T 1187-2018 第6.3条', '不可堆叠的货物上方不得放置其他货物；易碎货物应采取防震、防压措施；重货不应压在轻货或脆弱包装上。', [8, 79, 84, 10]),
  evidence('documents', '木包装与 IPPC 证据', 'wood-packaging-quarantine', 1, '海关总署令第238号 第五条', '进境货物的木质包装材料应按ISPM 15要求进行处理并加施IPPC标识。未加施标识或标识不合格的，海关将进行除害处理或退运。', [8, 49, 84, 8]),
  evidence('completeness', '装载完整性', 'ctu-code', 4, 'CTU Code 第四章第10条', '订单输入件数、已装件数和未装件数应逐件可追溯；不得用汇总文字掩盖未装货物或改变真实装箱方案。装箱完成后应生成装箱图供港口核验。', [8, 38, 84, 10])
]);

export function buildComplianceEvidence(rows = []) {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return EVIDENCE_TEMPLATES.map((template) => {
    const row = byKey.get(template.ruleId);
    const document = getRegulationDocument(template.documentId);
    return {
      ...template,
      documentTitle: document.documentTitle,
      sourceType: document.sourceType,
      ruleResult: row?.result || 'NOT_EVALUATED',
      hitReason: row?.actual || '当前规则尚未计算',
      standard: row?.standard || '',
      sourceRef: row?.sourceRef || ''
    };
  });
}

export function getRegulationDocument(documentId) {
  return REGULATION_DOCUMENTS.find((document) => document.documentId === documentId) || REGULATION_DOCUMENTS[0];
}

export function getDocumentCount() {
  return REGULATION_DOCUMENTS.length;
}

function evidence(ruleId, ruleName, documentId, pageNumber, sectionId, snippet, bbox) {
  return Object.freeze({ ruleId, ruleName, documentId, pageNumber, sectionId, snippet, bbox });
}

function pagePaths(prefix, count) {
  return Object.freeze(Array.from({ length: count }, (_, index) => `/regulations/${prefix}-page-${String(index + 1).padStart(3, '0')}.png`));
}
