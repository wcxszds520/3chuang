'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { MultiContainerPlanner } = require('./MultiContainerPlanner');

if (!isMainThread) {
  new MultiContainerPlanner().preview(workerData.task, workerData.options)
    .then(candidates => parentPort.postMessage({ candidates }))
    .catch(error => parentPort.postMessage({ error: { message:error.message, code:error.code, status:error.status } }));
}

// CPU-bound geometry search runs off the API event loop so opening another
// cabinet, checking the version, or reading history remains responsive.
class TaskPlannerWorker {
  async preview(task, options, { signal } = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(Object.assign(new Error('已取消本次候选计算'), {code:'TASK_CANCELLED',status:499}));
      const worker = new Worker(__filename, { workerData:{ task, options } });
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); worker.terminate();
        if (error) reject(error); else resolve(result);
      };
      const timer = setTimeout(() => finish(Object.assign(new Error('本次逐柜搜索超过5分钟，任务数据未改变；可缩小本次柜型或柜数范围后再试'), {code:'TASK_SOLVE_TIMEOUT',status:503})), 300000);
      const cancel = () => finish(Object.assign(new Error('已取消本次候选计算'), {code:'TASK_CANCELLED',status:499}));
      signal?.addEventListener('abort', cancel, {once:true});
      worker.once('message', message => finish(message.error ? Object.assign(new Error(message.error.message), message.error) : null, message.candidates));
      worker.once('error', error => finish(error));
      worker.once('exit', code => { if (!settled) finish(new Error(`柜型求解进程提前结束（${code}）`)); });
    });
  }
}
module.exports = { TaskPlannerWorker };
