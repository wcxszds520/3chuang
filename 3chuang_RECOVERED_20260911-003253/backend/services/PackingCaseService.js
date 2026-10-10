const { randomUUID } = require('crypto');

const CASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/;
const STATUSES = new Set(['DRAFT', 'SOLVED', 'ANALYZED', 'READY', 'REVIEWED', 'REVIEWED_WITH_CONDITIONS', 'REJECTED', 'DELIVERED', 'ARCHIVED']);
const PLAN_SOURCE_CODES = new Set(['LOCAL_PREVIEW', 'BACKEND_SOLVED', 'OFFLINE_DEMO', 'UNKNOWN']);

class PackingCaseService {
  constructor(db) {
    this.db = db;
    this.schemaReady = false;
  }

  async ensureSchema() {
    if (this.schemaReady) return;
    await this.db.query(`CREATE TABLE IF NOT EXISTS packing_case (
      case_id VARCHAR(80) PRIMARY KEY,
      cargo_snapshot LONGTEXT NOT NULL,
      container_type VARCHAR(80) NOT NULL,
      packing_plan_id VARCHAR(80) DEFAULT NULL,
      plan_snapshot LONGTEXT DEFAULT NULL,
      compliance_snapshot LONGTEXT DEFAULT NULL,
      context_snapshot LONGTEXT DEFAULT NULL,
      admission_snapshot LONGTEXT DEFAULT NULL,
      source_code VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_packing_case_updated (updated_at),
      INDEX idx_packing_case_plan (packing_plan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='跨端最小装箱任务快照'`);
    await this.db.query("ALTER TABLE packing_case MODIFY status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'");
    await this.db.query('ALTER TABLE packing_case MODIFY container_type VARCHAR(80) NOT NULL');
    await addColumnIfMissing(this.db, 'context_snapshot', 'LONGTEXT DEFAULT NULL');
    await addColumnIfMissing(this.db, 'admission_snapshot', 'LONGTEXT DEFAULT NULL');
    this.schemaReady = true;
  }

