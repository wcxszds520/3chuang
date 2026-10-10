import {configurePackaging} from '../../../../shared/commercePackaging.mjs';
import { canonicalDirectionObject } from './orientationBoundary.js';
import { createInitialSession } from '../session/initialSession.js';
import { externalClassificationLabel, externalFieldLabel } from './externalDatasetDisplay.js';
import { createFreightBusinessContext, solverReadinessFor } from './externalBusinessContext.js';
import { createCargoPresentationProfile, createOperationalHandlingProfile } from './externalCargoPresentation.js';
import { externalCapabilities, sourceContainers, businessSimulationCapabilities } from '../../../../shared/externalCapabilities.mjs';

export const EXTERNAL_TASK_STORE_KEY = 'portcube.externalTestTasks.v1';

export function orientationProjection(input) {
  const constraints = canonicalDirectionObject(input);
  if (constraints == null) return { policy: null, status: 'NOT_PROVIDED' };
  if (typeof constraints !== 'object' || Array.isArray(constraints) || !Object.keys(constraints).length) return { policy: null, status: 'INVALID' };
  const allowedKeys = ['mode','containerAxisAlignment','mappingStatus','x','y','z','lengthVertical','widthVertical','heightVertical'];
  if (Object.keys(constraints).some(key => !allowedKeys.includes(key))) return {policy:null,status:'UNSUPPORTED'};
  if (Object.hasOwn(constraints,'mode') && Object.hasOwn(constraints,'containerAxisAlignment')) return {policy:null,status:'INVALID'};
  for (const keys of [['x','y','z'],['lengthVertical','widthVertical','heightVertical']]) {
    if (keys.some(key => Object.hasOwn(constraints,key)) && keys.some(key => typeof constraints[key] !== 'boolean')) return {policy:null,status:'INVALID'};
  }
  if (Object.hasOwn(constraints,'mode') && constraints.mode !== 'FREE') return {policy:null,status:'UNSUPPORTED'};
  if (Object.hasOwn(constraints,'containerAxisAlignment') && !['LENGTHWISE','WIDTHWISE'].includes(constraints.containerAxisAlignment)) return {policy:null,status:'UNSUPPORTED'};
  if (Object.hasOwn(constraints,'x') && !['x','y','z'].every(key=>constraints[key]===true)) return {policy:null,status:'UNSUPPORTED'};
  if (Object.hasOwn(constraints,'lengthVertical') && ['lengthVertical','widthVertical','heightVertical'].every(key=>constraints[key]===false)) return {policy:null,status:'UNSATISFIABLE'};
  if (constraints.mode === 'FREE') return {policy:'HORIZONTAL_ROTATION_ONLY',status:'DIRECTLY_SUPPORTED'};
  if (constraints.containerAxisAlignment) return {policy:null,status:'DIRECTLY_SUPPORTED'};
  if (constraints.x === true || ['lengthVertical','widthVertical','heightVertical'].every(key=>constraints[key]===true)) return {policy:'FULL_ROTATION_ALLOWED',status:'DIRECTLY_SUPPORTED'};
  if (constraints.lengthVertical === false && constraints.widthVertical === false && constraints.heightVertical === true) return {policy:'HORIZONTAL_ROTATION_ONLY',status:'DIRECTLY_SUPPORTED'};
  return {policy:null,status:'DIRECTLY_SUPPORTED'};
}

function unsupportedConstraints(item) {
  const pending = [];
  const projection = orientationProjection(item.orientationConstraints);
  if (projection.status === 'CORE_EXTENSION_PENDING_SOLVER_SUPPORT') pending.push('完整朝向或容器轴向约束');
  if (['ADAPTER_REQUIRED','INVALID','UNSATISFIABLE','UNSUPPORTED'].includes(projection.status)) pending.push('朝向规则人工适配');
  if (item.stackingGroup != null) pending.push('堆叠兼容组');
  if (item.alwaysOnTop === true) pending.push('必须位于上层');
  if (item.alwaysOnBottom === true) pending.push('必须位于底层');
  if (item.loadBearingUnit) pending.push(`来源承压参数（${item.loadBearingUnit}）`);
  if (item.geometryType === 'MESH') pending.push('精确异形碰撞');
  return [...new Set(pending)];
}

