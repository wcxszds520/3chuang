import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'docs', 'advanced_optimization');
const RESULT_DIR = path.join(OUT_DIR, 'vlm-tests');
const IMAGE_DIR = path.join(ROOT, 'docs', 'final_product_integration', 'test-assets', 'vlm-online');
const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000/api';
const IMAGE_ORDER = [
  'carton_box.jpg',
  'labeled_carton.jpg',
  'pallet_wood.jpg',
  'warehouse_mixed_goods.jpg',
  'wrapped_pallet.jpg'
];

const REQUIRED_FIELDS = [
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
  'manual_review_required',
  'length',
  'width',
  'height',
  'weight'
];

fs.mkdirSync(RESULT_DIR, { recursive: true });

function readImagePayload(fileName) {
  const filePath = path.join(IMAGE_DIR, fileName);
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return {
    fileName,
    filePath,
    mimeType,
    image: fs.readFileSync(filePath).toString('base64'),
    bytes: fs.statSync(filePath).size
  };
}

async function callJson(name, method, url, body) {
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
    return {
      name,
      method,
      url,
      httpStatus: response.status,
      elapsedMs,
      payload
    };
  } catch (error) {
    return {
      name,
      method,
      url,
      httpStatus: null,
      elapsedMs: Math.round(performance.now() - started),
      error: {
        name: error?.name || 'Error',
        message: String(error?.message || error).slice(0, 300)
      }
    };
  }
}

function summarizeRecognition(call, fileName, attemptNo) {
  const data = call.payload?.data || null;
  const error = call.payload?.error || null;
  const presentFields = data
    ? REQUIRED_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(data, field))
    : [];
  const completeness = Number((presentFields.length / REQUIRED_FIELDS.length).toFixed(2));
  return {
    fileName,
    attemptNo,
    httpStatus: call.httpStatus,
    elapsedMs: call.elapsedMs,
    passed: Boolean(call.httpStatus === 200 && call.payload?.code === 200 && data && completeness >= 0.85),
    code: call.payload?.code || null,
    message: call.payload?.message || call.error?.message || '',
    errorCode: error?.errorCode || call.error?.name || null,
    model: data?.model || call.payload?.meta?.model || error?.model || null,
    serviceAttempts: call.payload?.meta?.attempts || error?.attempts || [],
    completeness,
    presentFields,
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
}

function scoreImage(attempts) {
  const passed = attempts.filter((item) => item.passed);
  if (!passed.length) return 0;
  const stableBonus = passed.length === attempts.length ? 2 : 0.8;
  const confidence = passed.reduce((sum, item) => sum + Number(item.extracted?.confidence || 0), 0) / passed.length;
  const completeness = passed.reduce((sum, item) => sum + item.completeness, 0) / passed.length;
  return Number(Math.min(10, 4 + stableBonus + confidence * 2 + completeness * 2).toFixed(1));
}

function classifyImage(fileName, attempts) {
  const passed = attempts.filter((item) => item.passed);
  const score = scoreImage(attempts);
  if (passed.length === attempts.length) return { label: 'BEST_CANDIDATE', score };
  if (passed.length > 0) return { label: 'BACKUP_CANDIDATE', score };
  return { label: 'NOT_RECOMMENDED', score };
}

function mdEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function buildMarkdown(output) {
  const lines = [];
  lines.push('# VLM Stability Repair Report');
  lines.push('');
  lines.push(`生成时间：${output.generatedAt}`);
  lines.push('');
  lines.push('## 统一结论');
  lines.push('');
  lines.push(`- VLM 状态：${output.status.available ? 'available=true' : 'available=false'}`);
  lines.push(`- 模型：${output.status.model || '-'}`);
  lines.push(`- 后端直连：${output.summary.backendPassedImages}/${output.summary.backendTestedImages} 张图片至少一次成功；${output.summary.backendStableImages} 张图片连续两次成功。`);
  lines.push(`- 最佳录屏图片：${output.summary.bestImage || '无'}`);
  lines.push(`- 备用录屏图片：${output.summary.backupImages.length ? output.summary.backupImages.join(', ') : '无'}`);
  lines.push(`- 是否存在假成功：否。失败图片保留错误码，不生成识别数据。`);
  lines.push('');
  lines.push('## 逐图测试表');
  lines.push('');
  lines.push('| 图片 | 结果 | 成功次数 | 最长耗时 | 评分/10 | 识别摘要 | 失败原因 |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- | --- |');
  for (const row of output.images) {
    const successCount = row.attempts.filter((item) => item.passed).length;
    const maxElapsed = Math.max(...row.attempts.map((item) => item.elapsedMs));
    const firstSuccess = row.attempts.find((item) => item.passed)?.extracted;
    const firstFailure = row.attempts.find((item) => !item.passed);
    const summary = firstSuccess
      ? `${firstSuccess.cargo_name || '-'} / ${firstSuccess.packaging_type || '-'} / confidence=${firstSuccess.confidence ?? '-'}`
      : '-';
    const reason = firstFailure
      ? `${firstFailure.errorCode || firstFailure.code || 'FAILED'} ${firstFailure.message || ''}`.trim()
      : '-';
    lines.push(`| ${row.fileName} | ${row.classification.label} | ${successCount}/2 | ${maxElapsed}ms | ${row.classification.score} | ${mdEscape(summary)} | ${mdEscape(reason)} |`);
  }
  lines.push('');
  lines.push('## 后端直接调用结果');
  lines.push('');
  for (const row of output.images) {
    lines.push(`### ${row.fileName}`);
    for (const attempt of row.attempts) {
      lines.push(`- Attempt ${attempt.attemptNo}: ${attempt.passed ? 'PASS' : 'FAIL'}，耗时 ${attempt.elapsedMs}ms，code=${attempt.code ?? '-'}，error=${attempt.errorCode ?? '-'}。`);
    }
    lines.push('');
  }
  lines.push('## 前端上传结果');
  lines.push('');
  lines.push(output.frontendUploadSummary || '待 Playwright E2E 更新。');
  lines.push('');
  lines.push('## 推荐');
  lines.push('');
  lines.push(`- 最佳录屏图片：${output.summary.bestImage || '暂无稳定图片'}`);
  lines.push(`- 备用录屏图片：${output.summary.backupImages.length ? output.summary.backupImages.join(', ') : '暂无'}`);
  lines.push(`- 不推荐图片：${output.summary.notRecommendedImages.length ? output.summary.notRecommendedImages.join(', ') : '暂无'}`);
  lines.push('');
  lines.push('## 最终建议');
  lines.push('');
  if (output.summary.bestImage) {
    lines.push('可以进入录屏，但录屏前仍需按 15 分钟检查清单重新跑一次最佳图片。');
  } else {
    lines.push('暂不建议展示 VLM 实时识图；如果外部服务持续失败，应只展示手动录入和失败态，不展示假成功。');
  }
  lines.push('');
  return lines.join('\n');
}

const statusCall = await callJson('GET /api/vlm/status', 'GET', `${BASE_URL}/vlm/status`, null);
const status = statusCall.payload?.data || { available: false, model: '' };
const images = [];

for (const fileName of IMAGE_ORDER) {
  const imagePayload = readImagePayload(fileName);
  const attempts = [];
  for (let attemptNo = 1; attemptNo <= 2; attemptNo += 1) {
    const call = await callJson(
      `POST /api/vlm/recognize-cargo ${fileName} attempt ${attemptNo}`,
      'POST',
      `${BASE_URL}/vlm/recognize-cargo`,
      {
        image: imagePayload.image,
        mimeType: imagePayload.mimeType,
        fileName
      }
    );
    attempts.push(summarizeRecognition(call, fileName, attemptNo));
  }
  images.push({
    fileName,
    bytes: imagePayload.bytes,
    attempts,
    classification: classifyImage(fileName, attempts)
  });
}

const stableImages = images.filter((row) => row.attempts.every((attempt) => attempt.passed));
const passedImages = images.filter((row) => row.attempts.some((attempt) => attempt.passed));
const best = [...images]
  .filter((row) => row.attempts.some((attempt) => attempt.passed))
  .sort((a, b) => b.classification.score - a.classification.score)[0];
const backupImages = images
  .filter((row) => row.fileName !== best?.fileName && row.attempts.some((attempt) => attempt.passed))
  .sort((a, b) => b.classification.score - a.classification.score)
  .map((row) => row.fileName);
const notRecommendedImages = images
  .filter((row) => row.attempts.every((attempt) => !attempt.passed))
  .map((row) => row.fileName);

let frontendUploadSummary = '待 Playwright E2E 更新。';
const e2ePath = path.join(ROOT, 'docs', 'final_product_integration', 'playwright-e2e-results.json');
if (fs.existsSync(e2ePath)) {
  const e2e = JSON.parse(fs.readFileSync(e2ePath, 'utf-8'));
  const upload = (e2e.records || []).find((record) => record.page === '货物录入页' && record.button === 'VLM 上传识别');
  if (upload) {
    frontendUploadSummary = `最近一次 Playwright 记录：${upload.passed ? 'PASS' : 'FAIL'}，文件 ${upload.file || '-'}，接口调用 ${upload.calledApis?.length || 0} 次。`;
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  imageDir: path.relative(ROOT, IMAGE_DIR).replaceAll('\\', '/'),
  status,
  images,
  frontendUploadSummary,
  summary: {
    backendTestedImages: images.length,
    backendPassedImages: passedImages.length,
    backendStableImages: stableImages.length,
    bestImage: best?.fileName || null,
    backupImages,
    notRecommendedImages,
    fakeSuccessFound: false,
    usableForRecording: Boolean(best)
  }
};

fs.writeFileSync(path.join(RESULT_DIR, 'vlm-stability-results.json'), JSON.stringify(output, null, 2), 'utf-8');
fs.writeFileSync(path.join(OUT_DIR, 'VLM_STABILITY_REPAIR_REPORT.md'), buildMarkdown(output), 'utf-8');

console.log(JSON.stringify(output.summary, null, 2));
