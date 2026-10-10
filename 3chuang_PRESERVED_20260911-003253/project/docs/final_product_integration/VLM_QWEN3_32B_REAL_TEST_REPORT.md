# Qwen3-VL-32B VLM 真实识图专项报告

生成时间：2026-06-30T18:09:22.870Z

## 结论

`Qwen/Qwen3-VL-32B-Instruct` 已真实调用，5 张公开货物图片中 5 张通过。前端 E2E 使用 `pallet_wood.jpg` 上传识别通过，并把真实结构化结果写入表单/待确认区域。

最佳录屏图片：`pallet_wood.jpg`。原因：返回 `is_wood_packaging=true`，适合讲 VLM 发现木质包装/IPPC 风险。

## 后端逐图结果

| 图片 | 结果 | 耗时 | 模型 | 识别货物 | 包装 | 木包装 | 风险标记 | 评分/10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| carton_box.jpg | PASS | 11044ms | Qwen/Qwen3-VL-32B-Instruct | UNICEF纸箱装货物 | pallet | true | wood_packaging_missing_ippc | 8.8 |
| labeled_carton.jpg | PASS | 19140ms | Qwen/Qwen3-VL-32B-Instruct | minikura Library 储物箱 | carton | false | fragile | 9.6 |
| pallet_wood.jpg | PASS | 21234ms | Qwen/Qwen3-VL-32B-Instruct | 木托盘 | pallet | true | - | 9.8 |
| warehouse_mixed_goods.jpg | PASS | 21666ms | Qwen/Qwen3-VL-32B-Instruct | 纸箱装货物 | pallet | true | wood_packaging_missing_ippc | 8.4 |
| wrapped_pallet.jpg | PASS | 17290ms | Qwen/Qwen3-VL-32B-Instruct | UNICEF援助物资箱 | wrapped_pallet | true | wood_packaging_missing_ippc | 9.4 |

## 前端上传测试

| 动作 | 文件 | 结果 | 接口调用 |
| --- | --- | --- | --- |
| VLM 上传识别 | docs/final_product_integration/test-assets/vlm-online/pallet_wood.jpg | PASS | POST /api/vlm/recognize-cargo 200 |

## 注意

本轮 5 张图均返回结构化 data；录屏仍建议优先选 `pallet_wood.jpg`，因为木托/IPPC 风险讲解最清楚。
