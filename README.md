# 3chuang（PORTCUBE · 智港立方）项目归档

本仓库是 PORTCUBE（智港立方）集装箱装载数字孪生决策平台相关工作目录的**源码归档**，一个仓库集中保存四个目录。

## 目录结构

| 目录 | 说明 |
| --- | --- |
| `3chuang/` | 主工作目录（当前开发用） |
| `3chuang_PRESERVED_20260911-003253/` | 2026-09-11 数据恢复时的保留快照（含 `project/`、`browser/`、`evidence/`、`database/`） |
| `3chuang_RECOVERED_20260911-003253/` | 恢复后的权威源码树（当前实际运行/实测使用） |
| `3chuang_RECOVERY_RUN_20260911-003253/` | 恢复过程记录（日志、校验 JSON、历史方案样本、恢复脚本） |

## 归档口径（重要）

本仓库**只包含源码、配置与文档**。以下内容因体积过大或可由源码重新生成而**未纳入**：

- 依赖与构建产物：`node_modules/`、`dist/`、`build/`
- 工作产物：`output/`、`outputs/`、`tmp/`、`artifacts/`
- Blender 工程源文件：`assets-src/`（`.blend` / `.blend1`）
- 数据库转储与三维模型：`database/*.sql`、`*.glb`、`*.gltf`、`*.bin`
- 压缩包与安装程序：`*.zip`、`*.exe` 等
- 助手/编辑器内部状态：`.workbuddy/`、`.codex/`、`.vscode/` 等

> 三维模型可按 `assets-src/blender/` 下的工程文件配合资产管线重新导出；
> 数据库可用 `backend/` 内的建表脚本与配置重建。

## 关于原来的 `.git` 目录

`3chuang/`、`3chuang_PRESERVED_20260911-003253/project/`、`3chuang_RECOVERED_20260911-003253/` 三个目录原本各自带有独立 `.git`。为避免 Git 把它们当作子模块（导致文件无法上传），上传前已将其临时移出。

- 原独立仓库仍完整保留在 Gitee：`https://gitee.com/wangcixuan/3chuang.git`
- 如需恢复本地独立仓库状态，把移出的 `.git` 目录放回原位即可。

## 快速开始（以 RECOVERED 为例）

```bash
cd 3chuang_RECOVERED_20260911-003253
# 后端（3000）：需先补 backend/.env 才能落库
node server.js
# 前端（5173）
node node_modules/vite/bin/vite.js --host 127.0.0.1
```

依赖需自行安装（`npm install`），本仓库未包含 `node_modules`。