export function externalItemToCargo(item, classification) {
  item = { ...item, orientationConstraints: canonicalDirectionObject(item.orientationConstraints) };
  const unknown = new Set(item.unknownFields || []);
  const orientation = orientationProjection(item.orientationConstraints);
  const packagingType = item.packagingType || null;
  const unsupported = unsupportedConstraints(item);
  const presentation = createCargoPresentationProfile(item);
  const operationalHandlingProfile = createOperationalHandlingProfile(item, presentation);
  return configurePackaging({
    cargoId: `ext_${String(item.externalSource).replace(/[^a-z0-9]/gi, '_')}_${String(item.externalInstance).replace(/[^a-z0-9]/gi, '_')}_${String(item.externalItemId).replace(/[^a-z0-9]/gi, '_')}`,
    name: item.name || '',
    sku: String(item.externalItemId),
    length: item.lengthMm ?? null,
    width: item.widthMm ?? null,
    height: item.heightMm ?? null,
    weight: item.weightKg ?? null,
    quantity: item.quantity,
    destinationPort: item.destination ?? null,
    portSequence: null,
    batchId: null,
    batchLabel: null,
    packagingType,
    packagingMaterial: presentation.semanticOrigin === 'SOURCE_FACT' ? presentation.packageLabel : null,
    transportUnit: item.palletAttached === true ? '托盘' : null,
    orientationPolicy: orientation.policy,
    orientationPolicySource: 'DERIVED_EXTERNAL',
    orientationConstraints: item.orientationConstraints ? JSON.parse(JSON.stringify(item.orientationConstraints)) : null,
    canRotate: orientation.policy ? orientation.policy !== 'FIXED_ORIENTATION' : null,
    canLayFlat: orientation.policy ? orientation.policy === 'FULL_ROTATION_ALLOWED' : null,
    canInvert: null,
    stackable: typeof item.stackability === 'boolean' ? item.stackability : null,
    maxStackLayers: item.maxStackLayers ?? null,
    maxSupportedWeight: null,
    maximumSupportedWeightKg: null,
    dangerous: typeof item.hazardous === 'boolean' ? item.hazardous : null,
    heavy: Number.isFinite(item.weightKg) ? item.weightKg >= 20 : null,
    wooden: packagingType === 'WOOD_CRATE' ? true : packagingType ? false : null,
    handlingMethod: null,
    handlingPolicy: 'NOT_PROVIDED',
    forkEntry: null,
    visualProfile: { assetKey: presentation.assetKey, visualFamily: presentation.visualFamily, materialFamily: presentation.packageClass, labelMode: 'CARGO_NAME', semanticOrigin: presentation.semanticOrigin },
    cargoPresentationProfile: presentation,
    source: 'external-dataset-copy',
    dataClassification: classification,
    riskNotes: [
      `外部来源：${item.externalSource}`,
      unknown.size ? `来源缺失字段：${[...unknown].map(externalFieldLabel).join('、')}` : '',
      unsupported.length ? `当前求解器尚未使用：${unsupported.join('、')}` : '',
      item.loadBearingUnit ? `来源承压参数仅保留原值 ${item.loadBearingUnit}，未转换为总承重 kg` : ''
    ].filter(Boolean),
    externalMetadata: JSON.parse(JSON.stringify({
      ...item,
      presentation,
      operationalHandlingProfile,
      constraintSummary: presentation.constraintSummary,
      mappingSupport: { orientationProjection: orientation, unsupportedConstraints: unsupported }
    }))
  });
}

