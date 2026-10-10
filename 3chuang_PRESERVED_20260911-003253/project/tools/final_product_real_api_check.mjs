import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'docs', 'final_product_integration');
const ASSET_DIR = path.join(OUT_DIR, 'test-assets', 'vlm-online');
const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000/api';

fs.mkdirSync(OUT_DIR, { recursive: true });

const demoCargoList = [
  {
    cargoId: 'demo_sku_a01',
    sku: 'SKU-A01',
    name: '空调外机',
    length: 780,
    width: 360,
    height: 540,
    weight: 28.5,
    quantity: 120,
    destinationPort: 'Hamburg',
    eta: '2026-07-08',
    portSequence: 1,
    packagingType: 'carton',
    stackable: true,
    maxStackLayers: 3,
    canLayFlat: false,
    fragile: false,
    dangerous: false
  },
  {
    cargoId: 'demo_sku_b12',
    sku: 'SKU-B12',
    name: '配件箱',
    length: 420,
    width: 300,
    height: 260,
    weight: 6.2,
    quantity: 260,
    destinationPort: 'Hamburg',
    eta: '2026-07-08',
    portSequence: 1,
    packagingType: 'carton',
    stackable: true,
    maxStackLayers: 6,
    canLayFlat: true,
    fragile: false,
    dangerous: false
  },
  {
    cargoId: 'demo_sku_c08',
    sku: 'SKU-C08',
    name: '木托包装件',
    length: 900,
    width: 700,
    height: 650,
    weight: 42,
    quantity: 24,
    destinationPort: 'Hamburg',
    eta: '2026-07-08',
    portSequence: 1,
    packagingType: 'wooden',
    stackable: true,
    maxStackLayers: 2,
    canLayFlat: false,
    fragile: false,
    dangerous: false
  },
  {
    cargoId: 'demo_sku_d22',
    sku: 'SKU-D22',
    name: '易碎面板',
    length: 600,
    width: 400,
    height: 180,
    weight: 3.8,
    quantity: 96,
    destinationPort: 'Hamburg',
    eta: '2026-07-08',
    portSequence: 1,
    packagingType: 'carton',
    stackable: false,
    maxStackLayers: 1,
    canLayFlat: true,
    fragile: true,
    dangerous: false
  },
  {
    cargoId: 'demo_sku_e17',
    sku: 'SKU-E17',
    name: '普通纸箱',
    length: 500,
    width: 380,
    height: 320,
    weight: 9.5,
    quantity: 364,
    destinationPort: 'Hamburg',
    eta: '2026-07-08',
    portSequence: 1,
    packagingType: 'carton',
    stackable: true,
    maxStackLayers: 5,
    canLayFlat: true,
    fragile: false,
    dangerous: false
  }
];

const requiredVlmFields = [
  'cargo_name',
  'possible_sku',
  'packaging_type',
  'material',
  'is_wood_packaging',
  'is_fragile',
  'is_stackable',
  'visible_label_text',
  'risk_flags',
  'confidence',
  'manual_review_required'
];

const results = [];

function summarizeError(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || error).slice(0, 600)
  };
}

function summarizeInput(body) {
  if (body?.cargoList) {
    return {
      containerType: body.containerType,
      cargoSkuRows: body.cargoList.length,
      totalQuantity: body.cargoList.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
    };
  }
  if (body?.packingPlanData) {
    return {
      containerType: body.packingPlanData.containerInfo?.typeId,
      loadedCargo: body.packingPlanData.loadedCargo?.length || 0,
      unloadedCargo: body.packingPlanData.unloadedCargo?.length || 0,
      declaredVGM: body.declaredVGM
    };
  }
  if (body?.query) return { query: body.query, topK: body.topK };
  if (body?.image) return { image: '[base64 omitted]', mimeType: body.mimeType, fileName: body.fileName };
  return body || null;
}

function summarizeGeneric(payload) {
  if (!payload) return null;
  return {
    code: payload.code,
    message: payload.message,
    dataKeys: payload.data ? Object.keys(payload.data) : []
  };
}

