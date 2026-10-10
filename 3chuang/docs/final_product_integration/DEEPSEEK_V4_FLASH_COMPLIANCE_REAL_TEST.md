# DeepSeek V4 Flash AI 合规审计真实测试

生成时间：2026-06-30T18:09:22.870Z

## 结论

- 模型：`deepseek-v4-flash`
- 合规结论：`本地规则 WARNING / AI建议 PASS / 人工复核独立`
- AI 来源：`aiAdviceSource=ai`
- 覆盖项：VGM=PASS，LIFO=PASS，重心=PASS，IPPC=PASS，单证=PASS
- 与前端口径：前端按本地规则、AI 建议和人工复核分层显示，各层状态互不覆盖。

## 请求摘要

- 订单号：NB2026-DEMO-01
- 柜型：40HQ
- 已装入：221
- 未装入：0 件
- 空间利用率：84.51%
- 总重量：8,812 kg

## 边界

AI 只做合规解释与建议，不决定物理坐标，不替代装箱算法。失败时前端显示真实失败/降级原因，不展示成功。
