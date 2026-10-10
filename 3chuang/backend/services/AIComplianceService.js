'use strict';

const regulationRAG = require('./RegulationRAGService');
const { DeterministicComplianceEngine } = require('./compliance/DeterministicComplianceEngine');
const { AIComplianceExplainer } = require('./compliance/AIComplianceExplainer');

class AIComplianceService {
  constructor(options = {}) {
    this.rules = options.rules || new DeterministicComplianceEngine();
    this.explainer = options.explainer || new AIComplianceExplainer(options);
  }

  async generateComplianceReport(packingPlanData) {
    const deterministic = this.rules.evaluate(packingPlanData);
    const explanation = await this.explainer.explain(deterministic);
    const reportTable = deterministic.reportTable.map((rule) => {
      let regulationEvidence = null;
      try {
        regulationEvidence = regulationRAG.getEvidenceForDimension(rule.dimension);
      } catch (error) {
        regulationEvidence = { unavailable: true, reason: error.message };
      }
      return { ...rule, regulationEvidence };
    });

    return {
      ...deterministic,
      reportTable,
      advice: explanation.text,
      aiExplanation: {
        source: explanation.source,
        model: explanation.model,
        error: explanation.error || null,
        authority: 'EXPLANATION_ONLY'
      },
      timestamp: new Date().toISOString(),
      ragProfile: {
        knowledgeBase: regulationRAG.listDocuments(),
        method: 'local regulation evidence lookup'
      }
    };
  }
}

module.exports = new AIComplianceService();
module.exports.AIComplianceService = AIComplianceService;
