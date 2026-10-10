const express = require('express');
const db = require('../config/database');
const { PackingCaseService } = require('../services/PackingCaseService');

const router = express.Router();
const service = new PackingCaseService(db);

router.post('/', async (req, res, next) => {
  try {
    const packingCase = req.body?.caseId
      ? await service.upsert(req.body)
      : await service.create(req.body);
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
  return next(error);
}

module.exports = router;
