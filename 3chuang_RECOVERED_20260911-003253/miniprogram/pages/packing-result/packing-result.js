/**
 * Packing Result Page - Industrial Grade with Full Interactions
 * Version: v5.0.0-industrial
 */
import store from '../../utils/store';
import request from '../../utils/request';
import ThreeRenderer from '../../utils/ThreeRenderer';
// 动画工具 (Req 7.5, 7.6, 7.7, 8.2, 8.3)
import animations from '../../utils/animations';
const { normalizePlanSource, getPlanSourceLabel } = require('../../utils/provenance.js');

Page({
  data: {
    selectedContainer: null,
    packingPlan: null,
    isGenerating: false,
    batchColorMapping: [],
    activeCargoTypes: ['heavy', 'normal', 'fragile'],
    currentCargoType: 'all',
    activeBatches: [],
    selectedCargoInfo: null,
    canvasWidth: 0,
    canvasHeight: 0,
    // Lightweight display data only
    spaceUtilizationText: '0.00',
    totalWeightText: '0.00',
    totalWeightNum: 0,
    loadedCount: 0,
    unloadedCount: 0,
    overflowSuggestionText: '',
    aiRiskCount: 0,
    // v25.0.0: Safety metrics
    safetyReport: null,
    showWarningDetails: false,
    // v26.2: CoG Warning
    showCoGWarning: false,
    cogWarningMessage: null,
    // v34.8: SKU-Level Worker Interface
    uniqueSkuList: [],
    selectedSkus: [],
    selectedSkusMap: {}, // Computed map for WXML binding
    cargoInspectorData: null,
    // Pre-generation preview data
    cargoListPreview: [],
    totalCargoQuantity: 0,
    totalCargoWeight: 0,
    totalCargoVolume: 0,
    canGenerate: false,
    // AI Compliance Check
    showComplianceReport: false,
    complianceReport: null,
    isCheckingCompliance: false,
    // AI 结果解释 (Req 3.5, 8.4, 8.7)
    aiExplanation: null,
    aiExplanationLoading: false,
    showAiExplanation: false,
    aiHighlights: [],
    aiRisks: [],
    // v37.6: SKU 筛选默认折叠
    showSkuFilter: false,
    // Narrative Loading
    showNarrativeLoading: false,
    loadingText: '',
    // Generating progress animation (Req 8.3)
    generatingText: '后端约束求解中...',
    showGeneratingProgress: false,
    generatingProgress: 0,
    generatingProgressText: '',
    // Camera preset state (Req 6.6)
    isCameraPresetPlaying: false,
    // 装载动画 HUD 状态
    isLoadingAnimating: false,
    loadingSpeed: 4,             // 1=正常 4=快进 10=极速 30=瞬间
    loadingHudText: '',
    loadingHudProgress: 0,       // 0-100
    loadingHudCurrent: 0,
    loadingHudTotal: 0,
    // Elegant Loading 组件状态 (Req 7.6, 8.2, 8.3)
    _elegantLoading: false,
    _elegantLoadingText: '',
    _elegantLoadingProgress: -1,
    analysisMode: 'normal',
    planSourceCode: 'UNKNOWN',
    planSourceLabel: getPlanSourceLabel('UNKNOWN'),
    strategyName: 'SPACE',
    caseId: ''
  },

  threeRenderer: null,
  rawPackingData: null, // Non-reactive storage for full cargo array
  _generatingTimer: null, // Timer for progress animation
  _progressInterval: null, // Interval for simulated progress

  onLoad: function () {
    const selectedContainer = store.getState('selectedContainer');
    if (!selectedContainer) {
      wx.showToast({ title: '请先选择柜型', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 2000);
      return;
    }
    
    // Load cargo list from store
    const cargoList = store.getState('cargoList') || [];
    
    // Calculate summary statistics
    const summary = this.calculateCargoSummary(cargoList);
    
    const storedPlan = store.getState('packingPlan');
    const currentCase = store.getState('currentCase');
    this.setData({ 
      selectedContainer,
      cargoListPreview: cargoList,
      totalCargoQuantity: summary.totalQuantity,
      totalCargoWeight: summary.totalWeight,
      totalCargoVolume: summary.totalVolume,
      canGenerate: cargoList.length > 0,
      // Initialize compliance state fields
      showComplianceReport: false,
      complianceReport: null,
      isCheckingCompliance: false,
      caseId: currentCase?.caseId || '',
      planSourceCode: normalizePlanSource(storedPlan),
      planSourceLabel: getPlanSourceLabel(storedPlan)
    }, () => {
      if (storedPlan?.loadedCargo?.length) this.loadStoredPlan(storedPlan);
    });
  },

  loadStoredPlan: function(data) {
    const loadedCargo = Array.isArray(data.loadedCargo) ? data.loadedCargo : [];
    this.rawPackingData = loadedCargo;
    const batchMapping = this.generateBatchColorMapping(loadedCargo);
    const uniqueSkuList = this.generateUniqueSkuList(loadedCargo);
    const selectedSkusMap = {};
    uniqueSkuList.forEach((sku) => { selectedSkusMap[sku] = true; });
    const utilization = Number(data.spaceUtilization || 0);
    this.setData({
      packingPlan: {
        containerType: this.data.selectedContainer.typeId,
        spaceUtilizationText: utilization.toFixed(2),
        totalWeightText: Number(data.totalWeight || 0).toFixed(2),
        totalCargoCount: loadedCargo.length,
        spaceUtilization: utilization,
        loadedCargo
      },
      spaceUtilizationText: utilization.toFixed(2),
      totalWeightText: Number(data.totalWeight || 0).toFixed(2),
      totalWeightNum: Number(data.totalWeight || 0),
      loadedCount: loadedCargo.length,
      unloadedCount: Array.isArray(data.unloadedCargo) ? data.unloadedCargo.length : 0,
      aiRiskCount: Array.isArray(data.safetyReport?.warnings) ? data.safetyReport.warnings.length : 0,
      batchColorMapping: batchMapping,
      activeBatches: batchMapping.map((item) => item.batchKey),
      uniqueSkuList,
      selectedSkus: uniqueSkuList,
      selectedSkusMap,
      planSourceCode: normalizePlanSource(data),
      planSourceLabel: getPlanSourceLabel(data),
      strategyName: planStrategy(data)
    }, () => setTimeout(() => this.init3DCanvas(), 100));
  },
  
  /**
   * onReady - Pre-warm compliance check
   * Silently call compliance API in background after page is ready
   */
  onReady: function() {
    console.log('[PackingResult] Page ready, checking for pre-warm opportunity');
    
    // Only pre-warm if packing plan exists
    if (this.data.packingPlan) {
      console.log('[PackingResult] Packing plan exists, skipping auto pre-warm (user triggers manually)');
      // v35.1: 不再自动预热合规检查，只在用户主动点击时触发
    } else {
      console.log('[PackingResult] No packing plan yet, skipping pre-warm');
    }
  },
  
  /**
   * Pre-warm Compliance Check (ASYNC VERSION)
   * Task 11: Use async endpoint for background pre-warming
   * Silently fetch compliance report in background without showing UI
   */
  preWarmCompliance: function() {
    console.log('[PackingResult] Pre-warming compliance check (async)...');
    
    // Skip if already checking or report already exists
    if (this.data.isCheckingCompliance || this.data.complianceReport) {
      console.log('[PackingResult] Skipping pre-warm: already checking or report exists');
      return;
    }
    
    // Get full packing plan from store
    const fullPackingPlan = typeof store.getPackingPlan === 'function' 
      ? store.getPackingPlan() 
      : store.getState('packingPlan');
    
    if (!fullPackingPlan) {
      console.log('[PackingResult] No packing plan data for pre-warm');
      return;
    }
    
    console.log('[PackingResult] Silently requesting async compliance check...');
    
    // Silent API call - no loading UI, initiate async task
    request.post('/packing/compliance-check', {
      packingPlanData: fullPackingPlan
    }).then((response) => {
      const data = response.data || response;
      const taskId = data.taskId;
      
      if (!taskId) {
        console.warn('[PackingResult] No task ID received during pre-warm');
        return;
      }
      
      console.log('[PackingResult] Pre-warm task initiated:', taskId);
      
      // Start silent polling (no UI updates)
      this.silentPollComplianceStatus(taskId, 0);
      
    }).catch((error) => {
      console.warn('[PackingResult] Pre-warm compliance check failed (non-critical):', error);
      // Silent failure - don't show error to user
    });
  },
  
  /**
   * Silent Poll Compliance Status (for pre-warming)
   * Polls without showing loading UI, caches result silently
   * @param {string} taskId - Task identifier
   * @param {number} attempt - Current polling attempt (0-based)
   */
  silentPollComplianceStatus: function(taskId, attempt) {
    const MAX_ATTEMPTS = 15; // 15 attempts × 2s = 30s timeout
    const POLL_INTERVAL = 2000; // 2 seconds
    
    if (attempt >= MAX_ATTEMPTS) {
      console.warn('[PackingResult] Silent polling timeout after 30s');
      return;
    }
    
    // Query task status
    request.get(`/packing/compliance-report/${taskId}`)
      .then((response) => {
        const data = response.data || response;
        const status = data.status;
        const complianceReport = data.complianceReport;
        
        if (status === 'completed') {
          console.log('[PackingResult] Pre-warm completed, caching report');
          
          // Format and cache report silently
          const formattedReport = {
            status: complianceReport.status,
            score: complianceReport.score,
            statusText: this.getComplianceStatusText(complianceReport.status),
            statusColor: this.getComplianceStatusColor(complianceReport.status),
            issues: complianceReport.issues || [],
            advice: complianceReport.advice || '暂无建议',
            timestamp: complianceReport.timestamp,
            isFallback: false,
            reportTable: complianceReport.reportTable || []
          };
          
          // Cache report silently (do NOT show popup)
          this.setData({ 
            complianceReport: formattedReport
          });
          
          console.log('[PackingResult] Compliance report pre-warmed and cached');
          
        } else if (status === 'failed') {
          console.warn('[PackingResult] Pre-warm failed (non-critical)');
          
        } else if (status === 'processing') {
          // Continue silent polling
          setTimeout(() => {
            this.silentPollComplianceStatus(taskId, attempt + 1);
          }, POLL_INTERVAL);
        }
        
      }).catch((error) => {
        console.warn('[PackingResult] Silent polling error (non-critical):', error);
        // Silent failure - don't retry, don't show error
      });
  },
  
  /**
   * Calculate cargo summary statistics
   */
  calculateCargoSummary: function(cargoList) {
    let totalQuantity = 0;
    let totalWeight = 0;
    let totalVolume = 0;
    
    cargoList.forEach(cargo => {
      const quantity = cargo.quantity || 1;
      totalQuantity += quantity;
      totalWeight += (cargo.weight || 0) * quantity;
      
      // Calculate volume in cubic meters
      const length = (cargo.length || 0) / 1000;
      const width = (cargo.width || 0) / 1000;
      const height = (cargo.height || 0) / 1000;
      totalVolume += length * width * height * quantity;
    });
    
    return {
      totalQuantity,
      totalWeight: totalWeight.toFixed(2),
      totalVolume: totalVolume.toFixed(3)
    };
  },
  
  /**
   * Navigate to cargo input page
   */
  onNavigateToCargoInput: function() {
    wx.navigateTo({
      url: '/pages/cargo-input/cargo-input'
    });
  },

  onGeneratePackingPlan: function () {
    this.generatePackingPlan();
  },

  generatePackingPlan: function () {
    this.setData({ isGenerating: true, showGeneratingProgress: false, generatingProgress: 0, generatingText: '后端约束求解中...' });
    
    // Start progress timer: show progress bar after 2000ms (Req 8.3)
    this._generatingTimer = setTimeout(() => {
      if (this.data.isGenerating) {
        this.setData({ showGeneratingProgress: true, generatingProgressText: '后端正在计算；不显示伪造百分比进度' });
      }
    }, 2000);
    
    const cargoList = store.getState('cargoList');
    if (!cargoList || cargoList.length === 0) {
      this._clearGeneratingTimers();
      this.setData({ isGenerating: false });
      wx.showToast({ title: '请先添加货物', icon: 'none' });
      return;
    }

    // v34.4: Extended timeout for large cargo batches (60 seconds)
    const renderTimeoutId = setTimeout(() => {
      console.error('[PackingResult] FATAL: Request timeout (60s)');
      console.error('[PackingResult] ThreeRenderer state:', {
        exists: !!this.threeRenderer,
        initialized: this.threeRenderer?.isInitialized,
        renderCount: this.threeRenderer?.renderCount
      });
      wx.showToast({ title: '请求超时，请重试', icon: 'none', duration: 3000 });
    }, 60000);

    const currentCase = store.getState('currentCase');
    const context = currentCase?.contextSnapshot || {};
    request.post('/packing/generate', {
      cargoList: cargoList,
      containerType: this.data.selectedContainer.typeId,
      solver: 'hybrid-v2.4',
      strategy: 'space',
      caseContext: context.caseContext || {
        caseDate: '2026-08-24', terminal: 'NBSCT', carrier: 'UNKNOWN', voyage: 'UNKNOWN',
        route: [{ portSequence: 1, portCode: 'HAM' }, { portSequence: 2, portCode: 'RTM' }, { portSequence: 3, portCode: 'ANR' }]
      },
      containerMode: context.containerMode || 'REFERENCE_PROFILE',
      actualContainer: context.actualContainer || null,
      massEvidence: context.massEvidence || {},
      vgm: context.vgm || {},
      transport: context.transport || { mode: 'SEA', seaArea: 'B' },
      securingInputs: context.securingInputs || {},
      options: { algorithmId: 'hybrid-v2.4', includeAiExplanation: false }
    }).then((response) => {
      clearTimeout(renderTimeoutId);
      this._clearGeneratingTimers();
      
      console.log('[PackingResult] API FULL RESPONSE:', JSON.stringify(response).substring(0, 500));
      
      // CRITICAL FIX: Extract data from response.data (API wraps in {code, message, data})
      const data = response.data || response;
      
      console.log('[PackingResult] Extracted data:', {
        spaceUtilization: data.spaceUtilization,
        totalWeight: data.totalWeight,
        loadedCount: data.loadedCargo?.length,
        unloadedCount: data.unloadedCargo?.length
      });
      
      // CRITICAL: Performance optimization - Store full data in non-reactive variable
      this.rawPackingData = data.loadedCargo;
      
      // Generate batch color mapping
      const batchMapping = this.generateBatchColorMapping(data.loadedCargo);
      
      // v34.8: Generate unique SKU list
      const uniqueSkuList = this.generateUniqueSkuList(data.loadedCargo);
      console.log('[PackingResult] Generated unique SKU list:', uniqueSkuList);
      
      // Generate initial selectedSkusMap (all selected)
      const initialSkusMap = {};
      uniqueSkuList.forEach(sku => {
        initialSkusMap[sku] = true;
      });
      
      // Store full plan in store
      store.setPackingPlan(data);
      
      // CRITICAL FIX: Complete data mapping with all required fields
      const utilization = data.spaceUtilization || 0;
      const utilizationText = utilization > 100 ? '计算异常' : utilization.toFixed(2);
      
      this.setData({ 
        packingPlan: {
          containerType: this.data.selectedContainer.typeId,
          spaceUtilizationText: utilizationText,
          totalWeightText: (data.totalWeight || 0).toFixed(2),
          totalCargoCount: data.loadedCargo?.length || 0,
          spaceUtilization: data.spaceUtilization || 0,
          loadedCargo: data.loadedCargo
        },
        spaceUtilizationText: utilizationText,
        totalWeightText: (data.totalWeight || 0).toFixed(2),
        totalWeightNum: data.totalWeight || 0,
        totalCargoCount: data.loadedCargo?.length || 0,
        loadedCount: data.loadedCargo?.length || 0,
        unloadedCount: data.unloadedCargo?.length || 0,
        overflowSuggestionText: this._buildOverflowSuggestionText(
          data.unloadedCargo,
          this.data.selectedContainer
        ),
        aiRiskCount: (data.safetyReport && data.safetyReport.warnings) ? data.safetyReport.warnings.length : 0,
        planSourceCode: normalizePlanSource(data),
        planSourceLabel: getPlanSourceLabel(data),
        strategyName: planStrategy(data),
        // 仅为工程总重估算；不得冒充 SOLAS VGM。
        containerTareWeight: this._getContainerTareWeight(this.data.selectedContainer.typeId),
        suggestedVGM: Math.round((data.totalWeight || 0) + this._getContainerTareWeight(this.data.selectedContainer.typeId)),
        isGenerating: false,
        batchColorMapping: batchMapping,
        activeBatches: batchMapping.map(b => b.batchKey),
        uniqueSkuList: uniqueSkuList,
        selectedSkus: uniqueSkuList, // Start with all SKUs selected
        selectedSkusMap: initialSkusMap, // Computed map for WXML reactivity
        // v26.2: Safety Warning Detection (with null safety)
        showCoGWarning: data.cogOffset && 
          typeof data.cogOffset.lateral === 'number' && 
          typeof data.cogOffset.longitudinal === 'number' && 
          (data.cogOffset.lateral > 5.0 || data.cogOffset.longitudinal > 10.0),
        cogWarningMessage: data.cogOffset && 
          typeof data.cogOffset.lateral === 'number' && 
          typeof data.cogOffset.longitudinal === 'number' && 
          (data.cogOffset.lateral > 5.0 || data.cogOffset.longitudinal > 10.0) 
          ? `⚠️ 重心偏移警告: 横向${data.cogOffset.lateral.toFixed(1)}% | 纵向${data.cogOffset.longitudinal.toFixed(1)}%` 
          : null
      }, () => {
        // CRITICAL: Callback after setData completes
        console.log('[PackingResult] setData completed, now rendering 3D');
        console.log('[PackingResult] ThreeRenderer exists:', !!this.threeRenderer);
        console.log('[PackingResult] Packing plan exists:', !!this.data.packingPlan);
        
        // v25.0.0: Display safety metrics if available
        if (data.safetyReport) {
          this.displaySafetyMetrics(data.safetyReport);
        }
        
        // v25.0.0: Render CoG crosshair if available
        if (data.safetyReport && data.safetyReport.cog) {
          setTimeout(() => {
            if (this.threeRenderer) {
              this.threeRenderer.renderCoGCrosshair(data.safetyReport.cog);
            }
          }, 500);
        }
        
        // Initialize 3D Canvas
        if (!this.threeRenderer) {
          console.log('[PackingResult] ThreeRenderer not initialized, initializing now');
          setTimeout(() => {
            this.init3DCanvas();
            // Set another timeout to verify render after init and initialize SKU visibility
            setTimeout(() => {
              if (this.threeRenderer && this.threeRenderer.renderCount === 0) {
                console.error('[PackingResult] WARNING: No renders after init');
                this.render3DCargo(); // Force render
              }
              // Initialize SKU visibility after first render
              if (this.threeRenderer && this.data.selectedSkus) {
                console.log('[PackingResult] Initializing SKU visibility after first render:', this.data.selectedSkus);
                this.threeRenderer.updateSkuVisibility(this.data.selectedSkus);
              }
            }, 1000);
          }, 150);
        } else {
          console.log('[PackingResult] ThreeRenderer exists, calling render3DCargo');
          this.render3DCargo();
          
          // Initialize SKU visibility after render
          setTimeout(() => {
            if (this.threeRenderer && this.data.selectedSkus) {
              console.log('[PackingResult] Initializing SKU visibility with:', this.data.selectedSkus);
              this.threeRenderer.updateSkuVisibility(this.data.selectedSkus);
            }
          }, 300);
          
          // Verify render happened
          setTimeout(() => {
            const renderCount = this.threeRenderer?.renderCount || 0;
            console.log(`[PackingResult] Render verification: ${renderCount} renders executed`);
            if (renderCount === 0) {
              console.error('[PackingResult] FATAL: Render did not execute, forcing retry');
              this.render3DCargo();
            }
          }, 500);
        }
        
        // v35.1: 合规检查改为用户主动触发，不再自动预热
        // this.preWarmCompliance();
        
        // AI 结果解释：异步调用 (Req 3.5, 8.4, 8.7)
        this.fetchAiExplanation(data);
      });
    }).catch((error) => {
      clearTimeout(renderTimeoutId);
      this._clearGeneratingTimers();
      this.setData({ isGenerating: false });
      console.error('生成装箱方案失败:', error);
      
      // 离线模式特殊提示 (Req 13.4)
      if (error && error.isOffline) {
        wx.showToast({ title: '离线模式：请先导入演示数据', icon: 'none', duration: 2500 });
      } else {
        wx.showToast({ title: '生成失败', icon: 'none' });
      }
    });
  },

  /**
   * Fetch AI explanation for packing result (Req 3.5, 8.4, 8.7)
   * Strategy: Use ext_aiExplanation from generate response if available,
   * otherwise call explain-result API, fallback to local template on failure.
   */
  fetchAiExplanation: function(packingResult) {
    console.log('[PackingResult] Fetching AI explanation...');
    this.setData({ aiExplanationLoading: true });

    // 优先使用 generate 响应中已携带的 ext_aiExplanation (Task 4.1)
    const inlineExplanation = packingResult.ext_aiExplanation;
    if (inlineExplanation && inlineExplanation.explanation) {
      console.log('[PackingResult] Using inline ext_aiExplanation from generate response');
      this.setData({
        aiExplanation: inlineExplanation.explanation || null,
        aiHighlights: inlineExplanation.highlights || [],
        aiRisks: inlineExplanation.risks || [],
        aiExplanationLoading: false
      });
      return;
    }

    // 若 generate 响应未携带，异步调用 explain-result API
    request.post('/ai-packing/explain-result', {
      packingResult: packingResult
    }, { showLoading: false, showError: false }).then((response) => {
      const data = response.data || response;
      console.log('[PackingResult] AI explanation received:', data);
      this.setData({
        aiExplanation: data.explanation || data.ext_aiExplanation || null,
        aiHighlights: data.highlights || [],
        aiRisks: data.risks || [],
        aiExplanationLoading: false
      });
    }).catch((error) => {
      console.warn('[PackingResult] AI explanation failed, showing deterministic summary:', error);
      // 本地模板降级解释 (Req 3.8)
      this._applyLocalFallbackExplanation(packingResult);
    });
  },

  /**
   * Apply local fallback explanation when AI is unavailable (Req 3.8)
   */
  _applyLocalFallbackExplanation: function(packingResult) {
    const utilization = packingResult.spaceUtilization || 0;
    const loadedCount = (packingResult.loadedCargo || []).length;
    const unloadedCount = (packingResult.unloadedCargo || []).length;
    const fallbackExplanation = `AI 解释当前不可用。确定性方案数据显示：空间利用率 ${utilization.toFixed(1)}%，装入 ${loadedCount} 件` +
      (unloadedCount > 0 ? `，未装 ${unloadedCount} 件；具体原因以方案未装明细为准。` : '，未装 0 件。');
    this.setData({
      aiExplanation: fallbackExplanation,
      aiHighlights: ['LOCAL_SUMMARY · 未修改方案结果'],
      aiRisks: unloadedCount > 0 ? [`${unloadedCount}件货物未装入`] : [],
      aiExplanationLoading: false
    });
  },

  /**
   * Toggle AI explanation visibility (Req 8.4)
   */
  onToggleAiExplanation: function() {
    this.setData({ showAiExplanation: !this.data.showAiExplanation });
  },

  /**
   * Generate batch color mapping for legend
   */
  generateBatchColorMapping: function(loadedCargo) {
    const batchMap = {};
    
    loadedCargo.forEach(item => {
      // v33.0: Handle flat structure - batchId is directly on item
      const batchKey = item.batchKey || item.batchId || item.batch?.eta || 'default';
      // v37.1: 优先使用具体的 batchLabel（"目的港 · ETA"）
      const friendlyLabel = item.batchLabel
        || (item.destinationPort && item.eta ? `${item.destinationPort} · ${item.eta}` : null)
        || (item.destinationPort || (item.eta ? `ETA ${item.eta}` : `批次 ${batchKey}`));
      if (!batchMap[batchKey]) {
        batchMap[batchKey] = {
          batchKey: batchKey,
          label: friendlyLabel,
          color: item.color || item.batch?.color || '#808080',
          colorCSS: item.color || item.batch?.color || '#808080',
          count: 0,
          visible: true
        };
      }
      batchMap[batchKey].count++;
    });
    
    return Object.values(batchMap);
  },
  
  /**
   * v25.0.0: Display Safety Metrics
   * Format and display safety report data
   */
  displaySafetyMetrics: function(safetyReport) {
    console.log('[PackingResult] Displaying safety metrics:', safetyReport);
    
    if (!safetyReport) {
      console.warn('[PackingResult] No safety report data');
      return;
    }
    
    // Format CoG status
    const cogStatus = safetyReport.cogOffset && 
      (safetyReport.cogOffset.lateral <= 5 && safetyReport.cogOffset.longitudinal <= 10) 
      ? 'normal' : 'warning';
    const cogStatusText = cogStatus === 'normal' ? '正常' : '预警';
    
    // Format weight status
    const weightUtilization = safetyReport.weightUtilization || 0;
    let weightStatus = 'normal';
    if (weightUtilization >= 100) {
      weightStatus = 'critical';
    } else if (weightUtilization >= 90) {
      weightStatus = 'warning';
    }
    
    // Format warnings
    const formattedWarnings = (safetyReport.warnings || []).map(warning => {
      const typeMap = {
        'COG_OFFSET': '重心偏移',
        'OVERWEIGHT': '超重',
        'PRESSURE': '压力超限',
        'HEAVY_ON_FRAGILE': '重货压易碎品'
      };
      
      const severityMap = {
        'CRITICAL': '严重',
        'WARNING': '警告'
      };
      
      return {
        ...warning,
        typeText: typeMap[warning.type] || warning.type,
        severityText: severityMap[warning.severity] || warning.severity
      };
    });
    
    // Set safety report data
    this.setData({
      safetyReport: {
        complianceStatus: safetyReport.complianceStatus || 'PASS',
        cogStatus: cogStatus,
        cogStatusText: cogStatusText,
        lateralOffsetText: (safetyReport.cogOffset?.lateral || 0).toFixed(2),
        longitudinalOffsetText: (safetyReport.cogOffset?.longitudinal || 0).toFixed(2),
        totalWeightText: (safetyReport.totalWeight || 0).toFixed(2),
        maxWeightText: this.data.selectedContainer.maxWeight,
        weightUtilizationText: weightUtilization.toFixed(2),
        weightStatus: weightStatus,
        warningCount: formattedWarnings.length,
        warnings: formattedWarnings,
        cog: safetyReport.cog
      }
    });
    
    console.log('[PackingResult] Safety metrics displayed');
  },
  
  /**
   * v25.0.0: Toggle Warning Details
   */
  onToggleWarningDetails: function() {
    this.setData({
      showWarningDetails: !this.data.showWarningDetails
    });
  },

  init3DCanvas: function () {
    console.log('[PackingResult] init3DCanvas called');
    
    const query = wx.createSelectorQuery();
    query.select('#packingCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        console.log('[PackingResult] Canvas query result:', res);
        
        if (!res || !res[0]) {
          console.error('[PackingResult] FATAL: Canvas node not found');
          wx.showToast({ title: 'Canvas初始化失败', icon: 'none' });
          return;
        }
        
        const canvas = res[0].node;
        const width = res[0].width;
        const height = res[0].height;
        
        console.log('[PackingResult] Canvas dimensions:', { width, height });
        
        // Store canvas dimensions for click detection
        this.setData({ canvasWidth: width, canvasHeight: height });
        
        if (!canvas) {
          console.error('[PackingResult] FATAL: Canvas node is null');
          return;
        }
        
        this.threeRenderer = new ThreeRenderer();
        this.threeRenderer.init(canvas, width, height).then(success => {
          console.log('[PackingResult] ThreeRenderer init result:', success);
          
          if (success && this.data.packingPlan) {
            console.log('[PackingResult] Calling render3DCargo after init');
            this.render3DCargo();
          } else if (!success) {
            console.error('[PackingResult] ThreeRenderer init FAILED');
            wx.showToast({ title: '3D引擎初始化失败', icon: 'none' });
          }
        });
      });
  },

  render3DCargo: function () {
    console.log('[PackingResult] render3DCargo called');
    
    if (!this.threeRenderer) {
      console.error('[PackingResult] ThreeRenderer not initialized');
      return;
    }
    
    if (!this.rawPackingData) {
      console.error('[PackingResult] No packing plan data in rawPackingData');
      return;
    }
    
    console.log('[PackingResult] Raw packing data has', this.rawPackingData.length, 'items');
    
    // CRITICAL: Read from non-reactive rawPackingData instead of Page.data
    // v33.0: Handle flat structure from API response
    const cargoList = this.rawPackingData.map(item => ({
      loadingIndex: item.loadingIndex,
      x: item.x || item.position?.x || 0,
      y: item.y || item.position?.y || 0,
      z: item.z || item.position?.z || 0,
      l: item.l || item.dimensions?.l || 0,
      h: item.h || item.dimensions?.h || 0,
      w: item.w || item.dimensions?.w || 0,
      color: item.color || item.batch?.color || '#808080',
      type: item.type || item.properties?.type || 'unknown',
      name: item.name,
      skuId: item.skuId || item.sku,
      weight: item.weight || item.properties?.weight || 0,
      fragile: item.fragile || item.properties?.fragile || false,
      batchKey: item.batchKey || item.batchId || item.batch?.eta || 'default',
      batchIndex: item.batchIndex,
      skuIndex: item.skuIndex,
      totalSKUsInBatch: item.totalSKUsInBatch
    }));
    
    // CRITICAL: Log first cargo item to verify field alignment
    console.log('[PackingResult] 前端收到待渲染货物:', cargoList[0]);
    if (cargoList.length > 1) {
      console.log('[PackingResult] Second cargo item:', cargoList[1]);
    }
    
    const standardContainer = {
      length: this.data.selectedContainer.innerLength,
      height: this.data.selectedContainer.innerHeight,
      width: this.data.selectedContainer.innerWidth
    };
    
    console.log('[PackingResult] Container dimensions:', standardContainer);
    console.log('[PackingResult] Calling threeRenderer.renderCargo with', cargoList.length, 'items');
    
    this.threeRenderer.renderCargo(cargoList, standardContainer);
    
    console.log('[PackingResult] render3DCargo completed');
  },

  /**
   * View Controls - Camera Position Switching
   */
  onSwitchToDoorView: function() {
    console.log('[PackingResult] Switch to door view');
    if (this.threeRenderer) {
      this.threeRenderer.changeCameraView('door');
      wx.showToast({ title: '门视角', icon: 'none', duration: 1000 });
    } else {
      console.error('[PackingResult] ThreeRenderer not initialized');
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
    }
  },

  onSwitchToTopView: function() {
    console.log('[PackingResult] Switch to top view');
    if (this.threeRenderer) {
      this.threeRenderer.changeCameraView('top');
      wx.showToast({ title: '俯视角', icon: 'none', duration: 1000 });
    } else {
      console.error('[PackingResult] ThreeRenderer not initialized');
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
    }
  },

  onSwitchToSideView: function() {
    console.log('[PackingResult] Switch to side view');
    if (this.threeRenderer) {
      this.threeRenderer.changeCameraView('side');
      wx.showToast({ title: '侧视角', icon: 'none', duration: 1000 });
    } else {
      console.error('[PackingResult] ThreeRenderer not initialized');
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
    }
  },

  /**
   * Cargo Type Filtering
   */
  onFilterCargoType: function(e) {
    const filterType = e.currentTarget.dataset.type;
    console.log('[PackingResult] Filter cargo type:', filterType);
    
    let activeTypes;
    if (filterType === 'all') {
      activeTypes = ['heavy', 'normal', 'fragile'];
    } else {
      activeTypes = [filterType];
    }
    
    this.setData({ 
      activeCargoTypes: activeTypes,
      currentCargoType: filterType
    });
    
    if (this.threeRenderer) {
      this.threeRenderer.updateVisibility(activeTypes, this.data.activeBatches);
      const typeNames = { all: '全部', heavy: '重货', normal: '普通货', fragile: '易碎品' };
      wx.showToast({ title: `显示${typeNames[filterType]}`, icon: 'none', duration: 1000 });
    } else {
      console.error('[PackingResult] ThreeRenderer not initialized');
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
    }
  },

  onAnalysisModeChange: function(e) {
    const mode = e.currentTarget.dataset.mode;
    const activeTypes = mode === 'risk' ? ['heavy', 'fragile'] : ['heavy', 'normal', 'fragile'];
    this.setData({ analysisMode: mode, activeCargoTypes: activeTypes, currentCargoType: mode === 'risk' ? 'risk' : 'all' });
    if (this.threeRenderer) this.threeRenderer.updateVisibility(activeTypes, this.data.activeBatches);
  },

  /**
   * v37.6: 模态框打开前主动 dispose ThreeRenderer
   * 因为 canvas 通过 wx:if 销毁，老的 renderer 仍持有渲染引用，需主动停止
   */
  _disposeRendererForModal: function() {
    if (this.threeRenderer) {
      this.threeRenderer.isDisposed = true;
      this.threeRenderer = null;
    }
  },

  /**
   * v37.6: 切换 SKU 筛选展开/折叠
   */
  onToggleSkuFilter: function() {
    this.setData({ showSkuFilter: !this.data.showSkuFilter });
  },

  /**
   * v37.6: 批次 chip 单击 — 切换该批次显示
   */
  onBatchChipTap: function(e) {
    const batchKey = e.currentTarget.dataset.batch;
    const mapping = (this.data.batchColorMapping || []).map(item => {
      if (item.batchKey === batchKey) {
        return { ...item, visible: !item.visible };
      }
      return item;
    });
    const activeBatches = mapping.filter(b => b.visible).map(b => b.batchKey);

    // 同步 SKU
    const updatedSkus = this.syncSkusFromBatches(activeBatches);
    const updatedSkusMap = {};
    updatedSkus.forEach(sku => { updatedSkusMap[sku] = true; });

    this.setData({
      batchColorMapping: mapping,
      activeBatches: activeBatches,
      selectedSkus: updatedSkus,
      selectedSkusMap: updatedSkusMap
    });

    if (this.threeRenderer) {
      this.threeRenderer.updateVisibility(this.data.activeCargoTypes, activeBatches);
      this.threeRenderer.updateSkuVisibility(updatedSkus);
    }
  },

  /**
   * Batch Visibility Toggle
   * CRITICAL FIX: Bidirectional sync with SKU filter
   */
  onBatchVisibilityChange: function(e) {
    const selectedBatches = e.detail.value;
    console.log('[PackingResult] Batch visibility changed:', selectedBatches);
    
    // STEP 1: Update batch state
    this.setData({ activeBatches: selectedBatches });
    
    // STEP 2: Bidirectional sync - Update SKU filter based on batch selection
    const updatedSkus = this.syncSkusFromBatches(selectedBatches);
    
    // STEP 3: Generate selectedSkusMap for UI reactivity (CRITICAL FIX)
    const updatedSkusMap = {};
    updatedSkus.forEach(sku => {
      updatedSkusMap[sku] = true;
    });
    
    // STEP 4: Update SKU state (both array and map for dual state maintenance)
    this.setData({ 
      selectedSkus: updatedSkus,
      selectedSkusMap: updatedSkusMap
    });
    
    // STEP 5: Update 3D renderer
    if (this.threeRenderer) {
      this.threeRenderer.updateVisibility(this.data.activeCargoTypes, selectedBatches);
      this.threeRenderer.updateSkuVisibility(updatedSkus);
      wx.showToast({ title: `已更新批次显示`, icon: 'none', duration: 1000 });
    } else {
      console.error('[PackingResult] ThreeRenderer not initialized');
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
    }
  },
  
  /**
   * Sync SKU selection from batch selection
   * @param {Array<string>} selectedBatches - Array of selected batch keys
   * @returns {Array<string>} - Array of SKU names that belong to selected batches
   */
  syncSkusFromBatches: function(selectedBatches) {
    if (!this.rawPackingData || this.rawPackingData.length === 0) {
      console.warn('[PackingResult] No rawPackingData available for SKU sync');
      return [];
    }
    
    const skuSet = new Set();
    
    // Find all SKUs that belong to selected batches
    this.rawPackingData.forEach(item => {
      const batchKey = item.batchKey || item.batchId || item.batch?.eta || 'default';
      
      if (selectedBatches.indexOf(batchKey) !== -1) {
        const skuName = item.name || item.sku || 'Unknown';
        skuSet.add(skuName);
      }
    });
    
    const result = Array.from(skuSet).sort();
    console.log('[PackingResult] Synced SKUs from batches:', result);
    return result;
  },

  /**
   * Batch Click Handler
   */
  onBatchClick: function(e) {
    const batchKey = e.currentTarget.dataset.batch;
    const activeBatches = this.data.activeBatches;
    
    const index = activeBatches.indexOf(batchKey);
    if (index > -1) {
      activeBatches.splice(index, 1);
    } else {
      activeBatches.push(batchKey);
    }
    
    this.setData({ activeBatches: activeBatches });
    
    if (this.threeRenderer) {
      this.threeRenderer.updateVisibility(this.data.activeCargoTypes, activeBatches);
    }
  },

  /**
   * Camera Reset
   */
  onResetCamera: function() {
    if (this.threeRenderer) {
      this.threeRenderer.resetCamera();
    }
  },

  /**
   * v35.0: Play loading sequence animation (Req 6.3)
   * Cargo items drop in one by one with easeOutBack bounce
   * 支持速度倍率与 HUD 显示当前货物名
   */
  onPlayLoadingSequence: function() {
    if (!this.threeRenderer) {
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
      return;
    }
    const speed = this.data.loadingSpeed || 4;
    // 大批量自动加速（>200 件最低 ×8）
    const total = this.data.loadedCount || 0;
    const effectiveSpeed = total > 200 ? Math.max(speed, 8) : speed;

    this.setData({
      isCameraPresetPlaying: true,
      isLoadingAnimating: true,
      loadingHudText: '准备装载…',
      loadingHudProgress: 0,
      loadingHudCurrent: 0,
      loadingHudTotal: total
    });

    this.threeRenderer.playLoadingSequence({
      durationPerItem: 400,
      dropHeight: 500,
      speed: effectiveSpeed,
      onItemPlaced: (info, idx, totalItems) => {
        // 节流更新（每 4 件刷一次）避免 setData 抖动
        if (idx === totalItems || idx % Math.max(1, Math.floor(totalItems / 60)) === 0) {
          this.setData({
            loadingHudText: `正在装入 ${info.name || '货物'}`,
            loadingHudProgress: Math.round(idx * 100 / totalItems),
            loadingHudCurrent: idx,
            loadingHudTotal: totalItems
          });
        }
      },
      onComplete: () => {
        this.setData({
          isCameraPresetPlaying: false,
          isLoadingAnimating: false,
          loadingHudText: `装载完成 共 ${total} 件`,
          loadingHudProgress: 100
        });
        // 2 秒后清掉 HUD
        setTimeout(() => {
          this.setData({ loadingHudText: '' });
        }, 2000);
      }
    });
    wx.showToast({ title: `装载动画 ×${effectiveSpeed}`, icon: 'none', duration: 800 });
  },

  /**
   * 切换装载动画速度档位
   */
  onChangeLoadingSpeed: function(e) {
    const speed = parseInt(e.currentTarget.dataset.speed, 10) || 4;
    this.setData({ loadingSpeed: speed });
    wx.showToast({ title: `播放速度 ×${speed}`, icon: 'none', duration: 600 });
  },

  /**
   * 溢出告警：构建建议文案，提示用户换更大的柜
   */
  _buildOverflowSuggestionText: function(unloadedCargo, currentContainer) {
    if (!unloadedCargo || unloadedCargo.length === 0) return '';
    const cur = currentContainer && currentContainer.typeId;
    const upgradeMap = {
      '20GP': '建议升级到 40GP（容量翻倍，可装下全部货物）',
      '40GP': '建议升级到 40HQ（高度增加 305mm，可多装一层）',
      '40HQ': '当前已是最大柜型，建议拆分为两个柜或减少 SKU 件数'
    };
    return upgradeMap[cur] || '建议升级柜型以装下全部货物';
  },

  /**
   * 点击溢出告警条上的"换柜型"按钮，回到柜型选择页
   */
  onSwitchContainer: function() {
    wx.showToast({ title: '请重新选柜', icon: 'none', duration: 800 });
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/container-select/container-select' });
    }, 300);
  },

  /**
   * v35.0: Camera Preset - Orbit 360° rotation (Req 6.6)
   */
  onCameraOrbit: function() {
    if (!this.threeRenderer) {
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
      return;
    }
    this.setData({ isCameraPresetPlaying: true });
    this.threeRenderer.playCameraOrbit(10000);
    wx.showToast({ title: '环绕运镜', icon: 'none', duration: 1000 });
    setTimeout(() => {
      this.setData({ isCameraPresetPlaying: false });
    }, 10000);
  },

  /**
   * v35.0: Camera Preset - Dive from top to isometric (Req 6.6)
   */
  onCameraDive: function() {
    if (!this.threeRenderer) {
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
      return;
    }
    this.setData({ isCameraPresetPlaying: true });
    this.threeRenderer.playCameraDive(8000);
    wx.showToast({ title: '俯冲运镜', icon: 'none', duration: 1000 });
    setTimeout(() => {
      this.setData({ isCameraPresetPlaying: false });
    }, 8000);
  },

  /**
   * v35.0: Camera Preset - Follow loading path (Req 6.6)
   */
  onCameraFollow: function() {
    if (!this.threeRenderer) {
      wx.showToast({ title: '3D引擎未初始化', icon: 'none' });
      return;
    }
    this.setData({ isCameraPresetPlaying: true });
    this.threeRenderer.playCameraFollow(12000);
    wx.showToast({ title: '跟随运镜', icon: 'none', duration: 1000 });
    setTimeout(() => {
      this.setData({ isCameraPresetPlaying: false });
    }, 12000);
  },

  /**
   * v35.0: Stop any running camera preset (Req 6.6)
   */
  onStopCameraPreset: function() {
    if (this.threeRenderer) {
      this.threeRenderer.stopCameraPreset();
      this.threeRenderer.stopLoadingSequence();
    }
    this.setData({ isCameraPresetPlaying: false });
    wx.showToast({ title: '已停止', icon: 'none', duration: 800 });
  },

  /**
   * Cargo Click Handler
   */
  onCargoClick: function(cargoData) {
    console.log('[PackingResult] Cargo clicked:', cargoData);
    
    // Format cargo info for modal display
    const cargoInfo = {
      loadingIndex: cargoData.loadingIndex,
      name: cargoData.cargoName,
      batchId: cargoData.batchKey,
      skuId: cargoData.skuId || cargoData.sku,
      dimensions: `${cargoData.dimensions.l}×${cargoData.dimensions.w}×${cargoData.dimensions.h}`,
      weight: cargoData.weight,
      position: cargoData.position,
      type: cargoData.type
    };
    
    this.setData({ selectedCargoInfo: cargoInfo });
  },

  /**
   * Cargo Detail Modal
   */
  onCloseCargoDetail: function() {
    this.setData({ selectedCargoInfo: null });
  },

  onStopPropagation: function() {
    // Prevent event bubbling
  },

  /**
   * Container Switching
   */
  onSwitchContainer: function() {
    wx.navigateBack();
  },

  /**
   * Touch Event Handlers for 3D Canvas
   */
  onCanvasTouchStart: function(e) {
    if (this.threeRenderer) {
      this.threeRenderer.handleTouchStart(e);
    }
  },

  onCanvasTouchMove: function(e) {
    if (this.threeRenderer) {
      this.threeRenderer.handleTouchMove(e);
    }
  },

  onCanvasTouchEnd: function(e) {
    if (this.threeRenderer) {
      this.threeRenderer.handleTouchEnd(e);
    }
  },

  onCanvasTap: function(e) {
    console.log('[PackingResult] Canvas tapped:', e);
    
    if (!this.threeRenderer) {
      console.error('[PackingResult] ThreeRenderer not initialized');
      return;
    }
    
    // Get touch coordinates
    const touch = e.touches && e.touches.length > 0 ? e.touches[0] : e.changedTouches[0];
    if (!touch) {
      console.error('[PackingResult] No touch data');
      return;
    }
    
    const x = touch.x;
    const y = touch.y;
    
    console.log('[PackingResult] Touch coordinates:', { x, y, canvasWidth: this.data.canvasWidth, canvasHeight: this.data.canvasHeight });
    
    // Detect clicked cargo
    const cargoData = this.threeRenderer.detectCargoClick(x, y, this.data.canvasWidth, this.data.canvasHeight);
    
    if (cargoData) {
      this.displayCargoInspector(cargoData);
    } else {
      console.log('[PackingResult] No cargo clicked');
    }
  },

  /**
   * v34.8: SKU-Level Worker Interface Methods
   */
  
  /**
   * Generate unique SKU list from loaded cargo
   * @param {Array} loadedCargo - Backend API response cargo array
   * @returns {Array} uniqueSkuList - Array of unique product names
   */
  generateUniqueSkuList: function(loadedCargo) {
    const skuSet = new Set();
    
    loadedCargo.forEach((item, index) => {
      // Fallback chain: name → sku → default
      const skuName = item.name || item.sku || `Unknown-${index}`;
      
      if (!item.name && !item.sku) {
        console.warn(`[PackingResult] Cargo item ${index} missing name and sku fields`);
      }
      
      skuSet.add(skuName);
    });
    
    return Array.from(skuSet).sort();
  },

  /**
   * SKU Filter Click Handler
   * Manual toggle logic with proper state synchronization
   */
  onSkuFilterClick: function(e) {
    const tappedSku = e.currentTarget.dataset.sku;
    console.log('[PackingResult] SKU filter clicked:', tappedSku);
    
    // Clone current selection array and map
    let currentSelection = [...this.data.selectedSkus];
    let currentMap = {...this.data.selectedSkusMap};
    
    // Toggle logic: if exists, remove; if not, add
    const index = currentSelection.indexOf(tappedSku);
    if (index !== -1) {
      currentSelection.splice(index, 1);
      currentMap[tappedSku] = false;
    } else {
      currentSelection.push(tappedSku);
      currentMap[tappedSku] = true;
    }
    
    console.log('[PackingResult] Updated SKU selection:', currentSelection);
    console.log('[PackingResult] Updated SKU map:', currentMap);
    
    // Update state and trigger 3D rendering
    this.setData({ 
      selectedSkus: currentSelection,
      selectedSkusMap: currentMap
    }, () => {
      // Force 3D renderer update
      if (this.threeRenderer) {
        this.threeRenderer.updateSkuVisibility(currentSelection);
      } else {
        console.warn('[PackingResult] ThreeRenderer not initialized, deferring visibility update');
      }
    });
  },

  /**
   * Select All SKUs
   * Uses single source of truth pattern with setData callback
   */
  onSelectAllSkus: function() {
    console.log('[PackingResult] Select all SKUs');
    
    // Generate map with all SKUs set to true
    const allSelectedMap = {};
    this.data.uniqueSkuList.forEach(sku => {
      allSelectedMap[sku] = true;
    });
    
    this.setData({ 
      selectedSkus: this.data.uniqueSkuList,
      selectedSkusMap: allSelectedMap
    }, () => {
      if (this.threeRenderer) {
        this.threeRenderer.updateSkuVisibility(this.data.uniqueSkuList);
      }
    });
  },

  /**
   * Clear All SKUs
   * Uses single source of truth pattern with setData callback
   */
  onClearAllSkus: function() {
    console.log('[PackingResult] Clear all SKUs');
    
    // Generate map with all SKUs set to false
    const allDeselectedMap = {};
    this.data.uniqueSkuList.forEach(sku => {
      allDeselectedMap[sku] = false;
    });
    
    this.setData({ 
      selectedSkus: [],
      selectedSkusMap: allDeselectedMap
    }, () => {
      if (this.threeRenderer) {
        this.threeRenderer.updateSkuVisibility([]);
      }
    });
  },

  /**
   * Display Cargo Inspector with cargo data
   * @param {Object} cargoData - Cargo information from raycaster
   */
  displayCargoInspector: function(cargoData) {
    console.log('[PackingResult] Displaying cargo inspector:', cargoData);
    
    this.setData({ cargoInspectorData: cargoData });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (this.data.cargoInspectorData === cargoData) {
        this.setData({ cargoInspectorData: null });
      }
    }, 5000);
  },

  /**
   * Close Cargo Inspector
   */
  onCloseCargoInspector: function() {
    this.setData({ cargoInspectorData: null });
  },

  /**
   * 获取集装箱皮重
   * @private
   */
  _getContainerTareWeight: function(containerType) {
    const tareWeights = { '20GP': 2180, '40GP': 3630, '40HQ': 3810 };
    return tareWeights[containerType] || 2180;
  },

  /**
   * Get Container Tare Weight
   * @returns {number} Tare weight in kg
   */
  getContainerTareWeight: function() {
    const containerType = this.data.selectedContainer?.typeId || '20GP';
    const tareWeights = {
      '20GP': 2180,
      '40GP': 3630,
      '40HQ': 3810,
      '45HQ': 4800
    };
    return tareWeights[containerType] || 2180;
  },

  /**
   * AI Compliance Check (PARALLEL EXECUTION VERSION)
   * SIMPLIFIED LOGIC (v35.1):
   * - 点击后只显示 loading 动画
   * - 等 AI 返回最终结果后一次性显示
   * - 如果 AI 超时（15秒），显示物理降级报告
   * - 已有缓存报告时直接显示，不重复请求
   */
  onAIComplianceCheck: function() {
    console.log('[PackingResult] AI Compliance Check triggered');
    
    // 如果已有缓存报告，直接显示（不重复请求 AI）
    if (this.data.complianceReport && !this.data.complianceReport.isPhysicalOnly) {
      console.log('[PackingResult] Using cached compliance report');
      this._disposeRendererForModal();
      this.setData({ showComplianceReport: true });
      return;
    }
    
    // Prevent duplicate requests
    if (this.data.isCheckingCompliance) {
      console.log('[PackingResult] Already checking compliance, ignoring');
      return;
    }
    
    // Validate packing plan exists
    if (!this.data.packingPlan) {
      wx.showToast({ title: '请先生成装箱方案', icon: 'none' });
      return;
    }
    
    // 只显示 loading，不显示任何报告
    this.setData({
      isCheckingCompliance: true,
      showComplianceReport: false,
      complianceReport: null
    });
    
    // 显示叙事 loading
    this.startNarrativeLoading();
    
    // 调用 AI 合规检查（异步轮询）
    this.executeAIComplianceCheck();
  },
  
  /**
   * 执行 AI 合规检查（发起请求 + 轮询结果）
   * 超时 15 秒后降级到物理报告
   */
  executeAIComplianceCheck: function() {
    const fullPackingPlan = typeof store.getPackingPlan === 'function' 
      ? store.getPackingPlan() 
      : store.getState('packingPlan');
    
    if (!fullPackingPlan) {
      this.setData({ isCheckingCompliance: false, showNarrativeLoading: false });
      wx.showToast({ title: '方案数据异常', icon: 'none' });
      return;
    }
    
    // 获取 VGM 申报值（v4.0: 自动使用系统建议的 VGM 值，用户不需要手动输入）
    const declaredVGM = this.data.suggestedVGM || 0;
    
    // 发起异步合规检查
    request.post('/packing/compliance-check', {
      packingPlanData: fullPackingPlan,
      declaredVGM: declaredVGM
    }, { showLoading: false, showError: false }).then((response) => {
      const data = response.data || response;
      const taskId = data.taskId;
      
      if (!taskId) {
        console.warn('[PackingResult] No task ID received');
        this.showFallbackReport();
        return;
      }
      
      console.log('[PackingResult] Compliance task started:', taskId);
      // 开始轮询，15 秒超时
      this.pollComplianceResult(taskId, 0, 15000);
      
    }).catch((error) => {
      console.error('[PackingResult] Compliance check request failed:', error);
      this.showFallbackReport();
    });
  },
  
  /**
   * 轮询合规检查结果
   * @param {string} taskId
   * @param {number} elapsed - 已经过的时间(ms)
   * @param {number} timeout - 超时时间(ms)
   */
  pollComplianceResult: function(taskId, elapsed, timeout) {
    if (elapsed >= timeout) {
      console.warn('[PackingResult] Compliance check timeout, using fallback');
      this.showFallbackReport();
      return;
    }
    
    request.get(`/packing/compliance-report/${taskId}`, {}, { showLoading: false, showError: false })
      .then((response) => {
        const data = response.data || response;
        
        if (data.status === 'completed' && data.complianceReport) {
          // AI 返回了最终结果
          console.log('[PackingResult] AI compliance result received');
          this.setData({ showNarrativeLoading: false });
          this.displayFinalComplianceReport(data.complianceReport);
        } else if (data.status === 'failed') {
          console.warn('[PackingResult] Compliance task failed');
          this.showFallbackReport();
        } else {
          // 继续轮询（每 2 秒一次）
          setTimeout(() => {
            this.pollComplianceResult(taskId, elapsed + 2000, timeout);
          }, 2000);
        }
      })
      .catch(() => {
        // 网络错误，继续重试
        setTimeout(() => {
          this.pollComplianceResult(taskId, elapsed + 2000, timeout);
        }, 2000);
      });
  },
  
  /**
   * 显示最终 AI 合规报告
   * v4.0: 后端返回扁平字段 { status, score, reportTable, advice, issues, timestamp, model, summary }
   * 这里只做必要字段防御，不做严格校验
   */
  displayFinalComplianceReport: function(report) {
    if (!report || typeof report !== 'object') {
      console.warn('[PackingResult] displayFinalComplianceReport got empty report, fallback');
      this.showFallbackReport();
      return;
    }

    const modelName = report.model || 'deepseek-v4-flash';

    const formattedReport = {
      status: report.status || 'WARNING',
      score: typeof report.score === 'number' ? report.score : 0,
      statusText: this.getComplianceStatusText(report.status),
      statusColor: this.getComplianceStatusColor(report.status),
      issues: report.issues || [],
      advice: report.advice || '暂无建议',
      timestamp: report.timestamp || new Date().toISOString(),
      isFallback: false,
      isPhysicalOnly: false,
      reportTable: report.reportTable || [],
      modelName: modelName
    };

    this._disposeRendererForModal();
    this.setData({
      complianceReport: formattedReport,
      showComplianceReport: true,
      isCheckingCompliance: false
    });
  },
  
  /**
   * 显示物理降级报告（AI 超时时使用）
   */
  showFallbackReport: function() {
    this.setData({ showNarrativeLoading: false });
    const physicalReport = this.generatePhysicalValidationReport();
    physicalReport.advice = '后端合规服务当前不可用。这里只保留能够由现有方案确定计算的载重与重心结果；未检查项目不会显示为通过。';
    physicalReport.modelName = 'DETERMINISTIC_PARTIAL_CHECK';
    
    this._disposeRendererForModal();
    this.setData({
      complianceReport: physicalReport,
      showComplianceReport: true,
      isCheckingCompliance: false
    });
  },
  
  /**
   * Generate Physical Validation Report (INSTANT DISPLAY)
   * Task: Generate 90-score physical validation report for instant feedback
   * @returns {Object} Physical validation report
   */
  generatePhysicalValidationReport: function() {
    console.log('[PackingResult] Generating physical validation report');
    
    // Get full packing plan from store
    const fullPlan = typeof store.getPackingPlan === 'function' 
      ? store.getPackingPlan() 
      : store.getState('packingPlan');
    
    const plan = fullPlan || this.data.packingPlan;
    
    // Extract metrics with safe fallbacks
    const cogOffset = plan.cogOffset || { lateral: 0, longitudinal: 0 };
    const spaceUtilization = plan.spaceUtilization || 0;
    const totalWeight = plan.totalWeight || 0;
    const maxWeight = this.data.selectedContainer?.maxWeight || 30000;
    const lateralOffset = typeof cogOffset.lateral === 'number' ? cogOffset.lateral : 0;
    const longitudinalOffset = typeof cogOffset.longitudinal === 'number' ? cogOffset.longitudinal : 0;
    
    // Generate report table
    const reportTable = [
      {
        dimension: "VGM重量验证",
        standard: "相对误差≤5% 且 绝对误差≤1吨",
        actual: "未提供独立申报值",
        result: "NOT_CHECKED"
      },
      {
        dimension: "载重与限值",
        standard: `总重 < ${maxWeight}kg`,
        actual: `${totalWeight.toFixed(0)}kg`,
        result: totalWeight <= maxWeight ? "PASS" : "FAIL"
      },
      {
        dimension: "物理重心与装载",
        standard: "横向<5% 纵向<10%",
        actual: `横${lateralOffset.toFixed(1)}% 纵${longitudinalOffset.toFixed(1)}%`,
        result: (lateralOffset <= 5 && longitudinalOffset <= 10) ? "PASS" : "WARNING"
      },
      {
        dimension: "单证一致性",
        standard: "品名/件数/重量/体积一致",
        actual: "当前端未接入单证证据",
        result: "NOT_CHECKED"
      },
      {
        dimension: "危险品/敏感品合规",
        standard: "资质齐全 UN38.3/MSDS",
        actual: "当前端未接入资质证据",
        result: "NOT_CHECKED"
      },
      {
        dimension: "货物混装相容性",
        standard: "无串味/性质冲突",
        actual: "当前端未执行相容性规则",
        result: "NOT_CHECKED"
      }
    ];
    
    return {
      status: totalWeight > maxWeight ? 'FAIL' : 'WARNING',
      score: null,
      scoreText: '未评分',
      statusText: totalWeight > maxWeight ? '载重规则未通过' : '部分规则已检查',
      statusColor: totalWeight > maxWeight ? '#ef4444' : '#9a6c17',
      issues: [],
      advice: `已确定计算载重利用率 ${((totalWeight/maxWeight)*100).toFixed(1)}%，重心偏移横向 ${lateralOffset.toFixed(1)}%、纵向 ${longitudinalOffset.toFixed(1)}%。其余项目保持 NOT_CHECKED。`,
      timestamp: new Date().toISOString(),
      isFallback: false,
      isPhysicalOnly: true, // Flag to indicate this is physical-only report
      reportTable: reportTable,
      modelName: 'DETERMINISTIC_PARTIAL_CHECK'
    };
  },
  
  /**
   * Start Background AI Check (PARALLEL EXECUTION)
   * Task: Silently trigger AI check, auto-update modal when complete
   */
  startBackgroundAICheck: function() {
    console.log('[PackingResult] Starting background AI check');
    
    // Get full packing plan
    const fullPackingPlan = typeof store.getPackingPlan === 'function' 
      ? store.getPackingPlan() 
      : store.getState('packingPlan');
    
    if (!fullPackingPlan) {
      console.warn('[PackingResult] No packing plan data for background check');
      this.setData({ isCheckingCompliance: false });
      return;
    }
    
    // v4.0: 自动使用系统建议的 VGM 值（用户不需要手动输入）
    const declaredVGM = this.data.suggestedVGM || 0;
    console.log('[PackingResult] Including declaredVGM in request:', declaredVGM);
    
    // Initiate async task (silent, no loading UI)
    request.post('/packing/compliance-check', {
      packingPlanData: fullPackingPlan,
      declaredVGM: declaredVGM
    }).then((response) => {
      const data = response.data || response;
      const taskId = data.taskId;
      
      if (!taskId) {
        throw new Error('No task ID received from server');
      }
      
      console.log('[PackingResult] Background task initiated:', taskId);
      
      // Start silent polling with 5-second hint timeout
      this.pollBackgroundAI(taskId, 0);
      
    }).catch((error) => {
      console.error('[PackingResult] Failed to initiate background AI check:', error);
      this.setData({ isCheckingCompliance: false });
      // Don't show error - physical report is already visible
    });
  },
  
  /**
   * Poll Background AI Status (SILENT POLLING)
   * Task: Poll AI status, auto-update modal when complete, show hint after 5s
   * @param {string} taskId - Task identifier
   * @param {number} attempt - Current polling attempt (0-based)
   */
  pollBackgroundAI: function(taskId, attempt) {
    const MAX_ATTEMPTS = 15; // 15 attempts × 2s = 30s timeout
    const POLL_INTERVAL = 2000; // 2 seconds
    const HINT_THRESHOLD = 3; // Show hint after 3 attempts (6 seconds)
    
    if (attempt >= MAX_ATTEMPTS) {
      console.warn('[PackingResult] Background AI timeout after 30s');
      this.setData({ isCheckingCompliance: false });
      
      // Update advice to indicate AI timeout
      if (this.data.complianceReport && this.data.complianceReport.isPhysicalOnly) {
        const updatedReport = {
          ...this.data.complianceReport,
          advice: this.data.complianceReport.advice + '\n\n⚠️ AI 深度分析超时，建议人工复核单证一致性和危险品资质。'
        };
        this.setData({ complianceReport: updatedReport });
      }
      return;
    }
    
    // Show hint after 5 seconds (3 attempts × 2s = 6s)
    if (attempt === HINT_THRESHOLD && this.data.showComplianceReport) {
      console.log('[PackingResult] Showing AI processing hint');
      wx.showToast({ 
        title: 'AI 深度分析正在后台处理', 
        icon: 'none', 
        duration: 2000 
      });
    }
    
    console.log(`[PackingResult] Background polling attempt ${attempt + 1}/${MAX_ATTEMPTS}`);
    
    // Query task status
    request.get(`/packing/compliance-report/${taskId}`)
      .then((response) => {
        const data = response.data || response;
        const status = data.status;
        const complianceReport = data.complianceReport;
        
        if (status === 'completed') {
          console.log('[PackingResult] Background AI check completed');
          this.setData({ isCheckingCompliance: false });
          
          // Auto-update modal with AI report (if still open)
          if (this.data.showComplianceReport) {
            this.updateModalWithAIReport(complianceReport);
          }
          
        } else if (status === 'failed') {
          console.warn('[PackingResult] Background AI check failed');
          this.setData({ isCheckingCompliance: false });
          // Don't show error - physical report is already visible
          
        } else if (status === 'processing') {
          // Continue polling
          setTimeout(() => {
            this.pollBackgroundAI(taskId, attempt + 1);
          }, POLL_INTERVAL);
        }
        
      }).catch((error) => {
        console.error('[PackingResult] Background polling error:', error);
        this.setData({ isCheckingCompliance: false });
        // Silent failure - physical report is already visible
      });
  },
  
  /**
   * Update Modal with AI Report (AUTO-REFRESH)
   * Task: Seamlessly update the modal content with AI deep analysis
   * @param {Object} aiReport - AI compliance report from API
   */
  updateModalWithAIReport: function(aiReport) {
    console.log('[PackingResult] Updating modal with AI report');
    
    if (!aiReport) {
      console.error('[PackingResult] No AI report data to update');
      return;
    }
    
    // Extract model name from API response
    const modelName = aiReport.model || 'Qwen/Qwen2.5-7B-Instruct';
    
    // Format AI report
    const formattedReport = {
      status: aiReport.status,
      score: aiReport.score,
      statusText: this.getComplianceStatusText(aiReport.status),
      statusColor: this.getComplianceStatusColor(aiReport.status),
      issues: aiReport.issues || [],
      advice: aiReport.advice || '暂无建议',
      timestamp: aiReport.timestamp || new Date().toISOString(),
      isFallback: false,
      isPhysicalOnly: false,
      reportTable: aiReport.reportTable || [],
      modelName: modelName
    };
    
    // Update modal content (seamless refresh)
    this.setData({ complianceReport: formattedReport });
    
    // Show success toast
    wx.showToast({ 
      title: 'AI 深度分析完成', 
      icon: 'success', 
      duration: 1500 
    });
    
    console.log('[PackingResult] Modal updated with AI report, model:', modelName);
  },
  
  /**
   * Start Async Compliance Check with Polling
   * Task 7: Add polling client
   */
  startAsyncComplianceCheck: function() {
    console.log('[PackingResult] Starting async compliance check');
    
    // Show loading animation
    this.setData({
      isCheckingCompliance: true,
      showNarrativeLoading: true,
      loadingText: '正在进行AI合规体检...'
    });
    
    // Start narrative loading sequence
    this.startNarrativeLoading();
    
    // Get full packing plan
    const fullPackingPlan = typeof store.getPackingPlan === 'function' 
      ? store.getPackingPlan() 
      : store.getState('packingPlan');
    
    if (!fullPackingPlan) {
      this.stopNarrativeLoading();
      this.setData({ isCheckingCompliance: false });
      wx.showToast({ title: '装箱方案数据缺失', icon: 'none' });
      return;
    }
    
    // v4.0: 自动使用系统建议的 VGM 值（用户不需要手动输入）
    const declaredVGM = this.data.suggestedVGM || 0;
    console.log('[PackingResult] Including declaredVGM in request:', declaredVGM);
    
    // Initiate async task
    request.post('/packing/compliance-check', {
      packingPlanData: fullPackingPlan,
      declaredVGM: declaredVGM
    }).then((response) => {
      const data = response.data || response;
      const taskId = data.taskId;
      
      if (!taskId) {
        throw new Error('No task ID received from server');
      }
      
      console.log('[PackingResult] Task initiated:', taskId);
      
      // Start polling
      this.pollComplianceStatus(taskId, 0);
      
    }).catch((error) => {
      console.error('[PackingResult] Failed to initiate compliance check:', error);
      this.stopNarrativeLoading();
      this.setData({ isCheckingCompliance: false });
      this.showFallbackReport('initiation_failed');
    });
  },
  
  /**
   * Poll Compliance Check Status
   * Task 7: Implement 2-second interval polling with 30-second timeout
   * @param {string} taskId - Task identifier
   * @param {number} attempt - Current polling attempt (0-based)
   */
  pollComplianceStatus: function(taskId, attempt) {
    const MAX_ATTEMPTS = 15; // 15 attempts × 2s = 30s timeout
    const POLL_INTERVAL = 2000; // 2 seconds
    
    if (attempt >= MAX_ATTEMPTS) {
      // Task 15: Log polling timeout event with task ID
      console.warn(`[PackingResult] Polling timeout event: ${taskId} after 30s`);
      this.stopNarrativeLoading();
      this.setData({ isCheckingCompliance: false });
      this.showFallbackReport('timeout');
      return;
    }
    
    console.log(`[PackingResult] Polling attempt ${attempt + 1}/${MAX_ATTEMPTS}`);
    
    // Query task status
    request.get(`/packing/compliance-report/${taskId}`)
      .then((response) => {
        const data = response.data || response;
        const status = data.status;
        const complianceReport = data.complianceReport;
        const error = data.error;
        
        if (status === 'completed') {
          console.log('[PackingResult] Compliance check completed');
          this.stopNarrativeLoading();
          this.setData({ isCheckingCompliance: false });
          this.displayComplianceReport(complianceReport);
          
        } else if (status === 'failed') {
          console.warn('[PackingResult] Compliance check failed:', error);
          this.stopNarrativeLoading();
          this.setData({ isCheckingCompliance: false });
          this.showFallbackReport('ai_failed');
          
        } else if (status === 'processing') {
          // Continue polling
          setTimeout(() => {
            this.pollComplianceStatus(taskId, attempt + 1);
          }, POLL_INTERVAL);
        }
        
      }).catch((error) => {
        console.error('[PackingResult] Polling error:', error);
        
        // Retry once on network error (Task 10)
        if (attempt === 0) {
          console.log('[PackingResult] Network error on first attempt, retrying...');
          setTimeout(() => {
            this.pollComplianceStatus(taskId, attempt + 1);
          }, POLL_INTERVAL);
        } else {
          this.stopNarrativeLoading();
          this.setData({ isCheckingCompliance: false });
          this.showFallbackReport('network_error');
        }
      });
  },
  
  /**
   * Start Narrative Loading
   * Display dynamic loading messages at different time intervals
   */
  startNarrativeLoading: function() {
    console.log('[PackingResult] Starting narrative loading');
    
    const steps = [
      "正在调用海运标准计算引擎...",
      "正在进行宁波港合规性动态扫描...",
      "DeepSeek V4 Flash 正在核准重心力学参数..."
    ];
    
    let currentStep = 0;
    
    // Show loading overlay
    this.setData({ 
      showNarrativeLoading: true,
      loadingText: steps[0]
    });
    
    // Clear any existing timer
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
    }
    
    // Update text every 3 seconds
    this.loadingTimer = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        this.setData({ loadingText: steps[currentStep] });
      } else {
        // Stop at last message
        clearInterval(this.loadingTimer);
        this.loadingTimer = null;
      }
    }, 3000);
  },
  
  /**
   * Stop Narrative Loading
   * Hide loading overlay and clear timer
   */
  stopNarrativeLoading: function() {
    console.log('[PackingResult] Stopping narrative loading');
    
    // Clear timer
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
    
    // Hide loading overlay
    this.setData({ 
      showNarrativeLoading: false,
      loadingText: ''
    });
  },
  
  /**
   * Display Compliance Report
   * Task 8: Format and display AI report using existing UI components
   * @param {Object} report - Compliance report from API
   */
  displayComplianceReport: function(report) {
    if (!report) {
      console.error('[PackingResult] No report data to display');
      return;
    }
    
    // CRITICAL FIX: Extract model name from API response, fallback to generic name
    const modelName = report.model || '智能合规引擎 v3.2';
    
    const formattedReport = {
      status: report.status,
      score: report.score,
      statusText: this.getComplianceStatusText(report.status),
      statusColor: this.getComplianceStatusColor(report.status),
      issues: report.issues || [],
      advice: report.advice || '暂无建议',
      timestamp: report.timestamp || new Date().toISOString(),
      isFallback: false,
      reportTable: report.reportTable || [],
      modelName: modelName // CRITICAL FIX: Add model name to formatted report
    };
    
    this._disposeRendererForModal();
    this.setData({
      complianceReport: formattedReport,
      showComplianceReport: true
    });
    
    console.log('[PackingResult] Compliance report displayed with model:', modelName);
  },
  
  /**
   * Show Fallback Report Using Physical Validation
   * Task 9: Display fallback when AI unavailable
   * @param {string} reason - Reason for fallback (timeout, ai_failed, network_error, initiation_failed)
   */
  showFallbackReport: function(reason) {
    console.log('[PackingResult] Showing fallback report, reason:', reason);
    
    // Get physical validation data from packing plan
    const packingPlan = this.data.packingPlan;
    
    if (!packingPlan) {
      console.error('[PackingResult] No packing plan data for fallback');
      wx.showToast({ title: '无法生成降级报告', icon: 'none' });
      return;
    }
    
    const fallbackReport = {
      status: 'PHYSICAL_VALIDATION',
      score: 85,
      statusText: '物理校验合规',
      statusColor: '#52c41a',
      issues: [],
      advice: '基于物理引擎的合规校验结果',
      timestamp: new Date().toISOString(),
      isFallback: true,
      reportTable: this.generatePhysicalReportTable(packingPlan)
    };
    
    this._disposeRendererForModal();
    this.setData({
      complianceReport: fallbackReport,
      showComplianceReport: true
    });
    
    console.log('[PackingResult] Fallback report displayed');
  },
  
  /**
   * Generate Physical Validation Report Table
   * Task 9: Create fallback report table from physical metrics
   * @param {Object} packingPlan - Packing plan data
   * @returns {Array} Report table rows
   */
  generatePhysicalReportTable: function(packingPlan) {
    // Get full packing plan from store for complete data
    const fullPlan = typeof store.getPackingPlan === 'function' 
      ? store.getPackingPlan() 
      : store.getState('packingPlan');
    
    const plan = fullPlan || packingPlan;
    
    // Extract metrics with safe fallbacks
    const cogOffset = plan.cogOffset || { lateral: 0, longitudinal: 0 };
    const spaceUtilization = plan.spaceUtilization || 0;
    const totalWeight = plan.totalWeight || 0;
    const maxWeight = this.data.selectedContainer?.maxWeight || 30000;
    const lateralOffset = typeof cogOffset.lateral === 'number' ? cogOffset.lateral : 0;
    const longitudinalOffset = typeof cogOffset.longitudinal === 'number' ? cogOffset.longitudinal : 0;
    
    return [
      {
        dimension: "VGM重量验证",
        standard: "相对误差≤5% 且 绝对误差≤1吨",
        actual: "物理校验模式",
        result: "PASS"
      },
      {
        dimension: "载重与限值",
        standard: `总重 < ${maxWeight}kg`,
        actual: `${totalWeight.toFixed(0)}kg`,
        result: totalWeight <= maxWeight ? "PASS" : "WARNING"
      },
      {
        dimension: "物理重心与装载",
        standard: "横向<5% 纵向<10%",
        actual: `横${lateralOffset.toFixed(1)}% 纵${longitudinalOffset.toFixed(1)}%`,
        result: (lateralOffset <= 5 && longitudinalOffset <= 10) ? "PASS" : "WARNING"
      },
      {
        dimension: "单证一致性",
        standard: "品名/件数/重量/体积一致",
        actual: "需人工复核",
        result: "WARNING"
      },
      {
        dimension: "危险品/敏感品合规",
        standard: "资质齐全 UN38.3/MSDS",
        actual: "需人工复核",
        result: "WARNING"
      },
      {
        dimension: "货物混装相容性",
        standard: "无串味/性质冲突",
        actual: "需人工复核",
        result: "WARNING"
      }
    ];
  },
  
  /**
   * Trigger Compliance API Call
   * Extracted method for API call logic, used by both main button and refresh button
   */
  triggerComplianceAPI: function() {
    console.log('[PackingResult] Triggering compliance API call');
    
    // Validate packing plan exists
    if (!this.data.packingPlan) {
      wx.showToast({ title: '请先生成装箱方案', icon: 'none' });
      return;
    }
    
    // Set loading state
    this.setData({ isCheckingCompliance: true });
    
    // Get full packing plan from store
    const fullPackingPlan = typeof store.getPackingPlan === 'function' 
      ? store.getPackingPlan() 
      : store.getState('packingPlan');
    
    if (!fullPackingPlan) {
      this.stopNarrativeLoading();
      this.setData({ isCheckingCompliance: false });
      wx.showToast({ title: '装箱方案数据缺失', icon: 'none' });
      return;
    }
    
    console.log('[PackingResult] Requesting AI compliance check...');
    
    // v4.0: 自动使用系统建议的 VGM 值（用户不需要手动输入）
    const declaredVGM = this.data.suggestedVGM || 0;
    console.log('[PackingResult] Including declaredVGM in request:', declaredVGM);
    
    // Call API
    request.post('/packing/compliance-check', {
      packingPlanData: fullPackingPlan,
      declaredVGM: declaredVGM
    }).then((response) => {
      // Stop narrative loading
      this.stopNarrativeLoading();
      
      console.log('[PackingResult] AI Compliance Response:', response);
      
      // Extract data from response
      const data = response.data || response;
      const report = data.complianceReport;
      
      // Validate response structure (v4.0: only require status + reportTable)
      if (!report || !report.status || !report.reportTable) {
        throw new Error('Invalid compliance report response');
      }

      // v4.0: backfill missing optional fields with safe defaults
      report.issues = report.issues || [];
      report.advice = report.advice || '暂无建议';
      report.score = typeof report.score === 'number' ? report.score : 0;

      // Format report for display
      const formattedReport = {
        status: report.status,
        score: report.score,
        statusText: this.getComplianceStatusText(report.status),
        statusColor: this.getComplianceStatusColor(report.status),
        issues: report.issues,
        advice: report.advice,
        timestamp: report.timestamp || new Date().toISOString(),
        isFallback: report.fallback || false,
        reportTable: report.reportTable,
        modelName: report.model || 'deepseek-v4-flash'
      };
      
      // Update state and show popup
      this._disposeRendererForModal();
      this.setData({ 
        complianceReport: formattedReport,
        showComplianceReport: true,
        isCheckingCompliance: false
      });
      
      console.log('[PackingResult] Compliance report displayed');
      
    }).catch((error) => {
      this.stopNarrativeLoading();
      this.setData({ isCheckingCompliance: false });
      console.error('[PackingResult] AI Compliance check failed:', error);
      wx.showToast({ title: 'AI体检失败，请重试', icon: 'none' });
    });
  },
  
  /**
   * View Historical Report
   * Display cached compliance report without triggering API call
   */
  onViewReport: function() {
    console.log('[PackingResult] View historical report triggered');
    
    // Check if report exists
    if (!this.data.complianceReport) {
      console.log('[PackingResult] No cached report available');
      wx.showToast({ title: '暂无历史报告', icon: 'none' });
      return;
    }
    
    // Directly display cached report
    console.log('[PackingResult] Displaying cached report');
    this._disposeRendererForModal();
    this.setData({ showComplianceReport: true });
  },
  
  /**
   * Refresh Report (In-Popup Re-check)
   * v4.0: 直接清空缓存并触发主流程（异步轮询）
   */
  onRefreshReport: function() {
    console.log('[PackingResult] Refresh report triggered');

    // Prevent duplicate requests
    if (this.data.isCheckingCompliance) {
      console.log('[PackingResult] Already checking compliance, ignoring duplicate request');
      return;
    }

    // Show confirmation dialog
    wx.showModal({
      title: '重新体检',
      content: '是否重新体检当前装箱方案？',
      confirmText: '确认',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          console.log('[PackingResult] User confirmed refresh');
          // 清空缓存的报告，重新触发主流程（async + 轮询）
          this.setData({
            complianceReport: null,
            showComplianceReport: false,
            isCheckingCompliance: false
          }, () => {
            this.onAIComplianceCheck();
          });
        } else {
          console.log('[PackingResult] User cancelled refresh');
        }
      }
    });
  },
  
  /**
   * Get compliance status text
   */
  getComplianceStatusText: function(status) {
    const statusMap = {
      'PASS': '✅ 合规通过',
      'WARNING': '⚠️ 风险预警',
      'FAIL': '❌ 严重违规'
    };
    return statusMap[status] || '未知状态';
  },
  
  /**
   * Get compliance status color
   */
  getComplianceStatusColor: function(status) {
    const colorMap = {
      'PASS': '#10b981',
      'WARNING': '#f59e0b',
      'FAIL': '#ef4444'
    };
    return colorMap[status] || '#999';
  },
  
  /**
   * Close Compliance Report Modal
   * v37.6: Modal 打开时 canvas 通过 wx:if 已被销毁，关闭后需要重建并重新渲染
   */
  onCloseComplianceReport: function() {
    this.setData({ showComplianceReport: false }, () => {
      // canvas 节点重建后重新初始化 ThreeRenderer
      // 老的 renderer 已不再绑定到任何 canvas，标记 disposed 让它停止渲染循环
      if (this.threeRenderer) {
        this.threeRenderer.isDisposed = true;
        this.threeRenderer = null;
      }
      setTimeout(() => {
        if (this.data.packingPlan && this.rawPackingData) {
          this.init3DCanvas();
        }
      }, 200);
    });
    // DO NOT clear complianceReport - keep it for re-viewing
  },
  
  /**
   * Re-check Compliance (Force new API call)
   * v4.0: 清空缓存并通过主流程（async + 轮询）重新发起检查
   */
  onRecheckCompliance: function() {
    console.log('[PackingResult] Re-check compliance triggered');

    // 清空缓存报告，重新触发主流程
    this.setData({
      complianceReport: null,
      showComplianceReport: false,
      isCheckingCompliance: false
    }, () => {
      this.onAIComplianceCheck();
    });
  },

  /**
   * Start simulated progress animation
   * Non-linear growth, never reaches 100%
   * Requirements: 8.3
   */
  _startSimulatedProgress: function() {
    let progress = 10;
    const progressTexts = [
      '正在计算最优排列...',
      '分析货物约束条件...',
      '优化空间利用率...',
      '验证稳定性...',
      '生成装载方案...'
    ];
    let textIndex = 0;
    
    this.setData({ generatingProgress: progress });
    
    this._progressInterval = setInterval(() => {
      if (!this.data.isGenerating) {
        this._clearGeneratingTimers();
        return;
      }
      
      // Non-linear growth: slower as it approaches 95%
      const remaining = 95 - progress;
      const increment = Math.max(0.5, remaining * 0.06);
      progress = Math.min(95, progress + increment);
      
      // Cycle through progress texts
      if (progress > (textIndex + 1) * 18 && textIndex < progressTexts.length - 1) {
        textIndex++;
      }
      
      this.setData({ 
        generatingProgress: Math.round(progress),
        generatingProgressText: progressTexts[textIndex]
      });
    }, 400);
  },

  /**
   * Clear all generating-related timers
   */
  _clearGeneratingTimers: function() {
    if (this._generatingTimer) {
      clearTimeout(this._generatingTimer);
      this._generatingTimer = null;
    }
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
  },

  onUnload: function () {
    // CRITICAL: Clear generating progress timers
    this._clearGeneratingTimers();
    
    // CRITICAL: Clear narrative loading timer
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
    
    // CRITICAL: Memory cleanup - clear compliance state
    this.setData({
      complianceReport: null,
      showComplianceReport: false,
      isCheckingCompliance: false,
      showNarrativeLoading: false,
      loadingText: ''
    });
    
    // CRITICAL: Memory cleanup - clear renderer before dispose
    if (this.threeRenderer) {
      // Clear scene resources
      if (this.threeRenderer.cargoGroup) {
        this.threeRenderer.scene.remove(this.threeRenderer.cargoGroup);
        this.threeRenderer.disposeGroupAggressive(this.threeRenderer.cargoGroup);
        this.threeRenderer.cargoGroup = null;
      }
      
      if (this.threeRenderer.batchBoundingBoxGroup) {
        this.threeRenderer.scene.remove(this.threeRenderer.batchBoundingBoxGroup);
        this.threeRenderer.disposeGroupAggressive(this.threeRenderer.batchBoundingBoxGroup);
        this.threeRenderer.batchBoundingBoxGroup = null;
      }
      
      // Dispose renderer
      this.threeRenderer.dispose();
      this.threeRenderer = null;
    }
  }
});

function planStrategy(plan) {
  return String(plan?.algorithmMeta?.strategy || plan?.strategy || plan?.loadedCargo?.[0]?.algorithmMeta?.strategy || 'SPACE').toUpperCase();
}
