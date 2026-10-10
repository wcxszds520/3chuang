'use strict';
/**
 * uat_worker.js — 装箱计算工作线程（UAT 并发补丁）
 *
 * 发现（Suite D）：装箱为 CPU 密集同步计算，单线程 Node 下 50 并发中
 * 每个重型订单（212 件）占 ~170ms，10 个重型订单串行化导致 P95 1.8s。
 * 标准解法：worker_threads 池化（接口层架构补丁，引擎代码零改动）。
 */
const { parentPort, workerData } = require('worker_threads');
const path = require('path');

const AlgorithmOrchestrator = require(path.join(__dirname, 'backend/services/AlgorithmOrchestrator'));

const orchestrator = new AlgorithmOrchestrator({
  cache: { get: async () => null, set: async () => {} },
  timeoutMs: 30000,
  debugMode: false
});

parentPort.on('message', async (task) => {
  const { id, cargoList, container, options } = task;
  try {
    const result = await orchestrator.execute({ cargoList, container, options });
    parentPort.postMessage({ id, ok: true, result });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: String(error.message || error) });
  }
});

if (workerData && workerData.warmup) {
  // 预热：JIT 提前编译，避免首个请求承担冷启动
}
