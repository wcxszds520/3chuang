/**
 * Regulation RAG Service - 港口法规向量知识库检索增强
 *
 * 架构: 轻量级语义检索 RAG (Retrieval-Augmented Generation)
 *   - 法规文档按章节预切片 (backend/data/regulations/*.json)
 *   - 检索基于 TF-IDF 余弦相似度 (零外部依赖, 演示 100% 稳定)
 *   - 给每条合规判定返回可溯源的法规 evidence (docId/section/snippet/score)
 *
 * 对答辩的意义:
 *   传统合规系统把规则硬编码在 prompt 里。本服务构建了可检索的港口法规
 *   向量知识库, AI 审计时语义检索最相关的国标条款, 每条判定都能溯源到
 *   具体章节 — 这是 RAG (检索增强生成) 在企业合规场景的落地。
 */

const fs = require('fs');
const path = require('path');

const REGULATIONS_DIR = path.join(__dirname, '..', 'data', 'regulations');

// 合规维度 → 检索关键词的映射 (用于精准召回)
// 这不是硬编码判定, 而是"该维度该查哪部法规的哪个方向"
const DIMENSION_QUERY_MAP = {
  'VGM重量验证': 'VGM 重量验证 误差 强制 装船',
  '载重与限值': '载重 MAX GROSS 重量 60/50 集重',
  '物理重心与装载': '重心 重量分布 横向偏移 纵向偏移',
  '单证一致性': '单证 品名 件数 重量 体积 记录',
  '危险品/敏感品合规': '危险品 UN38.3 MSDS 锂电池 装箱 资质',
  '货物混装相容性': '混装禁忌 食品 化工 液体 电子 危险品',
  '木质包装 IPPC': '木质包装 IPPC 熏蒸 木箱 木托盘',
  '堆叠/顶部补位': '堆码 下重上轻 易碎 堆叠 承载',
  '装载顺序': 'LIFO 装载顺序 可达性 卸货 多港口',
  '货物固定': '固定 衬垫 绑扎 移位 部分'
};

class RegulationRAGService {
  constructor() {
    this.corpus = [];        // 扁平化的可检索段落 [{docId, docTitle, sectionId, sectionTitle, content, tags, issuer}]
    this.vocabulary = new Map(); // 词 → 文档频率 df
    this.docVectors = [];    // 每个段落的 TF-IDF 向量
    this.loaded = false;
  }

  /**
   * 加载并索引所有法规文档 (启动时一次性加载)
   */
  load() {
    if (this.loaded) return;
    const files = fs.readdirSync(REGULATIONS_DIR).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const doc = JSON.parse(fs.readFileSync(path.join(REGULATIONS_DIR, file), 'utf-8'));
      for (const section of doc.sections || []) {
        this.corpus.push({
          docId: doc.docId,
          docTitle: doc.title,
          issuer: doc.issuer,
          effectiveDate: doc.effectiveDate,
          source: doc.source,
          scope: doc.scope,
          sectionId: section.sectionId,
          sectionTitle: section.title,
          content: section.content,
          tags: section.tags || []
        });
      }
    }

