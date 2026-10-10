import { REQUIRED_CARGO_FIELDS, validateCargo } from './cargo.js';
import {configurePackaging} from '../../../../shared/commercePackaging.mjs';

const HEADER_ALIASES = Object.freeze({
  required:['required','本次必运'], allowPartialShipment:['allowPartialShipment','允许拆单'], shipmentPriority:['shipmentPriority','订单优先级'],
  customerId:['customerId','货主编号'], customerName:['customerName','货主'], orderId:['orderId','订单号'], lotId:['lotId','库存批号'],
  arrivalBatchId:['arrivalBatchId','到仓批次'], expectedArrivalAt:['expectedArrivalAt','预计到仓'], arrivedAt:['arrivedAt','实际到仓'], unloadGroup:['unloadGroup','卸货组'], unloadSequence:['unloadSequence','卸货组顺序'],
  name: ['name', 'cargoName', '货物名称', '名称', '品名'],
  sku: ['sku', 'SKU', '货号', '物料编码'],
  length: ['length', 'length(mm)', '长(mm)', '长度', '长'],
  width: ['width', 'width(mm)', '宽(mm)', '宽度', '宽'],
  height: ['height', 'height(mm)', '高(mm)', '高度', '高'],
  weight: ['weight', 'weight(kg)', '单重(kg)', '单重', '重量'],
  quantity: ['quantity', 'qty', '数量', '件数'],
  destinationPort: ['destinationPort', 'destination', '目的港'],
  eta: ['eta', 'ETA', '预计到港'],
  portSequence: ['portSequence', 'portOrder', '港序', '卸货顺序'],
  packagingType: ['packagingType', 'packageType', '包装类型', '包装'],
  stackable: ['stackable', '可堆叠'],
  maxStackLayers: ['maxStackLayers', '最大堆叠层数', '最大层数'],
  canRotate: ['canRotate', '可旋转'],
  canLayFlat: ['canLayFlat', '可平放'],
  canInvert: ['canInvert', '可倒置'],
  fragile: ['fragile', '易碎'],
  heavy: ['heavy', '重货'],
  wooden: ['wooden', '木质包装', '木包装'],
  batchId: ['batchId', '批次ID'],
  batchLabel: ['batchLabel', '批次名称'],
  source: ['source', '来源'],
  dangerous: ['dangerous', '危险品'],
  handlingMethod: ['handlingMethod', '装卸方式', '搬运方式'],
  stackLayerScope:['stackLayerScope','层数计算范围'],
  maxSupportedWeight:['maxSupportedWeight','maximumSupportedWeightKg','顶载上限kg'],
  riskNotes: ['riskNotes', '风险备注', '备注']
});

const NUMBER_FIELDS = new Set(['length', 'width', 'height', 'weight', 'quantity', 'portSequence', 'maxStackLayers','unloadSequence','maxSupportedWeight','shipmentPriority']);
const BOOLEAN_FIELDS = new Set(['required', 'allowPartialShipment', 'stackable', 'canRotate', 'canLayFlat', 'canInvert', 'fragile', 'heavy', 'wooden', 'dangerous']);
const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', '是', '可', '允许']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n', '否', '不可', '禁止']);

function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().replace(/\s+/g, '').toLowerCase();
}

const HEADER_LOOKUP = new Map(
  Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) => aliases.map((alias) => [normalizeHeader(alias), field]))
);

