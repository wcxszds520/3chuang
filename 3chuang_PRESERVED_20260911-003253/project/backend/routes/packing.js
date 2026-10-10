/**
 * Packing Route - v33.0 FINAL MASTER BUNDLE
 * 
 * 🎯 INTERFACE CONTRACT (LOCKED):
 * ✅ Flat structure: loadedCargo[].{x, y, z, l, h, w, color, type, loadingIndex}
 * ✅ Utilization = (loaded volume / container volume) * 100
 * ✅ Compliance badge: EXCELLENT only when lateral offset ≤ 5%
 * ✅ No nested objects (position, dimensions, properties)
 */

const express = require('express');
const router = express.Router();
const Cargo = require('../models/Cargo');
const ContainerType = require('../models/ContainerType');
const AlgorithmOrchestrator = require('../services/AlgorithmOrchestrator');
const AIComplianceService = require('../services/AIComplianceService');
const AIPackingService = require('../services/AIPackingService');
const ResultCache = require('../services/ResultCache');
const ComplianceTaskManager = require('../services/ComplianceTaskManager');
const { evaluateAdmission } = require('../services/realworld/AdmissionPrecheckEngine');
const { REFERENCE_EQUIPMENT, buildEquipmentDecision } = require('../services/realworld/EquipmentPlanningService');
const { resolveRules } = require('../services/realworld/RuleRegistry');
const { buildShipmentReadiness } = require('../services/realworld/ShipmentReadinessService');
const { normalizeCargoList } = require('../services/packing/PackagingProfile');
const db = require('../config/database');

const STANDARD_CONTAINER_FALLBACKS = {
  '20GP': { ...REFERENCE_EQUIPMENT['20GP'], name: '20GP 标准干货柜' },
  '40GP': { ...REFERENCE_EQUIPMENT['40GP'], name: '40GP 标准干货柜' },
  '40HQ': { ...REFERENCE_EQUIPMENT['40HQ'], name: '40HQ 高柜' },
  '45HQ': { typeId: '45HQ', name: '45HQ 加长高柜', innerLength: 13556, innerWidth: 2352, innerHeight: 2698, maxWeight: 25000, description: '需确认航线/堆场箱源' },
  '20RF': { typeId: '20RF', name: '20RF 冷藏柜', innerLength: 5450, innerWidth: 2290, innerHeight: 2260, maxWeight: 22000, description: '冷链订舱/温控复核' },
  '40RH': { typeId: '40RH', name: '40RH 冷藏高柜', innerLength: 11580, innerWidth: 2290, innerHeight: 2500, maxWeight: 25000, description: '冷链订舱/温控复核' },
  '20OT': { typeId: '20OT', name: '20OT 开顶柜', innerLength: 5898, innerWidth: 2352, innerHeight: 2350, maxWeight: 28000, description: '特种柜订舱/OOG 审核' },
  '40OT': { typeId: '40OT', name: '40OT 开顶柜', innerLength: 12032, innerWidth: 2352, innerHeight: 2350, maxWeight: 26000, description: '特种柜订舱/OOG 审核' },
  '20FR': { typeId: '20FR', name: '20FR 框架柜', innerLength: 5612, innerWidth: 2200, innerHeight: 2200, maxWeight: 31000, description: '特种柜订舱/OOG 审核' },
  '40FR': { typeId: '40FR', name: '40FR 框架柜', innerLength: 11784, innerWidth: 2200, innerHeight: 2200, maxWeight: 40000, description: '特种柜订舱/OOG 审核' }
};

// CRITICAL FIX: Apply 200MB limit middleware for all packing routes (large AI compliance payloads)
router.use(express.json({ limit: '200mb' }));
router.use(express.urlencoded({ limit: '200mb', extended: true }));

router.get('/rules', (req, res) => {
  const resolved = resolveRules({ caseDate: req.query.caseDate || '2026-08-24' });
  const rules = req.query.includeInactive === 'true'
    ? resolved
    : resolved.filter((rule) => !['FUTURE', 'DRAFT'].includes(rule.resolvedStatus));
  return res.success({
    caseDate: req.query.caseDate || '2026-08-24',
    registryRole: 'RULE_GUIDANCE_REFERENCE_REGISTRY',
    normalUiHidesFutureAndDraft: req.query.includeInactive !== 'true',
    rules
  }, '2.5 rule/guidance/reference registry resolved');
});

router.get('/equipment/reference', (req, res) => res.success({
  mode: 'REFERENCE_PROFILE', profiles: Object.values(REFERENCE_EQUIPMENT), operationalAcceptance: 'EXTERNAL_CONFIRMATION_REQUIRED'
}, 'Reference equipment profiles loaded'));

