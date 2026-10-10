# Web RAG Enhancement Report

生成时间：2026-06-30T10:15:44.017Z

## 结论

- 是否接入 Tavily：否，当前环境未配置 TAVILY_API_KEY。
- 本地 RAG：9/9 关键词通过。
- Hybrid RAG：9/9 查询返回本地证据。
- 联网/缓存参考：9/9 查询返回公开网页参考；9 条使用缓存快照。
- 边界说明：本地法规证据库是主证据；公开网页参考用于补充展示；缓存快照不等同实时联网检索。

## 本地 RAG 关键词检查

| 关键词 | 结果 | 命中文档 | 命中章节 | 分数 |
| --- | --- | --- | --- | ---: |
| VGM | PASS | solas_vgm | VI-2.2 VGM 允许误差 | 0.302 |
| SOLAS | PASS | solas_vgm | VI-2.1 VGM 强制申报 | 0.164 |
| CTU | PASS | ctu_code | 3.2 CTU 60/50 规则 | 0.19 |
| LIFO | PASS | ctu_code | 4.1 装载顺序与可达性 | 0.163 |
| 重心 | PASS | ctu_code | 3.1 重量分布原则 | 0.332 |
| IPPC | PASS | jtt1187 | 6.1 木质包装 IPPC | 0.31 |
| 木包装 | PASS | jtt1187 | 6.1 木质包装 IPPC | 0.084 |
| 单证一致性 | PASS | gb40163 | 6.1 记录与单证 | 0.07 |
| 危险品 | PASS | gb40163 | 5.3 装箱与封箱操作 | 0.221 |

## Hybrid RAG 检查

| Query | 本地结果 | 公开网页参考 | 缓存 | 来源 | Top Web Sources |
| --- | ---: | ---: | --- | --- | --- |
| SOLAS VGM | 3 | 1 | cache_used | curated_public_web_cache | imo.org(official) |
| CTU Code container packing | 3 | 3 | cache_used | curated_public_web_cache | imo.org(official), unece.org(official) |
| IPPC wood packaging ISPM 15 | 3 | 2 | cache_used | curated_public_web_cache | ippc.int(official), help.cbp.gov(official) |
| container weight distribution center of gravity | 3 | 2 | cache_used | curated_public_web_cache | wiki.unece.org(official), cma-cgm.com(industry) |
| container packing dangerous goods | 3 | 2 | cache_used | curated_public_web_cache | imo.org(official), unece.org(official) |
| 集装箱 装箱 单证 一致性 | 3 | 2 | cache_used | curated_public_web_cache | imo.org(official), imo.org(official) |
| 木包装 IPPC 熏蒸 标识 | 3 | 2 | cache_used | curated_public_web_cache | ippc.int(official), help.cbp.gov(official) |
| 集装箱 偏载 重心 | 3 | 2 | cache_used | curated_public_web_cache | wiki.unece.org(official), cma-cgm.com(industry) |
| VGM 申报 误差 | 3 | 1 | cache_used | curated_public_web_cache | imo.org(official) |

## 前端展示要求

- 合规页必须显示“本地法规证据库”和“联网参考/缓存快照”的分层。
- 无 Tavily key 时，不得写实时联网国标检索。
- 报告和讲解词可以说：公开网页参考已缓存，用于录屏稳定。

## 最终话术建议

本系统先用本地法规证据库做稳定可追溯的主证据，再用公开网页缓存作为补充参考；如果现场网络或 Tavily key 不可用，系统仍能明确显示本地证据，不会假装联网成功。
