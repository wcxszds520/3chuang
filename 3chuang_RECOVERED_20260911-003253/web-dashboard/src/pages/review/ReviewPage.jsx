import { useEffect, useState } from 'react';
import { ArrowRight, Download, ArrowLeft, Check, CircleAlert } from 'lucide-react';
import { useSession } from '../../app/session/SessionProvider.jsx';
import { ROUTES } from '../../app/router.js';
import { apiRequest, unwrapApiData } from '../../services/apiClient.js';
import { buildReviewEvidence, currentReviewState } from '../../domain/plan/reviewEvidence.js';
import RuntimeStatus from '../../components/common/RuntimeStatus.jsx';
import './review.css';

const STEPS = [
  ['确认输入', '在货物页检查演示货单、包装尺寸与搬运限制。已有工作区会保留。', ROUTES.cargo, '查看货物'],
  ['生成并比较', '在规划页生成推荐方案，查看三种策略的实际结果；相同结果会明确说明。', ROUTES.strategy, '进入规划'],
  ['制造一次真实变更', '演示货单生成方案后，在货物页点击“木箱宽度 +100 mm”。检查旧方案是否失效，再返回规划重排。', ROUTES.cargo, '验证变更'],
  ['解释结果与边界', '到孪生页查看新旧货位、单件信息和模拟作业，再到出运准备查看待补证据。', ROUTES.twin, '检查孪生']
];

