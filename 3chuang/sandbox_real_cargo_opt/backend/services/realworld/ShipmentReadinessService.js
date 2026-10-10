'use strict';

const { activeRules } = require('./RuleRegistry');

const DOMAIN_ORDER = Object.freeze([
  'BOX_WEIGHT',
  'SPACE_STACKING',
  'LOAD_STABILITY',
  'PORT_OPERATION',
  'SHIPMENT_CONDITIONS'
]);

const DOMAIN_LABELS = Object.freeze({
  BOX_WEIGHT: '箱体与重量',
  SPACE_STACKING: '空间与堆码',
  LOAD_STABILITY: '载荷与稳定',
  PORT_OPERATION: '港序与作业',
  SHIPMENT_CONDITIONS: '出运条件'
});

const STATUS_PRIORITY = Object.freeze({
  BLOCKED: 0,
  DATA_REQUIRED: 1,
  EXTERNAL_CONFIRMATION_REQUIRED: 2,
  REVIEW_REQUIRED: 3,
  READY: 4,
  NOT_APPLICABLE: 5
});

function buildShipmentReadiness(input = {}) {
  const placements = input.placements || input.loadedCargo || input.plan?.loadedCargo || [];
  const cargoList = input.cargoList || [];
  const container = input.container || input.containerInfo || {};
  const validator = input.validator || input.plan?.validator || {};
  const layoutQuality = input.layoutQuality || input.plan?.layoutQuality || {};
  const voidJustification = input.voidJustification || input.plan?.voidJustification || input.plan?.metrics?.voidJustification || {};
  const loadDistribution = input.loadDistribution || input.plan?.loadDistribution || {};
  const portAccessibility = input.portAccessibility || input.plan?.portAccessibility || {};
  const securing = input.securing || input.plan?.securing || {};
  const packagingModel = input.packagingModel || input.plan?.packagingModel || summarizePackaging(cargoList);
  const caseContext = input.caseContext || {};
  const rules = activeRules({ caseDate: caseContext.caseDate || '2026-08-24', ...(caseContext.jurisdictions ? {jurisdictions:caseContext.jurisdictions} : {}) });
  const evidence = [];
  const totalCargoMassKg = placements.reduce((sum, item) => sum + number(item.weight), 0);
  const payloadKg = number(container.maxWeight || container.payload);
  const containerMode = String(input.containerMode || 'REFERENCE_PROFILE').toUpperCase();

  evidence.push(decisionEvidence({
    id: 'BOX-PAYLOAD', domain: 'BOX_WEIGHT', title: '货重与可用载荷',
    status: payloadKg > 0 && totalCargoMassKg > payloadKg ? 'BLOCKED' : payloadKg > 0 ? 'READY' : 'DATA_REQUIRED',
    currentValue: round(totalCargoMassKg), limit: payloadKg || null, unit: 'kg', comparison: '<=',
    summary: payloadKg > 0 ? `方案货重 ${round(totalCargoMassKg)} kg / 可用载荷 ${round(payloadKg)} kg` : '缺少本箱可用载荷',
    detail: '货重来自后端 placement 单一事实源；参考箱型载荷不等同于实际箱的铭牌许可。',
    ruleReferences: refs(rules, ['VGM']), inputReferences: ['placements[].weight', 'container.maxWeight'],
    requiredAction: payloadKg > 0 ? null : '录入实际箱最大总重、皮重或确认参考箱型载荷。',
    responsibility: '装箱计划员 / 箱管', source: 'BACKEND_SOLVED',
    calculation: 'sum(loadedCargo.weight) <= container.maxWeight', completeness: payloadKg > 0 ? 'COMPLETE_FOR_PLANNING' : 'MISSING_LIMIT'
  }));

  const vgm = input.vgm || {};
  const declaredVgm = number(vgm.declaredVGMKg || vgm.measuredGrossMassKg);
  const vgmMethod=String(vgm.method || vgm.verificationMethod || '').toUpperCase();
  const vgmComplete=declaredVgm>0 && ['METHOD_1','METHOD_2','METHOD1','METHOD2','1','2'].includes(vgmMethod) && Boolean(vgm.shipperDeclaration || vgm.signedDocumentReference);
  const maxGross=number(input.actualContainer?.maxGross);
  const vgmOverweight=maxGross>0 && declaredVgm>maxGross;
  evidence.push(decisionEvidence({
    id: 'BOX-VGM', domain: 'BOX_WEIGHT', title: '核实总重（VGM）资料',
    status: vgmOverweight ? 'BLOCKED' : vgmComplete ? 'READY' : 'DATA_REQUIRED',
    currentValue: declaredVgm || null, limit: number(input.actualContainer?.maxGross) || null, unit: 'kg', comparison: '<=',
    summary: vgmOverweight ? '记录的 VGM 超出实箱最大总重' : vgmComplete ? `VGM ${round(declaredVgm)} kg、核实方法与托运人声明已记录` : declaredVgm > 0 ? `已记录 ${round(declaredVgm)} kg；核实方法或托运人声明待补` : '尚未记录本票 VGM 与核实方法',
    detail: '本平台只检查输入完整性和记录值，不代替承运人/码头接收。',
    ruleReferences: refs(rules, ['VGM']), inputReferences: ['vgm.declaredVGMKg', 'vgm.method', 'vgm.shipperDeclaration'],
    requiredAction: vgmOverweight ? '复核称重与实箱最大总重；调整装载后重新核实。' : vgmComplete ? '保留声明凭证，另行确认承运人/码头接收状态。' : '补录 VGM 数值、核实方法和托运人声明。',
    responsibility: '托运人', source: declaredVgm > 0 ? 'CASE_INPUT' : 'MISSING_CASE_INPUT',
    calculation: 'recorded VGM evidence completeness', completeness: vgmComplete ? 'RECORDED_EXTERNAL_ACCEPTANCE_UNKNOWN' : declaredVgm > 0 ? 'PARTIAL' : 'MISSING'
  }));

  evidence.push(decisionEvidence({
    id: 'BOX-ACTUAL-UNIT', domain: 'BOX_WEIGHT', title: '实际箱体与安全牌照',
    status: containerMode === 'ACTUAL_CONTAINER' && input.actualContainer?.containerNumber && input.actualContainer?.cscPlateReference ? 'READY' : 'EXTERNAL_CONFIRMATION_REQUIRED',
    currentValue: containerMode === 'ACTUAL_CONTAINER' ? input.actualContainer?.containerNumber || '实际箱信息不完整' : '参考箱型',
    limit: null, unit: null, comparison: 'EVIDENCE_PRESENT',
    summary: containerMode === 'ACTUAL_CONTAINER' ? '已切换为实际箱资料' : '当前为规划参考箱型，不能作为实际箱准入结论',
    detail: '装箱规划可以使用参考轮廓；最终出运需绑定实际箱号、CSC 牌照及有效检查信息。',
    ruleReferences: refs(rules, ['CSC']), inputReferences: ['containerMode', 'actualContainer.containerNumber', 'actualContainer.cscPlateReference'],
    requiredAction: containerMode === 'ACTUAL_CONTAINER' ? '复核牌照和下次检查日期。' : '提箱后绑定实际箱并核对 CSC 牌照。',
    responsibility: '箱管 / 货代', source: containerMode === 'ACTUAL_CONTAINER' ? 'CASE_INPUT' : 'REFERENCE_PROFILE',
    calculation: 'actual-unit identity and CSC evidence presence', completeness: containerMode === 'ACTUAL_CONTAINER' ? 'CASE_DEPENDENT' : 'EXTERNAL_STEP_REQUIRED'
  }));

  const unexplained = number(voidJustification.unexplainedVoidVolume);
  const containerVolume = number(container.innerLength) * number(container.innerWidth) * number(container.innerHeight);
  const unexplainedRatio = containerVolume > 0 ? unexplained / containerVolume : null;
  evidence.push(decisionEvidence({
    id: 'SPACE-VOID', domain: 'SPACE_STACKING', title: '紧密装载与空洞解释',
    status: unexplainedRatio === null ? 'DATA_REQUIRED' : unexplainedRatio <= 0.08 ? 'READY' : 'REVIEW_REQUIRED',
    currentValue: unexplainedRatio === null ? null : round(unexplainedRatio * 100), limit: 8, unit: '% 柜内容积', comparison: '<=',
    summary: unexplainedRatio === null ? '缺少剩余空间分析' : `未解释剩余空间 ${round(unexplained / 1e9)} m³（${round(unexplainedRatio * 100)}%）`,
    detail: '预留空间、港序通道、门区/结构净空、系固区和几何余隙被单独解释；UNEXPLAINED_VOID 只表示尚无已证明的形成原因。8% 是 PORTCUBE 项目复核阈值。',
    ruleReferences: [], inputReferences: ['voidJustification.zones', 'layoutQuality.crossSectionReport'],
    spaceEvidence: { twinMode: 'SPACE_EXPLANATION', zoneIds: (voidJustification.zones || []).map((zone) => zone.id), defectZoneIds: (voidJustification.zones || []).filter((zone) => zone.classification === 'UNEXPLAINED_VOID').map((zone) => zone.id) },
    requiredAction: unexplainedRatio !== null && unexplainedRatio > 0.08 ? '检查未解释剩余空间的候选拒绝链，并比较局部重排方案。' : null,
    responsibility: '装箱计划员', source: 'BACKEND_SOLVED', calculation: 'UNEXPLAINED_VOID / container internal volume',
    completeness: unexplainedRatio === null ? 'MISSING' : 'COMPLETE_FOR_PLANNING'
  }));

  const packagingConfirmationCount = number(packagingModel.confirmationRequiredCount);
  evidence.push(decisionEvidence({
    id: 'SPACE-PACKAGING', domain: 'SPACE_STACKING', title: '包装画像完整性',
    status: packagingConfirmationCount > 0 ? 'DATA_REQUIRED' : 'READY',
    currentValue: packagingModel.typeCounts || {}, limit: 0, unit: '待确认项', comparison: '==',
    summary: packagingConfirmationCount > 0 ? `${packagingConfirmationCount} 个 AI 建议包装画像尚未由用户确认` : '包装类型、朝向与堆码字段已进入求解器',
    detail: '包装视觉网格仅用于解释；求解边界、朝向、堆码层数和显式承载上限来自 CargoPhysicalProfile。',
    ruleReferences: refs(rules, ['WOOD_PACKAGING']), inputReferences: ['cargoList[].cargoPhysicalProfile', 'cargoList[].packagingProfile'],
    requiredAction: packagingConfirmationCount > 0 ? '逐项确认或修改 AI 建议的包装画像后重新求解。' : null,
    responsibility: '包装工程 / 仓库', source: 'CARGO_PHYSICAL_PROFILE',
    calculation: 'count(packagingProfile.confirmationStatus == USER_CONFIRMATION_REQUIRED)', completeness: packagingConfirmationCount > 0 ? 'USER_CONFIRMATION_REQUIRED' : 'COMPLETE_FOR_PLANNING'
  }));

  const stacked = placements.filter((item) => number(item.y) > 1);
  const missingSupportLimits = stacked.filter((item) => !number(item.maximumSupportedWeightKg || item.maxSupportedWeight));
  evidence.push(decisionEvidence({
    id: 'SPACE-STACKING', domain: 'SPACE_STACKING', title: '堆码最弱项',
    status: validator?.checks?.stack === false || validator?.checks?.carrying === false ? 'BLOCKED' : missingSupportLimits.length > 0 ? 'REVIEW_REQUIRED' : 'READY',
    currentValue: { stackedCount: stacked.length, derivedCapacityCount: missingSupportLimits.length }, limit: 0, unit: '硬约束违规', comparison: '==',
    summary: validator?.checks?.stack === false || validator?.checks?.carrying === false
      ? '堆码或承载硬约束未通过'
      : missingSupportLimits.length > 0 ? `${missingSupportLimits.length} 件上层货仍使用项目保守派生承载规则` : '显式堆码/承载约束已通过',
    detail: '显式 maximumSupportedWeight 优先于重量倍数派生规则；未知承载能力不会被展示为认证通过。',
    ruleReferences: refs(rules, ['LOAD_DISTRIBUTION']), inputReferences: ['validator.checks.stack', 'validator.checks.carrying', 'placements[].maximumSupportedWeightKg'],
    spaceEvidence: { twinMode: 'RISK', cargoIds: missingSupportLimits.map((item) => item.cargoId).slice(0, 50) },
    requiredAction: missingSupportLimits.length > 0 ? '向包装供应商确认堆码承载能力；必要时录入显式上限并重新求解。' : null,
    responsibility: '包装工程 / 仓库', source: 'BACKEND_VALIDATOR', calculation: 'explicit support limit, else conservative project rule',
    completeness: missingSupportLimits.length > 0 ? 'DERIVED_POLICY_USED' : 'EXPLICIT_OR_NOT_STACKED'
  }));

  const stabilityInvalid = number(validator?.stability?.invalidCount || input.plan?.metrics?.stability?.invalidCount);
  evidence.push(decisionEvidence({
    id: 'LOAD-STABILITY', domain: 'LOAD_STABILITY', title: '初始与卸后稳定',
    status: stabilityInvalid > 0 || portAccessibility.postUnloadStabilityPass === false ? 'BLOCKED' : 'READY',
    currentValue: { initialInvalid: stabilityInvalid, postUnloadPass: portAccessibility.postUnloadStabilityPass !== false }, limit: 0, unit: '失稳项', comparison: '==',
    summary: stabilityInvalid > 0 ? `${stabilityInvalid} 项初始稳定性硬违规` : portAccessibility.postUnloadStabilityPass === false ? '存在卸后失稳阶段' : '初始与逐港卸后稳定门禁通过',
    detail: '结果来自后端支撑图、组合重心和逐港卸载状态；不替代运输动态系固工程计算。',
    ruleReferences: refs(rules, ['LOAD_DISTRIBUTION', 'TRANSPORT_SECURING']), inputReferences: ['validator.stability', 'portAccessibility.calls[].postUnloadStability'],
    spaceEvidence: { twinMode: 'BALANCE', cargoIds: validator?.stability?.violations?.flatMap((entry) => entry.cargoIds) || [] },
    requiredAction: stabilityInvalid > 0 || portAccessibility.postUnloadStabilityPass === false ? '返回装载规划修复失稳阶段。' : null,
    responsibility: '装箱计划员', source: 'BACKEND_SOLVED', calculation: 'initial stability + every post-unload stage', completeness: 'COMPLETE_FOR_PLANNING'
  }));

  const guidance = loadDistribution?.centreOfGravity?.guidanceStatus;
  evidence.push(decisionEvidence({
    id: 'LOAD-DISTRIBUTION', domain: 'LOAD_STABILITY', title: '载荷分布与重心指导等级',
    status: guidance === 'WITHIN_GENERAL_GUIDANCE' ? 'READY' : guidance ? 'REVIEW_REQUIRED' : 'DATA_REQUIRED',
    currentValue: {
      class: guidance || null,
      lateralPercent: loadDistribution?.centreOfGravity?.lateralOffsetPercent ?? null,
      longitudinalPercent: loadDistribution?.centreOfGravity?.longitudinalOffsetPercent ?? null,
      longitudinalSegments: loadDistribution?.segments?.longitudinal || []
    },
    limit: { generalGuidancePercent: 5, particularReviewPercent: 10 }, unit: '%', comparison: 'GUIDANCE_BAND',
    summary: guidance ? `${guidance === 'WITHIN_GENERAL_GUIDANCE' ? '符合一般重心指导范围' : '超出一般指导范围，需具体情形复核'}；横向 ${loadDistribution.centreOfGravity.lateralOffsetPercent}% / 纵向 ${loadDistribution.centreOfGravity.longitudinalOffsetPercent}%（全内宽 / 长）` : '缺少载荷分布分析',
    detail: '等级先于连续重心偏移参与 V2.5 候选选择；同一等级内连续偏移不能击败明显更紧凑的拓扑。',
    ruleReferences: refs(rules, ['LOAD_DISTRIBUTION', 'CONCENTRATED_LOAD']), inputReferences: ['loadDistribution.centreOfGravity', 'loadDistribution.segments'],
    spaceEvidence: { twinMode: 'WEIGHT', segmentModel: loadDistribution?.segments || null },
    requiredAction: guidance && guidance !== 'WITHIN_GENERAL_GUIDANCE' ? '由装箱负责人复核具体情形、箱体/设备能力与系固方案。' : null,
    responsibility: '装箱负责人 / 工程复核', source: 'BACKEND_SOLVED', calculation: 'CTU guidance band classification + six longitudinal mass segments',
    completeness: guidance ? 'COMPLETE_FOR_GUIDANCE' : 'MISSING'
  }));

  const fullUnload = portAccessibility.status === 'FULL_UNLOAD_PASS';
  evidence.push(decisionEvidence({
    id: 'PORT-ACCESS', domain: 'PORT_OPERATION', title: '逐港可达与重搬',
    status: fullUnload && number(portAccessibility.rehandleCount) === 0 ? 'READY' : 'BLOCKED',
    currentValue: { status: portAccessibility.status || null, blockedCount: number(portAccessibility.blockedCount), rehandleCount: number(portAccessibility.rehandleCount), calls: portAccessibility.calls || [] },
    limit: { blockedCount: 0, rehandleCount: 0 }, unit: '件', comparison: '==',
    summary: fullUnload ? `完整卸载通过；重搬 ${number(portAccessibility.rehandleCount)} 件` : '未来港货物阻挡当前港提取路径',
    detail: '卸货时间线来自同一 placement 与支撑依赖图，并在每一港后重算稳定性。',
    ruleReferences: [], inputReferences: ['portAccessibility.calls', 'placements[].portSequence'],
    spaceEvidence: { twinMode: 'UNLOAD_SIMULATION', callSequence: portAccessibility.calls || [] },
    requiredAction: fullUnload ? null : '返回装载规划，消除未来港阻挡或支撑依赖。',
    responsibility: '装箱计划员 / 仓库作业', source: 'BACKEND_SOLVED', calculation: 'canonical door corridor + support dependency unload simulation', completeness: 'COMPLETE_FOR_PLANNING'
  }));

  const handlingAssumptions = input.handlingAssumptions || input.plan?.handlingAssumptions || [];
  evidence.push(decisionEvidence({
    id: 'PORT-HANDLING', domain: 'PORT_OPERATION', title: '装卸设备与人员能力',
    status: handlingAssumptions.length > 0 ? 'EXTERNAL_CONFIRMATION_REQUIRED' : 'READY',
    currentValue: { assumptions: handlingAssumptions, methods: [...new Set(placements.map((item) => item.handlingMethod).filter(Boolean))] },
    limit: null, unit: null, comparison: 'CAPABILITY_AVAILABLE',
    summary: handlingAssumptions.length > 0 ? `${handlingAssumptions.length} 件货物使用派生协同人工假设` : '方案内搬运方式已明确',
    detail: '几何可作业不证明现场设备、人员、叉孔或吊点实际可用。',
    ruleReferences: [], inputReferences: ['placements[].handlingMethod', 'placements[].forkEntry', 'caseContext.availableHandlingMethods'],
    requiredAction: handlingAssumptions.length > 0 ? '由仓库确认人员、叉车/托盘车能力与安全作业方法。' : '装箱前复核现场设备可用性。',
    responsibility: '仓库主管', source: handlingAssumptions.length > 0 ? 'DERIVED_PROJECT_POLICY' : 'CASE_INPUT',
    calculation: 'handling method versus recorded capability', completeness: handlingAssumptions.length > 0 ? 'EXTERNAL_CONFIRMATION_REQUIRED' : 'RECORDED_METHODS'
  }));

  const securingInputs = input.securingInputs || {};
  const hasRecordedValue = value => value !== null && value !== undefined && value !== ''
    && (Array.isArray(value) ? value.some(hasRecordedValue)
      : typeof value === 'object' ? Object.values(value).some(hasRecordedValue)
        : typeof value === 'number' ? Number.isFinite(value) : true);
  const securingKnown = Object.values(securingInputs).some(hasRecordedValue);
  evidence.push(decisionEvidence({
    id: 'CONDITION-SECURING', domain: 'SHIPMENT_CONDITIONS', title: '运输系固条件',
    status: securing.status === 'SECURING_NOT_REQUIRED' ? 'READY' : securingKnown ? 'REVIEW_REQUIRED' : 'DATA_REQUIRED',
    currentValue: { geometricStatus: securing.status || null, zones: securing.zones || [], recordedInputs: securingKnown }, limit: null, unit: null, comparison: 'ENGINEERING_REVIEW',
    summary: securing.status === 'SECURING_NOT_REQUIRED' ? '几何模型未触发额外系固区' : securingKnown ? '已记录部分系固参数，需工程复核' : '存在几何系固需求，但摩擦/挡固/绑扎能力未录入',
    detail: '本平台解释几何缝隙与潜在系固区，不计算未知的摩擦、绑扎强度或运输加速度能力。',
    ruleReferences: refs(rules, ['TRANSPORT_SECURING']), inputReferences: ['securing', 'securingInputs'],
    spaceEvidence: { twinMode: 'SPACE_EXPLANATION', zoneIds: (voidJustification.zones || []).filter((zone) => ['SECURING_SPACE', 'SECURING_ZONE'].includes(zone.classification)).map((zone) => zone.id) },
    requiredAction: securing.status === 'SECURING_NOT_REQUIRED' ? null : '补录运输模式、摩擦、挡固与绑扎能力，并由责任方确认。',
    responsibility: '装箱负责人 / 承运人', source: securingKnown ? 'CASE_INPUT_AND_GEOMETRY' : 'GEOMETRY_ONLY',
    calculation: 'geometric securing trigger; capability remains external', completeness: securingKnown ? 'PARTIAL_ENGINEERING_INPUT' : 'MISSING_CAPABILITY_INPUTS'
  }));

  if (cargoList.some((cargo) => cargo.dangerous === true || cargo.dangerousGoodsContext === 'DECLARED_DANGEROUS_GOODS')) {
    const dg = input.dangerousGoodsEvidence || {};
    const dgComplete = Boolean(dg.declaration && dg.classification && dg.packingCertificate);
    evidence.push(decisionEvidence({
      id: 'CONDITION-DG', domain: 'SHIPMENT_CONDITIONS', title: '危险货物资料', status: dgComplete ? 'EXTERNAL_CONFIRMATION_REQUIRED' : 'DATA_REQUIRED',
      currentValue: dgComplete ? '资料已记录，等待外部受理' : '资料不完整', limit: null, unit: null, comparison: 'EVIDENCE_PRESENT',
      summary: dgComplete ? '危险货物申报资料已记录；承运人/码头受理未知' : '危险货物分类、申报或装箱证明缺失', detail: '平台不承担完整 IMDG 合规判定。',
      ruleReferences: refs(rules, ['DANGEROUS_GOODS']), inputReferences: ['dangerousGoodsEvidence'], requiredAction: dgComplete ? '向承运人/码头确认受理。' : '补齐危险货物责任文件。',
      responsibility: '托运人 / 货代', source: dgComplete ? 'CASE_INPUT' : 'MISSING_CASE_INPUT', calculation: 'required evidence presence only', completeness: dgComplete ? 'EXTERNAL_ACCEPTANCE_UNKNOWN' : 'MISSING'
    }));
  }

  if (cargoList.some(woodRelevant)) {
    const wood = input.woodPackagingEvidence || {};
    const markRecorded = Boolean(wood.treatmentMark || wood.exemptionBasis);
    evidence.push(decisionEvidence({
      id: 'CONDITION-WOOD', domain: 'SHIPMENT_CONDITIONS', title: '木质包装状态', status: markRecorded ? 'REVIEW_REQUIRED' : 'DATA_REQUIRED',
      currentValue: markRecorded ? wood.treatmentMark || wood.exemptionBasis : '未记录处理标识/豁免依据', limit: null, unit: null, comparison: 'EVIDENCE_PRESENT',
      summary: markRecorded ? '已记录木质包装证据，需按目的地适用性复核' : '木箱/木托盘的实木、加工木与处理标识尚未确认', detail: 'BIC、承运人设备资料不作为法规；木包装适用性按实际材料与目的地解析。',
      ruleReferences: refs(rules, ['WOOD_PACKAGING']), inputReferences: ['cargoList[].woodPackagingClass', 'woodPackagingEvidence'], requiredAction: markRecorded ? '复核目的地与有效标识。' : '确认材料类别并补录处理标识或豁免依据。',
      responsibility: '包装工程 / 货代', source: markRecorded ? 'CASE_INPUT' : 'CARGO_PROFILE_TRIGGER', calculation: 'wood packaging applicability + evidence presence', completeness: markRecorded ? 'CASE_DEPENDENT_REVIEW' : 'MISSING'
    }));
  }

  evidence.push(decisionEvidence({
    id: 'CONDITION-TERMINAL', domain: 'SHIPMENT_CONDITIONS', title: '承运人、航次与码头受理',
    status: 'EXTERNAL_CONFIRMATION_REQUIRED', currentValue: { terminal: caseContext.terminal || null, carrier: caseContext.carrier || null, voyage: caseContext.voyage || null, liveAcceptance: false },
    limit: null, unit: null, comparison: 'EXTERNAL_ACCEPTANCE', summary: '当前无实时承运人/码头受理接口，状态未知',
    detail: '未知优于伪造通过或失败。本平台停留在出运前装箱决策与资料准备边界。',
    ruleReferences: refs(rules, ['TERMINAL_ADMISSION']), inputReferences: ['caseContext.terminal', 'caseContext.carrier', 'caseContext.voyage'],
    requiredAction: '由货代在承运人/码头渠道确认箱型、航次、截止时间与接收状态。', responsibility: '货代',
    source: 'NO_LIVE_TERMINAL_API', calculation: 'none — external state intentionally unknown', completeness: 'EXTERNAL_STATE_UNKNOWN'
  }));

  const domains = DOMAIN_ORDER.map((domain) => summarizeDomain(domain, evidence.filter((item) => item.domain === domain)));
  const actionable = evidence.filter((item) => !['READY', 'NOT_APPLICABLE'].includes(item.status));
  const statusCounts = countBy(evidence, (item) => item.status);
  const overallStatus = domains.sort((left, right) => STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status])[0]?.status || 'DATA_REQUIRED';
  const contextResolver = {
    model: 'PORTCUBE_CASE_CONTEXT_RESOLVER_V2_5',
    caseDate: caseContext.caseDate || '2026-08-24',
    resolvedFacts: {
      containerMode,
      portSequences: [...new Set(cargoList.map((cargo) => number(cargo.portSequence || 1)))].sort((a, b) => a - b),
      dangerousGoodsPresent: cargoList.some((cargo) => cargo.dangerous === true),
      woodPackagingRelevant: cargoList.some(woodRelevant),
      liveTerminalAcceptanceAvailable: false
    },
    applicableEvidenceIds: evidence.map((item) => item.id),
    hiddenNotApplicableCount: 0,
    externalUnknowns: evidence.filter((item) => item.status === 'EXTERNAL_CONFIRMATION_REQUIRED').map((item) => item.id),
    futureAndDraftRulesVisibleInNormalUi: false
  };

  return {
    model: 'PORTCUBE_SHIPMENT_READINESS_V2_5',
    generatedAt: new Date().toISOString(),
    source: 'BACKEND_SINGLE_TRUTH',
    title: '出运准备',
    overallStatus,
    decision: overallDecision(overallStatus),
    statusCounts,
    domains: DOMAIN_ORDER.map((domain) => domains.find((entry) => entry.id === domain)),
    evidence,
    actionableEvidence: actionable,
    passedEvidence: evidence.filter((item) => item.status === 'READY'),
    contextResolver,
    uiPolicy: { defaultVisibleStatuses: ['BLOCKED', 'DATA_REQUIRED', 'EXTERNAL_CONFIRMATION_REQUIRED', 'REVIEW_REQUIRED'], passedCollapsed: true, notApplicableHidden: true },
    claim: 'PRE_SHIPMENT_DECISION_SUPPORT_NOT_OPERATIONAL_ACCEPTANCE'
  };
}