async function timedFetch(name, method, url, body, summarize, validate) {
  const start = performance.now();
  const item = {
    name,
    method,
    url,
    inputSummary: summarizeInput(body),
    trueCall: true
  };
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const elapsedMs = Math.round(performance.now() - start);
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const responseSummary = summarize ? summarize(payload, response) : summarizeGeneric(payload);
    const validation = validate ? validate(payload, response, responseSummary) : { passed: response.ok };
    Object.assign(item, {
      httpStatus: response.status,
      elapsedMs,
      ok: response.ok,
      responseSummary,
      passed: Boolean(response.ok && validation.passed),
      failureReason: validation.passed ? null : validation.reason || null,
      externalBlocker: validation.externalBlocker || null
    });
    results.push(item);
    return { item, response, payload };
  } catch (error) {
    Object.assign(item, {
      httpStatus: null,
      elapsedMs: Math.round(performance.now() - start),
      ok: false,
      passed: false,
      error: summarizeError(error)
    });
    results.push(item);
    return { item, response: null, payload: null };
  }
}

function extractPackingPlan(payload) {
  const data = payload?.data || {};
  return data.result || data.plan || data.packingPlan || data;
}

function buildCompliancePayload(plan) {
  const loadedCargo = Array.isArray(plan.loadedCargo) ? plan.loadedCargo : [];
  const unloadedCargo = Array.isArray(plan.unloadedCargo) ? plan.unloadedCargo : [];
  const containerInfo = plan.containerInfo || {
    typeId: '40HQ',
    name: '40HQ 高柜',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2698,
    maxWeight: 26000,
    tareWeight: 3900
  };
  const totalWeight = Number(plan.totalWeight || loadedCargo.reduce((sum, item) => sum + Number(item.weight || 0), 0));
  const tareWeight = Number(containerInfo.tareWeight || 3900);
  return {
    packingPlanData: {
      containerInfo,
      loadedCargo,
      unloadedCargo,
      spaceUtilization: Number(plan.spaceUtilization || 0),
      totalWeight,
      cog: plan.cog || null,
      cogOffset: plan.cogOffset || { lateral: 0, longitudinal: 0 },
      constraintMeta: plan.constraintMeta || {},
      declaredVGM: Math.round(totalWeight + tareWeight)
    },
    declaredVGM: Math.round(totalWeight + tareWeight)
  };
}

function imageFiles() {
  if (!fs.existsSync(ASSET_DIR)) return [];
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  return fs.readdirSync(ASSET_DIR)
    .map((name) => path.join(ASSET_DIR, name))
    .filter((file) => fs.statSync(file).isFile() && allowed.has(path.extname(file).toLowerCase()))
    .sort();
}

await timedFetch('GET /api/health', 'GET', `${BASE_URL}/health`, null, (payload) => ({
  code: payload?.code,
  message: payload?.message,
  status: payload?.data?.status,
  service: payload?.data?.service
}), (payload, response) => ({
  passed: response.ok && payload?.data?.status === 'ok',
  reason: response.ok ? 'health status is not ok' : 'HTTP error'
}));

await timedFetch('GET /api/container/list', 'GET', `${BASE_URL}/container/list`, null, (payload) => ({
  code: payload?.code,
  message: payload?.message,
  count: payload?.data?.containerTypes?.length || 0,
  types: payload?.data?.containerTypes?.map((item) => item.typeId) || []
}), (payload, response, summary) => {
  const types = new Set(summary.types || []);
  return {
    passed: response.ok && ['20GP', '40GP', '40HQ'].every((type) => types.has(type)),
    reason: 'container list missing 20GP/40GP/40HQ'
  };
});

const packing = await timedFetch(
  'POST /api/packing/generate',
  'POST',
  `${BASE_URL}/packing/generate`,
  { containerType: '40HQ', cargoList: demoCargoList, options: { algorithmId: 'fast-block' } },
  (payload) => {
    const plan = extractPackingPlan(payload);
    return {
      code: payload?.code,
      message: payload?.message,
      loadedCargoLength: plan?.loadedCargo?.length || 0,
      unloadedCargoLength: plan?.unloadedCargo?.length || 0,
      hasContainerInfo: Boolean(plan?.containerInfo),
      hasCog: Boolean(plan?.cog || plan?.cogOffset),
      spaceUtilization: Number(plan?.spaceUtilization || 0),
      totalWeight: Number(plan?.totalWeight || 0),
      source: plan?.source || payload?.data?.source || 'backend'
    };
  },
  (payload, response, summary) => ({
    passed: response.ok && summary.loadedCargoLength > 0 && summary.hasContainerInfo && summary.hasCog && summary.spaceUtilization > 0,
    reason: 'packing result missing loadedCargo/containerInfo/cog/spaceUtilization'
  })
);

let packingPlan = null;
if (packing.payload && packing.response?.ok) {
  packingPlan = extractPackingPlan(packing.payload);
}

