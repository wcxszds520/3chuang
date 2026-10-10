import store from '../../utils/store.js';
const caseApi = require('../../utils/caseApi.js');
const { normalizePlanSource, getPlanSourceLabel } = require('../../utils/provenance.js');
const { summarizeCompliance } = require('../../utils/complianceSemantics.js');

Page({
  data: {
    stat: { skuCount: 0, totalQty: 0, containerName: '未选择', loadedCount: 0, utilization: 0 },
    planSource: '尚无方案',
    planSourceCode: 'UNKNOWN',
    caseSourceCode: 'UNKNOWN',
    strategyName: '—',
    currentStep: '输入或扫描 Case ID',
    caseIdInput: '',
    currentCase: null,
    complianceSemantics: null,
    admissionStatus: null,
    caseLoading: false,
    caseError: ''
  },

  onLoad(options = {}) {
    this._storeListener = () => this._refreshStat();
    store.subscribe(this._storeListener);
    this._refreshStat();
    const existing = store.getState('currentCase');
    const incomingCaseId = options.caseId || existing?.caseId || '';
    this.setData({ caseIdInput: incomingCaseId, currentCase: existing || null });
    if (options.caseId) this.loadCaseById(options.caseId);
  },

  onShow() {
    this._refreshStat();
  },

  onUnload() {
    if (this._storeListener) store.unsubscribe(this._storeListener);
  },

  _refreshStat() {
    const cargoList = store.getState('cargoList') || [];
    const container = store.getState('selectedContainer');
    const plan = store.getState('packingPlan');
    const sourceCode = normalizePlanSource(plan);
    const currentCase = store.getState('currentCase') || null;
    const skuCount = cargoList.length;
    const totalQty = cargoList.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const loadedCount = Number(plan?.totalCargoCount || plan?.loadedCargo?.length || 0);
    const utilization = Number(plan?.spaceUtilization || 0);
    this.setData({
      stat: {
        skuCount,
        totalQty,
        containerName: container?.typeId || container?.name || '未选择',
        loadedCount,
        utilization: Number.isFinite(utilization) ? utilization.toFixed(1) : '0.0'
      },
      planSource: getPlanSourceLabel(sourceCode),
      planSourceCode: sourceCode,
      strategyName: planStrategy(plan),
      caseSourceCode: normalizePlanSource(currentCase?.sourceCode),
      currentCase,
      complianceSemantics: summarizeCompliance(currentCase?.complianceSummary || store.getState('complianceReport')),
      admissionStatus: currentCase?.admissionSnapshot?.overallStatus || plan?.ext_admission?.overallStatus || null,
      currentStep: !skuCount ? '输入或扫描 Case ID' : !container ? '确认待用柜型' : !plan ? '等待 Web 生成正式方案' : '继续现场装载复核'
    });
  },

  onCaseIdInput(event) { this.setData({ caseIdInput: String(event.detail.value || '').trim(), caseError: '' }); },

  loadCurrentCase() {
    const caseId = String(this.data.caseIdInput || '').trim();
    if (!caseId) {
      wx.showToast({ title: '请输入 Case ID', icon: 'none' });
      return;
    }
    this.loadCaseById(caseId);
  },

  loadCaseById(caseId) {
    if (this.data.caseLoading) return;
    this.setData({ caseLoading: true, caseError: '' });
    caseApi.getCase(caseId, { loadingText: '读取装箱任务...' }).then(async (packingCase) => {
      let plan = packingCase.packingPlan || null;
      if (!plan && packingCase.packingPlanId) plan = await caseApi.getPlan(packingCase.packingPlanId, { loadingText: '读取装箱方案...' });
      const container = containerFromCase(packingCase, plan);
      store.setState({
        currentCase: packingCase,
        cargoList: packingCase.cargoSnapshot || [],
        selectedContainer: container,
        packingPlan: plan,
        complianceReport: packingCase.complianceSummary || null
      });
      this.setData({ caseLoading: false, currentCase: packingCase, caseIdInput: packingCase.caseId, caseError: '' });
      wx.showToast({ title: '已读取同一装箱任务', icon: 'success' });
    }).catch((error) => {
      this.setData({ caseLoading: false, caseError: error.message || '装箱任务读取失败' });
    });
  },

  scanCase() {
    wx.scanCode({
      scanType: ['qrCode'],
      success: ({ result }) => {
        const caseId = String(result || '').trim().replace(/^CASE:/i, '');
        this.setData({ caseIdInput: caseId });
        this.loadCaseById(caseId);
      }
    });
  },

  continueOperation() {
    if (store.getState('packingPlan')) return wx.navigateTo({ url: '/pages/packing-result/packing-result' });
    if (store.getState('cargoList')?.length) return wx.navigateTo({ url: '/pages/container-select/container-select' });
    return wx.showToast({ title: '请先读取装箱任务', icon: 'none' });
  },

  goToCargoInput() { wx.navigateTo({ url: '/pages/cargo-input/cargo-input' }); },
  goToContainerSelect() { wx.navigateTo({ url: '/pages/container-select/container-select' }); },
  goToPackingResult() {
    if (!store.getState('packingPlan')) {
      wx.showToast({ title: '请先生成装箱方案', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/packing-result/packing-result' });
  }
});

function containerFromCase(packingCase, plan) {
  const typeId = packingCase.containerType || plan?.containerInfo?.typeId || '40HQ';
  const defaults = {
    '20GP': { innerLength: 5898, innerWidth: 2352, innerHeight: 2393, doorWidth: 2340, doorHeight: 2280, tare: 2180, maxGross: 30480, maxWeight: 28300, mode: 'REFERENCE_PROFILE' },
    '40GP': { innerLength: 12032, innerWidth: 2352, innerHeight: 2393, doorWidth: 2340, doorHeight: 2280, tare: 3630, maxGross: 32500, maxWeight: 28870, mode: 'REFERENCE_PROFILE' },
    '40HQ': { innerLength: 12032, innerWidth: 2352, innerHeight: 2698, doorWidth: 2340, doorHeight: 2585, tare: 3810, maxGross: 32500, maxWeight: 28690, mode: 'REFERENCE_PROFILE' }
  };
  return { typeId, name: `${typeId} 集装箱`, ...(defaults[typeId] || defaults['40HQ']), ...(plan?.containerInfo || {}) };
}

function planStrategy(plan) {
  return String(plan?.algorithmMeta?.strategy || plan?.strategy || plan?.loadedCargo?.[0]?.algorithmMeta?.strategy || '—').toUpperCase();
}
