'use strict';
/**
 * uat_worker_pool.js — worker_threads 装箱计算池（UAT 并发补丁，接口层）
 */
const { Worker } = require('worker_threads');
const path = require('path');

class UatWorkerPool {
  constructor({ size = 6 } = {}) {
    this.size = size;
    this.workers = [];
    this.queue = [];
    this.idle = [];
    this.nextId = 1;
    this.pending = new Map();
    for (let i = 0; i < size; i++) this._spawn();
  }

  _spawn() {
    const w = new Worker(path.join(__dirname, 'uat_worker.js'));
    w.on('message', (msg) => {
      const task = this.pending.get(msg.id);
      if (!task) return;
      this.pending.delete(msg.id);
      this.idle.push(w);
      this._drain();
      if (msg.ok) task.resolve(msg.result);
      else task.reject(new Error(msg.error));
    });
    w.on('error', (err) => {
      // 工作线程崩溃：拒绝其当前任务并以新线程替补
      for (const [id, task] of [...this.pending.entries()]) {
        task.reject(new Error('WORKER_CRASH: ' + err.message));
        this.pending.delete(id);
      }
      this.workers = this.workers.filter((x) => x !== w);
      this._spawn();
      this._drain();
    });
    this.workers.push(w);
    this.idle.push(w);
  }

  _drain() {
    while (this.queue.length && this.idle.length) {
      const task = this.queue.shift();
      const w = this.idle.pop();
      this.pending.set(task.id, task);
      w.postMessage(task.message);
    }
  }

  run(cargoList, container, options) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.queue.push({ id, message: { id, cargoList, container, options }, resolve, reject });
      this._drain();
    });
  }

  async warmup(cargoList, container) {
    // 预热所有 worker 的 JIT（小负载）
    await Promise.all(this.workers.map(() => this.run(cargoList.slice(0, 2).map((c) => ({ ...c })), container, { algorithmId: 'realistic4d-multi-strategy', seed: 42 })));
  }
}

module.exports = { UatWorkerPool };