if (packingPlan?.loadedCargo?.length) {
  await timedFetch(
    'POST /api/packing/compliance-check-sync',
    'POST',
    `${BASE_URL}/packing/compliance-check-sync`,
    buildCompliancePayload(packingPlan),
    (payload) => {
      const report = payload?.data?.complianceReport;
      const table = report?.reportTable || [];
      const text = JSON.stringify(report || {});
      return {
        code: payload?.code,
        message: payload?.message,
        status: report?.status,
        score: report?.score,
        model: report?.model,
        aiAdviceSource: report?.aiAdviceSource || 'unknown',
        aiAdviceError: report?.aiAdviceError || null,
        reportRows: table.length,
        containsVGM: text.includes('VGM'),
        containsLIFO: text.includes('LIFO') || text.includes('卸货'),
        containsCOG: text.includes('重心'),
        containsIPPC: text.includes('IPPC') || text.includes('木包装'),
        containsDocs: text.includes('单证')
      };
    },
    (payload, response, summary) => ({
      passed: response.ok &&
        summary.aiAdviceSource === 'ai' &&
        summary.model === 'deepseek-v4-flash' &&
        summary.containsVGM &&
        summary.containsLIFO &&
        summary.containsCOG &&
        summary.containsIPPC &&
        summary.containsDocs,
      reason: 'compliance result missing real AI source/model or required dimensions',
      externalBlocker: response.ok && summary.aiAdviceSource !== 'ai' ? 'DEEPSEEK_AI_NOT_USED' : null
    })
  );
} else {
  results.push({
    name: 'POST /api/packing/compliance-check-sync',
    method: 'POST',
    url: `${BASE_URL}/packing/compliance-check-sync`,
    trueCall: false,
    skipped: true,
    passed: false,
    failureReason: 'Skipped because packing did not return loadedCargo'
  });
}

const regulations = await timedFetch('GET /api/compliance/regulations', 'GET', `${BASE_URL}/compliance/regulations`, null, (payload) => ({
  code: payload?.code,
  count: payload?.data?.count,
  totalSections: payload?.data?.totalSections,
  method: payload?.data?.method,
  docIds: payload?.data?.documents?.map((doc) => doc.docId) || []
}), (payload, response, summary) => ({
  passed: response.ok && summary.count >= 4 && summary.totalSections >= 1,
  reason: 'regulation list missing expected documents'
}));

const docIds = regulations.payload?.data?.documents?.map((doc) => doc.docId) || [];
for (const docId of docIds.slice(0, 6)) {
  await timedFetch(`GET /api/compliance/regulation/${docId}`, 'GET', `${BASE_URL}/compliance/regulation/${encodeURIComponent(docId)}`, null, (payload) => ({
    code: payload?.code,
    docId: payload?.data?.docId,
    title: payload?.data?.title,
    sectionCount: payload?.data?.sections?.length || 0
  }), (payload, response, summary) => ({
    passed: response.ok && summary.sectionCount > 0,
    reason: 'regulation detail missing sections'
  }));
}

for (const keyword of ['VGM', 'SOLAS', 'CTU', 'LIFO', '重心', 'IPPC', '木包装', '单证一致性', '危险品']) {
  await timedFetch(
    `POST /api/compliance/search ${keyword}`,
    'POST',
    `${BASE_URL}/compliance/search`,
    { query: keyword, topK: 3 },
    (payload) => ({
      code: payload?.code,
      query: payload?.data?.query,
      method: payload?.data?.method,
      resultCount: payload?.data?.results?.length || 0,
      topDocs: payload?.data?.results?.slice(0, 3).map((row) => ({
        docId: row.docId,
        section: row.section,
        score: row.score
      })) || []
    }),
    (payload, response, summary) => ({
      passed: response.ok && summary.resultCount > 0,
      reason: `RAG search returned no results for ${keyword}`
    })
  );
}

await timedFetch('GET /api/vlm/status', 'GET', `${BASE_URL}/vlm/status`, null, (payload) => ({
  code: payload?.code,
  available: Boolean(payload?.data?.available),
  model: payload?.data?.model
}), (payload, response, summary) => ({
  passed: response.ok && summary.available === true && summary.model === 'Qwen/Qwen3-VL-32B-Instruct',
  reason: 'VLM status is unavailable or model is not Qwen/Qwen3-VL-32B-Instruct'
}));

