const SOURCE_NAMES = Object.freeze({
  renault_esicup_2015: '雷诺 · 多集装箱工业装载基准',
  ortec_alonso_2019: 'ORTEC · 真实工业物流实例',
  orlib_thpack: 'THPACK · 三维集装箱装载基准',
  orlib_wtpack: 'WTPACK · 重量与承压装载基准',
  esicup_irregular: 'ESICUP · 三维异形货物基准',
  atlas_copco: '阿特拉斯·科普柯 · 真实海运装载研究',
  beantech: 'BeanTech · 多目的地多集装箱实例'
});

const CLASSIFICATIONS = Object.freeze({
  REAL_SEA_FREIGHT_INDUSTRIAL: '真实海运工业数据',
  REAL_INDUSTRIAL_LOGISTICS: '真实工业物流数据',
  INDUSTRIAL_SUPPLIED_BENCHMARK: '企业提供工业基准',
  ACADEMIC_BENCHMARK: '公开学术基准',
  IRREGULAR_GEOMETRY_BENCHMARK: '三维异形几何基准',
  PENDING_EXTERNAL_SOURCE: '来源已确认 · 数据待获取'
});

const STATUSES = Object.freeze({
  UNKNOWN: '未知',
  NOT_PROVIDED: '来源未提供',
  ADAPTER_REQUIRED: '需人工确认适配',
  CORE_EXTENSION_PENDING_SOLVER_SUPPORT: '数据已记录 · 当前求解器暂未使用',
  DOWNLOAD_FAILED: '数据获取失败',
  REQUIRES_APPLICATION: '需要申请后获取',
  SOURCE_FOUND_DATASET_UNAVAILABLE: '来源已确认 · 数据文件暂不可用',
  METADATA_AVAILABLE_DATAFILE_NOT_PUBLICLY_RETRIEVED: '来源已确认 · 数据待获取'
});

const FIELD_LABELS = Object.freeze({
  externalItemId: '产品编号', productIdentifier: '产品编号', productId: '产品编号', boxType: '货物类型',
  deliveryDay: '交付日', demand: '需求数量', lengthMm: '长度', widthMm: '宽度', heightMm: '高度', dimensions: '尺寸', normalizedDimensions: '规范尺寸', dimensionUnit: '尺寸单位',
  weight: '单件重量', weightKg: '单件重量', quantity: '件数', packagingType: '包装类型', packagingMaterial: '包装类型',
  orientationConstraints: '允许摆放方向', rotationX: '允许绕 X 轴旋转', rotationY: '允许绕 Y 轴旋转', rotationZ: '允许绕 Z 轴旋转',
  stackingGroup: '堆叠分组', stackability: '可堆叠', maxStackLayers: '最大堆叠层数', alwaysOnTop: '必须位于上层', alwaysOnBottom: '必须位于底层',
  loadBearing: '承压 / 承载能力', normalizedLoadBearingKg: '总承重换算', hazardous: '危险品属性', palletAttached: '自带托盘',
  destination: '目的港', deliveryStage: '配送阶段', handling: '搬运方式', geometryType: '几何类型', geometryAsset: '三维几何模型', normalizedBoundingBoxMm: '毫米包络尺寸',
  containerDefinition: '容器定义', sourceFields: '来源原始字段', originalValue: '原始值', originalUnit: '原始单位'
});

export const SUPPORT_STATES = Object.freeze({
  supported: { symbol: '✓', label: '数据提供且 PORTCUBE 已支持' },
  recorded: { symbol: '◐', label: '数据已记录，当前求解器暂未使用' },
  missing: { symbol: '—', label: '来源未提供' },
  adapter: { symbol: '!', label: '需人工确认适配' }
});

