# VLM Stability Repair Report

生成时间：2026-06-30T10:11:54.109Z

## 统一结论

- VLM 状态：available=true
- 模型：Qwen/Qwen3-VL-32B-Instruct
- 后端直连：5/5 张图片至少一次成功；4 张图片连续两次成功。
- 最佳录屏图片：labeled_carton.jpg
- 备用录屏图片：pallet_wood.jpg, wrapped_pallet.jpg, warehouse_mixed_goods.jpg, carton_box.jpg
- 是否存在假成功：否。失败图片保留错误码，不生成识别数据。

## 逐图测试表

| 图片 | 结果 | 成功次数 | 最长耗时 | 评分/10 | 识别摘要 | 失败原因 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| carton_box.jpg | BACKUP_CANDIDATE | 1/2 | 90242ms | 8.6 | 纸箱装衣物及家居用品 / carton / confidence=0.9 | VLM_TIMEOUT VLM recognition failed, manual input required |
| labeled_carton.jpg | BEST_CANDIDATE | 2/2 | 27024ms | 9.8 | minikura Library 储物箱 / carton / confidence=0.85 | - |
| pallet_wood.jpg | BEST_CANDIDATE | 2/2 | 11476ms | 9.7 | 木托盘 / pallet / confidence=0.85 | - |
| warehouse_mixed_goods.jpg | BEST_CANDIDATE | 2/2 | 24102ms | 8.8 | 纸箱装货物 / carton / confidence=0.4 | - |
| wrapped_pallet.jpg | BEST_CANDIDATE | 2/2 | 16912ms | 9.2 | 果汁瓶装饮料及杂货混合货物 / mixed / confidence=0.6 | - |

## 后端直接调用结果

### carton_box.jpg
- Attempt 1: FAIL，耗时 90242ms，code=502，error=VLM_TIMEOUT。
- Attempt 2: PASS，耗时 32204ms，code=200，error=-。

### labeled_carton.jpg
- Attempt 1: PASS，耗时 27024ms，code=200，error=-。
- Attempt 2: PASS，耗时 14232ms，code=200，error=-。

### pallet_wood.jpg
- Attempt 1: PASS，耗时 11476ms，code=200，error=-。
- Attempt 2: PASS，耗时 8986ms，code=200，error=-。

### warehouse_mixed_goods.jpg
- Attempt 1: PASS，耗时 15824ms，code=200，error=-。
- Attempt 2: PASS，耗时 24102ms，code=200，error=-。

### wrapped_pallet.jpg
- Attempt 1: PASS，耗时 16912ms，code=200，error=-。
- Attempt 2: PASS，耗时 10432ms，code=200，error=-。

## 前端上传结果

最近一次 Playwright 记录：PASS，文件 docs/final_product_integration/test-assets/vlm-online/pallet_wood.jpg，接口调用 1 次。

## 推荐

- 最佳录屏图片：labeled_carton.jpg
- 备用录屏图片：pallet_wood.jpg, wrapped_pallet.jpg, warehouse_mixed_goods.jpg, carton_box.jpg
- 不推荐图片：暂无

## 最终建议

可以进入录屏，但录屏前仍需按 15 分钟检查清单重新跑一次最佳图片。
