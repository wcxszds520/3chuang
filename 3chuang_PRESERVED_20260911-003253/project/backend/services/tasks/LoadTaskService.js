'use strict';

const { createTask, appendRows, clone, id, fail, assertConservation, assertLocks } = require('./LoadTaskModel');
const { TaskPlannerWorker } = require('./TaskPlannerWorker');
const { recordTaskEvidence } = require('./TaskEvidence');

class LoadTaskService {
  constructor(db, planner = new TaskPlannerWorker()) { this.db = db; this.planner = planner; this.ready = null; }
  async schema() {
    if (!this.ready) this.ready = (async () => {
      await this.db.query(`CREATE TABLE IF NOT EXISTS load_task (
        task_id VARCHAR(80) PRIMARY KEY, revision INT NOT NULL, snapshot JSON NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await this.db.query(`CREATE TABLE IF NOT EXISTS load_task_version (
        task_id VARCHAR(80) NOT NULL, revision INT NOT NULL, snapshot JSON NOT NULL, action JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(task_id, revision)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await this.db.query(`CREATE TABLE IF NOT EXISTS load_task_preview (
        preview_id VARCHAR(80) PRIMARY KEY, task_id VARCHAR(80) NOT NULL, base_revision INT NOT NULL,
        snapshot JSON NOT NULL, applied_revision INT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(task_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch(error => { this.ready = null; throw error; });
    return this.ready;
  }
  async create(input) {
    await this.schema();
    const task = createTask(input);
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('INSERT INTO load_task(task_id, revision, snapshot) VALUES (?, ?, ?)', [task.taskId, task.revision, JSON.stringify(task)]);
      await connection.query('INSERT INTO load_task_version(task_id, revision, snapshot, action) VALUES (?, ?, ?, ?)', [task.taskId, task.revision, JSON.stringify(task), JSON.stringify({ type: 'CREATE', source: input.source || 'USER_INPUT' })]);
      await connection.commit(); return task;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }
  async get(taskId, revision) {
    await this.schema();
    const [rows] = revision == null
      ? await this.db.query('SELECT snapshot FROM load_task WHERE task_id=?', [taskId])
      : await this.db.query('SELECT snapshot FROM load_task_version WHERE task_id=? AND revision=?', [taskId, revision]);
    if (!rows[0]) fail('装载任务或版本不存在', 'TASK_NOT_FOUND', 404);
    return decode(rows[0].snapshot);
  }
  async list() {
    await this.schema();
    // MySQL may reserve the full JSON value when filesorting an expression
    // derived from snapshot. Sort small metadata first, then read only names.
    const [rows] = await this.db.query('SELECT task_id, revision, updated_at FROM load_task ORDER BY updated_at DESC, task_id LIMIT 50');
    if (!rows.length) return [];
    const [names] = await this.db.query(`SELECT task_id, JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.name')) AS name FROM load_task WHERE task_id IN (${rows.map(() => '?').join(',')})`, rows.map(row => row.task_id));
    const byId = new Map(names.map(row => [row.task_id, row.name]));
    return rows.map(row => ({ taskId: row.task_id, revision: row.revision, name: byId.get(row.task_id), updatedAt: row.updated_at }));
  }
  async history(taskId) {
    await this.schema();
    const [rows] = await this.db.query('SELECT revision, action, created_at FROM load_task_version WHERE task_id=? ORDER BY revision DESC', [taskId]);
    return rows.map(row => ({ revision: row.revision, action: decode(row.action), createdAt: row.created_at }));
  }
  async preview(taskId, input = {}, { signal } = {}) {
    if(input.append&&input.rowChanges)fail('追加客户与修改原货物需分别生成候选');
    const current = await this.get(taskId);
    checkRevision(current, input.baseRevision);
    const task = input.append ? appendRows(current, input.append) : current;
    const candidates = await this.planner.preview(task, input, { signal });
    const fresh = await this.get(taskId);
    checkRevision(fresh, input.baseRevision);
    const result = { previewId: id('PREVIEW'), taskId, baseRevision: current.revision, createdAt: new Date().toISOString(),
      inputChange: input.rowChanges ? {type:'ROW_EDIT',rowIds:input.rowChanges.map(row=>row.rowId),changedRows:input.rowChanges.length} : input.append ? {type:'APPEND', customerName: input.append.customerName, orderReference: input.append.orderReference, addedUnits: task.units.length - current.units.length } : null,
      candidates };
    await this.db.query('INSERT INTO load_task_preview(preview_id, task_id, base_revision, snapshot) VALUES (?, ?, ?, ?)', [result.previewId, taskId, current.revision, JSON.stringify(result)]);
    return result;
  }
  async apply(taskId, input = {}) {
    if (!input.previewId || !input.candidateId) fail('请选择已生成的候选方案');
    return this.mutate(taskId, input.baseRevision, async (current, connection) => {
      const [rows] = await connection.query('SELECT snapshot, applied_revision FROM load_task_preview WHERE preview_id=? AND task_id=? FOR UPDATE', [input.previewId, taskId]);
      if (!rows[0]) fail('候选预览不存在', 'TASK_PREVIEW_NOT_FOUND', 404);
      if (rows[0].applied_revision != null) fail('该预览已经应用，请读取最新任务', 'TASK_PREVIEW_APPLIED', 409);
      const preview = decode(rows[0].snapshot);
      checkRevision(current, preview.baseRevision);
      const candidate = preview.candidates.find(c => c.candidateId === input.candidateId);
      if (!candidate) fail('候选方案不属于本次预览');
      const next = clone(candidate.task);
      assertLocks(current, next); assertConservation(next);
      await connection.query('UPDATE load_task_preview SET applied_revision=? WHERE preview_id=?', [current.revision + 1, input.previewId]);
      return { next, action: { type: preview.inputChange?.type==='ROW_EDIT'?'EDIT_ROWS_AND_APPLY':preview.inputChange ? 'APPEND_AND_APPLY' : 'APPLY_PLAN', candidateId: candidate.candidateId, label: candidate.label,
        previewId: input.previewId, inputChange: preview.inputChange, impacts: candidate.impacts } };
    });
  }
  async transition(taskId, input = {}) {
    return this.mutate(taskId, input.baseRevision, async current => {
      const next = clone(current);
      const container = next.containers.find(c => c.containerId === input.containerId);
      if (!container) fail('柜不存在', 'TASK_CONTAINER_NOT_FOUND', 404);
      if (container.status === 'SEALED') fail('已封柜不能修改', 'TASK_LOCKED', 409);
      const before = container.status;
      if (input.status === 'CONFIRMED' && before === 'DRAFT') container.status = 'CONFIRMED';
      else if (input.status === 'DRAFT' && before === 'CONFIRMED' && !container.lockedUnitIds.length) container.status = 'DRAFT';
      else if (input.status === 'LOADED_LOCKED' && ['CONFIRMED', 'LOADED_LOCKED'].includes(before)) {
        if (!Array.isArray(input.unitIds) || !input.unitIds.length) fail('请选择已记录装入的实物件');
        const assigned = new Set(container.plan.loadedCargo.map(p => p.cargoId));
        if (input.unitIds.some(unitId => !assigned.has(unitId))) fail('不能锁定不属于该柜的货物');
        container.lockedUnitIds = [...new Set([...container.lockedUnitIds, ...input.unitIds])]; container.status = 'LOADED_LOCKED';
      } else if (input.status === 'SEALED' && before === 'LOADED_LOCKED') {
        if (container.lockedUnitIds.length !== container.plan.loadedCargo.length) fail('尚有未记录装入的货物，不能封柜');
        container.status = 'SEALED';
      } else fail('柜状态转换无效');
      container.executionEvidence = [...(container.executionEvidence || []), { eventId: id('EXECUTION'), status: container.status,
        unitIds: input.unitIds || [], at: new Date().toISOString(), source: 'LOCAL_OPERATOR_RECORD', note: String(input.note || '') }];
      return { next, action: { type: 'CONTAINER_STATE', containerId: container.containerId, before, after: container.status, unitIds: input.unitIds || [] } };
    });
  }
  async recordEvidence(taskId,input={}) {
    return this.mutate(taskId,input.baseRevision,async current=>({next:recordTaskEvidence(current,input),
      action:{type:'EVIDENCE_RECORD',scope:input.scope,objectId:input.objectId}}));
  }
  async mutate(taskId, baseRevision, update) {
    await this.schema();
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT snapshot FROM load_task WHERE task_id=? FOR UPDATE', [taskId]);
      if (!rows[0]) fail('装载任务不存在', 'TASK_NOT_FOUND', 404);
      const current = decode(rows[0].snapshot); checkRevision(current, baseRevision);
      const { next, action } = await update(current, connection);
      assertConservation(next); assertLocks(current, next);
      next.revision = current.revision + 1; next.updatedAt = new Date().toISOString();
      const serialized = JSON.stringify(next);
      const [result] = await connection.query('UPDATE load_task SET revision=?, snapshot=? WHERE task_id=? AND revision=?', [next.revision, serialized, taskId, current.revision]);
      if (result.affectedRows !== 1) fail('任务版本已变化，请刷新后重新预览', 'TASK_VERSION_CONFLICT', 409);
      await connection.query('INSERT INTO load_task_version(task_id, revision, snapshot, action) VALUES (?, ?, ?, ?)', [taskId, next.revision, serialized, JSON.stringify(action)]);
      await connection.commit(); return next;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }
}
function decode(value) { return typeof value === 'string' ? JSON.parse(value) : value; }
function checkRevision(task, expected) { if (task.revision !== Number(expected)) fail(`任务已是版本 ${task.revision}，请刷新并重新预览`, 'TASK_VERSION_CONFLICT', 409); }
module.exports = { LoadTaskService, checkRevision };