export function externalSourceName(source, fallback = '') {
  const aliases = {
    'Renault / ESICUP Challenge 2015': 'renault_esicup_2015',
    'ORTEC / Alonso 2019': 'ortec_alonso_2019',
    'OR-Library THPACK': 'orlib_thpack',
    'OR-Library WTPACK': 'orlib_wtpack',
    'ESICUP 3D Irregular': 'esicup_irregular'
  };
  return SOURCE_NAMES[source] || SOURCE_NAMES[aliases[source]] || fallback || source || '外部数据源';
}
export function externalClassificationLabel(value) { return CLASSIFICATIONS[value] || '分类待确认'; }
export function externalStatusLabel(value) { return STATUSES[value] || '状态待确认'; }
export function externalFieldLabel(value) { return FIELD_LABELS[value] || '其他来源字段'; }
export function externalUnknownLabels(fields = []) { return fields.map(externalFieldLabel); }
export function booleanLabel(value) { return value === true ? '是' : value === false ? '否' : '来源未提供'; }
export function supportState(kind) { return SUPPORT_STATES[kind] || SUPPORT_STATES.missing; }
export function datasetGroupLabel(value) {
  const match = String(value || '').match(/^instances([ABX])$/i);
  if (match) return `挑战实例 ${match[1].toUpperCase()}`;
  const thpack = String(value || '').match(/^thpack(\d+)$/i);
  if (thpack) return `THPACK ${thpack[1]}`;
  if (value === 'alonso_2019') return 'Alonso 2019';
  if (value === 'esicup_irregular') return 'ESICUP 异形数据';
  return value || '默认数据集';
}

export function externalItemDisplayName(item = {}) {
  if (item.externalSource?.includes('Renault')) return `雷诺工业部件 · ${item.externalItemId}`;
  if (item.externalSource?.startsWith('ORTEC')) return `工业货物类型 ${item.externalItemId}`;
  if (item.externalSource?.includes('THPACK')) return `箱装货物类型 ${item.externalItemId}`;
  if (item.externalSource?.includes('WTPACK')) return `承压箱装货物类型 ${item.externalItemId}`;
  if (item.externalSource?.includes('Irregular')) {
    const family = String(item.externalInstance || item.externalDataset || '').toLowerCase();
    const label = family.includes('stoyan') ? '非凸异形货物' : family.includes('egeblad') ? '长薄异形货物' : '工业异形货物';
    return `${label} ${item.externalItemId}`;
  }
  return item.name || `工业货物 ${item.externalItemId}`;
}

export function packagingDisplay(item = {}) {
  const sourceMaterial = String(item.sourceFields?.['Package material'] || '').trim().toUpperCase();
  if (sourceMaterial === 'CARDBOARD' || item.packagingType === 'CARTON') return '纸质包装';
  if (['WOOD', 'WOODEN'].includes(sourceMaterial) || item.packagingType === 'WOOD_CRATE') return '木质包装';
  if (sourceMaterial === 'METAL') return '金属包装';
  if (sourceMaterial === 'PLASTIC') return '塑料包装';
  if (item.externalSource?.includes('WTPACK')) return '承压箱装货物';
  if (item.externalSource?.includes('THPACK')) return '箱装货物';
  if (item.externalSource?.startsWith('ORTEC')) return '规则工业货物单元';
  if (item.externalSource?.includes('Irregular') || item.geometryType === 'MESH') return '异形货物';
  return '工业货物单元';
}

export function solverReadinessLabel(value) {
  return ({ FULLY_SUPPORTED: '完整约束可求解', PARTIALLY_SUPPORTED: '部分约束可求解', BROWSE_ONLY: '仅供浏览' })[value] || '求解状态待确认';
}

const LEGACY_PACKAGING_LABELS = Object.freeze({
  accessory: '配件包装', carton: '纸箱', panel: '面板防护包装', fragile: '易碎品包装',
  wooden: '木质包装', reinforced: '加固包装', protected: '防护包装', equipment: '设备包装箱'
});

export function cargoPackagingDisplay(value, canonicalTypes = []) {
  return canonicalTypes.find(([type]) => type === value)?.[1]
    || LEGACY_PACKAGING_LABELS[String(value || '').toLowerCase()]
    || '包装类型待确认';
}

