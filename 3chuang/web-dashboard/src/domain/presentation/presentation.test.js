import { describe, expect, it } from 'vitest';
import { createInitialSession } from '../session/initialSession.js';
import { getContainer } from '../container/catalog.js';
import { generateLocalPreview } from '../container/localPreview.js';
import { evaluateLocalCompliance } from '../compliance/evaluate.js';

describe('stage-two presentation model', () => {
  it('uses concise business-language page titles', async () => {
    const copy = await import('./productCopy.js').catch(() => ({}));

    expect(copy.PAGE_COPY).toBeDefined();
    expect(copy.PAGE_COPY).toMatchObject({
      dashboard: { title: '装运决策简报' },
      cargo: { title: '货物数据集编辑器' },
      container: { title: '装载规划' },
      twin: { title: '三维数字孪生' },
      compliance: { title: '出运准备' },
      report: { title: '交付工作区' }
    });
  });

  it('derives activity and todos only from current session evidence', async () => {
    const activity = await import('./activityTimeline.js').catch(() => ({}));
    expect(typeof activity.buildOrderActivity).toBe('function');
    expect(typeof activity.buildOrderTodos).toBe('function');

    const session = createInitialSession();
    const container = getContainer('40HQ');
    const plan = {
      ...generateLocalPreview(session.cargo, container),
      planId: 'REQ_TEST',
      source: 'backend',
      timestamp: '2026-07-10T10:00:00.000Z',
      totalCargoInput: 25,
      totalCargoCount: 20,
      unloadedCargo: Array.from({ length: 5 }, (_, index) => ({ cargoId: `tail-${index}` }))
    };
    session.backendPlan = plan;
    session.aiAudit = { status: 'PASS', score: 96, completedAt: '2026-07-10T10:20:00.000Z' };
    session.manualReview = {
      reviewer: '王宁',
      decision: 'approved-with-conditions',
      note: '补齐木包装 IPPC 标识照片。',
      reviewedAt: '2026-07-10T10:30:00.000Z'
    };
    const localCompliance = evaluateLocalCompliance({
      plan,
      cargoList: session.cargo,
      container,
      vgmSubmitted: session.vgmSubmitted
    });

    const entries = activity.buildOrderActivity({ session, plan, planSource: 'backend', localCompliance });
    expect(entries.map((entry) => entry.key)).toEqual([
      'cargo-ready',
      'backend-plan',
      'ai-audit',
      'manual-review'
    ]);
    expect(entries.find((entry) => entry.key === 'backend-plan')).toMatchObject({ planId: 'REQ_TEST' });

    const todos = activity.buildOrderTodos({ session, plan, planSource: 'backend', localCompliance });
    expect(todos).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'unloaded', count: 5 }),
      expect.objectContaining({ key: 'ippc' })
    ]));
    expect(todos.every((todo) => todo.source !== 'invented')).toBe(true);
  });
});
