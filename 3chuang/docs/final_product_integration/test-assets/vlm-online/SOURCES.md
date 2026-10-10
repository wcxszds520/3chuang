# VLM 在线真实货物图片来源清单

下载时间：2026-07-01 01:54:08 +08:00

用途：仅用于甬柜易算最终真实产品级联调中的内部 VLM 识图测试，不作为产品素材发布，不作为网页背景，不用于商业传播。

| 文件名 | 原图 URL | 来源网站 | 图片用途 | 是否用于内部测试 | 注意事项 |
|---|---|---|---|---|---|
| `carton_box.jpg` | https://upload.wikimedia.org/wikipedia/commons/1/1e/UNICEF_pallets_02.jpg | Wikimedia Commons: https://commons.wikimedia.org/wiki/File:UNICEF_pallets_02.jpg | 普通纸箱货物 / carton boxes on pallets | 是 | 公开可访问图片；已目视检查，不是 UI/PPT/设计稿截图，无明显水印或人脸隐私。 |
| `labeled_carton.jpg` | https://upload.wikimedia.org/wikipedia/commons/d/d4/Warehouse_Terrada_minikura_Library_box.jpg | Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Warehouse_Terrada_minikura_Library_box.jpg | 带标签或唛头纸箱 / labeled carton | 是 | 公开可访问图片；已目视检查，不是 UI/PPT/设计稿截图，无明显水印或人脸隐私。 |
| `pallet_wood.jpg` | https://upload.wikimedia.org/wikipedia/commons/e/e4/Canada_ISPM_pallet.jpg | Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Canada_ISPM_pallet.jpg | 木托盘 / IPPC 木包装风险识别 | 是 | 公开可访问图片；已目视检查，不是 UI/PPT/设计稿截图，无明显水印或人脸隐私。 |
| `warehouse_mixed_goods.jpg` | https://upload.wikimedia.org/wikipedia/commons/c/c7/Warehouse_goods.jpg | Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Warehouse_goods.jpg | 仓库多件货物 / mixed warehouse goods | 是 | 公开可访问图片；已目视检查，不是 UI/PPT/设计稿截图，无明显水印或人脸隐私。 |
| `wrapped_pallet.jpg` | https://upload.wikimedia.org/wikipedia/commons/0/0a/Pallet_wrapper.jpg | Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Pallet_wrapper.jpg | 缠绕膜托盘货物 / stretch-wrapped pallet or wrapper scene | 是 | 公开可访问图片；已目视检查，不是 UI/PPT/设计稿截图，无明显水印或人脸隐私。 |

## 测试集说明

- `carton_box.jpg`：普通纸箱/纸箱托盘，用于验证 carton、label、stackable 等字段。
- `pallet_wood.jpg`：木托盘和 IPPC 标识，用于验证 wood packaging / IPPC 风险识别。
- `wrapped_pallet.jpg`：缠绕膜托盘货物，用于验证 wrapped_pallet、pallet、stackable。
- `labeled_carton.jpg`：带品牌/标签纸箱，用于验证 visible_label_text 和 fragile/manual_review 识别。
- `warehouse_mixed_goods.jpg`：仓库多件货物，用于验证 mixed goods、pallet、barcode/label 的综合识别。

## 使用边界

- 不用于网页背景。
- 不用于替代真实 VLM 调用结果。
- VLM 失败时必须记录真实失败，不得用这些图片的人工描述冒充模型输出。
- 若后续发现来源授权或隐私风险，应立即替换图片并更新本清单。
