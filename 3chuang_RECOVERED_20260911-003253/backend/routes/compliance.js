/**
 * Compliance Regulation Route - 港口法规知识库 API
 *
 * 暴露 RAG 知识库的查询能力, 供前端 "法规溯源" 功能:
 *   GET  /api/compliance/regulations        — 列出知识库所有法规
 *   GET  /api/compliance/regulation/:docId  — 获取某法规完整结构 (详情弹窗)
 *   POST /api/compliance/search             — 语义检索相关条款
 *
 * 页面展示本地法规摘编、页码和参考条款，不宣称为完整官方原文。
 * 检索结果用于证据定位，不替代确定性规则与人工审核。
 */

const express = require('express');
const router = express.Router();
const regulationRAG = require('../services/RegulationRAGService');
const webRAG = require('../services/WebRAGService');

function expandLocalRegulationQuery(query) {
  const additions = [];
  if (/dangerous goods/i.test(query)) additions.push('危险品 装箱 标志 混装禁忌');
  if (/wood packaging|ISPM\s*15/i.test(query)) additions.push('木包装 IPPC 熏蒸 标识');
  if (/center of gravity|weight distribution/i.test(query)) additions.push('重心 偏载 重量分布');
  if (/shipping documents|packing list|consistency/i.test(query)) additions.push('单证一致性 装箱清单 品名 件数 重量');
  if (/container packing/i.test(query)) additions.push('集装箱 装箱 货物固定 衬垫');
  return [query, ...additions].join(' ');
}

/**
 * GET /api/compliance/regulations
 * 列出知识库中所有法规文档 (供前端展示知识库规模)
 */
router.get('/regulations', (req, res) => {
  try {
    const docs = regulationRAG.listDocuments();
    res.json({
      code: 200,
      message: 'Regulation knowledge base',
      data: {
        count: docs.length,
        totalSections: regulationRAG.corpus.length,
        method: 'TF-IDF cosine similarity (lightweight RAG)',
        documents: docs
      }
    });
  } catch (error) {
    console.error('[RegulationRoute] list error:', error.message);
    res.status(500).json({ code: 500, message: 'Failed to list regulations', data: null });
  }
});

/**
 * GET /api/compliance/regulation/:docId
 * 获取某法规的完整结构化内容 (供详情弹窗展示)
 */
router.get('/regulation/:docId', (req, res) => {
  try {
    const { docId } = req.params;
    const doc = regulationRAG.getDocument(docId);
    if (!doc) {
      return res.status(404).json({
        code: 404,
        message: `Regulation ${docId} not found`,
        data: null
      });
    }
    res.json({
      code: 200,
      message: 'Regulation detail',
      data: doc
    });
  } catch (error) {
    console.error('[RegulationRoute] detail error:', error.message);
    res.status(500).json({ code: 500, message: 'Failed to get regulation', data: null });
  }
});

/**
 * POST /api/compliance/search
 * 语义检索: 给定维度/查询, 返回最相关的法规条款
 * body: { query: "物理重心 偏移", topK?: 3 }
 */
router.post('/search', (req, res) => {
  try {
    const { query, topK = 3 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        code: 400,
        message: 'query is required',
        data: null
      });
    }
    const results = regulationRAG.search(expandLocalRegulationQuery(query), Number(topK));
    res.json({
      code: 200,
      message: 'RAG search result',
      data: {
        query,
        method: 'TF-IDF cosine similarity',
        results: results.map((r) => ({
          docId: r.doc.docId,
          docTitle: r.doc.docTitle,
          issuer: r.doc.issuer,
          section: `${r.doc.sectionId} ${r.doc.sectionTitle}`,
          snippet: r.doc.content,
          tags: r.doc.tags,
          score: Number(r.score.toFixed(3))
        }))
      }
    });
  } catch (error) {
    console.error('[RegulationRoute] search error:', error.message);
    res.status(500).json({ code: 500, message: 'Failed to search regulations', data: null });
  }
});

/**
 * POST /api/compliance/web-search
 * 联网法规参考: 返回公开网页参考或真实不可用状态。
 */
router.post('/web-search', async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        code: 400,
        message: 'query is required',
        data: null
      });
    }
    const result = await webRAG.search(query, { maxResults });
    res.json({
      code: 200,
      message: result.web_available ? 'Web RAG reference result' : 'Web RAG unavailable',
      data: result
    });
  } catch (error) {
    console.error('[RegulationRoute] web-search error:', error.message);
    res.status(500).json({ code: 500, message: 'Failed to search web references', data: null });
  }
});

/**
 * POST /api/compliance/hybrid-search
 * 本地法规库 + 联网参考。联网失败不影响本地 RAG。
 */
router.post('/hybrid-search', async (req, res) => {
  try {
    const { query, topK = 3, maxResults = 5 } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        code: 400,
        message: 'query is required',
        data: null
      });
    }

    const localRaw = regulationRAG.search(expandLocalRegulationQuery(query), Number(topK));
    const localResults = localRaw.map((r) => ({
      docId: r.doc.docId,
      docTitle: r.doc.docTitle,
      issuer: r.doc.issuer,
      section: `${r.doc.sectionId} ${r.doc.sectionTitle}`,
      snippet: r.doc.content,
      tags: r.doc.tags,
      score: Number(r.score.toFixed(3)),
      source_type: 'local_regulation_library'
    }));
    const web = await webRAG.search(query, { maxResults });

    res.json({
      code: 200,
      message: 'Hybrid RAG search result',
      data: {
        query,
        method: 'local TF-IDF RAG + optional public web reference',
        local_results: localResults,
        web_results: web.results || [],
        merged_results: [
          ...localResults.map((item) => ({ ...item, mergedSource: 'local' })),
          ...(web.results || []).map((item) => ({ ...item, mergedSource: web.cache_used ? 'web_cache' : 'web' }))
        ],
        source_summary: {
          local_count: localResults.length,
          web_count: web.results?.length || 0,
          web_available: web.web_available,
          cache_used: web.cache_used,
          web_source: web.source,
          web_error: web.errorCode || null,
          web_message: web.message || null,
          web_credibility: web.source_summary || {}
        }
      }
    });
  } catch (error) {
    console.error('[RegulationRoute] hybrid-search error:', error.message);
    res.status(500).json({ code: 500, message: 'Failed to search hybrid RAG', data: null });
  }
});

module.exports = router;