  async create(input = {}) {
    await this.ensureSchema();
    const value = normalizeInput(input, { allowGeneratedId: true });
    await this.db.query(
      `INSERT INTO packing_case
       (case_id, cargo_snapshot, container_type, packing_plan_id, plan_snapshot, compliance_snapshot, context_snapshot, admission_snapshot, source_code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      toParams(value)
    );
    return this.get(value.caseId);
  }

  async updateExisting(input = {}) {
    await this.ensureSchema();
    const value = normalizeInput(input);
    await this.db.query(
      `UPDATE packing_case SET cargo_snapshot=?, container_type=?, packing_plan_id=?, plan_snapshot=?,
       compliance_snapshot=?, context_snapshot=?, admission_snapshot=?, source_code=?, status=?, updated_at=CURRENT_TIMESTAMP
       WHERE case_id=?`,
      [...toParams(value).slice(1), value.caseId]
    );
    return this.get(value.caseId);
  }

  async update(caseId, patch = {}) {
    const current = await this.get(caseId);
    if (!current) return null;
    if (patch.caseId && patch.caseId !== caseId) throw validationError('更新路径与 caseId 冲突');
    return this.updateExisting({ ...current, ...patch, caseId: current.caseId, createdAt: current.createdAt });
  }

  async get(caseId) {
    await this.ensureSchema();
    validateCaseId(caseId);
    const [rows] = await this.db.query('SELECT * FROM packing_case WHERE case_id = ? LIMIT 1', [caseId]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async list(limit = 50) {
    await this.ensureSchema();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const [rows] = await this.db.query(
      `SELECT case_id, container_type, packing_plan_id, source_code, status,
       JSON_LENGTH(cargo_snapshot) AS cargo_sku_count, created_at, updated_at
       FROM packing_case ORDER BY updated_at DESC LIMIT ?`,
      [safeLimit]
    );
    return rows.map(mapCaseSummary);
  }
}

function normalizeInput(input, options = {}) {
  const caseId = input.caseId || (options.allowGeneratedId ? `CASE_${randomUUID()}` : '');
  validateCaseId(caseId);
  if (!Array.isArray(input.cargoSnapshot)) throw validationError('cargoSnapshot 必须是数组');
  const containerType = String(input.containerType || '').trim();
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(containerType)) throw validationError('containerType 无效');
  const status = String(input.status || (input.packingPlanId ? 'SOLVED' : 'DRAFT')).toUpperCase();
  if (!STATUSES.has(status)) throw validationError(`status 无效：${status}`);
  const packingPlanId = input.packingPlanId ? String(input.packingPlanId) : null;
  if (packingPlanId && !CASE_ID_PATTERN.test(packingPlanId)) throw validationError('packingPlanId 无效');
  const plan = input.packingPlan || input.planSnapshot || null;
  if (plan?.planId && plan.planId !== packingPlanId) throw validationError('packingPlanId 与方案身份冲突');
  const contextSnapshot = {...(input.contextSnapshot || {})};
  for (const key of ['caseContext','containerMode','actualContainer','massEvidence','vgm','transport','securingInputs',
    'taskIdentity','solverMode','benchmarkMode','externalDataset','datasetCapabilities','executionStatus','sourceContainer','dataClassification','datasetId']) {
    if (Object.hasOwn(input,key)) contextSnapshot[key] = input[key];
  }
  return {
    caseId,
    cargoSnapshot: input.cargoSnapshot,
    containerType,
    packingPlanId,
    packingPlan: plan,
    complianceSummary: input.complianceSummary || input.complianceSnapshot || null,
    contextSnapshot,
    admissionSnapshot: input.admissionSnapshot || input.packingPlan?.ext_admission || input.packingPlan?.admission || null,
    sourceCode: normalizePlanSource(input.sourceCode || input.packingPlan?.sourceCode || input.packingPlan?.source),
    status
  };
}

function toParams(value) {
  return [
    value.caseId,
    JSON.stringify(value.cargoSnapshot),
    value.containerType,
    value.packingPlanId,
    value.packingPlan ? JSON.stringify(value.packingPlan) : null,
    value.complianceSummary ? JSON.stringify(value.complianceSummary) : null,
    value.contextSnapshot ? JSON.stringify(value.contextSnapshot) : null,
    value.admissionSnapshot ? JSON.stringify(value.admissionSnapshot) : null,
    value.sourceCode,
    value.status
  ];
}

function mapRow(row) {
  return {
    caseId: row.case_id,
    cargoSnapshot: parseJson(row.cargo_snapshot, []),
    containerType: row.container_type,
    packingPlanId: row.packing_plan_id || null,
    packingPlan: parseJson(row.plan_snapshot, null),
    complianceSummary: parseJson(row.compliance_snapshot, null),
    contextSnapshot: parseJson(row.context_snapshot, null),
    admissionSnapshot: parseJson(row.admission_snapshot, null),
    sourceCode: normalizePlanSource(row.source_code),
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function mapCaseSummary(row) {
  return {
    caseId: row.case_id,
    cargoSkuCount: Number(row.cargo_sku_count || 0),
    containerType: row.container_type,
    packingPlanId: row.packing_plan_id || null,
    sourceCode: normalizePlanSource(row.source_code),
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_error) { return fallback; }
}

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function validateCaseId(value) {
  if (!CASE_ID_PATTERN.test(String(value || ''))) throw validationError('caseId 无效');
}

function normalizePlanSource(value) {
  const normalized = String(value || '').trim();
  if (PLAN_SOURCE_CODES.has(normalized)) return normalized;
  return ({ backend: 'BACKEND_SOLVED', 'local-preview': 'LOCAL_PREVIEW', 'offline-demo': 'OFFLINE_DEMO' })[normalized] || 'UNKNOWN';
}

function validationError(message) {
  const error = new Error(message);
  error.code = 'VALIDATION_ERROR';
  return error;
}

async function addColumnIfMissing(db, name, definition) {
  try {
    await db.query(`ALTER TABLE packing_case ADD COLUMN ${name} ${definition}`);
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', '42S21'].includes(error.code) && !/duplicate column/i.test(String(error.message))) throw error;
  }
}

module.exports = { PackingCaseService, normalizeInput, mapRow, mapCaseSummary, normalizePlanSource, STATUSES };