export function externalTaskTitle(externalDataset = {}) {
  const source = ({ renault_esicup_2015: 'Renault', ortec_alonso_2019: 'ORTEC', orlib_thpack: 'THPACK', orlib_wtpack: 'WTPACK', esicup_irregular: 'ESICUP' })[externalDataset.source] || '外部数据';
  const instance = String(externalDataset.instanceLabel || externalDataset.instanceId || '').replace(/^wtpack\d+\s*\/\s*/i, '').replace(/^thpack\d+\s*\/\s*/i, '');
  return `${source} · ${instance || '数据任务'}`;
}

export function orientationDisplay(constraints) {
  if (!constraints) return '来源未提供';
  if (constraints.mode === 'FREE') return '自由摆放';
  if (constraints.containerAxisAlignment === 'LENGTHWISE') return '沿柜长方向固定（已参与求解）';
  if (constraints.containerAxisAlignment === 'WIDTHWISE') return '沿柜宽方向固定（已参与求解）';
  if (['x', 'y', 'z'].some((key) => Object.hasOwn(constraints, key))) {
    return ['x', 'y', 'z'].map((key) => `绕 ${key.toUpperCase()} 轴：${booleanLabel(constraints[key])}`).join('；');
  }
  if (['lengthVertical', 'widthVertical', 'heightVertical'].some((key) => Object.hasOwn(constraints, key))) {
    return [['lengthVertical', '长度'], ['widthVertical', '宽度'], ['heightVertical', '高度']].map(([key, label]) => `${label}可竖直：${booleanLabel(constraints[key])}`).join('；');
  }
  return '原始朝向规则已保留 · 含义待确认';
}

export function sourceAdvisory(source, family, instance) {
  if (source === 'ortec_alonso_2019') return { tone: 'warning', text: '工业物流车辆基准 · 非海运标准柜。堆叠分组、上下层和车辆约束已记录，当前求解器尚未完整使用。' };
  if (source === 'orlib_wtpack') return { tone: 'warning', text: '来源承压参数为 kg/cm²，原值和定义已保留，尚不能换算为单件总承重。' };
  if (source === 'orlib_thpack' && ['thpack8', 'thpack9'].includes(family)) return { tone: 'warning', text: '数据可浏览 · 暂不建议正式求解。来源单位或部分原始记录结构尚待确认。' };
  if (source === 'esicup_irregular') return { tone: 'warning', text: '三维几何已导入；当前仅支持浏览，精确异形碰撞和毫米包络尚未接入正式求解。' };
  if (source === 'renault_esicup_2015' && instance?.items?.some((item) => item.orientationConstraints?.containerAxisAlignment)) return { tone: 'warning', text: '沿柜长/柜宽方向约束已参与求解；其余来源约束仍按当前部分支持状态如实披露。' };
  return { tone: 'neutral', text: '来源字段按原始语义保留；缺失值不会自动补全。' };
}

export function sourceCapabilities(dataset, summary) {
  const source = dataset?.source;
  const features = summary?.features || {};
  const rows = [
    ['尺寸', features.dimensions === true ? 'supported' : 'missing'],
    ['重量', features.weight ? 'supported' : 'missing'],
    ['允许摆放方向', features.orientation ? 'supported' : 'missing']
  ];
  if (source === 'ortec_alonso_2019') rows.push(['堆叠分组', 'recorded'], ['上下层限制', 'recorded'], ['道路车辆约束', 'recorded'], ['海运港口资料', 'missing']);
  if (source === 'orlib_wtpack') rows.push(['来源承压参数', 'adapter']);
  if (source === 'esicup_irregular') rows.push(['三维几何模型', 'recorded'], ['精确异形碰撞', 'recorded']);
  if (source === 'orlib_thpack' && ['thpack8', 'thpack9'].includes(summary?.group)) rows.push(['来源单位与记录结构', 'adapter']);
  return rows.map(([name, state]) => {
    const support = supportState(state);
    return { name, state, symbol: support.symbol, explanation: support.label };
  });
}
