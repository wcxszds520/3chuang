# MISSING_FILES

本文用途：记录本轮生成 NotebookLM 来源文档时未能读取或主动跳过的资料，避免后续资料包误把缺失内容当作已确认事实。

## 缺失文件

| 要求读取项 | 状态 | 处理方式 |
|---|---|---|
| `README.md` | 未在项目根目录发现 | 不编造 README 内容；项目概述以最新复测报告、后端 README、前端代码结构和导演稿为准 |

## 主动跳过的敏感类文件

| 文件 | 原因 | 处理方式 |
|---|---|---|
| `docs/final_product_integration/SECRET_ENV_CHECK.md` | 文件名涉及密钥/环境检查，任务明确要求不读取、不复制、不输出任何 `.env`、API Key、token、密钥 | 仅记录“已跳过”，不引用其中内容 |
| `.env`、`.env.*` | 敏感配置文件 | 本轮未读取 |

## 已确认存在的核心资料目录

- `docs/final_product_integration/`
- `docs/advanced_open_design_web/`
- `docs/advanced_optimization/`
- `outputs/ppt_director_master/`
- `outputs/ppt_director_master/pilot_5_pages/`
- `outputs/ppt_director_master/final_13_pages/`
- `web-dashboard/src/`
- `backend/`
- `tools/`