function decisionEvidence(input) {
  return {
    id: input.id,
    domain: input.domain,
    domainLabel: DOMAIN_LABELS[input.domain],
    title: input.title,
    status: input.status,
    currentValue: input.currentValue ?? null,
    limit: input.limit ?? null,
    unit: input.unit ?? null,
    comparison: input.comparison || null,
    summary: input.summary || '',
    detail: input.detail || '',
    ruleReferences: input.ruleReferences || [],
    inputReferences: input.inputReferences || [],
    spaceEvidence: input.spaceEvidence || null,
    requiredAction: input.requiredAction || null,
    responsibility: input.responsibility || null,
    source: input.source || 'UNKNOWN',
    calculation: input.calculation || null,
    completeness: input.completeness || 'UNKNOWN',
    applicability: 'CASE_RELEVANT',
    dataClassification: 'DECISION_EVIDENCE'
  };
}

function summarizeDomain(id, items) {
  const visible = items.filter((item) => item.status !== 'NOT_APPLICABLE');
  const status = [...visible].sort((left, right) => STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status])[0]?.status || 'NOT_APPLICABLE';
  return { id, label: DOMAIN_LABELS[id], status, itemCount: visible.length, pendingCount: visible.filter((item) => !['READY', 'NOT_APPLICABLE'].includes(item.status)).length, evidenceIds: visible.map((item) => item.id) };
}

