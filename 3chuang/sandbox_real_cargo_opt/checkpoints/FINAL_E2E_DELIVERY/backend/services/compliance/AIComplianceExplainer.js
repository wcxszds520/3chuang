'use strict';

const axios = require('axios');

class AIComplianceExplainer {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || process.env.AI_API_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions';
    this.apiKey = options.apiKey ?? process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? process.env.SILICONFLOW_API_KEY ?? '';
    this.model = options.model || process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
    this.timeout = Number(options.timeout || process.env.AI_TIMEOUT_MS) || 30000;
    this.http = options.http || axios;
  }

  async explain(ruleReport) {
    const fallback = buildFallback(ruleReport);
    if (!this.apiKey) return { text: fallback, source: 'local-template', model: null };
    try {
      const response = await this.http.post(this.apiUrl, {
        model: this.model,
        messages: [
          { role: 'system', content: '你只解释给定的确定性规则结果。不得修改数值、状态、分数或补造证据。仅输出简短中文建议。' },
          { role: 'user', content: JSON.stringify({ status: ruleReport.status, score: ruleReport.score, issues: ruleReport.issues, summary: ruleReport.summary }) }
        ],
        temperature: 0.2,
        max_tokens: 400,
        stream: false
      }, { headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, timeout: this.timeout });
      const text = response.data?.choices?.[0]?.message?.content?.trim();
      return { text: text || fallback, source: text ? 'ai-explanation' : 'local-template', model: text ? this.model : null };
    } catch (error) {
      return { text: fallback, source: 'local-template', model: null, error: error.message };
    }
  }
}

function buildFallback(report) {
  if (!report.issues.length) return '确定性规则未发现阻断项；装柜前仍需核对单证、VGM 回执与现场加固。';
  const issues = report.issues.map((item) => `${item.key}：${item.actual}`).join('；');
  return `请按确定性规则结果复核：${issues}。AI 解释不改变上述状态与数值。`;
}

module.exports = { AIComplianceExplainer };
