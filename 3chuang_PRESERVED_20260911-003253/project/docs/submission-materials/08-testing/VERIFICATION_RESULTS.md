# 执行验证结果 (VERIFICATION_RESULTS)

> 本文件记录对"甬柜易算"项目执行的只读验证命令、退出码、通过/失败数量及失败原因。
> 验证日期：2026-07-11
> 验证环境：Windows + Node.js v18.18.2 + PowerShell
> 验证原则：不执行会清空数据库、reset、clean、强制回退、删除文件、自动提交、自动推送的命令。

---

## 一、验证命令总览

| # | 命令 | 目录 | 退出码 | 状态 | 备注 |
|---|------|------|--------|------|------|
| 1 | `npm run lint` | web-dashboard | 0 | PASS | 0 errors, 0 warnings |
| 2 | `npm test` | web-dashboard | 1 | PARTIAL_PASS | 76 测试中 75 通过, 1 失败 |
| 3 | `npm run build` | web-dashboard | 0 | PASS | 1630 模块, 18.86s 构建成功 |
| 4 | `npm run lint` | backend | 0 | PASS | 0 errors, 66 warnings (全为 no-unused-vars) |
| 5 | `npm test` | backend | 1 | CRASHED | 端口 3000 被占用导致进程崩溃 |

---

## 二、Web 端验证详情

### 2.1 Web Lint (ESLint)

- **命令**: `npm run lint` (eslint src --ext .js,.jsx --max-warnings 0)
- **退出码**: 0
- **结果**: PASS
- **详情**: 零错误、零警告，代码质量符合 ESLint 规则。

### 2.2 Web Unit Tests (Vitest)

- **命令**: `npm test` (vitest run)
- **退出码**: 1
- **结果**: PARTIAL_PASS
- **统计**: 21 个测试文件, 76 个测试用例, 75 通过, 1 失败
- **持续时间**: 4.16s

#### 失败测试详情

| 测试文件 | 测试名称 | 失败原因 |
|----------|----------|----------|
| `src/domain/report/reportBuilders.test.js` | `report builders > builds one current-session model with explicit provenance` | provenance 字段不匹配: 期望 `order: 'demo-order-input'`, 实际 `order: 'official-demo-template'` |

**失败分析**: 测试期望的 provenance.order 值为 `'demo-order-input'`，但代码实际返回 `'official-demo-template'`。这表明演示模板的命名在代码中被更新（从 `demo-order-input` 改为 `official-demo-template`），但测试用例未同步更新。属于**测试与代码不同步**问题，非功能缺陷。

#### 通过的测试文件清单 (20/21)

| # | 测试文件 | 测试数 |
|---|----------|--------|
| 1 | `src/three/presentation/operationFilters.test.js` | 3 |
| 2 | `src/domain/cargo/cargo.test.js` | 5 |
| 3 | `src/three/operation/geometry.test.js` | 6 |
| 4 | `src/domain/cargo/csvImport.test.js` | 6 |
| 5 | `src/three/operation/operationMachine.test.js` | 9 |
| 6 | `src/domain/cargo/demoDataset.test.js` | 3 |
| 7 | `src/app/session/sessionStorage.test.js` | 3 |
| 8 | `src/domain/container/localPreview.test.js` | 3 |
| 9 | `src/app/session/sessionReducer.test.js` | 4 |
| 10 | `src/domain/compliance/evaluate.test.js` | 4 |
| 11 | `src/services/apiServices.test.js` | 3 |
| 12 | `src/domain/presentation/presentation.test.js` | 2 |
| 13 | `src/three/presentation/cameraPresets.test.js` | 1 |
| 14 | `src/three/scene/sceneDescriptors.test.js` | 4 |
| 15 | `src/components/visual/planProjectionModel.test.js` | 1 |
| 16 | `src/domain/cargo/templates.test.js` | 3 |
| 17 | `src/three/presentation/labelLayout.test.js` | 2 |
| 18 | `src/three/presentation/queueGroups.test.js` | 1 |
| 19 | `src/domain/cargo/appearance.test.js` | 7 |
| 20 | `src/three/cameraFrame.test.js` | 1 |

### 2.3 Web Build (Vite)

- **命令**: `npm run build` (vite build)
- **退出码**: 0
- **结果**: PASS
- **详情**: 1630 模块转换成功, 构建耗时 18.86s

#### 构建产物

| 文件 | 大小 | Gzip |
|------|------|------|
| `dist/index.html` | 0.56 kB | 0.37 kB |
| `dist/assets/index-BpQytNzQ.css` | 49.70 kB | 10.26 kB |
| `dist/assets/react-DfRugLdA.js` | 140.92 kB | 45.27 kB |
| `dist/assets/index-AoQtIfHd.js` | 236.16 kB | 76.25 kB |
| `dist/assets/three-CVxQgN_M.js` | 497.57 kB | 125.27 kB |

