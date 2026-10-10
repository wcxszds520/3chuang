import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'docs', 'advanced_optimization');
const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000/api';
const KEYWORDS = [
  'VGM',
  'SOLAS',
  'CTU',
  'LIFO',
  '重心',
  'IPPC',
  '木包装',
  '单证一致性',
  '危险品'
];
const HYBRID_QUERIES = [
  'SOLAS VGM',
  'CTU Code container packing',
  'IPPC wood packaging ISPM 15',
  'container weight distribution center of gravity',
  'container packing dangerous goods',
  '集装箱 装箱 单证 一致性',
  '木包装 IPPC 熏蒸 标识',
  '集装箱 偏载 重心',
  'VGM 申报 误差'
];

fs.mkdirSync(OUT_DIR, { recursive: true });

async function callJson(method, url, body) {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const elapsedMs = Math.round(performance.now() - started);
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { ok: response.ok, status: response.status, elapsedMs, payload };
  } catch (error) {
    return {
      ok: false,
      status: null,
      elapsedMs: Math.round(performance.now() - started),
      error: String(error?.message || error).slice(0, 300)
    };
  }
}

function rowLocal(keyword, call) {
  const results = call.payload?.data?.results || [];
  const top = results[0] || {};
  return {
    keyword,
    passed: call.ok && results.length > 0,
    elapsedMs: call.elapsedMs,
    resultCount: results.length,
    topDoc: top.docId || '',
    topSection: top.section || '',
    topScore: top.score || 0,
    error: call.error || ''
  };
}

function rowHybrid(query, call) {
  const data = call.payload?.data || {};
  const summary = data.source_summary || {};
  return {
    query,
    passed: call.ok && (data.local_results?.length || 0) > 0,
    elapsedMs: call.elapsedMs,
    localCount: data.local_results?.length || 0,
    webCount: data.web_results?.length || 0,
    webAvailable: Boolean(summary.web_available),
    cacheUsed: Boolean(summary.cache_used),
    webSource: summary.web_source || 'none',
    webError: summary.web_error || '',
    credibility: summary.web_credibility || {},
    topWeb: (data.web_results || []).slice(0, 2).map((item) => ({
      title: item.title,
      domain: item.domain,
      credibility: item.credibility,
      url: item.url
    }))
  };
}

const localRows = [];
for (const keyword of KEYWORDS) {
  const call = await callJson('POST', `${BASE_URL}/compliance/search`, { query: keyword, topK: 3 });
  localRows.push(rowLocal(keyword, call));
}

const hybridRows = [];
for (const query of HYBRID_QUERIES) {
  const call = await callJson('POST', `${BASE_URL}/compliance/hybrid-search`, { query, topK: 3, maxResults: 5 });
  hybridRows.push(rowHybrid(query, call));
}

const tavilyConfigured = Boolean(process.env.TAVILY_API_KEY);
const output = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  tavilyConfigured,
  localRows,
  hybridRows,
  summary: {
    localPassed: localRows.filter((row) => row.passed).length,
    localTotal: localRows.length,
    hybridPassed: hybridRows.filter((row) => row.passed).length,
    hybridTotal: hybridRows.length,
    hybridWithWebRefs: hybridRows.filter((row) => row.webCount > 0).length,
    cacheUsedRows: hybridRows.filter((row) => row.cacheUsed).length,
    tavilyConfigured
  }
};

function md(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

const lines = [];
lines.push('# Web RAG Enhancement Report');
lines.push('');
lines.push(`生成时间：${output.generatedAt}`);
lines.push('');
lines.push('## 结论');
lines.push('');
lines.push(`- 是否接入 Tavily：${tavilyConfigured ? '是' : '否，当前环境未配置 TAVILY_API_KEY。'}`);
lines.push(`- 本地 RAG：${output.summary.localPassed}/${output.summary.localTotal} 关键词通过。`);
lines.push(`- Hybrid RAG：${output.summary.hybridPassed}/${output.summary.hybridTotal} 查询返回本地证据。`);
lines.push(`- 联网/缓存参考：${output.summary.hybridWithWebRefs}/${output.summary.hybridTotal} 查询返回公开网页参考；${output.summary.cacheUsedRows} 条使用缓存快照。`);
lines.push('- 边界说明：本地法规证据库是主证据；公开网页参考用于补充展示；缓存快照不等同实时联网检索。');
lines.push('');
lines.push('## 本地 RAG 关键词检查');
lines.push('');
lines.push('| 关键词 | 结果 | 命中文档 | 命中章节 | 分数 |');
lines.push('| --- | --- | --- | --- | ---: |');
for (const row of localRows) {
  lines.push(`| ${md(row.keyword)} | ${row.passed ? 'PASS' : 'FAIL'} | ${md(row.topDoc)} | ${md(row.topSection)} | ${row.topScore} |`);
}
lines.push('');
lines.push('## Hybrid RAG 检查');
lines.push('');
lines.push('| Query | 本地结果 | 公开网页参考 | 缓存 | 来源 | Top Web Sources |');
lines.push('| --- | ---: | ---: | --- | --- | --- |');
for (const row of hybridRows) {
  const top = row.topWeb.map((item) => `${item.domain}(${item.credibility})`).join(', ') || row.webError || '-';
  lines.push(`| ${md(row.query)} | ${row.localCount} | ${row.webCount} | ${row.cacheUsed ? 'cache_used' : '-'} | ${md(row.webSource)} | ${md(top)} |`);
}
lines.push('');
lines.push('## 前端展示要求');
lines.push('');
lines.push('- 合规页必须显示“本地法规证据库”和“联网参考/缓存快照”的分层。');
lines.push('- 无 Tavily key 时，不得写实时联网国标检索。');
lines.push('- 报告和讲解词可以说：公开网页参考已缓存，用于录屏稳定。');
lines.push('');
lines.push('## 最终话术建议');
lines.push('');
lines.push('本系统先用本地法规证据库做稳定可追溯的主证据，再用公开网页缓存作为补充参考；如果现场网络或 Tavily key 不可用，系统仍能明确显示本地证据，不会假装联网成功。');
lines.push('');

fs.writeFileSync(path.join(OUT_DIR, 'rag-check-results.json'), JSON.stringify(output, null, 2), 'utf-8');
fs.writeFileSync(path.join(OUT_DIR, 'WEB_RAG_ENHANCEMENT_REPORT.md'), lines.join('\n'), 'utf-8');

console.log(JSON.stringify(output.summary, null, 2));
