/**
 * Web RAG Service - 联网法规参考增强
 *
 * 本服务只提供公开网页参考, 不替代本地法规证据库。
 * - 有 TAVILY_API_KEY 时调用 Tavily 搜索。
 * - 无 key 或联网失败时返回 web_available=false。
 * - 允许读取缓存快照, 但必须标记 cache_used=true, 不能说成实时检索。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const CACHE_DIR = path.join(__dirname, '..', '..', 'docs', 'advanced_optimization', 'rag-cache');

class WebRAGService {
  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY || '';
    this.enabled = String(process.env.WEB_RAG_ENABLED || 'true').toLowerCase() !== 'false';
    this.timeout = Number(process.env.WEB_RAG_TIMEOUT_MS) || 15000;
    this.cacheEnabled = String(process.env.WEB_RAG_CACHE_ENABLED || 'true').toLowerCase() !== 'false';
    this.maxResults = Math.max(1, Math.min(8, Number(process.env.WEB_RAG_MAX_RESULTS) || 5));
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  async search(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
      return this._unavailable('WEB_RAG_EMPTY_QUERY', 'query is required');
    }

    const expandedQuery = this.expandQuery(normalizedQuery);
    const cacheKey = this._cacheKey(expandedQuery);
    const cached = this._readCache(cacheKey);
    const maxResults = Math.max(1, Math.min(8, Number(options.maxResults) || this.maxResults));

    if (!this.enabled) {
      return cached || this._unavailable('WEB_RAG_DISABLED', 'WEB_RAG_ENABLED=false', expandedQuery);
    }

    if (!this.apiKey) {
      return cached || this._unavailable('WEB_RAG_KEY_MISSING', 'TAVILY_API_KEY is not configured', expandedQuery);
    }

    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: this.apiKey,
        query: expandedQuery,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false
      }, { timeout: this.timeout });

      const rawResults = Array.isArray(response.data?.results) ? response.data.results : [];
      const webResults = rawResults.slice(0, maxResults).map((item) => this._normalizeResult(item));
      const output = {
        web_available: true,
        cache_used: false,
        source: 'tavily',
        query: normalizedQuery,
        expanded_query: expandedQuery,
        generatedAt: new Date().toISOString(),
        results: webResults,
        source_summary: this._summarizeSources(webResults)
      };
      this._writeCache(cacheKey, output);
      return output;
    } catch (error) {
      if (cached) {
        return {
          ...cached,
          web_available: true,
          cache_used: true,
          live_error: this._safeError(error)
        };
      }
      return this._unavailable('WEB_RAG_REQUEST_FAILED', this._safeError(error), expandedQuery);
    }
  }

  expandQuery(query) {
    const rules = [
      [/VGM|SOLAS/i, 'SOLAS verified gross mass container shipping'],
      [/CTU|装载规范/i, 'CTU Code cargo transport unit packing guideline'],
      [/IPPC|木包装|熏蒸/i, 'IPPC ISPM 15 wood packaging mark'],
      [/重心|偏载|weight distribution/i, 'container weight distribution center of gravity'],
      [/危险品|dangerous/i, 'container packing dangerous goods declaration'],
      [/单证|一致性|document/i, 'shipping documents packing list consistency']
    ];
    const additions = rules
      .filter(([pattern]) => pattern.test(query))
      .map(([, addition]) => addition);
    return [...new Set([query, ...additions])].join(' ');
  }

  _normalizeResult(item) {
    const url = String(item.url || '');
    const title = String(item.title || '').trim();
    const content = String(item.content || item.snippet || '').replace(/\s+/g, ' ').trim();
    const domain = this._domain(url);
    return {
      title: title.slice(0, 160),
      url,
      domain,
      snippet: content.slice(0, 360),
      score: Number(item.score || 0),
      credibility: this._classifyCredibility(domain, url, title)
    };
  }

  _classifyCredibility(domain, url, title) {
    const haystack = `${domain} ${url} ${title}`.toLowerCase();
    if (/imo\.org|ippc\.int|fao\.org|unece\.org|wcoomd\.org/.test(haystack)) return 'official';
    if (/iso\.org|astm\.org|ansi\.org|bsigroup/.test(haystack)) return 'standards_body';
    if (/port|harbor|maritime|shipping/.test(haystack)) return 'port_authority';
    if (/gov|edu/.test(haystack)) return 'official';
    if (/news|media|blog/.test(haystack)) return 'news';
    if (/logistics|freight|container|forwarder|shipping/.test(haystack)) return 'industry';
    return 'unknown';
  }

  _summarizeSources(results) {
    return results.reduce((summary, item) => {
      summary[item.credibility] = (summary[item.credibility] || 0) + 1;
      return summary;
    }, {});
  }

  _cacheKey(query) {
    return crypto.createHash('sha1').update(query).digest('hex');
  }

  _cachePath(key) {
    return path.join(CACHE_DIR, `${key}.json`);
  }

  _readCache(key) {
    if (!this.cacheEnabled) return null;
    const filePath = this._cachePath(key);
    if (!fs.existsSync(filePath)) return null;
    try {
      const cached = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        ...cached,
        cache_used: true
      };
    } catch {
      return null;
    }
  }

  _writeCache(key, payload) {
    if (!this.cacheEnabled || !payload?.results?.length) return;
    fs.writeFileSync(this._cachePath(key), JSON.stringify(payload, null, 2), 'utf-8');
  }

  _domain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  _safeError(error) {
    const status = error.response?.status ? `HTTP ${error.response.status}` : '';
    return String(status || error.message || error).slice(0, 240);
  }

  _unavailable(errorCode, message, expandedQuery = '') {
    return {
      web_available: false,
      cache_used: false,
      source: 'none',
      errorCode,
      message,
      expanded_query: expandedQuery,
      generatedAt: new Date().toISOString(),
      results: [],
      source_summary: {}
    };
  }
}

module.exports = new WebRAGService();