export function createExternalTaskSession(dataset, instance, now = new Date(), businessOptions = {}) {
  const base = createInitialSession({ dataset: 'legacy' });
  const suffix = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const taskId = `EXT-${dataset.source.toUpperCase()}-${instance.id}-${suffix}`;
  if(businessOptions.solverMode!=='PORTCUBE_BUSINESS_SIMULATION'){
    const capabilities=externalCapabilities(dataset.source,instance),containers=sourceContainers(dataset.source,instance);
    const container=containers[businessOptions.sourceContainerIndex||0]||null;
    const cargo=instance.items.map(item=>({...externalItemToCargo(item,dataset.dataClassification),solverMode:'SOURCE_BENCHMARK',
      loadBearing:item.loadBearing,loadBearingUnit:item.loadBearingUnit,stackingGroup:item.stackingGroup,alwaysOnTop:item.alwaysOnTop,alwaysOnBottom:item.alwaysOnBottom,
      riskNotes:[`外部来源：${dataset.source}`,...capabilities.unsupported.map(rule=>`尚未支持：${rule}`)]}));
    const conservation={skuCount:cargo.length,pieces:cargo.reduce((s,c)=>s+c.quantity,0),weightKg:cargo.every(c=>Number.isFinite(c.weight))?cargo.reduce((s,c)=>s+c.weight*c.quantity,0):null};
    return {...base,cargo,order:{orderNo:taskId,source:'external-dataset-copy',dataClassification:dataset.dataClassification},caseContext:{},externalBusinessContext:null,
      datasetId:`${dataset.source}/${instance.id}`,dataClassification:dataset.dataClassification,solverMode:'SOURCE_BENCHMARK',benchmarkMode:capabilities.benchmarkMode,datasetCapabilities:capabilities,
      selectedContainerType:container?.typeId||'SOURCE_CONTAINER_UNAVAILABLE',containerMode:'SOURCE_BENCHMARK',sourceContainer:container,actualContainer:null,
      externalDataset:{source:dataset.source,instanceId:instance.id,displayName:dataset.displayName,instanceLabel:instance.label,sourceContainerIndex:container?.index||0,containers,conservation,
        rawSourceImmutable:true,normalizedSourceImmutable:true,unsupportedConstraints:capabilities.unsupported,solverReadiness:capabilities.canSolve?(capabilities.fullSourceProblem?'FULLY_SUPPORTED':'PARTIALLY_SUPPORTED'):'BROWSE_ONLY',solverEligibility:capabilities.canSolve?'SOURCE_SOLVABLE':'BROWSE_ONLY'},
      executionStatus:{solve:'NOT_STARTED',validation:'NOT_VERIFIED',persistence:'NOT_SAVED',benchmark:'NOT_RUN',businessReadiness:'NOT_APPLICABLE'},
      dataSource:{order:'来源基准任务 · 无业务运输分组',cargo:`${dataset.displayName} · ${instance.label} · ${conservation.pieces} 件`,plan:'尚未生成',compliance:'业务出运校核不适用'}};
  }
  base.solverMode='PORTCUBE_BUSINESS_SIMULATION';base.benchmarkMode='BUSINESS_SIMULATION';
  base.datasetCapabilities=businessSimulationCapabilities(dataset.source);
  const businessContext = createFreightBusinessContext(dataset, instance, businessOptions);
  base.cargo = instance.items.map((item) => {
    const cargo = externalItemToCargo(item, dataset.dataClassification);
    const assignment = businessContext.assignments[String(item.externalItemId)];
    return {
      ...cargo,
      customerId: assignment.customerId,
      customerName: assignment.customerName,
      orderId: assignment.orderId,
      orderLabel: assignment.orderLabel,
      destinationPort: assignment.destinationPort,
      portSequence: assignment.portSequence,
      unloadGroup: assignment.unloadGroup,
      unloadGroupLabel: assignment.unloadGroupLabel,
      batchId: assignment.batchId,
      batchLabel: assignment.batchLabel,
      externalMetadata: {
        ...cargo.externalMetadata,
        cargoSource: dataset.source,
        cargoDataset: item.externalDataset,
        cargoInstance: instance.id,
        businessContextProfile: businessContext.profileId,
        businessContextVersion: businessContext.profileVersion,
        portContextSource: businessContext.portContextSource,
        routeReference: businessContext.routeReference,
        assignmentMethod: businessContext.assignmentMethod,
        businessAssignment: { ...assignment }
      }
    };
  });
  base.datasetId = `${dataset.source}/${instance.id}`;
  base.order = {
    ...base.order,
    orderNo: taskId,
    originPort: businessContext.portOfLoading.name,
    destinationPort: businessContext.portOfDischarge.name,
    route: `${businessContext.portOfLoading.name} → ${businessContext.portOfDischarge.name}`,
    customer: `外部测试客户组（${businessContext.customerCount}）`,
    source: 'external-dataset-copy',
    dataClassification: dataset.dataClassification
  };
  base.caseContext = {
    ...base.caseContext,
    caseId: taskId,
    origin: 'Ningbo, CN',
    destination: 'Hamburg, DE',
    terminal: null,
    carrier: 'UNKNOWN',
    voyage: null,
    bookingReference: null,
    terminalAcceptanceReference: null,
    route: [{ portSequence: 1, portCode: 'HAM', name: 'Hamburg' }]
  };
  base.externalBusinessContext = { ...businessContext, assignments: undefined };
  base.dataClassification = dataset.dataClassification;
  base.selectedContainerType = businessOptions.containerType || '40HQ';
  base.containerMode = 'REFERENCE_PROFILE';
  const unsupported = [...new Set(base.cargo.flatMap((cargo) => cargo.externalMetadata.mappingSupport.unsupportedConstraints))];
  const factsComplete = base.cargo.every((cargo) => cargo.length > 0 && cargo.width > 0 && cargo.height > 0 && cargo.weight > 0);
  const conservation = {
    skuCount: base.cargo.length,
    pieces: base.cargo.reduce((sum, cargo) => sum + Number(cargo.quantity || 0), 0),
    weightKg: base.cargo.every((cargo) => Number.isFinite(cargo.weight)) ? base.cargo.reduce((sum, cargo) => sum + cargo.weight * cargo.quantity, 0) : null
  };
  base.externalDataset = {
    source: dataset.source,
    displayName: dataset.displayName,
    instanceId: instance.id,
    instanceLabel: instance.label,
    sourceNotice: dataset.sourceNotice,
    containerDefinition: instance.container || instance.containers || instance.trucks || null,
    rawSourceImmutable: true,
    normalizedSourceImmutable: true,
    unsupportedConstraints: unsupported,
    solverReadiness: solverReadinessFor(dataset.source, instance.group || instance.externalDataset),
    solverEligibility: !factsComplete ? 'BLOCKED_MISSING_REQUIRED_FACTS' : unsupported.length ? 'DATA_COMPLETE_WITH_UNSUPPORTED_CONSTRAINTS' : 'DATA_COMPLETE_FOR_EXISTING_ENVELOPE',
    conservation
  };
  base.dataSource = {
    ...base.dataSource,
    order: `${businessContext.label} · ${businessContext.customerCount} 个客户 · ${businessContext.unloadGroupCount} 个卸货组`,
    cargo: `${externalClassificationLabel(dataset.dataClassification)} · ${dataset.displayName} · ${instance.label} · ${conservation.pieces} 件`,
    plan: '尚未生成',
    compliance: '来源未提供'
  };
  return base;
}

