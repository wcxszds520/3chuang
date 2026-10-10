const request = require('./request.js');

function getCase(caseId, options = {}) {
  return request.get(`/cases/${encodeURIComponent(caseId)}`, {}, options);
}

function listCases(options = {}) {
  return request.get('/cases', {}, options);
}

function getPlan(planId, options = {}) {
  return request.get(`/packing/plans/${encodeURIComponent(planId)}`, {}, options);
}

module.exports = { getCase, listCases, getPlan };
