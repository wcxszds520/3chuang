const express = require('express');
const db = require('../config/database');
const { PackingCaseService } = require('../services/PackingCaseService');

const router = express.Router();
const service = new PackingCaseService(db);

router.post('/', async (req, res, next) => {
  try {
    // Creation never updates a record named by a source/order identifier.
    if (req.body?.caseId) return res.status(409).json({code:'CASE_CREATE_ID_NOT_ALLOWED',message:'创建任务时请省略 caseId；已有任务请使用 PUT 更新',data:null});
    const packingCase = await service.create(req.body);
    res.status(201).success(packingCase, '装箱任务已保存');
  } catch (error) { handle(error, res, next); }
});

router.get('/', async (req, res, next) => {
  try {
    res.success(await service.list(req.query.limit), '装箱任务列表');
  } catch (error) { handle(error, res, next); }
});

router.get('/:caseId', async (req, res, next) => {
  try {
    const packingCase = await service.get(req.params.caseId);
    if (!packingCase) return res.error('装箱任务不存在', 404);
    return res.success(packingCase, '装箱任务读取成功');
  } catch (error) { return handle(error, res, next); }
});

router.put('/:caseId', async (req, res, next) => {
  try {
    const packingCase = await service.update(req.params.caseId, req.body);
    if (!packingCase) return res.error('装箱任务不存在', 404);
    return res.success(packingCase, '装箱任务已更新');
  } catch (error) { return handle(error, res, next); }
});

function handle(error, res, next) {
  if (error.code === 'VALIDATION_ERROR') return res.error(error.message, 400);
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({code:'CASE_ALREADY_EXISTS',message:'任务已存在，未覆盖原记录',data:null});
  return next(error);
}

module.exports = router;
