import { apiRequest, unwrapApiData } from './apiClient.js';

const ENDPOINTS = Object.freeze({
  summary: '/api/dashboard/summary',
  priorityTask: '/api/dashboard/priority-task',
  queues: '/api/dashboard/queues',
  recentTasks: '/api/dashboard/recent-tasks?limit=8',
  risks: '/api/dashboard/risks',
  portSituation: '/api/dashboard/port-situation'
});

export async function fetchDashboardSnapshot(config = {}) {
  const entries = Object.entries(ENDPOINTS);
  const results = await Promise.allSettled(entries.map(([, endpoint]) => apiRequest(endpoint, {
    signal: config.signal
  }, config).then(unwrapApiData)));
  return Object.fromEntries(results.map((result, index) => {
    const key = entries[index][0];
    return [key, result.status === 'fulfilled'
      ? { data: result.value, error: null }
      : { data: null, error: result.reason }];
  }));
}