function refs(rules, scopes) {
  const scopeSet = new Set(scopes);
  return rules.filter((rule) => scopeSet.has(rule.scope)).map((rule) => ({
    id: rule.id, title: rule.title, level: rule.level, authority: rule.authority,
    sourceDocument: rule.sourceDocument, sourceUrl: rule.sourceUrl, clause: rule.clause,
    resolvedStatus: rule.resolvedStatus
  }));
}

function summarizePackaging(cargoList) {
  const typeCounts = {};
  let confirmationRequiredCount = 0;
  for (const cargo of cargoList) {
    const type = cargo.packagingType || 'GENERIC';
    typeCounts[type] = number(typeCounts[type]) + Math.max(1, number(cargo.quantity || 1));
    if (cargo.packagingProfile?.confirmationStatus === 'USER_CONFIRMATION_REQUIRED') confirmationRequiredCount++;
  }
  return { typeCounts, confirmationRequiredCount };
}

function woodRelevant(cargo) {
  return cargo.wooden === true || ['WOOD_CRATE', 'PALLETIZED_CARTONS', 'WRAPPED_PALLET', 'EQUIPMENT_CASE'].includes(cargo.packagingType)
    || String(cargo.woodPackagingClass || '').includes('REQUIRED') || String(cargo.woodPackagingClass || '').includes('CONFIRM');
}

function overallDecision(status) {
  return ({ BLOCKED: 'RETURN_TO_PLANNING', DATA_REQUIRED: 'COMPLETE_REQUIRED_DATA', EXTERNAL_CONFIRMATION_REQUIRED: 'CONFIRM_WITH_EXTERNAL_PARTIES', REVIEW_REQUIRED: 'RESPONSIBLE_REVIEW_REQUIRED', READY: 'PACKING_DECISION_READY_NOT_OPERATIONAL_ACCEPTANCE' })[status] || 'REVIEW_REQUIRED';
}

function countBy(values, getter) { return values.reduce((result, value) => { const key = getter(value); result[key] = number(result[key]) + 1; return result; }, {}); }
function round(value) { return Math.round(number(value) * 1000) / 1000; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

module.exports = { DOMAIN_ORDER, DOMAIN_LABELS, buildShipmentReadiness, decisionEvidence };