router.post('/equipment/decision', (req, res) => res.success(buildEquipmentDecision(req.body || {}), 'Equipment decision matrix generated'));

router.post('/admission/precheck', (req, res) => res.success(evaluateAdmission(req.body || {}), 'Real-world admission precheck completed'));

router.post('/shipment-readiness', (req, res) => {
  const cargoList = normalizeCargoList(req.body?.cargoList || [], { source: 'USER_INPUT' });
  return res.success(buildShipmentReadiness({ ...req.body, cargoList }), 'Shipment readiness evidence generated');
});

router.get('/plans/:planId', async (req, res, next) => {
  try {
    const planId = String(req.params.planId || '');
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/.test(planId)) return res.error('planId 无效', 400);
    const [rows] = await db.query(
      'SELECT plan_id, container_type, plan_data, compliance_status, risk_level, created_at FROM packing_plan WHERE plan_id = ? LIMIT 1',
      [planId]
    );
    if (!rows.length) return res.error('装箱方案不存在', 404);
    const row = rows[0];
    const plan = typeof row.plan_data === 'string' ? JSON.parse(row.plan_data) : row.plan_data;
    return res.success({
      ...plan,
      planId: row.plan_id,
      source: 'backend',
      sourceCode: 'BACKEND_SOLVED',
      containerType: row.container_type,
      complianceStatus: row.compliance_status,
      riskLevel: row.risk_level,
      createdAt: row.created_at
    }, '装箱方案读取成功');
  } catch (error) {
    return next(error);
  }
});

// Initialize async compliance infrastructure
const resultCache = new ResultCache();
const taskManager = new ComplianceTaskManager(resultCache, AIComplianceService);

