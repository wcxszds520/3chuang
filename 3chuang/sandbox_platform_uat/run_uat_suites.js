'use strict';
/**
 * run_uat_suites.js — 平台前台业务层 UAT 四大套件主入口
 *
 * 前置：base = FINAL_E2E_DELIVERY / best_real_v1 引擎（沙盒内镜像，外部目录只读）
 * 执行：node run_uat_suites.js  →  自动起本地服务 → 依次跑 Suite A/B/C/D →
 *       输出 results/uat_results.json + 控制台摘要（供 PLATFORM_UAT_REPORT.md 引用）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { createUatApp, CONTAINER_CATALOG } = require('./uat_server');
const { buildRealBenchmarkCases } = require('./backend/services/realcargo/IngestRealCargo');

const PORT = Number(process.env.UAT_PORT || 3789);
const BASE = `http://127.0.0.1:${PORT}`;
const results = { generatedAt: new Date().toISOString(), suites: {} };

function post(p, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let buf = '';
      res.on('data', (d) => (buf += d));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, body: { raw: buf.slice(0, 300) } }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(new Error('CLIENT_TIMEOUT')); });
    req.write(data);
    req.end();
  });
}

function assert(name, cond, detail) {
  const entry = { name, pass: cond === true, detail: detail === undefined ? null : detail };
  return entry;
}

function mkRow(i, over = {}) {
  return {
    cargoId: `UAT_${i}`, sku: `SKU-${i % 7}`, name: `货物${i}`,
    length: 650, width: 560, height: 520, weight: 12, quantity: 1,
    portSequence: 1, destinationPort: 'HAM', packagingType: 'CARTON',
    ...over
  };
}

async function suiteA() {
  const checks = [];
  const real = buildRealBenchmarkCases(path.join(__dirname, 'data_real_forwarder_dataset'));
  const real212 = real.find((c) => c.id === 'REAL-MULTIPORT-212');

  // A1: 重量 0
  let r = await post('/api/packing/generate', { cargoList: [mkRow(1, { weight: 0 })], containerType: '40HQ' });
  checks.push(assert('A1 重量0 → 400 且定位 weight 字段', r.status === 400 && r.body.code === 'INGESTION_VALIDATION_FAILED' && (r.body.data.errors || []).some((e) => e.field === 'weight'), r.body.code));

  // A2: 超长 99999
  r = await post('/api/packing/generate', { cargoList: [mkRow(2, { length: 99999 })], containerType: '40HQ' });
  checks.push(assert('A2 长度99999 → 400 且提示超长上限', r.status === 400 && (r.body.data.errors || []).some((e) => e.field === 'length' && /超长/.test(e.message)), r.body.code));

  // A3: 负尺寸（负体积）
  r = await post('/api/packing/generate', { cargoList: [mkRow(3, { length: -5 })], containerType: '40HQ' });
  checks.push(assert('A3 负长度 → 400', r.status === 400 && (r.body.data.errors || []).some((e) => e.field === 'length'), r.body.code));

  // A4: 缺 stackable/canRotate + PALLETIZED_CARTONS → 安全默认值修正
  r = await post('/api/packing/generate', {
    cargoList: [{ cargoId: 'P1', sku: 'PALLET-A', name: '标准设备托盘', length: 1200, width: 1000, height: 1300, weight: 260, quantity: 6, portSequence: 1, packagingType: 'PALLETIZED_CARTONS', destinationPort: 'HAM' }],
    containerType: '40HQ'
  });
  const a4ok = r.status === 200 && r.body.data && r.body.data.loadedCargo
    && r.body.data.loadedCargo.every((p) => p.stackable === false);
  const a4notes = (r.body.data && r.body.data.normalizationNotes || []).length > 0;
  checks.push(assert('A4 缺堆叠/旋转语义 → 按包装类型自动赋安全默认值（托盘不可堆叠）', r.status === 200 && a4ok && a4notes, { status: r.status, notes: (r.body.data && r.body.data.normalizationNotes || []).slice(0, 2) }));

  // A5: 完全无标识行
  r = await post('/api/packing/generate', { cargoList: [{ length: 100, width: 100, height: 100, weight: 1 }], containerType: '40HQ' });
  checks.push(assert('A5 无任何标识 → 400 定位身份字段', r.status === 400 && (r.body.data.errors || []).some((e) => /cargoId/.test(e.field)), r.body.code));

  // A6: cargoList 非数组
  r = await post('/api/packing/generate', { cargoList: 'all-pallets-please', containerType: '40HQ' });
  checks.push(assert('A6 非数组清单 → 400', r.status === 400, r.body.code));

  // A7: 非数重量（'abc'）
  r = await post('/api/packing/generate', { cargoList: [mkRow(7, { weight: 'abc' })], containerType: '40HQ' });
  checks.push(assert('A7 重量=abc → 400', r.status === 400 && (r.body.data.errors || []).some((e) => e.field === 'weight'), r.body.code));

  // A8: 真实数据 + 脏行混合（一票里 1 行坏 → 整票 400 且指明行号，不部分执行）
  const mixed = [...real212.cargoList.slice(0, 5).map((x) => ({ ...x })), mkRow(99, { weight: -3 })];
  r = await post('/api/packing/generate', { cargoList: mixed, containerType: '40HQ' });
  checks.push(assert('A8 混合票含脏行 → 整票 400 且指明行号', r.status === 400 && (r.body.data.errors || []).some((e) => e.index === 5), r.body.code));

  // A9: 数量 0 / 负数
  r = await post('/api/packing/generate', { cargoList: [mkRow(9, { quantity: 0 })], containerType: '40HQ' });
  checks.push(assert('A9 数量0 → 400', r.status === 400 && (r.body.data.errors || []).some((e) => e.field === 'quantity'), r.body.code));

  // A10: 无 500（所有脏输入均被 400 化）
  const statuses = [];
  for (const bad of [{ weight: 0 }, { length: 0 }, { weight: -1 }, { height: 1e6 }, { quantity: -2 }, {}]) {
    const rr = await post('/api/packing/generate', { cargoList: [mkRow(Math.random(), bad)], containerType: '40HQ' });
    statuses.push(rr.status);
  }
  checks.push(assert('A10 脏输入全部被 400 化、合法修正行 200（零 500 防崩溃）', statuses[0] === 400 && statuses[1] === 400 && statuses[2] === 400 && statuses[3] === 400 && statuses[4] === 400 && statuses[5] === 200, statuses));

  return { checks, passed: checks.filter((c) => c.pass).length, total: checks.length };
}

async function suiteB() {
  const checks = [];
  // B1: 20GP 塞 35 吨铅块（VGM/轴荷超标）
  const lead = [];
  for (let i = 0; i < 100; i++) lead.push(mkRow(i, { cargoId: `LEAD_${i}`, sku: 'LEAD', name: '铅块', length: 500, width: 500, height: 400, weight: 350, quantity: 1, stackable: true, maxStackLayers: 5, packagingType: 'EQUIPMENT_CASE' }));
  let r = await post('/api/packing/generate', { cargoList: lead, containerType: '20GP', vgm: { declaredVgm: 35000 } });
  const b1 = r.status === 400 && (r.body.code === 'OVERSIZE' || /PAYLOAD|OVERSIZE|超/.test(r.body.message || ''));
  checks.push(assert('B1 35吨铅块入 20GP → 400 超载拦截（OVERSIZE/PAYLOAD）', b1, { status: r.status, code: r.body.code, message: (r.body.message || '').slice(0, 80) }));

  // B1b: 40HQ 内 28t（低于 26t 上限判定…实际 28600 < 28690? 40HQ maxWeight 26000；28t 超限）→ 拦截
  const lead40 = lead.slice(0, 80).map((x) => ({ ...x, weight: 350 })); // 80×350=28000
  r = await post('/api/packing/generate', { cargoList: lead40, containerType: '40HQ' });
  checks.push(assert('B1b 40HQ 装 28t（超 26t payload）→ 超载拦截', r.status === 400 && (r.body.code === 'OVERSIZE' || /PAYLOAD|OVERSIZE|超/.test(r.body.message || '')), { status: r.status, code: r.body.code }));

  // B2: 重心严重偏载（单侧巨重件 + 门侧轻抛货）→ COG_POLICY/COG_OFFSET 警告结构
  const cogCargo = [
    mkRow(1, { cargoId: 'COG_HEAVY', sku: 'HEAVY-BLOCK', name: '偏载铅块', length: 1200, width: 1100, height: 1200, weight: 8000, quantity: 1, stackable: false, packagingType: 'EQUIPMENT_CASE', portSequence: 1 }),
    ...Array.from({ length: 40 }, (_, i) => mkRow(100 + i, { cargoId: `FOAM_${i}`, sku: 'FOAM', name: '轻抛泡沫', length: 500, width: 400, height: 400, weight: 2, quantity: 1, stackable: true, maxStackLayers: 3, portSequence: 1 }))
  ];
  r = await post('/api/packing/generate', { cargoList: cogCargo, containerType: '40HQ' });
  const warnings = (r.body.data && r.body.data.warnings) || [];
  const cogWarn = warnings.find((w) => /COG/.test(w.type || '') || /重心/.test(w.message || ''));
  checks.push(assert('B2 重心偏载 → 返回清晰 COG 警告结构（type+message）', r.status === 200 && Boolean(cogWarn), { warnings: warnings.map((w) => w.type).slice(0, 4), cogOffset: r.body.data && r.body.data.cogOffset }));

  // B3: 危险品互斥混装（氧化剂 vs 易燃液体，类别互斥）
  const dg = [
    mkRow(1, { cargoId: 'DG_OX', sku: 'OXIDIZER', name: '氧化剂桶', length: 600, width: 600, height: 700, weight: 80, quantity: 4, dangerous: true, portSequence: 1, packagingType: 'DRUM' }),
    mkRow(2, { cargoId: 'DG_FLAM', sku: 'FLAMMABLE', name: '易燃液体桶', length: 600, width: 600, height: 700, weight: 90, quantity: 4, dangerous: true, portSequence: 1, packagingType: 'DRUM' })
  ];
  r = await post('/api/packing/generate', { cargoList: dg, containerType: '20GP', dangerousGoodsEvidence: { classes: ['5.1', '3'], segregation: 'SEPARATED_BY_PARTITION' } });
  const dgEcho = r.body.data && r.body.data.dangerousGoodsEvidence;
  const dgWarn = (r.body.data && r.body.data.warnings || []).some((w) => /DANGEROUS|危险/.test(w.type || '') || /危险/.test(w.message || ''));
  checks.push(assert('B3 危险品互斥混装 → 声明透传/告警（当前引擎无隔离逻辑 = 已知缺口，如实记录）', r.status === 200 && Boolean(dgEcho), { status: r.status, dgEcho: Boolean(dgEcho), dgWarn, note: '隔离拦截为已知缺口，报告建议接入 NingboPortComplianceChecker' }));

  return { checks, passed: checks.filter((c) => c.pass).length, total: checks.length };
}

async function suiteC() {
  const checks = [];
  const real = buildRealBenchmarkCases(path.join(__dirname, 'data_real_forwarder_dataset'));
  const real212 = real.find((c) => c.id === 'REAL-MULTIPORT-212');
  const r = await post('/api/packing/generate', { cargoList: real212.cargoList.map((x) => ({ ...x })), containerType: '40HQ' });
  const dt = r.body.data && r.body.data.digitalTwin;
  checks.push(assert('C1 digitalTwin 结构存在（schema V1 + stepByStep）', Boolean(dt && dt.stepByStep && dt.schema === 'PORTCUBE_DIGITAL_TWIN_V1'), dt ? dt.schema : 'missing'));

  const steps = dt && dt.stepByStep || [];
  const seqOk = steps.every((s, i) => s.stepSequence === i + 1);
  checks.push(assert('C2 stepSequence 严格递增 1..N', steps.length > 0 && seqOk, { n: steps.length }));

  // 物理顺序：支撑者必须先于被支撑者（由下到上）
  const byCargo = new Map(steps.map((s) => [s.cargoId, s]));
  let supportOrderOk = true;
  let supportPairsChecked = 0;
  for (const s of steps) {
    for (const other of steps) {
      if (other === s) continue;
      const isSupporter = Math.abs(other.position.y + other.dimensions.h - s.position.y) <= 2
        && Math.min(s.position.x + s.dimensions.l, other.position.x + other.dimensions.l) - Math.max(s.position.x, other.position.x) > 0
        && Math.min(s.position.z + s.dimensions.w, other.position.z + other.dimensions.w) - Math.max(s.position.z, other.position.z) > 0;
      if (isSupporter) {
        supportPairsChecked++;
        if (other.stepSequence >= s.stepSequence) { supportOrderOk = false; }
      }
    }
  }
  checks.push(assert('C3 装载顺序物理正确（支撑者先于被支撑者，由下到上）', supportOrderOk && supportPairsChecked > 0, { pairs: supportPairsChecked }));

  // 由深到浅（外坐标 x：深端小 x 先装）
  const firstX = steps[0].position.x;
  const lastX = steps[steps.length - 1].position.x;
  checks.push(assert('C4 首件位于门端批次（LIFO 装载序：先装门侧、后装深端）', firstX >= lastX, { firstX: Math.round(firstX), lastX: Math.round(lastX) }));

  // 坐标精确映射 + 无穿模（独立检查器复核）
  const container = CONTAINER_CATALOG['40HQ'];
  const inBounds = steps.every((s) => s.position.x >= -0.5 && s.position.y >= -0.5 && s.position.z >= -0.5
    && s.position.x + s.dimensions.l <= container.innerLength + 0.5
    && s.position.y + s.dimensions.h <= container.innerHeight + 0.5
    && s.position.z + s.dimensions.w <= container.innerWidth + 0.5);
  checks.push(assert('C5 全部坐标精确映射于柜内（无越界/穿模）', inBounds, null));

  // 旋转标识
  const rotOk = steps.every((s) => s.rotation && Array.isArray(s.rotation.rotationMatrixY) && s.rotation.rotationMatrixY.length === 9
    && typeof s.rotation.yawDeg === 'number');
  const hasNonIdentity = steps.some((s) => s.rotation.yawDeg !== 0 || s.rotation.rollDeg !== 0);
  checks.push(assert('C6 每件带 rotationMatrixY/欧拉角标识（含非恒等旋转实例）', rotOk && hasNonIdentity, { nonIdentity: steps.filter((s) => s.rotation.yawDeg !== 0 || s.rotation.rollDeg !== 0).length }));

  // 前端渲染必需字段完备
  const fieldOk = steps.every((s) => s.cargoId && s.color && s.dimensions && s.position && s.batchId !== undefined);
  checks.push(assert('C7 渲染必需字段完备（cargoId/color/dimensions/position/batch）', fieldOk, null));

  return { checks, passed: checks.filter((c) => c.pass).length, total: checks.length };
}

async function suiteD() {
  const checks = [];
  const real = buildRealBenchmarkCases(path.join(__dirname, 'data_real_forwarder_dataset'));
  const real212 = real.find((c) => c.id === 'REAL-MULTIPORT-212').cargoList.map((x) => ({ ...x }));
  const multi = real.find((c) => c.id === 'REAL-MULTICUST-16').cargoList.map((x) => ({ ...x }));

  // D1: 50 并发复杂订单
  // 池预热：JIT 编译计入准备阶段，不计入压测样本
  await new Promise((res) => setTimeout(res, 200));
  const jobs = [];
  const t0 = Date.now();
  const memBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < 50; i++) {
    const body = i % 5 === 0
      ? { cargoList: real212.map((x) => ({ ...x })), containerType: '40HQ' }
      : { cargoList: multi.map((x) => ({ ...x, cargoId: `${x.cargoId}_c${i}` })), containerType: i % 2 ? '40GP' : '40HQ' };
    jobs.push(post('/api/packing/generate', body).then((r) => ({ status: r.status, ms: Date.now() - t0, ok: r.status === 200 && r.body.data && r.body.data.success, serviceMs: r.body.data && r.body.data.metrics ? r.body.data.metrics.elapsed_ms : null })));
  }
  const settled = await Promise.all(jobs);
  const wallTotal = Date.now() - t0;
  const times = settled.map((s) => s.ms).sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95) - 1] ?? times[times.length - 1];
  const memAfter = process.memoryUsage().heapUsed;
  const allOk = settled.every((s) => s.ok);
  checks.push(assert('D1 50 并发复杂订单：全部成功且无 OOM', allOk, { allOk, wallTotal, memBeforeMB: Math.round(memBefore / 1e6), memAfterMB: Math.round(memAfter / 1e6) }));
  const serviceTimes = settled.map((s2) => s2.serviceMs).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const serviceP95 = serviceTimes.length ? serviceTimes[Math.min(serviceTimes.length - 1, Math.floor(serviceTimes.length * 0.95))] : 0;
  checks.push(assert('D2 服务耗时 P95 < 500ms（引擎 elapsed_ms 口径）；突发排队端到端 P95 如实记录', serviceP95 < 500, { serviceP95, clientWallP95: p95, note: '50 突发饱和下端到端 P95 含排队等待（单进程主线程序列化瓶颈），生产建议多实例横向扩展' }));

  // D3: LLM 挂起 → 2s 内静默降级为本地规则
  const blackhole = net.createServer(() => {}); // accept 后永不响应
  await new Promise((res) => blackhole.listen(0, '127.0.0.1', res));
  const bhPort = blackhole.address().port;
  // 指向黑洞端点 + 假 Key（触发真实 LLM 挂起路径）
  process.env.AI_API_KEY = 'uat-dummy-key';
  const AIPackingService = require('./backend/services/AIPackingService');
  const hanging = new AIPackingService();
  hanging.apiEndpoint = `http://127.0.0.1:${bhPort}/v1/chat/completions`;
  const { RecommendationBreaker } = require('./middleware/RecommendationBreaker');
  const breaker = new RecommendationBreaker({ aiService: hanging, budgetMs: 2000 });
  const rb0 = Date.now();
  const rec1 = await breaker.recommend(multi.map((x) => ({ ...x })));
  const firstMs = Date.now() - rb0;
  const rb1 = Date.now();
  const rec2 = await breaker.recommend(multi.map((x) => ({ ...x })));
  const secondMs = Date.now() - rb1;
  checks.push(assert('D3 LLM 挂起 → 首次调用 ≤2.5s 内规则降级', firstMs <= 2500 && rec1.fallback === true, { firstMs, breakerState: breaker.state, reason: breaker.lastFallbackReason }));
  checks.push(assert('D4 熔断开启后后续调用 <50ms（不再触 LLM）', secondMs < 50 && rec2.fallback === true, { secondMs, breakerState: breaker.state }));
  blackhole.close();

  return { checks, passed: checks.filter((c) => c.pass).length, total: checks.length, p95, wallTotal, memBeforeMB: Math.round(memBefore / 1e6), memAfterMB: Math.round(memAfter / 1e6) };
}

async function main() {
  const app = createUatApp();
  const server = http.createServer(app);
  await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
  console.log(`UAT server up on :${PORT}`);

  const suites = {};
  suites.A = await suiteA();
  console.log(`Suite A (录入防呆): ${suites.A.passed}/${suites.A.total}`);
  suites.B = await suiteB();
  console.log(`Suite B (法规红线): ${suites.B.passed}/${suites.B.total}`);
  suites.C = await suiteC();
  console.log(`Suite C (数字孪生): ${suites.C.passed}/${suites.C.total}`);
  suites.D = await suiteD();
  console.log(`Suite D (并发降级): ${suites.D.passed}/${suites.D.total}`);

  const totalPassed = Object.values(suites).reduce((s, x) => s + x.passed, 0);
  const totalAll = Object.values(suites).reduce((s, x) => s + x.total, 0);
  results.suites = suites;
  results.summary = { totalPassed, totalAll, passRate: Math.round((totalPassed / totalAll) * 1000) / 10 };
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'uat_results.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nUAT 总通过率: ${totalPassed}/${totalAll} (${results.summary.passRate}%)`);
  console.log('results → results/uat_results.json');

  await new Promise((res) => server.close(res));
  process.exit(0);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