export default function ReviewPage({ navigate }) {
  const { session } = useSession();
  const state = currentReviewState(session);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    document.title = '作品导览与验证 · PORTCUBE';
    const controller = new AbortController();
    fetch('/review-evidence/manifest.json', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Evidence unavailable'); return response.json(); })
      .then(setHistory).catch(() => { if (!controller.signal.aborted) setHistoryError(true); });
    return () => controller.abort();
  }, []);

  const exportEvidence = async () => {
    setExporting(true); setMessage('正在读取运行状态并生成快照…');
    const capturedAt = new Date().toISOString();
    const snapshot = structuredClone(session);
    try {
      let capabilities;
      try { capabilities = { ...unwrapApiData(await apiRequest('/api/capabilities', {}, { timeoutMs: 4000 })), checkedAt: new Date().toISOString() }; }
      catch { capabilities = { unavailable: true, checkedAt: new Date().toISOString() }; }
      const evidence = await buildReviewEvidence(snapshot, capabilities, capturedAt);
      const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `PORTCUBE-evidence-${capturedAt.replace(/[:.]/g, '-')}.json`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`已导出${evidence.state === 'CURRENT' ? '当前方案' : evidence.state === 'STALE' ? '输入已变化的待重排' : '尚未正式求解的预览'}快照，包含输入、版本记录及 SHA-256 校验值。`);
    } catch { setMessage('导出失败，未生成证据文件。请在本机 localhost 或 HTTPS 环境重试。'); }
    finally { setExporting(false); }
  };

  return <div className="review-page">
    <header className="review-nav"><button type="button" onClick={() => navigate(ROUTES.landing)}><ArrowLeft size={16} />返回首页</button><strong>智港立方 <span>PORTCUBE</span></strong><button type="button" onClick={() => navigate(ROUTES.overview)}>进入工作台<ArrowRight size={16} /></button></header>
    <main>
      <section className="review-intro"><span className="review-kicker">作品导览 / 可复现验证</span><h1>一次货物变更，<br />如何成为一份可信的新方案。</h1><p>面向货代、仓库与装载计划人员。把输入约束、装载求解、三维复核和出运证据连接起来，让每个判断都能回到同一票、同一版本。</p><div className="review-tags"><span>Web 应用</span><span>集装箱装载决策</span><span>演示与现场事实分开记录</span></div></section>
      <RuntimeStatus />
      <section className="review-section"><div className="review-section-title"><span>01 / 验证路径</span><h2>先操作，再判断</h2><p>约 4–6 分钟的建议演示路径，时间不是赛事限时要求。以下按钮只导航，不清空或替换当前货单。</p></div><ol className="review-steps">{STEPS.map(([title, text, route, action], index) => <li key={title}><span className="review-step-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p><button type="button" onClick={() => navigate(route)}>{action}<ArrowRight size={16} /></button></li>)}</ol><button className="review-text-link" type="button" onClick={() => navigate(ROUTES.evidence)}>最后核对出运准备中的事实、规则来源与责任动作<ArrowRight size={16} /></button></section>
      <section className="review-section review-contributions"><div className="review-section-title"><span>02 / 设计贡献</span><h2>需要被验证的三项设计</h2><p>这是作品技术主张。学生原创归属、第三方复用和 AI 辅助范围仍需团队提供过程记录。</p></div><div className="review-claims">
        <article><h3>输入变化不会沿用旧结论</h3><p>输入身份贯穿请求、结果与证据。改变尺寸或约束后，旧方案进入历史记录；重排完成才恢复当前判断。</p><small>验证点：变更后“出运准备”不展示旧版通过结果。</small></article>
        <article><h3>局部修复与全量重排有明确边界</h3><p>优先保留可用货位，再按校核结果决定是否回退。新旧版本记录位置、方向和输入变化。</p><small>验证点：检查实际修复方式及货物差异；不承诺每次都局部成功。</small></article>
        <article><h3>计算、模拟与现场事实分别表达</h3><p>三维画面沿用方案坐标；作业动画用于模拟验证。缺少现场记录或外部证据时，状态保持未知或待补。</p><small>验证点：播放结束不自动宣布真实装箱完成。</small></article>
      </div></section>
      <section className="review-section review-live" aria-label="当前方案验证快照"><div className="review-section-title"><span>03 / 当前工作区</span><h2>{state.current ? '当前方案可供核对' : state.status === 'STALE' ? '输入已变化，需要重新规划' : '当前只有预览，尚无正式方案'}</h2><p>导出包含本票输入、历史方案与证据，分享前请检查业务信息。校验值用于比对文件，不构成签名认证或出运许可。</p></div><dl><div><dt>输入件数</dt><dd>{session.cargo.reduce((sum, cargo) => sum + Number(cargo.quantity || 0), 0)}</dd></div><div><dt>当前方案</dt><dd>{state.plan?.planId || '未生成'}</dd></div><div><dt>历史版本</dt><dd>{session.planRevisions?.length || 0} 版</dd></div><div><dt>数据性质</dt><dd>{session.dataClassification === 'DEMO_DATA' ? '演示数据' : '以本票来源为准'}</dd></div></dl><button className="review-primary" type="button" disabled={exporting} onClick={exportEvidence}><Download size={17} />{exporting ? '正在生成快照' : '导出当前验证快照'}</button><p role="status" className="review-export-status">{message}</p></section>
      <section className="review-section"><div className="review-section-title"><span>04 / 留存证据</span><h2>已完成的验证与未完成的部分</h2><p>以下为 2026-09-26 重构验收留下的历史证据，不代表之后所有代码版本都已通过同样测试。</p></div>{history ? <div className="review-proof-list">{history.checks.map(check => <article key={check.id}><Check size={18} /><div><h3>{check.title}</h3><p>{check.result}</p><small>{check.scope}</small></div><a href={`/review-evidence/${check.file}`} download>下载记录</a></article>)}</div> : <p role="status">{historyError ? '历史证据暂不可读取，请先检查服务；此处不显示通过结论。' : '正在读取历史证据…'}</p>}
        <div className="review-limits"><CircleAlert size={20} /><div><h3>答辩时需要说明的边界</h3><p>数据库写入、真实 AI 调用、码头受理和现场装箱应分别举证。当前演示不提供商业降本比例、客户实测效果或算法全局最优保证。全部模型资产的授权、学生贡献与参赛资格仍待团队核实。</p><p>使用 React、Three.js 等第三方基础组件；AI 辅助开发需要如实披露，不能等同于学生已独立完成全部代码。</p></div></div>
      </section>
      <footer className="review-footer"><span>CMIT 2026 · 建议类别：自主选题 / 移动与网络应用开发</span><a href="https://www.cmit.cn/html/tongzhigonggao/show-144-45826-1.html" target="_blank" rel="noreferrer">9 月 24 日官方通知与附件 ↗</a></footer>
    </main>
  </div>;
}