for (const imagePath of imageFiles()) {
  const image = fs.readFileSync(imagePath).toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const fileName = path.basename(imagePath);
  await timedFetch(
    `POST /api/vlm/recognize-cargo ${fileName}`,
    'POST',
    `${BASE_URL}/vlm/recognize-cargo`,
    { image, mimeType, fileName },
    (payload) => {
      const data = payload?.data || null;
      const presentFields = data ? requiredVlmFields.filter((field) => Object.prototype.hasOwnProperty.call(data, field)) : [];
      return {
        code: payload?.code,
        message: payload?.message,
        hasData: Boolean(data),
        model: data?.model,
        presentFields,
        completeness: Number((presentFields.length / requiredVlmFields.length).toFixed(2)),
        extracted: data ? {
          cargo_name: data.cargo_name,
          possible_sku: data.possible_sku,
          packaging_type: data.packaging_type,
          material: data.material,
          is_wood_packaging: data.is_wood_packaging,
          is_fragile: data.is_fragile,
          is_stackable: data.is_stackable,
          visible_label_text: data.visible_label_text,
          risk_flags: data.risk_flags,
          confidence: data.confidence,
          manual_review_required: data.manual_review_required,
          length: data.length,
          width: data.width,
          height: data.height,
          weight: data.weight
        } : null
      };
    },
    (payload, response, summary) => ({
      passed: response.ok &&
        summary.hasData === true &&
        summary.model === 'Qwen/Qwen3-VL-32B-Instruct' &&
        summary.completeness >= 0.9 &&
        typeof summary.extracted?.cargo_name === 'string' &&
        summary.extracted.cargo_name.length > 0,
      reason: summary.hasData ? 'VLM result missing Qwen3 model or required fields' : 'VLM returned null data',
      externalBlocker: response.ok && !summary.hasData ? 'QWEN3_VLM_RETURNED_NULL' : null
    })
  );
}

const cargoCreate = await timedFetch(
  'POST /api/cargo/create',
  'POST',
  `${BASE_URL}/cargo/create`,
  {
    name: `联调测试货物-${Date.now()}`,
    length: 450,
    width: 330,
    height: 280,
    weight: 7.5,
    quantity: 2,
    stackable: true,
    maxStackLayers: 3,
    canLayFlat: true,
    fragile: false
  },
  (payload) => ({
    code: payload?.code,
    message: payload?.message,
    hasCargoId: Boolean(payload?.data?.cargoId),
    cargoId: payload?.data?.cargoId || null
  }),
  (payload, response, summary) => ({
    passed: response.ok && summary.hasCargoId,
    reason: 'cargo create did not return cargoId'
  })
);

await timedFetch('GET /api/cargo/list', 'GET', `${BASE_URL}/cargo/list`, null, (payload) => ({
  code: payload?.code,
  message: payload?.message,
  count: payload?.data?.cargoList?.length || 0
}), (payload, response) => ({
  passed: response.ok,
  reason: 'cargo list HTTP error'
}));

const createdCargoId = cargoCreate.payload?.data?.cargoId;
if (createdCargoId) {
  await timedFetch(
    'DELETE /api/cargo/delete/:cargoId',
    'DELETE',
    `${BASE_URL}/cargo/delete/${encodeURIComponent(createdCargoId)}`,
    null,
    (payload) => ({
      code: payload?.code,
      message: payload?.message
    }),
    (payload, response) => ({
      passed: response.ok,
      reason: 'cargo delete HTTP error'
    })
  );
}

const vlmItems = results.filter((item) => item.name.startsWith('POST /api/vlm/recognize-cargo'));
const vlmPassed = vlmItems.filter((item) => item.passed).length;
const rawExternalBlockers = [...new Set(results.map((item) => item.externalBlocker).filter(Boolean))];
const externalBlockers = rawExternalBlockers.filter((blocker) => (
  blocker !== 'QWEN3_VLM_RETURNED_NULL' || vlmPassed === 0
));

const output = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  demoCargoSummary: {
    skuRows: demoCargoList.length,
    totalQuantity: demoCargoList.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    containerType: '40HQ'
  },
  requiredVlmFields,
  results,
  summary: {
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed && !item.skipped).length,
    skipped: results.filter((item) => item.skipped).length,
    vlmImagesTested: vlmItems.length,
    vlmImagesPassed: vlmPassed,
    vlmRealCallUsable: vlmPassed > 0,
    externalBlockers
  }
};

fs.writeFileSync(path.join(OUT_DIR, 'backend-real-api-results.json'), JSON.stringify(output, null, 2), 'utf-8');
console.log(JSON.stringify({
  output: path.join(OUT_DIR, 'backend-real-api-results.json'),
  ...output.summary
}, null, 2));
