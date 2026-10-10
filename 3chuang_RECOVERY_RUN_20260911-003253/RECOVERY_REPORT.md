# PORTCUBE 旧版本恢复核对

本轮只恢复指定候选版本，未切换主目录。代码与可核实资产已恢复；不能称为当时完整数据库、密钥配置和浏览器会话的全量恢复。等待用户确认“这就是要恢复的版本”。

1. **实际来源**：2026-09-10 17:26:56–17:27:03（北京时间）的 `tmp/rebuild-start-20260910-172656`，基准提交 `a175aea9a902c094733ed486d49348f4aca98e1b`。已找到当时实际生成命令，确认它使用工作区 `git diff --binary`，并将修改文件和未忽略的未跟踪文件打包。快照不是完整目录副本。
2. **恢复完整性**：没有暂存改动；32 个修改项全部在 ZIP 中。基准提交＋一次工作区补丁＋159 个 ZIP 文件已还原，104 个明确记录的删除项已还原。ZIP 全部 SHA-256 一致，恢复版 Git 状态与快照状态逐项一致。PowerShell 写入补丁带来的 CRLF 在工作副本中规范化后应用；原补丁未改。36 个 GLB、24 个 Blend 源文件已恢复；GLB 结构和 Git/ZIP 来源均已核对，代码中的静态资产引用无缺失。
3. **恢复目录与启动**：`D:\cixing\3chuang_RECOVERED_20260911-003253`。访问 [恢复版首页](http://127.0.0.1:14173/)；后端仅使用 13000 端口。日后可运行本目录的 [Start-Recovered.ps1](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/Start-Recovered.ps1)。隔离运行脚本和报告放在恢复代码目录之外，没有改动旧实现。
4. **数据恢复程度**：没有找到快照时代的完整数据库备份。当前数据库已导出 402,860,125 字节，并复制到独立库 `portcube_recovery_20260911_003253` 作兼容性核对；运行账号只有此库权限。它含当前数据，不能当作重构前数据库。其保留的历史方案 `REQ_1789015704635` 创建于 2026-09-10 12:49:21（北京时间），布局哈希 `155f34bf236fc0c8`，与快照旧结果逐货物核对 cargoId、坐标、尺寸和重量完全一致：212 件、8,623 kg。未重新求解。
5. **浏览器与配置**：已将原 5173、4173 标签的 localStorage/sessionStorage 导出到现场备份后关闭标签，两来源无 IndexedDB 数据库。验收使用独立的 Codex 浏览器和新来源 14173。当前核对会话由快照的原 212 输入＋上述真实历史方案通过旧版现有加载/序列化函数载入，不是找回了原浏览器的完整会话历史。旧加载函数补入 `palletJackCompatible=false` 默认值，未改尺寸、数量、重量或其他约束。快照没有包含被忽略的本地 `.env`、全部缓存/临时数据与浏览器配置；其当时内容无法证明，当前版本仅在现场备份中保护。恢复目录未混入当前密钥配置，在线 AI/TTS 未验证。
6. **保护现场**：原项目 `D:\cixing\3chuang` 和原快照未覆盖。现场副本位于 `D:\cixing\3chuang_PRESERVED_20260911-003253\project`，包括 `.git`、配置、锁文件、所有未跟踪文件、现有快照、模型及贴图；38,539 个文件哈希全部匹配。两处依赖目录 junction 的原目标已记录，备份内链接改指向备份自身对应目录。只停止已核实的本项目 3000/5173 服务，未停止共享 MySQL 或其他项目服务。当前数据库和原浏览器数据未清空。

## 实际验证与截图

前后端依赖均按各自旧锁文件执行 `npm ci`，未升级或运行 audit fix；生产构建和隔离后端健康检查通过。页面和 GLB 实际响应来自恢复目录的 `web-dashboard/dist`，使用新端口并禁用静态缓存；没有新版多柜入口。未运行全量回归或性能基准。

该候选快照本身已将默认演示改为 **42 件现场作业案例**；这项旧状态被忠实保留。原 212 件案例另行恢复供核对。新浏览器如需载入它，可打开 [载入历史212案例](http://127.0.0.1:14173/_recovery-import-historical-212)。此链接只写恢复版 14173 来源的业务会话。

| 实际页面 / 模型 | 截图 |
|---|---|
| Landing | [首页全页](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/01-landing-full.png) |
| 工作台，历史 212 方案 | [工作台](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/11-workbench-historical-212.png) |
| 货物，10 SKU / 212 件 / 8,623 kg | [货物页](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/03-cargo-212.png) |
| 旧规划页面与三种柜型 | [规划页](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/12-planning-historical-212.png) |
| 旧集装箱及货物，原布局 155f34bf | [三维孪生](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/07-twin-historical-212.png) |
| 旧人员、叉车与作业场景 | [人员近景](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/08-old-actors.png)、[旧叉车](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/13-old-forklift.png)、[作业场景](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/09-old-operation-assets.png) |
| 历史出运准备与证据 | [证据页面](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/screenshots/10-historical-evidence.png) |

旧版在本次窄视口下工具栏纵向排列、部分深色 HUD 文字对比度偏低，均保留原样。定向查看第 58 件叉车作业时，旧回放按原有地牛底座/叉孔规则阻断；已记录截图，未跳过、修改货物或修复逻辑。历史证据中的 7 项待处理及原重心指导数值也保留，不作顺手修复。交付页面已返回完整 212 方案，回放停止。

## 本机证据文件

- [ZIP 文件逐项校验](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/snapshot-file-verification.json)
- [旧资产来源与结构校验](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/asset-verification.json)
- [历史212方案与会话来源](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/historical-212-session-provenance.json)
- [数据库副本性质说明](D:/cixing/3chuang_RECOVERY_RUN_20260911-003253/database-provenance.json)
- [现场文件哈希清单](D:/cixing/3chuang_PRESERVED_20260911-003253/evidence/preservation-sha256.json)

本机现存 `backend/.env` 的最后修改时间为 2026-06-30 18:05:18，已完整保护；由于未包含在当时快照中，未把文件日期单独作为旧配置内容的完整证明。最终只读目录对比显示原项目 38,539 个文件全部未变化，0 个新增差异、0 个内容/时间差异。

不进行主目录切换，不继续产品开发。
