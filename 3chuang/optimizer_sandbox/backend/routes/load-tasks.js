'use strict';
const express = require('express');
const { LoadTaskService } = require('../services/tasks/LoadTaskService');
const { readTaskContext } = require('../services/tasks/TaskContext');
const { answerTask } = require('../services/tasks/TaskAssistant');
const service = new LoadTaskService(require('../config/database'));
const router = express.Router();
const handle = fn => async (req, res, next) => {
  try { res.success(await fn(req)); }
  catch (error) { if (error.status) res.status(error.status).json({ code: error.status, errorCode: error.code, message: error.message }); else next(error); }
};
router.get('/', handle(() => service.list()));
router.post('/', handle(req => service.create(req.body)));
router.get('/:taskId', handle(req => service.get(req.params.taskId, req.query.revision)));
router.get('/:taskId/history', handle(req => service.history(req.params.taskId)));
router.post('/:taskId/preview', async (req, res, next) => {
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try { const result = await service.preview(req.params.taskId, req.body, {signal:controller.signal}); if (!controller.signal.aborted) res.success(result); }
  catch (error) { if (controller.signal.aborted) return; if (error.status) res.status(error.status).json({code:error.status,errorCode:error.code,message:error.message}); else next(error); }
});
router.post('/:taskId/apply', handle(req => service.apply(req.params.taskId, req.body)));
router.post('/:taskId/state', handle(req => service.transition(req.params.taskId, req.body)));
router.post('/:taskId/evidence', handle(req => service.recordEvidence(req.params.taskId, req.body)));
router.post('/:taskId/context', handle(req => readTaskContext(service,req.params.taskId,req.body)));
router.post('/:taskId/assistant', async (req,res,next) => {
  const controller=new AbortController();
  res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  try {const answer=await answerTask(service,req.params.taskId,req.body||{},controller.signal);if(!controller.signal.aborted)res.success(answer);}
  catch(error){if(controller.signal.aborted)return;if(error.status)res.status(error.status).json({code:error.status,errorCode:error.code,message:error.message});
    else if(error.isAxiosError)res.status(503).json({code:503,message:'真实模型暂时不可用，请重试或查看事实与证据。'});else next(error);}
});
module.exports = router;