---

## 三、后端验证详情

### 3.1 Backend Lint (ESLint)

- **命令**: `npm run lint` (eslint . --ext .js --ignore-pattern node_modules/ --ignore-pattern scripts/_archive/)
- **退出码**: 0
- **结果**: PASS
- **统计**: 0 errors, 66 warnings
- **警告类型**: 全部为 `no-unused-vars` (未使用的变量/参数)

#### 警告分布

| 目录 | 警告数 | 主要问题 |
|------|--------|----------|
| `__tests__/` | ~15 | 测试中未使用的 index/position/key 参数 |
| `services/` | ~25 | AIComplianceService/AIPackingService/LayeredPackingEngine 等未使用变量 |
| `routes/` | ~8 | cargo.js/ai-packing.js 中未使用的导入和变量 |
| `middleware/` | 1 | errorHandler.js 中未使用的 next 参数 |
| `server.js` | 1 | 未使用的 db 导入 |
| `scripts/` | 2 | 未使用的 response/packageJson 变量 |

### 3.2 Backend Tests (Jest)

- **命令**: `npm test` (jest --runInBand --detectOpenHandles)
- **退出码**: 1
- **结果**: CRASHED (进程异常终止)
- **崩溃原因**: `Error: listen EADDRINUSE: address already in use :::3000`

#### 崩溃详情

崩溃发生在 `__tests__/roadshow/ai-packing-demo.test.js` 第 20 行，该测试直接 `require('../server.js')`，导致 Express 尝试在端口 3000 上监听，但该端口已被占用（可能有另一个服务或之前的进程仍在运行）。

```
Error: listen EADDRINUSE: address already in use :::3000
    at Server.setupListenHandle [as _listen2] (node:net:1817:16)
    at listenInCluster (node:net:1865:12)
    at Server.listen (node:net:1953:7)
    at Function.listen (D:\cixing\3chuang\backend\node_modules\express\lib\application.js:635:24)
    at Object.listen (D:\cixing\3chuang\backend\server.js:37:16)
    at Object.require (D:\cixing\3chuang\backend\__tests__\roadshow\ai-packing-demo.test.js:20:13)
```

#### 崩溃前的测试执行情况

由于进程在 Jest 输出最终汇总前崩溃，无法获得完整的通过/失败统计。基于日志中 PASS/FAIL 标记的统计：

| 指标 | 数量 | 备注 |
|------|------|------|
| PASS 测试套件 | ≥18 | 在崩溃前已完成并通过 |
| FAIL 测试套件 | ≥8 | 含崩溃的 ai-packing-demo.test.js |

#### 已确认通过的测试套件 (部分)

- `__tests__/setup/test-data-generators.test.js` - PASS
- `__tests__/unit/OptimizedPackingEngine-Task6-LoadDistribution.test.js` - PASS
- `__tests__/unit/OptimizedPackingEngine-Task12-DebugMode.test.js` - PASS
- `__tests__/unit/ai-semantic-cache-offline.test.js` - PASS
- `__tests__/unit/OptimizedPackingEngine-Task9.test.js` - PASS
- `__tests__/unit/algorithm-orchestrator.test.js` - PASS (27.479s)
- `__tests__/unit/PackingEngine-SpaceAndCOG.test.js` - PASS
- `__tests__/unit/OptimizedPackingEngine-Preprocessing.test.js` - PASS
- `__tests__/unit/ai-recommend-container.test.js` - PASS
- `__tests__/unit/ai-strategy-explain.test.js` - PASS (8.551s)

#### 已确认失败的测试套件 (部分)

| 测试文件 | 失败原因 |
|----------|----------|
| `__tests__/unit/NingboPortSafetyEngine-v25.test.js` | `validatePressure > should pass when no heavy cargo on fragile cargo` 断言失败 |
| `__tests__/unit/StackManager.test.js` | 具体失败原因未在截取日志中显示 |
| `__tests__/integration/system-integration.test.js` | 装箱失败: `Packing failed` (65.404s) |
| `__tests__/unit/DBLFPackingEngine-v25-CoG.test.js` | Test suite failed to run |
| `__tests__/unit/OptimizedPackingEngine-Task3.test.js` | 具体失败原因未在截取日志中显示 |
| `__tests__/unit/DBLFPackingEngine-v25-SnapToNeighbors.test.js` | Test suite failed to run |
| `__tests__/integration/server.test.js` | 可能与端口占用相关 |
| `__tests__/integration/packing.test.js` | Test suite failed to run |
| `__tests__/unit/OptimizedPackingEngine-Task10-StackLevel.test.js` | 具体失败原因未在截取日志中显示 |
| `__tests__/roadshow/ai-packing-demo.test.js` | EADDRINUSE 崩溃 |