    this._buildIndex();
    this.loaded = true;
    console.log(`[RegulationRAGService] Loaded ${this.corpus.length} regulation sections from ${files.length} documents`);
  }

  /**
   * 中文分词 (简易: 按标点/空格切 + 字符级 bi-gram, 无需外部分词库)
   */
  _tokenize(text) {
    if (!text) return [];
    const cleaned = String(text).replace(/[,。;:、,!!??"''《》()（）\[\]【】\s]+/g, ' ');
    const tokens = [];
    // 英文/数字整词
    const alphaNum = cleaned.match(/[A-Za-z0-9]+/g) || [];
    tokens.push(...alphaNum.map((t) => t.toLowerCase()));
    // 中文 bi-gram (2-gram, 适合短文本相似度)
    const cn = cleaned.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const seg of cn) {
      for (let i = 0; i < seg.length - 1; i += 1) {
        tokens.push(seg.substring(i, i + 2));
      }
      if (seg.length === 1) tokens.push(seg);
    }
    return tokens;
  }

  /**
   * 构建 TF-IDF 索引
   */
  _buildIndex() {
    const docCount = this.corpus.length;
    if (docCount === 0) return;

    // 1. 统计每个 token 的文档频率 (df)
    const df = new Map();
    for (const doc of this.corpus) {
      const tokens = new Set(this._tokenize(`${doc.docId} ${doc.docTitle} ${doc.issuer} ${doc.source || ''} ${doc.scope || ''} ${doc.sectionTitle} ${doc.content} ${doc.tags.join(' ')}`));
      for (const t of tokens) {
        df.set(t, (df.get(t) || 0) + 1);
      }
    }
    this.vocabulary = df;

    // 2. 计算每个段落的 TF-IDF 向量
    this.docVectors = this.corpus.map((doc) => {
      const tokens = this._tokenize(`${doc.docId} ${doc.docTitle} ${doc.issuer} ${doc.source || ''} ${doc.scope || ''} ${doc.sectionTitle} ${doc.content} ${doc.tags.join(' ')}`);
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

      const vector = new Map();
      for (const [t, freq] of tf.entries()) {
        const idf = Math.log((docCount + 1) / (df.get(t) || 1));
        vector.set(t, (freq / tokens.length) * idf);
      }
      return vector;
    });
  }

  /**
   * 余弦相似度
   */
  _cosine(vecA, vecB) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const [t, a] of vecA.entries()) {
      normA += a * a;
      const b = vecB.get(t);
      if (b) dot += a * b;
    }
    for (const b of vecB.values()) normB += b * b;
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 把 query 转成 TF-IDF 向量 (复用已有 vocabulary)
   */
  _queryToVector(query) {
    const tokens = this._tokenize(query);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    const docCount = this.corpus.length;
    const vector = new Map();
    for (const [t, freq] of tf.entries()) {
      const idf = Math.log((docCount + 1) / (this.vocabulary.get(t) || 1));
      vector.set(t, (freq / tokens.length) * idf);
    }
    return vector;
  }

  /**
   * 检索: 返回与 query 最相关的 Top-K 法规段落
   */
  search(query, topK = 3) {
    if (!this.loaded) this.load();
    if (this.corpus.length === 0) return [];

    const queryVec = this._queryToVector(query);
    const scored = this.docVectors.map((docVec, idx) => ({
      doc: this.corpus[idx],
      score: this._cosine(queryVec, docVec)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter((s) => s.score > 0);
  }

  /**
   * 为指定合规维度生成 evidence (法规出处)
   * @param {string} dimension - 合规维度名 (如 "物理重心与装载")
   * @returns {Object|null} evidence 对象 {docId, title, section, snippet, score}
   */
  getEvidenceForDimension(dimension) {
    const query = DIMENSION_QUERY_MAP[dimension] || dimension;
    const results = this.search(query, 1);
    if (results.length === 0) return null;
    const top = results[0];
    return {
      docId: top.doc.docId,
      title: top.doc.docTitle,
      issuer: top.doc.issuer,
      section: `${top.doc.sectionId} ${top.doc.sectionTitle}`,
      snippet: top.doc.content,
      score: Number(top.score.toFixed(3)),
      fullDocAvailable: true
    };
  }

  /**
   * 获取法规文档完整结构 (供详情弹窗展示)
   */
  getDocument(docId) {
    if (!this.loaded) this.load();
    const doc = this.corpus.find((c) => c.docId === docId);
    if (!doc) return null;
    const sections = this.corpus
      .filter((c) => c.docId === docId)
      .map((c) => ({
        sectionId: c.sectionId,
        sectionTitle: c.sectionTitle,
        content: c.content,
        tags: c.tags
      }));
    return {
      docId: doc.docId,
      title: doc.docTitle,
      issuer: doc.issuer,
      effectiveDate: doc.effectiveDate,
      scope: doc.scope,
      sections
    };
  }

  /**
   * 列出所有可用法规 (供前端展示知识库规模)
   */
  listDocuments() {
    if (!this.loaded) this.load();
    const seen = new Set();
    const list = [];
    for (const c of this.corpus) {
      if (!seen.has(c.docId)) {
        seen.add(c.docId);
        list.push({
          docId: c.docId,
          title: c.docTitle,
          issuer: c.issuer,
          effectiveDate: c.effectiveDate,
          sectionCount: this.corpus.filter((x) => x.docId === c.docId).length
        });
      }
    }
    return list;
  }
}

// 单例 (启动时加载一次, 后续检索复用)
const instance = new RegulationRAGService();
instance.load();

module.exports = instance;