export function persistExternalTaskCopy(session, storage = globalThis.localStorage) {
  const current = JSON.parse(storage.getItem(EXTERNAL_TASK_STORE_KEY) || '[]');
  const snapshot = JSON.parse(JSON.stringify({ taskId: session.order.orderNo, createdAt: new Date().toISOString(), datasetId: session.datasetId, dataClassification: session.dataClassification, order: session.order, caseContext: session.caseContext, externalBusinessContext: session.externalBusinessContext, externalDataset: session.externalDataset, cargo: session.cargo,solverMode:session.solverMode,benchmarkMode:session.benchmarkMode,sourceContainer:session.sourceContainer,datasetCapabilities:session.datasetCapabilities,selectedContainerType:session.selectedContainerType,containerMode:session.containerMode }));
  storage.setItem(EXTERNAL_TASK_STORE_KEY, JSON.stringify([snapshot, ...current.filter((item) => item.taskId !== snapshot.taskId)].slice(0, 20)));
  return snapshot;
}

export function readExternalTaskCopies(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(EXTERNAL_TASK_STORE_KEY) || '[]'); } catch { return []; }
}

export function expandExternalCargoForSolver(cargo) {
  return cargo.flatMap((item) => Array.from({ length: Number(item.quantity || 0) }, (_, index) => ({ ...JSON.parse(JSON.stringify(item)), quantity: 1, cargoId: `${item.cargoId}__piece_${String(index + 1).padStart(6, '0')}` })));
}