export function parseCsvRows(text = '') {
  const source = String(text).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

export function previewCargoCsv(text = '') {
  const records = parseCsvRows(text);
  if (!records.length) return emptyPreview('CSV 文件为空');

  const header = records[0];
  const mappedHeader = header.map((value) => HEADER_LOOKUP.get(normalizeHeader(value)) || null);
  const duplicates = mappedHeader.filter((field, index) => field && mappedHeader.indexOf(field) !== index);
  if (duplicates.length) return emptyPreview(`存在重复列：${[...new Set(duplicates)].join('、')}`);

  const present = new Set(mappedHeader.filter(Boolean));
  const missing = REQUIRED_CARGO_FIELDS.filter((field) => field!=='name'&&!present.has(field));
  if (missing.length) return emptyPreview(`缺少必需列：${missing.join('、')}`);

  const rows = records.slice(1).map((values, index) => {
    const raw = {};
    mappedHeader.forEach((field, column) => {
      if (field) raw[field] = values[column] ?? '';
    });
    const candidate = configurePackaging({...toCargoCandidate(raw, index + 2),rawImportRecord:{format:'CSV',rowNumber:index+2,fields:{...raw}}});
    const result = validateCargo(candidate);
    const booleanErrors = Object.fromEntries(Object.entries(raw).filter(([field, value]) => BOOLEAN_FIELDS.has(field) && String(value).trim() && !TRUE_VALUES.has(String(value).trim().toLowerCase()) && !FALSE_VALUES.has(String(value).trim().toLowerCase())).map(([field]) => [field, '请填写是或否']));
    const errors = { ...result.errors, ...booleanErrors };
    return {
      rowNumber: index + 2,
      raw,
      cargo: result.cargo,
      errors,
      warnings: ['packagingType', 'stackable', 'canRotate', 'maxStackLayers'].filter(field => !String(raw[field] ?? '').trim()).map(field => `未填写 ${field}，使用默认值，请核对`),
      valid: result.valid && Object.keys(booleanErrors).length === 0
    };
  });

  const skuCounts = rows.reduce((counts, row) => {
    const sku = row.cargo.sku.toLowerCase();
    if (sku) counts.set(sku, (counts.get(sku) || 0) + 1);
    return counts;
  }, new Map());
  for (const row of rows) {
    if ((skuCounts.get(row.cargo.sku.toLowerCase()) || 0) > 1) row.warnings.push('CSV 内存在重复 SKU');
  }

  const valid = rows.filter((row) => row.valid).length;
  return {
    rows,
    fatalErrors: [],
    ignoredHeaders: header.filter((_, index) => !mappedHeader[index]),
    summary: { total: rows.length, valid, invalid: rows.length - valid }
  };
}

export function buildInputCargoCsv(cargoList = []) {
  const columns = [
    ['货物名称', 'name'], ['SKU', 'sku'], ['长(mm)', 'length'], ['宽(mm)', 'width'], ['高(mm)', 'height'],
    ['单重(kg)', 'weight'], ['数量', 'quantity'], ['目的港', 'destinationPort'], ['港序', 'portSequence'],
    ['本次必运','required'], ['允许拆单','allowPartialShipment'], ['订单优先级','shipmentPriority'],
    ['货主编号','customerId'], ['货主','customerName'], ['订单号','orderId'], ['库存批号','lotId'], ['到仓批次','arrivalBatchId'], ['预计到仓','expectedArrivalAt'], ['实际到仓','arrivedAt'], ['卸货组','unloadGroup'], ['卸货组顺序','unloadSequence'],
    ['批次ID', 'batchId'], ['批次名称', 'batchLabel'], ['装卸方式', 'handlingMethod'], ['包装类型', 'packagingType'],
    ['可堆叠', 'stackable'], ['最大堆叠层数', 'maxStackLayers'], ['易碎', 'fragile'], ['重货', 'heavy'],
    ['顶载上限kg','maxSupportedWeight'], ['层数计算范围','stackLayerScope'],
    ['木包装', 'wooden'], ['可旋转', 'canRotate'], ['可平放', 'canLayFlat'], ['可倒置', 'canInvert'], ['危险品', 'dangerous'], ['风险备注', 'riskNotes'], ['来源', 'source']
  ];
  const rows = [columns.map(([label]) => csvCell(label)).join(',')];
  for (const cargo of cargoList) {
    rows.push(columns.map(([, field]) => {
      const value = field === 'riskNotes'
        ? (cargo.riskNotes || []).join('；')
        : typeof cargo[field] === 'boolean'
          ? (cargo[field] ? '是' : '否')
          : cargo[field];
      return csvCell(value);
    }).join(','));
  }
  return `\uFEFF${rows.join('\r\n')}`;
}

function toCargoCandidate(raw, rowNumber) {
  const candidate = { cargoId: `csv_row_${rowNumber}` };
  for (const [field, value] of Object.entries(raw)) {
    if (NUMBER_FIELDS.has(field)) {
      candidate[field] = value === '' ? 0 : Number(value);
    } else if (BOOLEAN_FIELDS.has(field)) {
      candidate[field] = parseBoolean(value, ['required','allowPartialShipment'].includes(field) ? undefined : field === 'stackable' || field === 'canRotate');
    } else if (field === 'riskNotes') {
      candidate[field] = String(value).split(/[;；|]/).map((part) => part.trim()).filter(Boolean);
    } else {
      candidate[field] = value;
    }
  }
  if (!Object.hasOwn(candidate, 'packagingType') || !candidate.packagingType) candidate.packagingType = 'carton';
  if (!Object.hasOwn(candidate, 'stackable')) candidate.stackable = true;
  if (!Object.hasOwn(candidate, 'canRotate')) candidate.canRotate = true;
  if (!Object.hasOwn(candidate, 'maxStackLayers')) candidate.maxStackLayers = candidate.stackable ? 5 : 1;
  return candidate;
}

function parseBoolean(value, defaultValue) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

function emptyPreview(message) {
  return {
    rows: [],
    fatalErrors: [message],
    ignoredHeaders: [],
    summary: { total: 0, valid: 0, invalid: 0 }
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