router.post('/generate', async (req, res) => {
  const requestId = `REQ_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 [${requestId}] Packing Request Started (AlgorithmOrchestrator)`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    const {
      cargoList: submittedCargoList,
      cargoIds: legacyCargoIds,
      containerType: containerTypeId,
      solver: requestedSolver,
      strategy: requestedStrategy,
      options: requestOptions = {},
      caseContext = {},
      containerMode = 'REFERENCE_PROFILE',
      actualContainer = null,
      massEvidence = {},
      vgm = {},
      transport = {},
      securingInputs = {},
      operatorEnvelope = null,
      dangerousGoodsEvidence = {},
      woodPackagingEvidence = {}
    } = req.body;

    let cargoDataList = submittedCargoList;
    if ((!Array.isArray(cargoDataList) || cargoDataList.length === 0)
      && Array.isArray(legacyCargoIds) && legacyCargoIds.length > 0) {
      const placeholders = legacyCargoIds.map(() => '?').join(', ');
      const [legacyRows] = await db.query(
        `SELECT * FROM cargo WHERE cargo_id IN (${placeholders})`,
        legacyCargoIds
      );
      const rowsById = new Map(legacyRows.map(row => [row.cargo_id, row]));
      cargoDataList = legacyCargoIds
        .map(cargoId => rowsById.get(cargoId))
        .filter(Boolean)
        .map(row => ({
          cargoId: row.cargo_id,
          name: row.name,
          length: row.length,
          width: row.width,
          height: row.height,
          weight: Number(row.weight),
          quantity: row.quantity,
          stackable: Boolean(row.stackable),
          maxStackLayers: row.max_stack_layers,
          canRotate: row.can_rotate == null ? true : Boolean(row.can_rotate),
          canInvert: Boolean(row.can_invert),
          canLayFlat: Boolean(row.can_lay_flat),
          fragile: Boolean(row.fragile),
          dangerous: Boolean(row.dangerous),
          eta: row.eta,
          portSequence: row.port_sequence || 1,
          packagingType: row.packaging_type || 'wooden',
          sku: row.sku || row.cargo_id,
          batchId: row.batch_id || `batch_${row.port_sequence || 1}`,
          destinationPort: row.destination_port || null
        }));

      if (cargoDataList.length === 0) {
        return res.status(404).json({
          code: 404,
          message: 'No cargo found for supplied cargo IDs',
          data: null,
          ts: Date.now()
        });
      }
    }

    if (!Array.isArray(cargoDataList) || cargoDataList.length === 0) {
      return res.status(400).json({ 
        code: 400, 
        message: 'Cargo list or cargo ID list is required and must be non-empty',
        data: null,
        ts: Date.now()
      });
    }
    
    if (!containerTypeId) {
      return res.status(400).json({ 
        code: 400, 
        message: 'Container type is required',
        data: null,
        ts: Date.now()
      });
    }

    cargoDataList = normalizeCargoList(cargoDataList, { source: 'USER_INPUT' });

    // Build cargo objects with strict validation
    const cargoList = cargoDataList.map(data => new Cargo({
      cargoId: data.cargoId || `cargo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: String(data.name || ''),
      length: Number(data.length),
      width: Number(data.width),
      height: Number(data.height),
      weight: Number(data.weight),
      quantity: Number(data.quantity || 1),
      stackable: Boolean(data.stackable !== false),
      maxStackLayers: Number(data.maxStackLayers || 3),
      canRotate: data.canRotate !== false,
      canInvert: data.canInvert === true,
      canLayFlat: data.canLayFlat === true,
      packagingType: String(data.packagingType || 'wooden'),
      fragile: Boolean(data.fragile || false),
      dangerous: data.dangerous === true,
      sku: String(data.sku || data.name || ''),
      portSequence: Number(data.portSequence || 1),
      batchId: String(data.batchId || `batch_${data.portSequence || 1}`),
      batchLabel: String(data.batchLabel || data.batchId || `批次 ${data.portSequence || 1}`),
      destinationPort: data.destinationPort || null,  // v37.1: 透传目的港
      eta: data.eta || null,
      handlingMethod: data.handlingMethod || null,
      handlingPolicy: data.handlingPolicy || 'derived',
      heavy: data.heavy === true,
      wooden: data.wooden === true,
      riskNotes: Array.isArray(data.riskNotes) ? data.riskNotes : [],
      source: data.source || null,
      cargoPhysicalProfile: data.cargoPhysicalProfile || null,
      packagingProfile: data.packagingProfile || null,
      handlingMode: data.handlingMode || null,
      orientationPolicy: data.orientationPolicy || null,
      maxSupportedWeight: data.maxSupportedWeight || null,
      maximumSupportedWeightKg: data.maximumSupportedWeightKg || null,
      forkEntry: data.forkEntry || null,
      woodPackagingClass: data.woodPackagingClass || null,
      dangerousGoodsContext: data.dangerousGoodsContext || null,
      visualProfile: data.visualProfile || null
    }));

    // Reference profiles keep planning available when the optional local database
    // is offline. Actual-unit admission still requires user-supplied evidence.
    const referenceData = STANDARD_CONTAINER_FALLBACKS[containerTypeId];
    let containerRows = [];
    // A dated reference is already the selected source below. Do not wait on
    // an optional database query whose result would be discarded anyway.
    if (!referenceData) try {
      [containerRows] = await db.query(
        `SELECT
          type_id AS typeId,
          name,
          inner_length AS innerLength,
          inner_width AS innerWidth,
          inner_height AS innerHeight,
          max_weight AS maxWeight,
          description
        FROM container_type
        WHERE type_id = ?`,
        [containerTypeId]
      );
    } catch (databaseError) {
      console.warn(`[${requestId}] Container catalogue database unavailable; using dated reference profile when available: ${databaseError.message}`);
    }
    
    const containerData = String(containerMode).toUpperCase() === 'ACTUAL_CONTAINER' && actualContainer
      ? { ...referenceData, ...actualContainer, typeId: containerTypeId, maxWeight: Number(actualContainer.maxGross || 0) - Number(actualContainer.tare || 0) }
      : referenceData || containerRows?.[0];
    if (!containerData) {
      return res.status(404).json({ 
        code: 404, 
        message: `Container type ${containerTypeId} not found`,
        data: null,
        ts: Date.now()
      });
    }
    
    const container = new ContainerType(containerData);

    const solver = requestedSolver || requestOptions.solver || requestOptions.algorithmId || 'auto';
    const strategy = requestedStrategy || requestOptions.strategy || 'space';
    console.log(`🏗️ [${requestId}] Running solver=${solver}, strategy=${strategy}`);
    console.log(`   Container: ${container.typeId} (${container.innerLength}×${container.innerWidth}×${container.innerHeight}mm)`);
    console.log(`   Cargo items: ${cargoList.length}`);

    // Use AlgorithmOrchestrator instead of direct engine call
    const orchestrator = new AlgorithmOrchestrator({ debugMode: false });
    const orchResult = await orchestrator.execute({
      cargoList,
      container: {
        typeId: container.typeId,
        name: container.name,
        innerLength: container.innerLength,
        innerWidth: container.innerWidth,
        innerHeight: container.innerHeight,
        maxWeight: container.maxWeight
      },
      options: { ...requestOptions, algorithmId: solver, strategy, caseContext, route: caseContext.route }
    });

    // Handle orchestrator errors (OVERSIZE, UNKNOWN_ALGORITHM)
    if (!orchResult.success) {
      const errorCode = orchResult.error?.code || 'INTERNAL_ERROR';
      const errorMessage = orchResult.error?.message || 'Packing failed';
      console.error(`❌ [${requestId}] Orchestrator error: ${errorCode} - ${errorMessage}`);
      return res.status(400).json({
        code: errorCode,
        message: errorMessage,
        data: orchResult.error,
        ts: Date.now()
      });
    }

    console.log(`✅ [${requestId}] Packing complete`);
    console.log(`   - Loaded: ${orchResult.loadedCargo.length}`);
    console.log(`   - Utilization: ${orchResult.metrics.space_utilization.toFixed(2)}%`);

    // Verify utilization calculation
    const containerVolume = container.innerLength * container.innerWidth * container.innerHeight;
    const loadedVolume = orchResult.loadedCargo.reduce((sum, item) => 
      sum + (item.l * item.w * item.h), 0
    );
    const verifiedUtilization = (loadedVolume / containerVolume) * 100;

    console.log(`🔍 [${requestId}] Verification:`);
    console.log(`   - Orchestrator: ${orchResult.metrics.space_utilization.toFixed(2)}%`);
    console.log(`   - Verified: ${verifiedUtilization.toFixed(2)}%`);

    if (orchResult.warnings?.length > 0) {
      console.log(`⚠️ [${requestId}] Warnings:`);
      orchResult.warnings.forEach(w => {
        const msg = typeof w === 'string' ? w : `${w.type}: ${w.message}`;
        console.log(`   - ${msg}`);
      });
    }

    // Compliance badge: compute from cogOffset (backward compatible)
    // orchResult.cogOffset may be a number or object; normalize
    let cogOffsetObj = orchResult.cogOffset;
    if (typeof cogOffsetObj === 'number') {
      cogOffsetObj = { lateral: Math.abs(cogOffsetObj), longitudinal: 0 };
    } else if (!cogOffsetObj || typeof cogOffsetObj !== 'object') {
      cogOffsetObj = { lateral: 0, longitudinal: 0 };
    }
    // Ensure lateral field exists
    if (cogOffsetObj.lateral === undefined) {
      cogOffsetObj.lateral = 0;
    }

    const cogWithinPolicy = orchResult.validator?.checks?.cog?.withinPolicy !== false
      && cogOffsetObj.lateral <= 5.0
      && Math.abs(Number(cogOffsetObj.longitudinal || 0)) <= 10.0;
    const stabilityPassed = orchResult.validator?.checks?.stability !== false;
    const isCompliant = cogWithinPolicy && stabilityPassed;
    const complianceStatus = isCompliant ? 'EXCELLENT' : 'WARNING';
    const shipmentReadiness = buildShipmentReadiness({
      caseContext,
      containerMode,
      actualContainer,
      container: { ...containerData, typeId: containerTypeId },
      cargoList,
      placements: orchResult.loadedCargo,
      validator: orchResult.validator,
      layoutQuality: orchResult.layoutQuality || orchResult.metrics?.layoutQuality,
      voidJustification: orchResult.voidJustification || orchResult.metrics?.voidJustification,
      securing: orchResult.securing || orchResult.metrics?.securing,
      portAccessibility: orchResult.portAccessibility || orchResult.metrics?.portAccessibility,
      loadDistribution: orchResult.loadDistribution || orchResult.metrics?.loadDistribution,
      packagingModel: orchResult.packagingModel,
      handlingAssumptions: orchResult.handlingAssumptions,
      massEvidence,
      vgm,
      transport,
      securingInputs,
      dangerousGoodsEvidence,
      woodPackagingEvidence
    });

    // AI 闭环：异步获取 AI 解释与推荐（非阻塞，失败静默降级）
    let aiExplanation = null;
    let aiRecommendation = null;
    if (requestOptions.includeAiExplanation !== false) try {
      const aiService = new AIPackingService();
      // AI 结果解释（Requirement 3.5）
      const packingResultForAI = {
        loadedCargo: orchResult.loadedCargo,
        unloadedCargo: orchResult.unloadedCargo,
        spaceUtilization: Math.min(verifiedUtilization, 100),
        totalWeight: orchResult.totalWeight,
        containerInfo: {
          typeId: container.typeId,
          name: container.name,
          innerLength: container.innerLength,
          innerWidth: container.innerWidth,
          innerHeight: container.innerHeight,
          maxWeight: container.maxWeight,
          mode: String(containerMode).toUpperCase(),
          isoTypeCode: containerData.isoTypeCode || null,
          doorWidth: containerData.doorWidth || null,
          doorHeight: containerData.doorHeight || null,
          tare: containerData.tare || null,
          maxGross: containerData.maxGross || null,
          source: containerData.source || null
        }
      };
      const explainResult = await aiService.explainResult(packingResultForAI);
      aiExplanation = explainResult || null;
    } catch (aiError) {
      console.warn(`⚠️ [${requestId}] AI explanation failed (degraded):`, aiError.message);
      aiExplanation = null;
    }

    if (requestOptions.includeAiExplanation !== false) try {
      const aiService = new AIPackingService();
      // AI 箱型推荐（Requirement 3.1）
      const recommendResult = await aiService.recommendContainers(cargoList);
      aiRecommendation = recommendResult || null;
    } catch (aiError) {
      console.warn(`⚠️ [${requestId}] AI recommendation failed (degraded):`, aiError.message);
      aiRecommendation = null;
    }
    
    // Build response with FLAT structure (backward compatible)
    const response = {
      code: 200,
      message: 'Packing plan generated successfully',
      data: {
        planId: requestId,
        containerInfo: {
          typeId: container.typeId,
          name: container.name,
          innerLength: container.innerLength,
          innerWidth: container.innerWidth,
          innerHeight: container.innerHeight,
          maxWeight: container.maxWeight
        },
        // FLAT STRUCTURE - NO NESTED OBJECTS (backward compatible)
        loadedCargo: orchResult.loadedCargo.map(cargo => ({
          loadingIndex: cargo.loadingIndex,
          name: cargo.name,
          cargoId: cargo.cargoId,
          x: cargo.x,
          y: cargo.y,
          z: cargo.z,
          l: cargo.l,
          h: cargo.h,
          w: cargo.w,
          color: cargo.color,
          type: cargo.type,
          packagingType: cargo.packagingType,
          packagingProfile: cargo.packagingProfile,
          cargoPhysicalProfile: cargo.cargoPhysicalProfile,
          visualProfile: cargo.visualProfile,
          maxSupportedWeight: cargo.maxSupportedWeight,
          maximumSupportedWeightKg: cargo.maximumSupportedWeightKg,
          orientationPolicy: cargo.orientationPolicy,
          forkEntry: cargo.forkEntry,
          woodPackagingClass: cargo.woodPackagingClass,
          dangerousGoodsContext: cargo.dangerousGoodsContext,
          weight: cargo.weight,
          fragile: cargo.fragile,
          dangerous: cargo.dangerous,
          stackable: cargo.stackable,
          maxStackLayers: cargo.maxStackLayers,
          canRotate: cargo.canRotate,
          canInvert: cargo.canInvert,
          canLayFlat: cargo.canLayFlat,
          batchId: cargo.batchId,
          batchKey: cargo.batchKey,
          batchLabel: cargo.batchLabel,           // v37.1: 友好批次标签（"目的港 · ETA"）
          destinationPort: cargo.destinationPort, // v37.1: 目的港
          eta: cargo.eta,                         // v37.1: ETA
          portSequence: cargo.portSequence,
          sku: cargo.sku,
          handlingMethod: cargo.handlingMethod,
          handlingPolicy: cargo.handlingPolicy,
          heavy: cargo.heavy,
          wooden: cargo.wooden,
          riskNotes: cargo.riskNotes,
          source: cargo.source,
          orientation: cargo.orientation,
          inverted: cargo.inverted,
          stackLevel: cargo.stackLevel,
          supportRatio: cargo.supportRatio,
          supportMargin: cargo.supportMargin,
          supportCargoIds: cargo.supportCargoIds,
          stackStability: cargo.stackStability,
          restraint: cargo.restraint,
          slenderness: cargo.slenderness,
          riskStatus: cargo.riskStatus,
          placementReason: cargo.placementReason,
          candidateTrace: cargo.candidateTrace,
          algorithmMeta: cargo.algorithmMeta,
          handlingEvidence: cargo.handlingEvidence
        })),
        unloadedCargo: orchResult.unloadedCargo.map(cargo => ({
          name: cargo.name,
          cargoId: cargo.cargoId,
          length: cargo.length,
          width: cargo.width,
          height: cargo.height,
          weight: cargo.weight,
          quantity: cargo.quantity,
          sku: cargo.sku,
          batchId: cargo.batchId,
          batchLabel: cargo.batchLabel,
          destinationPort: cargo.destinationPort,
          portSequence: cargo.portSequence,
          handlingMethod: cargo.handlingMethod,
          riskNotes: cargo.riskNotes,
          reason: cargo.reason || 'Insufficient space'
        })),
        // Core metrics (backward compatible)
        spaceUtilization: Math.min(verifiedUtilization, 100),
        totalWeight: orchResult.totalWeight,
        totalCargoCount: orchResult.loadedCargo.length,
        cog: orchResult.cog,
        cogOffset: cogOffsetObj,
        metrics: orchResult.metrics,
        validator: orchResult.validator,
        stability: orchResult.stability || orchResult.validator?.stability || null,
        layoutQuality: orchResult.layoutQuality || orchResult.metrics?.layoutQuality || null,
        voidJustification: orchResult.voidJustification || orchResult.metrics?.voidJustification || null,
        packagingModel: orchResult.packagingModel || null,
        shipmentReadiness,
        securing: orchResult.securing || orchResult.metrics?.securing || null,
        operationFeasibility: orchResult.operationFeasibility || orchResult.metrics?.operationFeasibility || null,
        fallback: orchResult.fallback,
        constraintMeta: orchResult.constraintMeta,
        warnings: orchResult.warnings || [],
        // Compliance badge (≤5% = EXCELLENT)
        compliance: {
          status: isCompliant ? 'WITHIN_PROJECT_POLICY' : 'REVIEW_REQUIRED',
          legacyStatus: complianceStatus,
          badge: isCompliant ? 'WITHIN PROJECT POLICY — NOT OPERATIONAL ACCEPTANCE' : 'OUTSIDE RECOMMENDED PROJECT POLICY',
          lateralOffset: cogOffsetObj.lateral.toFixed(2),
          longitudinalOffset: Number(cogOffsetObj.longitudinal || 0).toFixed(2),
          stabilityStatus: orchResult.validator?.stability?.status || 'NOT_PROVIDED',
          dataClassification: 'PROJECT_POLICY',
          threshold: 5.0,
          thresholds: { lateralPercent: 5.0, longitudinalPercent: 10.0 }
        },
        timestamp: new Date().toISOString(),
        // ext_ prefixed new fields (Requirement 16.2 - backward compatible extensions)
        ext_metrics: orchResult.metrics,
        ext_stability: orchResult.stability || orchResult.validator?.stability || null,
        ext_layoutQuality: orchResult.layoutQuality || orchResult.metrics?.layoutQuality || null,
        ext_voidJustification: orchResult.voidJustification || orchResult.metrics?.voidJustification || null,
        ext_packagingModel: orchResult.packagingModel || null,
        ext_shipmentReadiness: shipmentReadiness,
        ext_securing: orchResult.securing || orchResult.metrics?.securing || null,
        ext_operationFeasibility: orchResult.operationFeasibility || orchResult.metrics?.operationFeasibility || null,
        ext_portAccessibility: orchResult.portAccessibility || orchResult.metrics?.portAccessibility || null,
        ext_loadDistribution: orchResult.loadDistribution || orchResult.metrics?.loadDistribution || null,
        ext_placementHash: orchResult.placementHash || null,
        ext_strategyUsed: orchResult.metrics?.strategy_used || 'default',
        ext_strategyFamily: orchResult.metrics?.strategy_family || 'exact',
        ext_skuStats: orchResult.skuStats || {},
        ext_constraintMeta: orchResult.constraintMeta || null,
        ext_fromCache: orchResult.fromCache || false,
        ext_algorithmId: orchResult.metrics?.algorithm_id || 'auto',
        ext_aiExplanation: aiExplanation,
        ext_recommendation: aiRecommendation,
        ext_admission: evaluateAdmission({
          caseContext, containerMode, actualContainer, container: { ...containerData, typeId: containerTypeId },
          cargoList: cargoDataList, placements: orchResult.loadedCargo,
          massEvidence, vgm, transport, securingInputs, operatorEnvelope, dangerousGoodsEvidence, woodPackagingEvidence,
          portAccessibility: orchResult.portAccessibility, loadDistribution: orchResult.loadDistribution
        })
      },
      ts: Date.now()
    };

    console.log(`${'='.repeat(80)}`);
    console.log(`✅ [${requestId}] Response sent`);
    console.log(`${'='.repeat(80)}\n`);

    // 持久化装箱结果到 packing_plan 表 (不修改算法结果, 只增加存储)
    try {
      const planId = response.data.planId;
      const containerType = containerTypeId;
      const spaceUtil = response.data.spaceUtilization || 0;
      const totalWeight = response.data.totalWeight || 0;
      const totalCargoCount = response.data.totalCargoCount || 0;
      const planData = JSON.stringify(response.data);
      const complianceStatus = response.data.compliance?.status === 'EXCELLENT' ? 'passed' : 'warning';
      const riskLevel = Math.abs(response.data.cogOffset?.lateral || 0) > 10 ? 'red' : Math.abs(response.data.cogOffset?.lateral || 0) > 5 ? 'yellow' : 'green';

      await db.query(
        `INSERT INTO packing_plan (plan_id, container_type, space_utilization, total_weight, total_cargo_count, plan_data, compliance_status, risk_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [planId, containerType, spaceUtil, totalWeight, totalCargoCount, planData, complianceStatus, riskLevel]
      );
      console.log(`💾 [${requestId}] Plan saved to packing_plan: ${planId}`);
    } catch (saveErr) {
      console.error(`⚠️ [${requestId}] Failed to save plan (non-blocking):`, saveErr.message);
      // 非阻塞: 保存失败不影响返回结果
    }

    res.json(response);

  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    console.error(error.stack);
    
    res.status(500).json({
      code: 500,
      message: 'Internal server error during packing calculation',
      data: null,
      ts: Date.now()
    });
  }
});

/**
 * AI Compliance Check Endpoint (ASYNC)
 * POST /packing/compliance-check
 * 
 * Returns immediately with task ID for polling.
 * Request body: { packingPlanData: {...} }
 * Response: HTTP 202 { code, message, data: { taskId, status, pollUrl, estimatedTime } }
 */
router.post('/compliance-check', async (req, res) => {
  const requestId = `ASYNC_COMPLIANCE_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 [${requestId}] Async AI Compliance Check Initiated`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    const { packingPlanData, declaredVGM } = req.body;
    
    // Validate input
    if (!packingPlanData) {
      return res.status(400).json({
        code: 400,
        message: 'Packing plan data is required'
      });
    }
    
    // CRITICAL: Add declaredVGM to packingPlanData for VGM validation
    if (declaredVGM !== undefined && declaredVGM !== null) {
      packingPlanData.declaredVGM = parseFloat(declaredVGM) || 0;
      console.log(`📊 [${requestId}] VGM declared: ${packingPlanData.declaredVGM} kg`);
    }
    
    // Check cache health
    if (!await resultCache.isHealthy()) {
      return res.status(503).json({
        code: 503,
        message: 'Service temporarily unavailable'
      });
    }
    
    console.log(`📊 [${requestId}] Creating async task...`);
    console.log(`   - Container: ${packingPlanData.containerInfo?.typeId || 'Unknown'}`);
    console.log(`   - Loaded cargo: ${packingPlanData.loadedCargo?.length || 0}`);
    
    // Create task and launch async execution
    const taskId = taskManager.createTask(packingPlanData);
    
    // CRITICAL: Fire-and-forget - do NOT await
    taskManager.executeTask(taskId, packingPlanData);
    
    console.log(`✅ [${requestId}] Task ${taskId} initiated`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Return immediately with HTTP 202
    res.status(202).json({
      code: 202,
      message: 'Compliance check initiated',
      data: {
        taskId,
        status: 'processing',
        pollUrl: `/api/packing/compliance-report/${taskId}`,
        estimatedTime: 10 // seconds
      }
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    res.status(500).json({
      code: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Task Status Query Endpoint
 * GET /packing/compliance-report/:taskId
 * 
 * Returns current task status and result if completed.
 * Response: HTTP 200 { code, message, data: { taskId, status, complianceReport?, error? } }
 * Response: HTTP 404 if task not found
 */
router.get('/compliance-report/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const requestId = `STATUS_${Date.now()}`;
  
  try {
    console.log(`🔍 [${requestId}] Querying task status: ${taskId}`);
    
    // Query task status
    const taskStatus = await taskManager.getTaskStatus(taskId);
    
    if (!taskStatus) {
      console.log(`❌ [${requestId}] Task not found: ${taskId}`);
      return res.status(404).json({
        code: 404,
        message: 'Task not found',
        data: { taskId }
      });
    }
    
    // Return current status
    const responseMessage = taskStatus.status === 'completed' 
      ? 'Compliance check completed'
      : taskStatus.status === 'failed'
      ? 'Compliance check failed'
      : 'Task is processing';
    
    console.log(`✅ [${requestId}] Task ${taskId} status: ${taskStatus.status}`);
    
    res.json({
      code: 200,
      message: responseMessage,
      data: {
        taskId,
        ...taskStatus
      }
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    res.status(500).json({
      code: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Health and Metrics Endpoint
 * GET /packing/health/compliance
 * Task 27: Add metrics endpoint for monitoring
 * 
 * Returns system health status and metrics.
 * Response: { status, cache, queueDepth, averageCompletionTime, timestamp }
 */
router.get('/health/compliance', async (req, res) => {
  try {
    const cacheHealthy = await resultCache.isHealthy();
    const cacheStats = resultCache.getStats ? resultCache.getStats() : { size: 0 };
    
    res.json({
      status: cacheHealthy ? 'healthy' : 'degraded',
      cache: cacheHealthy ? 'connected' : 'unavailable',
      queueDepth: cacheStats.size || 0,
      cacheMode: cacheStats.mode || 'memory',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Health] Error:', error.message);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Deterministic compliance check with optional AI explanation (SYNC - DEPRECATED)
 * POST /packing/compliance-check-sync
 * 
 * Synchronous version maintained for backward compatibility.
 * Will be removed in 2 release cycles.
 * 
 * Request body: { packingPlanData: {...} }
 * Response: { code, message, data: { complianceReport } }
 * 
 * @deprecated Use /packing/compliance-check (async) instead
 */
router.post('/compliance-check-sync', async (req, res) => {
  const requestId = `COMPLIANCE_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🛡️ [${requestId}] Deterministic Compliance Check Started`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    const { packingPlanData, declaredVGM } = req.body;
    
    if (!packingPlanData) {
      return res.status(400).json({
        code: 400,
        message: 'Packing plan data is required'
      });
    }
    
    // CRITICAL: Add declaredVGM to packingPlanData for VGM validation
    if (declaredVGM !== undefined && declaredVGM !== null) {
      packingPlanData.declaredVGM = parseFloat(declaredVGM) || 0;
      console.log(`📊 [${requestId}] VGM declared: ${packingPlanData.declaredVGM} kg`);
    }
    
    console.log(`📊 [${requestId}] Analyzing packing plan...`);
    console.log(`   - Container: ${packingPlanData.containerInfo?.typeId || 'Unknown'}`);
    console.log(`   - Loaded cargo: ${packingPlanData.loadedCargo?.length || 0}`);
    console.log(`   - Utilization: ${packingPlanData.spaceUtilization?.toFixed(2) || 0}%`);
    
    // Deterministic rules own all values and statuses; AI may only explain them.
    const complianceReport = await AIComplianceService.generateComplianceReport(packingPlanData);
    
    console.log(`✅ [${requestId}] Compliance check complete`);
    console.log(`   - Status: ${complianceReport.status}`);
    console.log(`   - Score: ${complianceReport.score}`);
    console.log(`   - Issues: ${complianceReport.issues?.length || 0}`);

    // 持久化合规结果到 packing_plan 表 (更新最近一条 plan 的 compliance_status)
    try {
      // 取最近一条 packing_plan
      const [recentRows] = await db.query('SELECT plan_id, plan_data FROM packing_plan ORDER BY created_at DESC LIMIT 1');
      if (recentRows && recentRows.length > 0) {
        const recentPlan = recentRows[0];
        const normalizedStatus = String(complianceReport.status || '').toUpperCase();
        const newStatus = normalizedStatus === 'PASS' ? 'passed' : normalizedStatus === 'FAIL' ? 'failed' : 'warning';
        // 更新 plan_data 中的 complianceReport
        let updatedPlanData = recentPlan.plan_data;
        try {
          const parsed = typeof updatedPlanData === 'string' ? JSON.parse(updatedPlanData) : updatedPlanData;
          parsed.complianceReport = complianceReport;
          updatedPlanData = JSON.stringify(parsed);
        } catch (e) { /* 解析失败则保留原数据 */ }
        await db.query(
          'UPDATE packing_plan SET compliance_status = ?, plan_data = ? WHERE plan_id = ?',
          [newStatus, updatedPlanData, recentPlan.plan_id]
        );
        console.log(`💾 [${requestId}] Compliance saved to packing_plan: ${recentPlan.plan_id} → ${newStatus}`);
      }
    } catch (saveErr) {
      console.error(`⚠️ [${requestId}] Failed to save compliance (non-blocking):`, saveErr.message);
    }

    res.json({
      code: 200,
      message: 'Compliance check completed',
      data: {
        complianceReport: complianceReport
      }
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    console.error(error.stack);
    
    res.status(500).json({
      code: 500,
      message: 'Internal server error during compliance check',
      error: error.message
    });
  }
});

module.exports = router;