---

## 四、环境与依赖问题

### 4.1 端口占用 (EADDRINUSE)

- **问题**: 端口 3000 被占用，导致 `ai-packing-demo.test.js` 崩溃
- **影响**: 后端测试套件无法完整运行，Jest 无法输出最终汇总
- **修复建议**: 
  1. 在测试中 mock `server.listen` 或使用 `beforeAll` 中设置 `PORT` 环境变量为其他端口
  2. 或将 `server.js` 的 `listen` 调用提取为可条件控制的导出
  3. 或在运行测试前确保端口 3000 空闲

### 4.2 可能的数据库依赖

- 后端部分集成测试可能依赖 MySQL 数据库连接
- 当前环境未确认 MySQL 可用性
- 如果数据库不可用，部分测试可能因连接超时而失败

### 4.3 AI API Key 依赖

- `AIComplianceService` 和 `AIPackingService` 依赖 `AI_API_KEY` 环境变量
- 测试中包含降级逻辑（无 Key 时走本地模板），但部分测试可能期望真实 API 响应
- 当前环境未确认 API Key 可用性

---

## 五、验证结论

### 5.1 可信事实

| 事实 | 状态 | 证据 |
|------|------|------|
| Web 前端代码通过 ESLint 检查 | VERIFIED | exit code 0, 0 errors |
| Web 前端可成功构建生产包 | VERIFIED | exit code 0, 1630 modules, dist/ 产出 |
| Web 前端 75/76 单元测试通过 | VERIFIED | Vitest 输出 1 failed, 75 passed |
| Web 前端 reportBuilders 测试与代码不同步 | VERIFIED | provenance.order 值不匹配 |
| 后端代码通过 ESLint 检查 (0 errors) | VERIFIED | exit code 0, 66 warnings (全为 unused-vars) |
| 后端测试因端口占用无法完整运行 | VERIFIED | EADDRINUSE 崩溃, exit code 1 |
| 后端至少 18 个测试套件通过 | IMPLEMENTED_UNVERIFIED | 日志中确认 18 个 PASS, 但无最终汇总 |
| 后端至少 8 个测试套件失败 | VERIFIED | 日志中确认 FAIL 标记 |

### 5.2 不可信/无法确认的内容

| 内容 | 原因 |
|------|------|
| 后端测试的完整通过/失败数量 | 进程崩溃前未输出 Jest 汇总 |
| 后端测试的准确失败原因 | 部分套件仅显示 "Test suite failed to run" |
| 数据库相关测试是否通过 | 环境中 MySQL 可用性未确认 |
| AI 相关测试是否通过 | 环境中 API Key 可用性未确认 |
| Playwright E2E 测试结果 | 未执行 (需要浏览器环境且可能需要运行中的服务) |

### 5.3 未执行的验证

| 验证项 | 未执行原因 |
|--------|------------|
| Playwright E2E | 需要浏览器环境和运行中的前后端服务 |
| 后端完整 Jest 测试 | 端口 3000 被占用导致进程崩溃 |
| 小程序构建 | 需要微信开发者工具环境 |
| 性能基准测试 | 需要完整的运行环境和数据库 |

---

## 六、对申报材料的影响

### 6.1 可用于申报的事实

- **Web 端**: lint 零错误 + build 成功 + 75/76 测试通过，可作为前端工程质量证据
- **后端**: lint 零错误 + 至少 18 个测试套件通过，可部分作为后端工程质量证据

### 6.2 需谨慎措辞的内容

- **后端测试总数**: 不得引用"811 测试全通过"等旧版数据，当前实际无法确认完整通过数量
- **测试覆盖率**: 当前环境无法生成覆盖率报告，不得编造数字
- **E2E 测试**: 未执行，不得声称"端到端测试全部通过"

### 6.3 需要在演示前修复的问题

1. **P0**: 修复 `ai-packing-demo.test.js` 的端口占用问题（mock server.listen 或使用 TEST_PORT）
2. **P1**: 同步 `reportBuilders.test.js` 中的 provenance.order 期望值
3. **P1**: 排查 `DBLFPackingEngine-v25-CoG.test.js` 和 `DBLFPackingEngine-v25-SnapToNeighbors.test.js` 的 "Test suite failed to run" 原因
4. **P2**: 清理后端 66 个 `no-unused-vars` 警告
